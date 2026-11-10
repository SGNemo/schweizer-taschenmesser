//! Wire format of the input session (both sides; no I/O, no clock, no keys).
//!
//! Every frame is `tag (1) || body` inside a Noise transport message of an input session. The tags
//! start at `0x20`, apart from the sync tags (`0x10`, `0x11`): a sync session closes on an input tag
//! and an input session closes on a sync tag.
//!
//! Phone → PC: `open`, `events` (1..=32 records of 4 bytes), `text`. PC → phone: `opened`,
//! `refused`, `state`, `closed` – nothing else, ever. There is no JSON and no free-form string from
//! the PC; the only string at all is the text the user typed on the phone.
//!
//! Decoding is strict: an unknown tag, kind or id, a reserved byte that is not zero, a wrong length
//! or a control character is an error, and the caller closes the session.

/// Phone → PC: `[level]`.
pub const TAG_OPEN: u8 = 0x20;
/// PC → phone: `[level, grant, unlock_required, volume, mute, playing, locked]`.
pub const TAG_OPENED: u8 = 0x21;
/// PC → phone: `[code]`, then the PC closes.
pub const TAG_REFUSED: u8 = 0x22;
/// Phone → PC: 1..=[`MAX_RECORDS`] records of [`RECORD_LEN`] bytes.
pub const TAG_EVENTS: u8 = 0x23;
/// Phone → PC: UTF-8, 1..=[`MAX_TEXT_BYTES`] bytes, no control characters.
pub const TAG_TEXT: u8 = 0x24;
/// PC → phone: `[volume, mute, playing, locked]`.
pub const TAG_STATE: u8 = 0x25;
/// PC → phone: `[code]`, then the PC closes.
pub const TAG_CLOSED: u8 = 0x26;

pub const RECORD_LEN: usize = 4;
pub const MAX_RECORDS: usize = 32;
pub const MAX_TEXT_BYTES: usize = 256;
/// `volume` when the PC cannot tell.
pub const VOLUME_UNKNOWN: u8 = 255;

/// Why a body was refused. Carries no bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WireError;

/// What a device may do, and what a session was opened for. Ordered: `Off < Media < Full`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub enum Level {
    #[default]
    Off,
    /// Media, volume, lock the PC. No simulated input.
    Media,
    /// Media and mouse and keyboard.
    Full,
}

impl Level {
    pub fn byte(self) -> u8 {
        match self {
            Level::Off => 0,
            Level::Media => 1,
            Level::Full => 2,
        }
    }

    pub fn from_byte(b: u8) -> Option<Level> {
        match b {
            0 => Some(Level::Off),
            1 => Some(Level::Media),
            2 => Some(Level::Full),
            _ => None,
        }
    }
}

/// Every reason the PC ever gives. `refused` answers an `open`, `closed` ends an open session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Code {
    /// The PC's master switch is off.
    RemoteOff,
    /// This device has no grant (or not this level any more).
    NotGranted,
    /// Another device controls the PC.
    Busy,
    /// Ended at the PC; someone there has to switch the device on again.
    Paused,
    /// The PC is locked and the asked level is not usable.
    Locked,
    /// This PC cannot be controlled (not Windows, or nothing wired).
    Unsupported,
    /// Ended at the PC during the session.
    Ended,
    /// Too many events.
    Limit,
}

impl Code {
    pub fn byte(self) -> u8 {
        match self {
            Code::RemoteOff => 1,
            Code::NotGranted => 2,
            Code::Busy => 3,
            Code::Paused => 4,
            Code::Locked => 5,
            Code::Unsupported => 6,
            Code::Ended => 7,
            Code::Limit => 8,
        }
    }

    pub fn from_byte(b: u8) -> Option<Code> {
        Some(match b {
            1 => Code::RemoteOff,
            2 => Code::NotGranted,
            3 => Code::Busy,
            4 => Code::Paused,
            5 => Code::Locked,
            6 => Code::Unsupported,
            7 => Code::Ended,
            8 => Code::Limit,
            _ => return None,
        })
    }
}

/// The only facts the PC ever tells the phone about itself.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PcState {
    /// 0..=100, or [`VOLUME_UNKNOWN`].
    pub volume: u8,
    pub mute: bool,
    pub playing: bool,
    pub locked: bool,
}

impl PcState {
    pub const UNKNOWN: PcState = PcState {
        volume: VOLUME_UNKNOWN,
        mute: false,
        playing: false,
        locked: false,
    };

    fn bytes(self) -> [u8; 4] {
        [
            if self.volume <= 100 {
                self.volume
            } else {
                VOLUME_UNKNOWN
            },
            u8::from(self.mute),
            u8::from(self.playing),
            u8::from(self.locked),
        ]
    }

    fn from_bytes(b: &[u8]) -> Result<PcState, WireError> {
        match b {
            [v, m, p, l] if (*v <= 100 || *v == VOLUME_UNKNOWN) => Ok(PcState {
                volume: *v,
                mute: flag(*m)?,
                playing: flag(*p)?,
                locked: flag(*l)?,
            }),
            _ => Err(WireError),
        }
    }
}

fn flag(b: u8) -> Result<bool, WireError> {
    match b {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(WireError),
    }
}

/// The PC's answer to an accepted `open`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Opened {
    /// The level of this session: the smaller of what was asked and what is granted. Fixed.
    pub level: Level,
    /// What this device is granted at most (so the phone knows what a reopen could get).
    pub grant: Level,
    /// The PC asks the phone to unlock itself before a `Full` session (only ever true with a
    /// `Full` grant).
    pub unlock_required: bool,
    pub state: PcState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Button {
    Left,
    Right,
}

/// The fixed list of keys. Never a raw key code; a combination is one id.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Key {
    Enter,
    Escape,
    Backspace,
    Tab,
    Space,
    Left,
    Up,
    Right,
    Down,
    Home,
    End,
    PageUp,
    PageDown,
    Delete,
    F11,
    AltTab,
}

const KEYS: [Key; 16] = [
    Key::Enter,
    Key::Escape,
    Key::Backspace,
    Key::Tab,
    Key::Space,
    Key::Left,
    Key::Up,
    Key::Right,
    Key::Down,
    Key::Home,
    Key::End,
    Key::PageUp,
    Key::PageDown,
    Key::Delete,
    Key::F11,
    Key::AltTab,
];

/// The fixed list of media-level commands.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Media {
    PlayPause,
    Next,
    Previous,
    VolumeUp,
    VolumeDown,
    MuteToggle,
    /// Lock the PC (it only ever reduces access).
    Lock,
}

const MEDIA: [Media; 7] = [
    Media::PlayPause,
    Media::Next,
    Media::Previous,
    Media::VolumeUp,
    Media::VolumeDown,
    Media::MuteToggle,
    Media::Lock,
];

/// One input event. Four bytes on the wire: `kind, a, b, reserved (0)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Record {
    Move { dx: i8, dy: i8 },
    Button { button: Button, down: bool },
    Scroll { dx: i8, dy: i8 },
    Key(Key),
    Media(Media),
}

const KIND_MOVE: u8 = 1;
const KIND_BUTTON: u8 = 2;
const KIND_SCROLL: u8 = 3;
const KIND_KEY: u8 = 4;
const KIND_MEDIA: u8 = 5;

impl Record {
    /// Whether the record needs the `Full` level.
    pub fn needs_full(&self) -> bool {
        !matches!(self, Record::Media(_))
    }

    fn bytes(self) -> [u8; RECORD_LEN] {
        match self {
            Record::Move { dx, dy } => [KIND_MOVE, dx as u8, dy as u8, 0],
            Record::Button { button, down } => [
                KIND_BUTTON,
                match button {
                    Button::Left => 1,
                    Button::Right => 2,
                },
                u8::from(down),
                0,
            ],
            Record::Scroll { dx, dy } => [KIND_SCROLL, dx as u8, dy as u8, 0],
            Record::Key(k) => [KIND_KEY, index_of(&KEYS, &k), 0, 0],
            Record::Media(m) => [KIND_MEDIA, index_of(&MEDIA, &m), 0, 0],
        }
    }

    fn from_bytes(b: &[u8]) -> Result<Record, WireError> {
        let [kind, a, b2, 0] = *b else {
            return Err(WireError);
        };
        Ok(match kind {
            KIND_MOVE => Record::Move {
                dx: a as i8,
                dy: b2 as i8,
            },
            KIND_SCROLL => Record::Scroll {
                dx: a as i8,
                dy: b2 as i8,
            },
            KIND_BUTTON => Record::Button {
                button: match a {
                    1 => Button::Left,
                    2 => Button::Right,
                    _ => return Err(WireError),
                },
                down: flag(b2)?,
            },
            KIND_KEY if b2 == 0 => Record::Key(by_index(&KEYS, a)?),
            KIND_MEDIA if b2 == 0 => Record::Media(by_index(&MEDIA, a)?),
            _ => return Err(WireError),
        })
    }
}

/// Ids on the wire are the position in the fixed list, starting at 1.
fn index_of<T: PartialEq>(list: &[T], item: &T) -> u8 {
    list.iter()
        .position(|x| x == item)
        .and_then(|i| u8::try_from(i + 1).ok())
        .unwrap_or(0)
}

fn by_index<T: Copy>(list: &[T], id: u8) -> Result<T, WireError> {
    usize::from(id)
        .checked_sub(1)
        .and_then(|i| list.get(i))
        .copied()
        .ok_or(WireError)
}

// ---- phone → PC ----

pub fn encode_open(level: Level) -> [u8; 1] {
    [level.byte()]
}

/// The level the phone asks for. `Off` is not a level to open.
pub fn decode_open(body: &[u8]) -> Result<Level, WireError> {
    match body {
        [b] => match Level::from_byte(*b) {
            Some(Level::Off) | None => Err(WireError),
            Some(l) => Ok(l),
        },
        _ => Err(WireError),
    }
}

/// `None` for an empty slice or more than [`MAX_RECORDS`] (the caller splits).
pub fn encode_events(records: &[Record]) -> Option<Vec<u8>> {
    if records.is_empty() || records.len() > MAX_RECORDS {
        return None;
    }
    Some(records.iter().flat_map(|r| r.bytes()).collect())
}

pub fn decode_events(body: &[u8]) -> Result<Vec<Record>, WireError> {
    if body.is_empty() || body.len() % RECORD_LEN != 0 || body.len() > MAX_RECORDS * RECORD_LEN {
        return Err(WireError);
    }
    body.chunks_exact(RECORD_LEN)
        .map(Record::from_bytes)
        .collect()
}

/// Text as the user typed it: 1..=[`MAX_TEXT_BYTES`] bytes of UTF-8 without control characters
/// (a line break is the key `Enter`, never part of a text).
pub fn check_text(body: &[u8]) -> Result<&str, WireError> {
    if body.is_empty() || body.len() > MAX_TEXT_BYTES {
        return Err(WireError);
    }
    let text = std::str::from_utf8(body).map_err(|_| WireError)?;
    if text.chars().any(char::is_control) {
        return Err(WireError);
    }
    Ok(text)
}

// ---- PC → phone ----

pub fn encode_opened(o: Opened) -> [u8; 7] {
    let s = o.state.bytes();
    [
        o.level.byte(),
        o.grant.byte(),
        u8::from(o.unlock_required),
        s[0],
        s[1],
        s[2],
        s[3],
    ]
}

pub fn decode_opened(body: &[u8]) -> Result<Opened, WireError> {
    let [level, grant, unlock, state @ ..] = body else {
        return Err(WireError);
    };
    let level = Level::from_byte(*level).ok_or(WireError)?;
    let grant = Level::from_byte(*grant).ok_or(WireError)?;
    // an open session has a level, and never more than the grant
    if level == Level::Off || level > grant {
        return Err(WireError);
    }
    Ok(Opened {
        level,
        grant,
        unlock_required: flag(*unlock)?,
        state: PcState::from_bytes(state)?,
    })
}

pub fn encode_state(s: PcState) -> [u8; 4] {
    s.bytes()
}

pub fn decode_state(body: &[u8]) -> Result<PcState, WireError> {
    PcState::from_bytes(body)
}

pub fn encode_code(c: Code) -> [u8; 1] {
    [c.byte()]
}

pub fn decode_code(body: &[u8]) -> Result<Code, WireError> {
    match body {
        [b] => Code::from_byte(*b).ok_or(WireError),
        _ => Err(WireError),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_record_round_trips() {
        let mut all = vec![
            Record::Move { dx: -128, dy: 127 },
            Record::Move { dx: 0, dy: -1 },
            Record::Scroll { dx: 3, dy: -3 },
        ];
        for button in [Button::Left, Button::Right] {
            for down in [true, false] {
                all.push(Record::Button { button, down });
            }
        }
        all.extend(KEYS.iter().map(|k| Record::Key(*k)));
        all.extend(MEDIA.iter().map(|m| Record::Media(*m)));
        for chunk in all.chunks(MAX_RECORDS) {
            let body = encode_events(chunk).unwrap();
            assert_eq!(body.len(), chunk.len() * RECORD_LEN);
            assert_eq!(decode_events(&body).unwrap(), chunk);
        }
        // ids start at 1 and are dense
        assert_eq!(Record::Key(Key::Enter).bytes(), [KIND_KEY, 1, 0, 0]);
        assert_eq!(Record::Key(Key::AltTab).bytes(), [KIND_KEY, 16, 0, 0]);
        assert_eq!(Record::Media(Media::Lock).bytes(), [KIND_MEDIA, 7, 0, 0]);
    }

    #[test]
    fn only_media_records_work_without_the_full_level() {
        assert!(!Record::Media(Media::VolumeUp).needs_full());
        assert!(!Record::Media(Media::Lock).needs_full());
        for r in [
            Record::Move { dx: 1, dy: 1 },
            Record::Scroll { dx: 1, dy: 1 },
            Record::Key(Key::Enter),
            Record::Button {
                button: Button::Left,
                down: true,
            },
        ] {
            assert!(r.needs_full());
        }
    }

    #[test]
    fn malformed_events_are_refused() {
        for bad in [
            &[][..],
            &[KIND_MOVE, 1, 1],               // short
            &[KIND_MOVE, 1, 1, 0, KIND_MOVE], // not a multiple
            &[0, 0, 0, 0],                    // kind 0
            &[6, 0, 0, 0],                    // unknown kind
            &[KIND_MOVE, 1, 1, 1],            // reserved byte set
            &[KIND_BUTTON, 0, 1, 0],          // unknown button
            &[KIND_BUTTON, 3, 1, 0],
            &[KIND_BUTTON, 1, 2, 0], // down is 0 or 1
            &[KIND_KEY, 0, 0, 0],    // id 0
            &[KIND_KEY, 17, 0, 0],   // past the list
            &[KIND_KEY, 1, 1, 0],    // second byte must be 0
            &[KIND_MEDIA, 8, 0, 0],
            &[KIND_MEDIA, 1, 9, 0],
            &[0x5b, 0x52, 0, 0], // a raw key code is not a kind
        ] {
            assert_eq!(decode_events(bad), Err(WireError), "{bad:?}");
        }
        let too_many = [KIND_MOVE, 1, 1, 0].repeat(MAX_RECORDS + 1);
        assert_eq!(decode_events(&too_many), Err(WireError));
        assert!(encode_events(&[]).is_none());
        assert!(encode_events(&[Record::Move { dx: 1, dy: 1 }; MAX_RECORDS + 1]).is_none());
    }

    #[test]
    fn text_rules() {
        assert_eq!(check_text("Grüße 👋".as_bytes()).unwrap(), "Grüße 👋");
        assert_eq!(check_text(&[b'a'; MAX_TEXT_BYTES]).unwrap().len(), 256);
        assert!(check_text(&[b'a'; MAX_TEXT_BYTES + 1]).is_err());
        assert!(check_text(b"").is_err());
        assert!(check_text(&[0xff, 0xfe]).is_err());
        for control in [
            "a\nb", "a\rb", "a\tb", "a\x00", "a\x1b[2J", "a\x7f", "a\u{85}b",
        ] {
            assert!(check_text(control.as_bytes()).is_err(), "{control:?}");
        }
    }

    #[test]
    fn open_and_opened() {
        assert_eq!(decode_open(&encode_open(Level::Media)), Ok(Level::Media));
        assert_eq!(decode_open(&encode_open(Level::Full)), Ok(Level::Full));
        for bad in [&[][..], &[0], &[3], &[1, 1]] {
            assert!(decode_open(bad).is_err());
        }
        let o = Opened {
            level: Level::Media,
            grant: Level::Full,
            unlock_required: true,
            state: PcState {
                volume: 42,
                mute: false,
                playing: true,
                locked: false,
            },
        };
        assert_eq!(decode_opened(&encode_opened(o)), Ok(o));
        for bad in [
            &[][..],
            &[1, 1, 0, 42, 0, 0],       // short
            &[1, 1, 0, 42, 0, 0, 0, 0], // long
            &[0, 1, 0, 42, 0, 0, 0],    // an open session has a level
            &[2, 1, 0, 42, 0, 0, 0],    // never more than the grant
            &[1, 3, 0, 42, 0, 0, 0],
            &[1, 1, 2, 42, 0, 0, 0],
            &[1, 1, 0, 101, 0, 0, 0], // volume 0..=100 or unknown
            &[1, 1, 0, 42, 2, 0, 0],
        ] {
            assert!(decode_opened(bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn state_and_codes() {
        let s = PcState {
            volume: 100,
            mute: true,
            playing: false,
            locked: true,
        };
        assert_eq!(decode_state(&encode_state(s)), Ok(s));
        assert_eq!(
            decode_state(&encode_state(PcState::UNKNOWN)),
            Ok(PcState::UNKNOWN)
        );
        // an out-of-range volume leaves as "unknown", never as a number
        let wild = PcState { volume: 180, ..s };
        assert_eq!(encode_state(wild)[0], VOLUME_UNKNOWN);
        assert!(decode_state(&[1, 0, 0]).is_err());
        for b in 1..=8u8 {
            let c = Code::from_byte(b).unwrap();
            assert_eq!(c.byte(), b);
            assert_eq!(decode_code(&encode_code(c)), Ok(c));
        }
        assert!(Code::from_byte(0).is_none() && Code::from_byte(9).is_none());
        assert!(decode_code(&[]).is_err() && decode_code(&[1, 1]).is_err());
    }

    #[test]
    fn the_tags_stay_apart_from_sync_and_control_tags() {
        let tags = [
            TAG_OPEN,
            TAG_OPENED,
            TAG_REFUSED,
            TAG_EVENTS,
            TAG_TEXT,
            TAG_STATE,
            TAG_CLOSED,
        ];
        for (i, t) in tags.iter().enumerate() {
            assert!(*t >= 0x20, "below the input range");
            assert!(!tags[..i].contains(t), "duplicate tag");
            assert!(*t != crate::client::TAG_REQUEST && *t != crate::client::TAG_RESPONSE);
        }
        assert!(Level::Off < Level::Media && Level::Media < Level::Full);
    }
}
