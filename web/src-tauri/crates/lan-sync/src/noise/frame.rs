//! Wire layout and frame rules of the LAN channel (no I/O, no keys).
//!
//! Handshake message 1 on the wire: `mode byte (1) || Noise message 1 (96 B)` = 97 B.
//! Message 2 is the bare Noise message (48 B, 49 B when it carries `unknown-device`).
//! Transport frame = Noise ciphertext of `tag (1) || body`. Framing on the stream (length prefix) is
//! the transport's business (package 2b); these checks work on one complete message.

/// Mode byte: pairing (`IKpsk1`).
pub const MODE_PAIR: u8 = 1;
/// Mode byte: session of an already paired device (`IK`).
pub const MODE_SESSION: u8 = 2;

/// Noise message 1 length for both patterns (e 32 + encrypted s 32 + tag 16 + tag 16).
pub const NOISE_M1_LEN: usize = 96;
/// Whole first wire message.
pub const WIRE_M1_LEN: usize = 1 + NOISE_M1_LEN;
/// Anything larger than this is dropped before any crypto (pre-handshake cap).
pub const PRE_HANDSHAKE_CAP: usize = 256;
/// Cap of every message until the peer proved itself with a first transport frame, and for the
/// whole pairing connection (only `hello` and the key frame exist there).
pub const PRE_CONFIRM_CAP: usize = 256;
/// Noise's own limit for one message.
pub const MAX_FRAME: usize = 65_535;

/// Prologue shared by both patterns; the mode byte is appended so a mode cannot be swapped.
pub(crate) const PROLOGUE_BASE: &[u8] = b"nemo-lan-sync/1";

/// Control frame tags (first plaintext byte).
pub const TAG_HELLO: u8 = 1;
/// Device asks to be unpaired. Has no id field: it acts on the session's own peer only.
pub const TAG_UNPAIR: u8 = 2;
/// Hub hands over the data key (after the confirmation, inside the pairing channel).
pub const TAG_DATA_KEY: u8 = 3;
/// Authenticated refusal (also carried as message 2's payload).
pub const TAG_UNKNOWN_DEVICE: u8 = 4;
/// First tag free for application frames (package 2b).
pub const TAG_APP_MIN: u8 = 0x10;

/// Longest device name in `hello`, in bytes.
pub const HELLO_NAME_MAX: usize = 64;

/// Why a frame was refused. Carries no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FrameError {
    TooLarge,
    Empty,
    BadHello,
    Decrypt,
    Encrypt,
    UnknownTag,
}

/// Splits a plaintext frame into tag and body.
pub fn split(plain: &[u8]) -> Result<(u8, &[u8]), FrameError> {
    match plain.split_first() {
        Some((tag, body)) => Ok((*tag, body)),
        None => Err(FrameError::Empty),
    }
}

/// Validates and returns the name of a `hello` body: 1..=64 bytes, valid UTF-8, no control characters.
pub fn parse_hello(body: &[u8]) -> Result<String, FrameError> {
    if body.is_empty() || body.len() > HELLO_NAME_MAX {
        return Err(FrameError::BadHello);
    }
    let name = std::str::from_utf8(body).map_err(|_| FrameError::BadHello)?;
    if name.chars().any(char::is_control) || name.trim().is_empty() {
        return Err(FrameError::BadHello);
    }
    Ok(name.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hello_name_rules() {
        assert_eq!(parse_hello(&[b'a'; 64]).unwrap().len(), 64);
        assert_eq!(parse_hello(&[b'a'; 65]), Err(FrameError::BadHello));
        assert_eq!(parse_hello(&[0xff, 0xfe]), Err(FrameError::BadHello));
        assert_eq!(parse_hello(b""), Err(FrameError::BadHello));
        assert_eq!(parse_hello(b"   "), Err(FrameError::BadHello));
        assert_eq!(parse_hello(b"a\nb"), Err(FrameError::BadHello));
        assert_eq!(parse_hello(b"a\x00"), Err(FrameError::BadHello));
        assert_eq!(parse_hello("Pixel 7".as_bytes()).unwrap(), "Pixel 7");
    }

    #[test]
    fn split_needs_a_tag() {
        assert_eq!(split(&[]), Err(FrameError::Empty));
        assert_eq!(split(&[3, 9]).unwrap(), (3, &[9u8][..]));
    }
}
