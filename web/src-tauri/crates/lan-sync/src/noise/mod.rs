//! Noise channel of the LAN sync (`snow`, pure Rust: ChaChaPoly, BLAKE2s, X25519; no ring resolver).
//!
//! * Pairing: `Noise_IKpsk1_25519_ChaChaPoly_BLAKE2s`, the PSK is the single-use pairing secret.
//! * Session: `Noise_IK_25519_ChaChaPoly_BLAKE2s`, only keys of the trust list get a session.
//! * Input session (remote control): the same `IK` pattern with its own mode byte in the prologue.
//! * Prologue = `nemo-lan-sync/1 || mode`, so message 1 of one mode never opens in the other.
//! * Only `TransportState` is used, never the stateless variant (nonces stay strictly ordered).
//!
//! KCI: whoever holds the hub's private key can also impersonate any device *to the hub*. That is
//! accepted (a compromised hub PC already holds all data); the hub key never leaves the OS keystore.
//!
//! Nothing here logs. Keys and secrets have no `Clone`/`Display`/`Serialize`, `Debug` is redacted,
//! and every secret buffer is zeroized on drop. A rejected initiator's static key is never kept:
//! the remote key is read only after `read_message` returned `Ok` and the failed handshake state
//! is dropped at once.

pub mod frame;

use frame::{
    FrameError, INPUT_CAP, MAX_FRAME, MODE_INPUT, MODE_PAIR, MODE_SESSION, NOISE_M1_LEN,
    PRE_CONFIRM_CAP, PRE_HANDSHAKE_CAP, PROLOGUE_BASE, TAG_UNKNOWN_DEVICE, WIRE_M1_LEN,
};
use snow::params::DHChoice;
use snow::resolvers::{CryptoResolver, DefaultResolver};
use snow::{Builder, HandshakeState, TransportState};
use std::fmt;
use zeroize::Zeroizing;

const PATTERN_PAIR: &str = "Noise_IKpsk1_25519_ChaChaPoly_BLAKE2s";
const PATTERN_SESSION: &str = "Noise_IK_25519_ChaChaPoly_BLAKE2s";
/// `psk1`: mixed in at the end of message 1.
const PSK_LOCATION: u8 = 1;

/// Which handshake a first message asks for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Pair,
    /// Sync session.
    Session,
    /// Remote-control input session (`crate::input`): same pattern and keys as a sync session, its
    /// own prologue byte.
    Input,
}

impl Mode {
    fn byte(self) -> u8 {
        match self {
            Mode::Pair => MODE_PAIR,
            Mode::Session => MODE_SESSION,
            Mode::Input => MODE_INPUT,
        }
    }
    fn from_byte(b: u8) -> Option<Mode> {
        match b {
            MODE_PAIR => Some(Mode::Pair),
            MODE_SESSION => Some(Mode::Session),
            MODE_INPUT => Some(Mode::Input),
            _ => None,
        }
    }
    fn pattern(self) -> &'static str {
        match self {
            Mode::Pair => PATTERN_PAIR,
            Mode::Session | Mode::Input => PATTERN_SESSION,
        }
    }
    fn prologue(self) -> Vec<u8> {
        let mut p = PROLOGUE_BASE.to_vec();
        p.push(self.byte());
        p
    }
}

/// X25519 public key (32 bytes). Not secret, but `Debug` stays redacted like the rest.
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct PublicKey([u8; 32]);

impl PublicKey {
    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        PublicKey(bytes)
    }
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

impl fmt::Debug for PublicKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("PublicKey(..)")
    }
}

/// Static X25519 key pair of a device. Storage is the OS keystore (CONCEPT §3), never IndexedDB or
/// a backup. No `Clone`, no `Serialize`, no `Display`; zeroized on drop.
pub struct StaticKey {
    secret: Zeroizing<[u8; 32]>,
    public: PublicKey,
}

impl StaticKey {
    /// Fresh random key pair.
    pub fn generate() -> Result<Self, KeyError> {
        let mut secret = Zeroizing::new([0u8; 32]);
        getrandom::fill(&mut *secret).map_err(|_| KeyError::Rng)?;
        Self::from_secret_bytes(secret)
    }

    /// Rebuilds the pair from stored secret bytes (key store use only).
    pub fn from_secret_bytes(secret: Zeroizing<[u8; 32]>) -> Result<Self, KeyError> {
        let mut dh = DefaultResolver
            .resolve_dh(&DHChoice::Curve25519)
            .ok_or(KeyError::Resolver)?;
        dh.set(&*secret);
        let mut public = [0u8; 32];
        public.copy_from_slice(dh.pubkey());
        Ok(StaticKey {
            secret,
            public: PublicKey(public),
        })
    }

    /// Copy of the secret for the key store; the caller zeroizes it (`Zeroizing`).
    pub fn to_secret_bytes(&self) -> Zeroizing<[u8; 32]> {
        Zeroizing::new(*self.secret)
    }

    pub fn public(&self) -> PublicKey {
        self.public
    }

    #[cfg(test)]
    pub(crate) fn secret_ptr(&self) -> *const u8 {
        self.secret.as_ptr()
    }
}

impl fmt::Debug for StaticKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("StaticKey(..)")
    }
}

/// Key creation failed. Carries no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyError {
    Rng,
    Resolver,
}

/// Pairing pre-shared key: the 16-byte single-use secret from the QR, zero-extended to the 32 bytes
/// Noise wants (the entropy is the 128 bits of the secret). No `Clone`; zeroized on drop.
pub struct Psk(Zeroizing<[u8; 32]>);

impl Psk {
    pub fn from_secret(secret: &[u8; 16]) -> Self {
        let mut k = Zeroizing::new([0u8; 32]);
        k[..16].copy_from_slice(secret);
        Psk(k)
    }

    #[cfg(test)]
    pub(crate) fn bytes(&self) -> &[u8; 32] {
        &self.0
    }

    #[cfg(test)]
    pub(crate) fn secret_ptr(&self) -> *const u8 {
        self.0.as_ptr()
    }
}

impl fmt::Debug for Psk {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Psk(..)")
    }
}

/// Six-digit short authentication string, from the handshake hash (same on both sides).
pub struct Sas(u32);

impl Sas {
    fn from_hash(hash: &[u8]) -> Self {
        let mut b = [0u8; 8];
        b.copy_from_slice(&hash[..8]);
        Sas((u64::from_be_bytes(b) % 1_000_000) as u32)
    }
    /// Six digits with leading zeros, for the screen.
    pub fn digits(&self) -> String {
        format!("{:06}", self.0)
    }
}

impl fmt::Debug for Sas {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Sas(..)")
    }
}

/// Why the hub dropped a first message without any reply. Carries no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandshakeDrop {
    TooLarge,
    BadLength,
    BadMode,
    Decrypt,
}

/// Initiator side failures. Carries no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InitError {
    /// Message 2 did not verify: the peer does not hold the hub key (impostor, wrong address).
    HubNotAuthentic,
    /// Message 2 verified but is not a valid reply.
    BadMessage,
    /// Pairing needs a PSK, a session must not have one.
    BadPsk,
    Internal,
}

/// Authenticated transport after a finished handshake.
pub struct Transport {
    state: TransportState,
    peer: PublicKey,
    mode: Mode,
    cap: usize,
}

impl Transport {
    fn new(state: TransportState, peer: PublicKey, mode: Mode) -> Self {
        Transport {
            state,
            peer,
            mode,
            cap: PRE_CONFIRM_CAP,
        }
    }

    pub fn peer(&self) -> PublicKey {
        self.peer
    }

    pub fn mode(&self) -> Mode {
        self.mode
    }

    /// Current cap on one wire message.
    pub fn cap(&self) -> usize {
        self.cap
    }

    /// Lifts the cap after the first authenticated frame was decrypted: a sync session to Noise's
    /// limit, an input session to [`INPUT_CAP`] (never more); a pairing connection keeps the small
    /// cap for good.
    pub fn raise_cap(&mut self) -> bool {
        match self.mode {
            Mode::Session => self.cap = MAX_FRAME,
            Mode::Input => self.cap = INPUT_CAP,
            Mode::Pair => return false,
        }
        true
    }

    /// Encrypts `tag || body`.
    pub fn seal(&mut self, tag: u8, body: &[u8]) -> Result<Vec<u8>, FrameError> {
        let mut plain = Zeroizing::new(Vec::with_capacity(1 + body.len()));
        plain.push(tag);
        plain.extend_from_slice(body);
        let wire_len = plain.len() + 16;
        if wire_len > self.cap {
            return Err(FrameError::TooLarge);
        }
        let mut out = vec![0u8; wire_len];
        let n = self
            .state
            .write_message(&plain, &mut out)
            .map_err(|_| FrameError::Encrypt)?;
        out.truncate(n);
        Ok(out)
    }

    /// Decrypts one wire message to `(tag, body)`. The size cap is checked before any crypto.
    pub fn open(&mut self, wire: &[u8]) -> Result<(u8, Zeroizing<Vec<u8>>), FrameError> {
        if wire.len() > self.cap {
            return Err(FrameError::TooLarge);
        }
        let mut plain = Zeroizing::new(vec![0u8; wire.len()]);
        let n = self
            .state
            .read_message(wire, &mut plain)
            .map_err(|_| FrameError::Decrypt)?;
        plain.truncate(n);
        let (tag, body) = frame::split(&plain)?;
        Ok((tag, Zeroizing::new(body.to_vec())))
    }
}

impl fmt::Debug for Transport {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Transport(..)")
    }
}

/// Initiator between message 1 and message 2.
pub struct Initiator {
    hs: HandshakeState,
    mode: Mode,
    hub: PublicKey,
}

impl fmt::Debug for Initiator {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Initiator(..)")
    }
}

/// Outcome of the initiator's second step.
#[derive(Debug)]
pub enum Finished {
    Established(Transport, Sas),
    /// The authenticated hub does not know this device (never paired or revoked: identical).
    Refused(Refusal),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Refusal {
    UnknownDevice,
}

/// Builds message 1. Pairing needs the PSK, a session must not pass one. Returns the wire message.
pub fn start_initiator(
    mode: Mode,
    own: &StaticKey,
    hub: &PublicKey,
    psk: Option<&Psk>,
) -> Result<(Initiator, Vec<u8>), InitError> {
    if (mode == Mode::Pair) != psk.is_some() {
        return Err(InitError::BadPsk);
    }
    let prologue = mode.prologue();
    let params = mode.pattern().parse().map_err(|_| InitError::Internal)?;
    let secret = own.to_secret_bytes();
    let mut b = Builder::new(params)
        .local_private_key(&*secret)
        .and_then(|b| b.remote_public_key(hub.as_bytes()))
        .and_then(|b| b.prologue(&prologue))
        .map_err(|_| InitError::Internal)?;
    if let Some(p) = psk {
        b = b.psk(PSK_LOCATION, &p.0).map_err(|_| InitError::Internal)?;
    }
    let mut hs = b.build_initiator().map_err(|_| InitError::Internal)?;
    let mut wire = vec![0u8; WIRE_M1_LEN];
    wire[0] = mode.byte();
    let n = hs
        .write_message(&[], &mut wire[1..])
        .map_err(|_| InitError::Internal)?;
    if n != NOISE_M1_LEN {
        return Err(InitError::Internal);
    }
    Ok((
        Initiator {
            hs,
            mode,
            hub: *hub,
        },
        wire,
    ))
}

impl Initiator {
    /// Reads message 2. A failure to verify means the peer is not the hub.
    pub fn finish(mut self, m2: &[u8]) -> Result<Finished, InitError> {
        if m2.len() > PRE_CONFIRM_CAP {
            return Err(InitError::BadMessage);
        }
        let mut payload = [0u8; PRE_CONFIRM_CAP];
        let n = self
            .hs
            .read_message(m2, &mut payload)
            .map_err(|_| InitError::HubNotAuthentic)?;
        if !self.hs.is_handshake_finished() {
            return Err(InitError::BadMessage);
        }
        match &payload[..n] {
            [] => {
                let sas = Sas::from_hash(self.hs.get_handshake_hash());
                let state = self
                    .hs
                    .into_transport_mode()
                    .map_err(|_| InitError::Internal)?;
                Ok(Finished::Established(
                    Transport::new(state, self.hub, self.mode),
                    sas,
                ))
            }
            [TAG_UNKNOWN_DEVICE] => Ok(Finished::Refused(Refusal::UnknownDevice)),
            _ => Err(InitError::BadMessage),
        }
    }
}

/// Hub after message 1 verified; the peer key is known and only now readable.
pub struct Responder1 {
    hs: HandshakeState,
    mode: Mode,
    peer: PublicKey,
}

impl fmt::Debug for Responder1 {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Responder1(..)")
    }
}

/// Hub: checks size, length and mode, then reads message 1. In pairing mode `psk` must be the
/// current secret; a wrong PSK, a wrong hub key or a swapped mode all end as `Decrypt`.
/// The caller replies to nothing on `Err`.
pub fn read_first(
    own: &StaticKey,
    wire: &[u8],
    psk: Option<&Psk>,
) -> Result<Responder1, HandshakeDrop> {
    if wire.len() > PRE_HANDSHAKE_CAP {
        return Err(HandshakeDrop::TooLarge);
    }
    if wire.len() != WIRE_M1_LEN {
        return Err(HandshakeDrop::BadLength);
    }
    let mode = Mode::from_byte(wire[0]).ok_or(HandshakeDrop::BadMode)?;
    if (mode == Mode::Pair) != psk.is_some() {
        return Err(HandshakeDrop::Decrypt);
    }
    let prologue = mode.prologue();
    let params = mode.pattern().parse().map_err(|_| HandshakeDrop::Decrypt)?;
    let secret = own.to_secret_bytes();
    let mut b = Builder::new(params)
        .local_private_key(&*secret)
        .and_then(|b| b.prologue(&prologue))
        .map_err(|_| HandshakeDrop::Decrypt)?;
    if let Some(p) = psk {
        b = b
            .psk(PSK_LOCATION, &p.0)
            .map_err(|_| HandshakeDrop::Decrypt)?;
    }
    let mut hs = b.build_responder().map_err(|_| HandshakeDrop::Decrypt)?;
    let mut payload = [0u8; NOISE_M1_LEN];
    // On failure `hs` is dropped here, before anything about the sender was read.
    hs.read_message(&wire[1..], &mut payload)
        .map_err(|_| HandshakeDrop::Decrypt)?;
    // Only after `read_message` returned Ok is the remote static key authentic to this hub.
    let mut peer = [0u8; 32];
    match hs.get_remote_static() {
        Some(k) if k.len() == 32 => peer.copy_from_slice(k),
        _ => return Err(HandshakeDrop::Decrypt),
    }
    Ok(Responder1 {
        hs,
        mode,
        peer: PublicKey(peer),
    })
}

impl Responder1 {
    pub fn mode(&self) -> Mode {
        self.mode
    }

    pub fn peer(&self) -> PublicKey {
        self.peer
    }

    /// Writes message 2 and switches to transport mode.
    pub fn accept(mut self) -> Result<(Vec<u8>, Transport, Sas), HandshakeDrop> {
        let mut m2 = vec![0u8; PRE_CONFIRM_CAP];
        let n = self
            .hs
            .write_message(&[], &mut m2)
            .map_err(|_| HandshakeDrop::Decrypt)?;
        m2.truncate(n);
        let sas = Sas::from_hash(self.hs.get_handshake_hash());
        let state = self
            .hs
            .into_transport_mode()
            .map_err(|_| HandshakeDrop::Decrypt)?;
        Ok((m2, Transport::new(state, self.peer, self.mode), sas))
    }

    /// Message 2 carrying an authenticated `unknown-device`; the state is dropped afterwards.
    /// Same bytes for a never-paired and a revoked key.
    pub fn refuse_unknown(mut self) -> Result<Vec<u8>, HandshakeDrop> {
        let mut m2 = vec![0u8; PRE_CONFIRM_CAP];
        let n = self
            .hs
            .write_message(&[TAG_UNKNOWN_DEVICE], &mut m2)
            .map_err(|_| HandshakeDrop::Decrypt)?;
        m2.truncate(n);
        Ok(m2)
    }
}

#[cfg(test)]
mod tests;
