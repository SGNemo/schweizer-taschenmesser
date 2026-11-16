//! Frames of an exchange session (`noise::Mode::Exchange`). Tags `0x30..=0x3f` – apart from sync
//! (`0x10`, `0x11`) and input (`0x20..=0x2b`), checked by a test. Binary, explicit lengths, every
//! string checked as UTF-8; nothing here is formatted or logged.
//!
//! Package 1a carries `open`, `opened`, `refused`, `item`, `ack` and `ping`. Package 2a defines
//! the file records `0x35..=0x3c` (offer, accept, wait, refuse, chunk, end, result, cancel); a
//! session carries them only when both sides agreed on [`FEATURE_FILES`] at `open`, and closes
//! on any of them otherwise.

use std::fmt;

/// Phone → PC, after `hello`: `[version, features]`.
pub const TAG_OPEN: u8 = 0x30;
/// PC → phone: `[version, features accepted]`.
pub const TAG_OPENED: u8 = 0x31;
/// PC → phone, then the PC closes: `[code]`.
pub const TAG_REFUSED: u8 = 0x32;
/// Both ways: `id (16) · kind (1) · UTF-8 body`.
pub const TAG_ITEM: u8 = 0x33;
/// Both ways: `id (16) · state (1)`; the sender counts an item as delivered only on `stored`.
pub const TAG_ACK: u8 = 0x34;
/// First and last tag of the file records.
pub const TAG_FILE_FIRST: u8 = TAG_OFFER;
pub const TAG_FILE_LAST: u8 = TAG_CANCEL;
/// Sender: `id · size u64 · sha256 (32) · name length · name · mime length · mime`.
pub const TAG_OFFER: u8 = 0x35;
/// Receiver: `id · from u64` (`from > 0` resumes a part this side kept).
pub const TAG_ACCEPT: u8 = 0x36;
/// Receiver: `id · reason` – the user decides (_Annehmen_) before anything is written.
pub const TAG_WAIT: u8 = 0x37;
/// Receiver: `id · code` – not taken.
pub const TAG_REFUSE: u8 = 0x38;
/// Sender: `id · offset u64 · bytes`; offsets are contiguous.
pub const TAG_CHUNK: u8 = 0x39;
/// Sender: `id` – every byte is out.
pub const TAG_END: u8 = 0x3a;
/// Receiver: `id · code` – `ok` only when length and SHA-256 match the offer.
pub const TAG_RESULT: u8 = 0x3b;
/// Either side, any time: `id`.
pub const TAG_CANCEL: u8 = 0x3c;
/// Phone → PC: keeps the session against the hub's idle close (it counts inbound frames only).
pub const TAG_PING: u8 = 0x3d;

/// Version of this wire.
pub const VERSION: u8 = 1;
/// Features this version knows. A side asks for what it can do; the PC accepts files only when its
/// shell wired them (`Exchange::with_files`).
pub const FEATURES: u8 = FEATURE_FILES;
/// The feature bit of file transfers.
pub const FEATURE_FILES: u8 = 1;

/// Longest item body, in bytes.
pub const MAX_BODY: usize = 16 * 1024;
/// Longest link, in bytes (as long as any text: map, office and tracking links are often 2–4 KB).
pub const MAX_LINK: usize = MAX_BODY;
/// An item frame: tag, id, kind, body.
pub const ITEM_HEADER: usize = 16 + 1;

/// The frame does not belong to the protocol. Carries no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Malformed;

/// Why the PC refused or ended a session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Code {
    /// Exchange is not switched on at this PC.
    ExchangeOff,
    /// This device may not exchange (no grant).
    NotGranted,
    /// Paused at the PC.
    Paused,
    /// Too many items in the last hour; the minutes until the next one is taken (1..=60).
    Limit(u8),
}

impl Code {
    pub fn byte(self) -> u8 {
        match self {
            Code::ExchangeOff => 1,
            Code::NotGranted => 2,
            Code::Paused => 3,
            Code::Limit(_) => 4,
        }
    }
}

/// What an item is. The receiver shows each kind as its own card.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Text,
    /// An `http`/`https` address; nothing else is a link.
    Link,
    /// Text the sender took from its clipboard on a tap.
    Clip,
}

impl Kind {
    fn byte(self) -> u8 {
        match self {
            Kind::Text => 1,
            Kind::Link => 2,
            Kind::Clip => 3,
        }
    }
    fn from_byte(b: u8) -> Option<Kind> {
        Some(match b {
            1 => Kind::Text,
            2 => Kind::Link,
            3 => Kind::Clip,
            _ => return None,
        })
    }
}

/// One message, checked: the only way to build one is [`Item::new`] (or decoding, which uses it), so
/// no outbox or caller can queue an item the other side would not take. `Debug` never shows the body.
#[derive(Clone, PartialEq, Eq)]
pub struct Item {
    id: [u8; 16],
    kind: Kind,
    body: String,
}

impl fmt::Debug for Item {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Item")
            .field("kind", &self.kind)
            .finish_non_exhaustive()
    }
}

impl Item {
    /// A checked item, or `Malformed` (empty, too long, a control character, a link that is not
    /// a plain `http(s)` address). Line breaks of text are normalised to `\n` (CRLF and CR from a
    /// Windows clipboard or a web form are ordinary text).
    pub fn new(id: [u8; 16], kind: Kind, body: String) -> Result<Item, Malformed> {
        let body = match kind {
            Kind::Text | Kind::Clip if body.contains('\r') => {
                body.replace("\r\n", "\n").replace('\r', "\n")
            }
            _ => body,
        };
        check_body(kind, &body)?;
        Ok(Item { id, kind, body })
    }

    pub fn id(&self) -> &[u8; 16] {
        &self.id
    }

    pub fn kind(&self) -> Kind {
        self.kind
    }

    pub fn body(&self) -> &str {
        &self.body
    }
}

/// Why an item frame was not taken.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ItemError {
    /// Not even an id: a broken peer, the session closes.
    Broken,
    /// A readable id but a body this side does not take (an unknown kind, a link rule of another
    /// version): answered `ack rejected`, so it leaves the sender's queue instead of blocking it.
    Unusable([u8; 16]),
}

/// The receiver's answer to one item.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AckState {
    /// Kept on the receiving side (in its inbox); the sender may forget it.
    Stored,
    /// Not kept (the receiver's inbox is full); the sender keeps it and tries again later.
    Refused,
    /// Never taken (the receiver cannot read this item); the sender drops it and says so.
    Rejected,
}

fn check_body(kind: Kind, body: &str) -> Result<(), Malformed> {
    if body.trim().is_empty() || body.len() > MAX_BODY {
        return Err(Malformed);
    }
    match kind {
        // line breaks and tabs are text; every other control character is not
        Kind::Text | Kind::Clip => {
            if body
                .chars()
                .any(|c| c.is_control() && c != '\n' && c != '\t')
            {
                return Err(Malformed);
            }
        }
        Kind::Link => {
            // on bytes: the 8th byte of `http://über…` is inside a character
            let starts = |p: &str| {
                body.as_bytes()
                    .get(..p.len())
                    .is_some_and(|b| b.eq_ignore_ascii_case(p.as_bytes()))
            };
            let scheme = starts("https://") || starts("http://");
            // no whitespace, controls or invisible format characters (bidi tricks) in an address
            let plain = body
                .chars()
                .all(|c| !c.is_whitespace() && !c.is_control() && !is_format(c));
            // an authority that starts with a host character and carries no user part (`a@b`
            // shows one host and opens another) and no backslash
            let host = body.split_once("://").is_some_and(|(_, rest)| {
                let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
                let authority = &rest[..end];
                authority
                    .chars()
                    .next()
                    .is_some_and(|c| c.is_alphanumeric() || c == '[')
                    && !authority.contains(['@', '\\'])
            });
            if body.len() > MAX_LINK || !scheme || !plain || !host {
                return Err(Malformed);
            }
        }
    }
    Ok(())
}

/// Unicode format characters (category Cf) that matter in an address: bidi controls, zero-width
/// characters, the BOM and the soft hyphen.
fn is_format(c: char) -> bool {
    matches!(c,
        '\u{00AD}' | '\u{061C}' | '\u{180E}' | '\u{200B}'..='\u{200F}' | '\u{202A}'..='\u{202E}'
        | '\u{2060}'..='\u{2064}' | '\u{2066}'..='\u{206F}' | '\u{FEFF}' | '\u{FFF9}'..='\u{FFFB}')
}

pub fn encode_open(features: u8) -> [u8; 2] {
    [VERSION, features]
}

/// The features asked for. Any version from 1 on is answered with this side's version.
pub fn decode_open(body: &[u8]) -> Result<u8, Malformed> {
    match body {
        [v, features] if *v >= 1 => Ok(*features),
        _ => Err(Malformed),
    }
}

pub fn encode_opened(features: u8) -> [u8; 2] {
    [VERSION, features]
}

/// The features the PC accepted.
pub fn decode_opened(body: &[u8]) -> Result<u8, Malformed> {
    match body {
        [v, features] if *v >= 1 => Ok(*features),
        _ => Err(Malformed),
    }
}

/// `[code]`, and for `limit` `[code, minutes]`.
pub fn encode_code(code: Code) -> Vec<u8> {
    match code {
        Code::Limit(minutes) => vec![code.byte(), minutes],
        _ => vec![code.byte()],
    }
}

pub fn decode_code(body: &[u8]) -> Result<Code, Malformed> {
    Ok(match body {
        [1] => Code::ExchangeOff,
        [2] => Code::NotGranted,
        [3] => Code::Paused,
        [4, m] if (1..=60).contains(m) => Code::Limit(*m),
        _ => return Err(Malformed),
    })
}

pub fn encode_item(item: &Item) -> Vec<u8> {
    let mut out = Vec::with_capacity(ITEM_HEADER + item.body.len());
    out.extend_from_slice(&item.id);
    out.push(item.kind.byte());
    out.extend_from_slice(item.body.as_bytes());
    out
}

pub fn decode_item(body: &[u8]) -> Result<Item, ItemError> {
    if body.len() < ITEM_HEADER {
        return Err(ItemError::Broken);
    }
    let mut id = [0u8; 16];
    id.copy_from_slice(&body[..16]);
    let unusable = ItemError::Unusable(id);
    let kind = Kind::from_byte(body[16]).ok_or(unusable)?;
    let text = std::str::from_utf8(&body[ITEM_HEADER..]).map_err(|_| unusable)?;
    Item::new(id, kind, text.to_owned()).map_err(|_| unusable)
}

pub fn encode_ack(id: &[u8; 16], state: AckState) -> [u8; 17] {
    let mut out = [0u8; 17];
    out[..16].copy_from_slice(id);
    out[16] = match state {
        AckState::Stored => 1,
        AckState::Refused => 2,
        AckState::Rejected => 3,
    };
    out
}

pub fn decode_ack(body: &[u8]) -> Result<([u8; 16], AckState), Malformed> {
    if body.len() != 17 {
        return Err(Malformed);
    }
    let mut id = [0u8; 16];
    id.copy_from_slice(&body[..16]);
    let state = match body[16] {
        1 => AckState::Stored,
        2 => AckState::Refused,
        3 => AckState::Rejected,
        _ => return Err(Malformed),
    };
    Ok((id, state))
}

// ---- files (package 2a: records only; the session flow is package 2b) ----

/// Largest file, in bytes (v1). Above 100 MB, or above 1 GB from one device in a day, the
/// receiver answers `wait` and the user decides; this is the hard cap of the wire.
pub const MAX_FILE: u64 = 4 * 1024 * 1024 * 1024;
/// Longest name in an offer (raw sender text, cleaned by the receiver: `exchange::name`).
pub const MAX_OFFER_NAME: usize = 255;
/// Longest media type in an offer.
pub const MAX_MIME: usize = 64;
/// Most bytes in one chunk: the 65 535-byte frame minus the AEAD tag (16), the record tag (1),
/// the id (16) and the offset (8).
pub const MAX_CHUNK: usize = crate::noise::frame::MAX_FRAME - 16 - 1 - 16 - 8;

/// A file the sender offers. Built only by [`Offer::new`] (or decoding, which uses it). `Debug`
/// shows neither name, type nor size.
#[derive(Clone, PartialEq, Eq)]
pub struct Offer {
    id: [u8; 16],
    size: u64,
    sha256: [u8; 32],
    name: String,
    mime: String,
}

impl fmt::Debug for Offer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // no name, type or size: none of them may reach a log or a panic message
        f.debug_struct("Offer").finish_non_exhaustive()
    }
}

impl Offer {
    /// A checked offer, or `Malformed`: size over [`MAX_FILE`], a name that is empty, longer than
    /// [`MAX_OFFER_NAME`] bytes or holds a NUL, a media type that is not a plain `type/subtype`
    /// of at most [`MAX_MIME`] printable ASCII characters (empty means unknown).
    pub fn new(
        id: [u8; 16],
        size: u64,
        sha256: [u8; 32],
        name: String,
        mime: String,
    ) -> Result<Offer, Malformed> {
        let name_ok = !name.is_empty() && name.len() <= MAX_OFFER_NAME && !name.contains('\0');
        let mime_ok = mime.is_empty() || plain_mime(&mime);
        if size > MAX_FILE || !name_ok || !mime_ok {
            return Err(Malformed);
        }
        Ok(Offer {
            id,
            size,
            sha256,
            name,
            mime,
        })
    }

    pub fn id(&self) -> &[u8; 16] {
        &self.id
    }

    pub fn size(&self) -> u64 {
        self.size
    }

    pub fn sha256(&self) -> &[u8; 32] {
        &self.sha256
    }

    /// The sender's name, untrusted: clean it (`exchange::name::clean`) before any use.
    pub fn name(&self) -> &str {
        &self.name
    }

    /// The sender's media type, untrusted and only a hint (empty = unknown).
    pub fn mime(&self) -> &str {
        &self.mime
    }
}

/// `type/subtype` of RFC 6838 token characters only (no parameters), at most [`MAX_MIME`] bytes.
fn plain_mime(mime: &str) -> bool {
    let token = |t: &str| {
        !t.is_empty()
            && t.bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"!#$&-^_.+".contains(&b))
    };
    mime.len() <= MAX_MIME
        && mime
            .split_once('/')
            .is_some_and(|(t, st)| token(t) && token(st))
}

pub fn encode_offer(offer: &Offer) -> Vec<u8> {
    let mut out = Vec::with_capacity(16 + 8 + 32 + 2 + offer.name.len() + offer.mime.len());
    out.extend_from_slice(&offer.id);
    out.extend_from_slice(&offer.size.to_be_bytes());
    out.extend_from_slice(&offer.sha256);
    // both fit a byte: `Offer::new` caps them at 255 and 64
    out.push(u8::try_from(offer.name.len()).unwrap_or(u8::MAX));
    out.extend_from_slice(offer.name.as_bytes());
    out.push(u8::try_from(offer.mime.len()).unwrap_or(u8::MAX));
    out.extend_from_slice(offer.mime.as_bytes());
    out
}

/// Why an offer frame was not taken.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OfferError {
    /// Not even an id: a broken peer, the session closes.
    Broken,
    /// Over [`MAX_FILE`]: answered `refuse {too-large}`.
    TooLarge([u8; 16]),
    /// A readable id, but an offer this side cannot read (name, lengths): answered
    /// `refuse {rejected}`, never written.
    Unusable([u8; 16]),
}

impl OfferError {
    /// What the receiver answers: `refuse {too-large}`, `refuse {rejected}`, or nothing (the
    /// session closes on a frame without an id).
    pub fn answer(self) -> Option<([u8; 16], RefuseCode)> {
        match self {
            OfferError::Broken => None,
            OfferError::TooLarge(id) => Some((id, RefuseCode::TooLarge)),
            OfferError::Unusable(id) => Some((id, RefuseCode::Rejected)),
        }
    }
}

pub fn decode_offer(body: &[u8]) -> Result<Offer, OfferError> {
    let id = id_of(body).ok_or(OfferError::Broken)?;
    let unusable = OfferError::Unusable(id);
    let mut r = Reader(&body[16..]);
    let size = r.u64().ok_or(unusable)?;
    let sha256: [u8; 32] = r.take(32).and_then(|b| b.try_into().ok()).ok_or(unusable)?;
    let name = r.short_text().ok_or(unusable)?;
    // the media type is only a hint: raw bytes here, read as UTF-8 below or else "unknown"
    let mime_len = usize::from(*r.take(1).and_then(|b| b.first()).ok_or(unusable)?);
    let mime_raw = r.take(mime_len).ok_or(unusable)?;
    if !r.0.is_empty() {
        return Err(unusable);
    }
    if size > MAX_FILE {
        return Err(OfferError::TooLarge(id));
    }
    // one this side cannot read (not UTF-8, not a plain token type) is "unknown", never a refusal
    let mime = std::str::from_utf8(mime_raw)
        .ok()
        .filter(|m| plain_mime(m))
        .unwrap_or("")
        .to_owned();
    Offer::new(id, size, sha256, name, mime).map_err(|_| unusable)
}

/// Why the receiver waits for the user before taking a file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WaitReason {
    /// Over 100 MB.
    Large,
    /// Over 1 GB from this device today.
    Daily,
}

/// Why the receiver does not take a file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefuseCode {
    /// Over [`MAX_FILE`].
    TooLarge,
    /// Not enough free space on the receiving side.
    Full,
    /// The user said no.
    Declined,
    /// This device may not send files here.
    NotGranted,
    /// An offer this side cannot read (`OfferError::Unusable`): the sender drops it and says so.
    Rejected,
}

/// How a transfer ended at the receiver.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResultCode {
    /// Length and SHA-256 match the offer; the file is in place.
    Ok,
    /// Length or SHA-256 differ: the part is deleted.
    Mismatch,
    /// The disk filled up while writing.
    Full,
    /// Writing failed otherwise.
    Failed,
}

pub fn encode_accept(id: &[u8; 16], from: u64) -> [u8; 24] {
    debug_assert!(
        from <= MAX_FILE,
        "the peer refuses a resume point past the largest file"
    );
    let mut out = [0u8; 24];
    out[..16].copy_from_slice(id);
    out[16..].copy_from_slice(&from.to_be_bytes());
    out
}

pub fn decode_accept(body: &[u8]) -> Result<([u8; 16], u64), Malformed> {
    if body.len() != 24 {
        return Err(Malformed);
    }
    let id = id_of(body).ok_or(Malformed)?;
    let from = Reader(&body[16..]).u64().ok_or(Malformed)?;
    // never past the largest file: `from + len` always fits a u64 on the other side
    if from > MAX_FILE {
        return Err(Malformed);
    }
    Ok((id, from))
}

pub fn encode_wait(id: &[u8; 16], reason: WaitReason) -> [u8; 17] {
    with_byte(
        id,
        match reason {
            WaitReason::Large => 1,
            WaitReason::Daily => 2,
        },
    )
}

pub fn decode_wait(body: &[u8]) -> Result<([u8; 16], WaitReason), Malformed> {
    let (id, b) = id_and_byte(body)?;
    Ok((
        id,
        match b {
            1 => WaitReason::Large,
            2 => WaitReason::Daily,
            _ => return Err(Malformed),
        },
    ))
}

pub fn encode_refuse(id: &[u8; 16], code: RefuseCode) -> [u8; 17] {
    with_byte(
        id,
        match code {
            RefuseCode::TooLarge => 1,
            RefuseCode::Full => 2,
            RefuseCode::Declined => 3,
            RefuseCode::NotGranted => 4,
            RefuseCode::Rejected => 5,
        },
    )
}

pub fn decode_refuse(body: &[u8]) -> Result<([u8; 16], RefuseCode), Malformed> {
    let (id, b) = id_and_byte(body)?;
    Ok((
        id,
        match b {
            1 => RefuseCode::TooLarge,
            2 => RefuseCode::Full,
            3 => RefuseCode::Declined,
            4 => RefuseCode::NotGranted,
            5 => RefuseCode::Rejected,
            _ => return Err(Malformed),
        },
    ))
}

/// The 24 bytes before a chunk's data: a sender can read the file straight into a buffer after
/// them (then at most [`MAX_CHUNK`] data bytes).
pub fn chunk_header(id: &[u8; 16], offset: u64) -> [u8; 24] {
    let mut out = [0u8; 24];
    out[..16].copy_from_slice(id);
    out[16..].copy_from_slice(&offset.to_be_bytes());
    out
}

/// `None` for an empty chunk, one over [`MAX_CHUNK`] or an offset past [`MAX_FILE`] (the caller
/// cuts files into chunks; the peer would refuse any of them).
pub fn encode_chunk(id: &[u8; 16], offset: u64, bytes: &[u8]) -> Option<Vec<u8>> {
    if bytes.is_empty() || bytes.len() > MAX_CHUNK || offset > MAX_FILE {
        return None;
    }
    let mut out = Vec::with_capacity(24 + bytes.len());
    out.extend_from_slice(&chunk_header(id, offset));
    out.extend_from_slice(bytes);
    Some(out)
}

/// `(id, offset, bytes)`; the bytes borrow the frame (nothing is copied before it is written).
pub fn decode_chunk(body: &[u8]) -> Result<([u8; 16], u64, &[u8]), Malformed> {
    let id = id_of(body).ok_or(Malformed)?;
    let offset = Reader(&body[16..]).u64().ok_or(Malformed)?;
    let bytes = &body[24..];
    if bytes.is_empty() || bytes.len() > MAX_CHUNK || offset > MAX_FILE {
        return Err(Malformed);
    }
    Ok((id, offset, bytes))
}

/// `end` and `cancel` carry the id only: their body is the 16 bytes of the id.
pub fn decode_id(body: &[u8]) -> Result<[u8; 16], Malformed> {
    if body.len() != 16 {
        return Err(Malformed);
    }
    id_of(body).ok_or(Malformed)
}

pub fn encode_result(id: &[u8; 16], code: ResultCode) -> [u8; 17] {
    with_byte(
        id,
        match code {
            ResultCode::Ok => 0,
            ResultCode::Mismatch => 1,
            ResultCode::Full => 2,
            ResultCode::Failed => 3,
        },
    )
}

pub fn decode_result(body: &[u8]) -> Result<([u8; 16], ResultCode), Malformed> {
    let (id, b) = id_and_byte(body)?;
    Ok((
        id,
        match b {
            0 => ResultCode::Ok,
            1 => ResultCode::Mismatch,
            2 => ResultCode::Full,
            3 => ResultCode::Failed,
            _ => return Err(Malformed),
        },
    ))
}

fn id_of(body: &[u8]) -> Option<[u8; 16]> {
    body.get(..16)?.try_into().ok()
}

fn with_byte(id: &[u8; 16], b: u8) -> [u8; 17] {
    let mut out = [0u8; 17];
    out[..16].copy_from_slice(id);
    out[16] = b;
    out
}

fn id_and_byte(body: &[u8]) -> Result<([u8; 16], u8), Malformed> {
    match body {
        [.., b] if body.len() == 17 => Ok((id_of(body).ok_or(Malformed)?, *b)),
        _ => Err(Malformed),
    }
}

/// Reads fields front to back; every read checks the length.
struct Reader<'a>(&'a [u8]);

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Option<&'a [u8]> {
        if self.0.len() < n {
            return None;
        }
        let (head, rest) = self.0.split_at(n);
        self.0 = rest;
        Some(head)
    }

    fn u64(&mut self) -> Option<u64> {
        self.take(8)?.try_into().ok().map(u64::from_be_bytes)
    }

    /// One length byte, then that many bytes of UTF-8.
    fn short_text(&mut self) -> Option<String> {
        let len = usize::from(*self.take(1)?.first()?);
        std::str::from_utf8(self.take(len)?).ok().map(str::to_owned)
    }
}

const _: () = assert!(
    TAG_PING > TAG_FILE_LAST,
    "ping stays outside the file records"
);

#[cfg(test)]
mod tests {
    use super::*;

    fn item(kind: Kind, body: &str) -> Result<Item, Malformed> {
        Item::new([7; 16], kind, body.to_owned())
    }

    #[test]
    fn items_round_trip_and_fit_a_frame() {
        for (kind, body) in [
            (Kind::Text, "Vergiss nicht, Milch zu kaufen\nund Brot"),
            (Kind::Link, "https://example.org/rezept?x=1"),
            (Kind::Clip, "Grüße 👋🏽"),
        ] {
            let i = item(kind, body).unwrap();
            assert_eq!(decode_item(&encode_item(&i)).unwrap(), i);
        }
        let crlf = item(Kind::Clip, "Zeile 1\r\nZeile 2\rZeile 3").unwrap();
        assert_eq!(crlf.body(), "Zeile 1\nZeile 2\nZeile 3");
        let long_link = format!("https://maps.example.org/route?{}", "a".repeat(4000));
        assert!(
            item(Kind::Link, &long_link).is_ok(),
            "real links are often 2–4 KB"
        );
        assert!(item(Kind::Link, "http://192.168.1.10:8080/x").is_ok());
        assert!(item(Kind::Link, "https://bücher.example/").is_ok());
        assert!(item(Kind::Link, "http://über.example/").is_ok());
        assert!(item(Kind::Link, "http://[fe80::1]:8080/").is_ok());
        assert!(item(Kind::Link, "https://example.org/?mail=a@b.example").is_ok());
        let big = item(Kind::Text, &"x".repeat(MAX_BODY)).unwrap();
        assert!(1 + encode_item(&big).len() + 16 <= crate::noise::frame::MAX_FRAME);
        assert_eq!(item(Kind::Text, &"x".repeat(MAX_BODY + 1)), Err(Malformed));
    }

    #[test]
    fn bodies_are_checked() {
        assert_eq!(item(Kind::Text, "  \n "), Err(Malformed));
        assert_eq!(item(Kind::Text, "a\u{0007}b"), Err(Malformed));
        assert_eq!(item(Kind::Clip, "a\u{001b}[31mb"), Err(Malformed));
        assert!(item(Kind::Text, "Zeile\tTab").is_ok());
        for bad in [
            "javascript:alert(1)",
            "file:///C:/Windows",
            "ftp://x.org",
            "https://exa mple.org",
            "https://example.org/\u{202E}gpj.exe",
            "https://ex\u{200B}ample.org",
            "http://",
            "https://",
            "https:///pfad",
            "HTTPS:",
            "www.example.org",
            "https://@evil.example",
            "https://bank.example@evil.example/login",
            "https://?x",
            "https://#",
            "https://\\evil.example",
            "https://-x.example",
            "https://example.org\n",
        ] {
            assert_eq!(item(Kind::Link, bad), Err(Malformed), "{bad:?}");
        }
        assert!(item(Kind::Link, "HTTPS://Example.org").is_ok());
        assert_eq!(
            item(Kind::Link, &format!("https://{}", "a".repeat(MAX_LINK))),
            Err(Malformed)
        );
        // no id: broken; an id with a body this side does not take: unusable (acked `rejected`)
        assert_eq!(decode_item(&[0; 16]), Err(ItemError::Broken));
        assert_eq!(decode_item(&[7; 17]), Err(ItemError::Unusable([7; 16])));
        let mut bad_kind = encode_item(&item(Kind::Text, "x").unwrap());
        bad_kind[16] = 9;
        assert_eq!(decode_item(&bad_kind), Err(ItemError::Unusable([7; 16])));
        let mut bad_utf8 = encode_item(&item(Kind::Text, "x").unwrap());
        bad_utf8.push(0xff);
        assert_eq!(decode_item(&bad_utf8), Err(ItemError::Unusable([7; 16])));
    }

    #[test]
    fn control_frames_round_trip() {
        assert_eq!(decode_open(&encode_open(0)), Ok(0));
        assert_eq!(decode_open(&[0, 0]), Err(Malformed));
        assert_eq!(decode_open(&[1]), Err(Malformed));
        assert_eq!(decode_opened(&encode_opened(0)), Ok(0));
        for c in [
            Code::ExchangeOff,
            Code::NotGranted,
            Code::Paused,
            Code::Limit(42),
        ] {
            assert_eq!(decode_code(&encode_code(c)), Ok(c));
        }
        assert_eq!(decode_code(&[0]), Err(Malformed));
        assert_eq!(decode_code(&[4]), Err(Malformed));
        assert_eq!(decode_code(&[4, 0]), Err(Malformed));
        assert_eq!(decode_code(&[4, 61]), Err(Malformed));
        let id = [3; 16];
        for s in [AckState::Stored, AckState::Refused, AckState::Rejected] {
            assert_eq!(decode_ack(&encode_ack(&id, s)), Ok((id, s)));
        }
        assert_eq!(decode_ack(&[0; 16]), Err(Malformed));
    }

    #[test]
    fn tags_stay_apart_from_sync_and_input() {
        let ours = [
            TAG_OPEN,
            TAG_OPENED,
            TAG_REFUSED,
            TAG_ITEM,
            TAG_ACK,
            TAG_FILE_FIRST,
            TAG_FILE_LAST,
            TAG_PING,
        ];
        for t in ours {
            assert!((0x30..=0x3f).contains(&t));
        }
        let sync = [crate::client::TAG_REQUEST, crate::client::TAG_RESPONSE];
        for t in sync {
            assert!(!(0x30..=0x3f).contains(&t));
        }
        for t in 0x20..=0x2bu8 {
            assert!(!(0x30..=0x3f).contains(&t), "input range");
        }
    }

    #[test]
    fn debug_never_shows_a_body() {
        let i = item(Kind::Text, "geheim").unwrap();
        assert!(!format!("{i:?}").contains("geheim"));
    }
    fn offer(name: &str, mime: &str, size: u64) -> Result<Offer, Malformed> {
        Offer::new([9; 16], size, [3; 32], name.to_owned(), mime.to_owned())
    }

    #[test]
    fn offers_round_trip_and_are_checked() {
        let o = offer("Urlaub 2026.jpg", "image/jpeg", 2_500_000).unwrap();
        assert_eq!(decode_offer(&encode_offer(&o)).unwrap(), o);
        let raw = offer("../../Rechnung\u{202E}fdp.exe", "", MAX_FILE).unwrap();
        assert_eq!(
            decode_offer(&encode_offer(&raw)).unwrap().name(),
            "../../Rechnung\u{202E}fdp.exe",
            "the wire carries the raw name: the receiver cleans it"
        );
        assert!(offer(&"n".repeat(MAX_OFFER_NAME), "a/b", 0).is_ok());
        for bad in [
            offer("", "image/png", 1),
            offer(&"n".repeat(MAX_OFFER_NAME + 1), "", 1),
            offer("a\0b", "", 1),
            offer("a", "", MAX_FILE + 1),
            offer("a", "image", 1),
            offer("a", "image/", 1),
            offer("a", "/png", 1),
            offer("a", "a/b/c", 1),
            offer("a", "image/p ng", 1),
            offer("a", "bild/ä", 1),
            offer("a", &format!("a/{}", "b".repeat(MAX_MIME)), 1),
        ] {
            assert_eq!(bad, Err(Malformed));
        }
        // parameters are not a plain type; a type the receiver cannot read is only "unknown"
        assert_eq!(offer("a", "text/plain;charset=utf-8", 1), Err(Malformed));
        assert!(offer("a", "application/vnd.ms-excel", 1).is_ok());
        let mut odd = encode_offer(&offer("a.txt", "text/plain", 1).unwrap());
        let n = odd.len();
        odd[n - 3] = b';';
        assert_eq!(decode_offer(&odd).unwrap().mime(), "");
        // too large is its own answer
        let mut big = encode_offer(&o);
        big[16..24].copy_from_slice(&(MAX_FILE + 1).to_be_bytes());
        assert_eq!(decode_offer(&big), Err(OfferError::TooLarge([9; 16])));
        // what each failure is answered with
        assert_eq!(
            OfferError::TooLarge([9; 16]).answer(),
            Some(([9; 16], RefuseCode::TooLarge))
        );
        assert_eq!(
            OfferError::Unusable([9; 16]).answer(),
            Some(([9; 16], RefuseCode::Rejected))
        );
        assert_eq!(OfferError::Broken.answer(), None);
        // a media type that is not UTF-8 is "unknown" too
        let mut latin = encode_offer(&offer("a.txt", "text/plain", 1).unwrap());
        let n = latin.len();
        latin[n - 1] = 0xe9;
        assert_eq!(decode_offer(&latin).unwrap().mime(), "");
        // a sender passes its local name through `name::clean`: always a valid offer name
        for local in [
            "発表資料".repeat(30) + ".pptx",
            "a\0b.txt".into(),
            "".into(),
            "x".repeat(900),
        ] {
            let cleaned = crate::exchange::name::clean(&local);
            assert!(offer(&cleaned, "", 1).is_ok(), "{local:?}");
        }
        // a readable id with a broken rest is answered, not a reason to close
        let mut body = encode_offer(&o);
        body.push(0);
        assert_eq!(decode_offer(&body), Err(OfferError::Unusable([9; 16])));
        let mut bad_utf8 = encode_offer(&o);
        let at = 16 + 8 + 32 + 1;
        bad_utf8[at] = 0xff;
        assert_eq!(decode_offer(&bad_utf8), Err(OfferError::Unusable([9; 16])));
        for cut in 0..encode_offer(&o).len() {
            let r = decode_offer(&encode_offer(&o)[..cut]);
            assert!(r.is_err(), "cut at {cut}");
            assert_eq!(r.is_err() && cut < 16, r == Err(OfferError::Broken));
        }
        let debug = format!("{o:?}");
        assert!(
            !debug.contains("Urlaub") && !debug.contains("jpeg") && !debug.contains("2500000"),
            "{debug}"
        );
    }

    #[test]
    fn file_control_records_round_trip() {
        let id = [5u8; 16];
        assert_eq!(decode_accept(&encode_accept(&id, 0)), Ok((id, 0)));
        assert_eq!(
            decode_accept(&encode_accept(&id, 1 << 30)),
            Ok((id, 1 << 30))
        );
        for r in [WaitReason::Large, WaitReason::Daily] {
            assert_eq!(decode_wait(&encode_wait(&id, r)), Ok((id, r)));
        }
        for c in [
            RefuseCode::TooLarge,
            RefuseCode::Full,
            RefuseCode::Declined,
            RefuseCode::NotGranted,
            RefuseCode::Rejected,
        ] {
            assert_eq!(decode_refuse(&encode_refuse(&id, c)), Ok((id, c)));
        }
        for c in [
            ResultCode::Ok,
            ResultCode::Mismatch,
            ResultCode::Full,
            ResultCode::Failed,
        ] {
            assert_eq!(decode_result(&encode_result(&id, c)), Ok((id, c)));
        }
        assert_eq!(decode_id(&id), Ok(id));
        // wrong lengths and unknown codes
        assert_eq!(decode_accept(&[0; 23]), Err(Malformed));
        assert_eq!(decode_accept(&[0; 25]), Err(Malformed));
        assert_eq!(decode_wait(&with_byte(&id, 3)), Err(Malformed));
        assert_eq!(decode_refuse(&with_byte(&id, 0)), Err(Malformed));
        assert_eq!(decode_result(&with_byte(&id, 4)), Err(Malformed));
        assert_eq!(decode_id(&[0; 17]), Err(Malformed));
        assert_eq!(
            decode_accept(&encode_accept(&id, MAX_FILE)),
            Ok((id, MAX_FILE))
        );
        let mut past = encode_accept(&id, MAX_FILE);
        past[16..].copy_from_slice(&(MAX_FILE + 1).to_be_bytes());
        assert_eq!(decode_accept(&past), Err(Malformed));
        assert_eq!(decode_wait(&[0; 16]), Err(Malformed));
    }

    #[test]
    fn chunks_fill_a_frame_and_no_more() {
        let id = [1u8; 16];
        let full = vec![0xaa; MAX_CHUNK];
        let body = encode_chunk(&id, 7, &full).unwrap();
        // tag + body + AEAD tag is exactly one frame
        assert_eq!(1 + body.len() + 16, crate::noise::frame::MAX_FRAME);
        assert_eq!(decode_chunk(&body).unwrap(), (id, 7, &full[..]));
        assert!(encode_chunk(&id, 0, &[]).is_none());
        assert!(encode_chunk(&id, 0, &vec![0; MAX_CHUNK + 1]).is_none());
        let mut over = body.clone();
        over.push(0);
        assert_eq!(decode_chunk(&over), Err(Malformed));
        assert_eq!(decode_chunk(&body[..24]), Err(Malformed));
        assert_eq!(decode_chunk(&body[..20]), Err(Malformed));
        assert!(encode_chunk(&id, MAX_FILE + 1, &[1]).is_none());
        let mut far = encode_chunk(&id, MAX_FILE, &[1]).unwrap();
        far[16..24].copy_from_slice(&u64::MAX.to_be_bytes());
        assert_eq!(decode_chunk(&far), Err(Malformed));
    }

    #[test]
    fn file_tags_are_the_reserved_range() {
        let tags = [
            TAG_OFFER, TAG_ACCEPT, TAG_WAIT, TAG_REFUSE, TAG_CHUNK, TAG_END, TAG_RESULT, TAG_CANCEL,
        ];
        for (i, t) in tags.iter().enumerate() {
            assert_eq!(*t, TAG_FILE_FIRST + u8::try_from(i).unwrap());
        }
        assert_eq!(TAG_FILE_LAST, 0x3c);
        assert_eq!(FEATURES & FEATURE_FILES, FEATURE_FILES);
    }
}
