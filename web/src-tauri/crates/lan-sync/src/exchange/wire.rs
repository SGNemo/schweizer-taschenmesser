//! Frames of an exchange session (`noise::Mode::Exchange`). Tags `0x30..=0x3f` – apart from sync
//! (`0x10`, `0x11`) and input (`0x20..=0x2b`), checked by a test. Binary, explicit lengths, every
//! string checked as UTF-8; nothing here is formatted or logged.
//!
//! Package 1a carries `open`, `opened`, `refused`, `item`, `ack` and `ping`. The file tags
//! `0x35..=0x3c` are reserved for package 2; a session that receives one closes.

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
/// First and last tag reserved for files (package 2).
pub const TAG_FILE_FIRST: u8 = 0x35;
pub const TAG_FILE_LAST: u8 = 0x3c;
/// Phone → PC: keeps the session against the hub's idle close (it counts inbound frames only).
pub const TAG_PING: u8 = 0x3d;

/// Version of this wire.
pub const VERSION: u8 = 1;
/// Features this version knows (none yet; files come with their own bit in package 2).
pub const FEATURES: u8 = 0;

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
            let lower = body
                .get(..8)
                .map(str::to_ascii_lowercase)
                .unwrap_or_default();
            let scheme = lower.starts_with("https://") || lower.starts_with("http://");
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
}
