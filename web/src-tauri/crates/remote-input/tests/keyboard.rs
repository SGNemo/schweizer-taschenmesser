//! The keyboard's behaviour: the plans of strokes, checked on every system, and the thread over
//! keys that only write down what they were handed.

use remote_input::{
    strokes, typed, Code, Key, KeyAction, Keyboard, Keys, Stroke, KEYS, KEY_QUEUE, TEXT_UNITS,
};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Clone, Default)]
struct Log(Arc<Mutex<Vec<Vec<Stroke>>>>);

impl Log {
    fn until(&self, count: usize) -> Vec<Vec<Stroke>> {
        let end = Instant::now() + Duration::from_secs(10);
        loop {
            let all = self.0.lock().unwrap().clone();
            if all.len() >= count || Instant::now() > end {
                return all;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    }
}

/// Writes down every call. `takes`: how many strokes of a call the "system" takes (`None` = all);
/// with a gate, every call waits until the gate opens.
struct Fake {
    log: Log,
    takes: Option<usize>,
    gate: Option<Receiver<()>>,
}

impl Keys for Fake {
    fn send(&mut self, strokes: &[Stroke]) -> usize {
        if let Some(gate) = &self.gate {
            let _ = gate.recv();
        }
        self.log.0.lock().unwrap().push(strokes.to_vec());
        self.takes.map_or(strokes.len(), |n| n.min(strokes.len()))
    }
}

fn keyboard(takes: Option<usize>) -> (Keyboard, Log) {
    let log = Log::default();
    let fake = Fake {
        log: log.clone(),
        takes,
        gate: None,
    };
    (Keyboard::with(Box::new(fake)), log)
}

fn text_of(plan: &[Stroke]) -> String {
    let units: Vec<u16> = plan
        .iter()
        .filter_map(|s| match s {
            Stroke::Unit { unit, up: false } => Some(*unit),
            _ => None,
        })
        .collect();
    String::from_utf16(&units).unwrap()
}

fn down(code: Code) -> Stroke {
    Stroke::Key { code, up: false }
}
fn up(code: Code) -> Stroke {
    Stroke::Key { code, up: true }
}

#[test]
fn every_key_goes_down_and_comes_up_in_the_same_plan_and_nothing_stays_down() {
    for key in KEYS {
        let plan = strokes(key);
        // only keys, never a unit of text
        assert!(
            plan.iter().all(|s| matches!(s, Stroke::Key { .. })),
            "{key:?}"
        );
        // walked like a stack: a release always matches the key that went down last
        let mut held: Vec<Code> = Vec::new();
        for stroke in &plan {
            let Stroke::Key { code, up } = *stroke else {
                unreachable!()
            };
            if up {
                assert_eq!(held.pop(), Some(code), "{key:?}");
            } else {
                assert!(!held.contains(&code), "{key:?}: pressed twice");
                held.push(code);
            }
        }
        assert!(held.is_empty(), "{key:?}: something stays down");
        // one key each – but the one combination, which is two
        let keys = plan.len() / 2;
        assert_eq!(keys, if key == Key::AltTab { 2 } else { 1 }, "{key:?}");
        // Alt exists only there
        let alt = plan.iter().any(|s| {
            matches!(
                s,
                Stroke::Key {
                    code: Code::Alt,
                    ..
                }
            )
        });
        assert_eq!(alt, key == Key::AltTab, "{key:?}");
    }
    assert_eq!(
        strokes(Key::AltTab),
        [
            down(Code::Alt),
            down(Code::Tab),
            up(Code::Tab),
            up(Code::Alt)
        ]
    );
    assert_eq!(strokes(Key::Enter), [down(Code::Enter), up(Code::Enter)]);
}

#[test]
fn each_key_of_the_list_is_its_own_key_of_the_keyboard() {
    let mut seen = Vec::new();
    for key in KEYS {
        assert!(!seen.contains(&key));
        seen.push(key);
    }
    assert_eq!(seen.len(), 16);
    let pairs = [
        (Key::Enter, Code::Enter),
        (Key::Escape, Code::Escape),
        (Key::Backspace, Code::Backspace),
        (Key::Tab, Code::Tab),
        (Key::Space, Code::Space),
        (Key::Left, Code::Left),
        (Key::Up, Code::Up),
        (Key::Right, Code::Right),
        (Key::Down, Code::Down),
        (Key::Home, Code::Home),
        (Key::End, Code::End),
        (Key::PageUp, Code::PageUp),
        (Key::PageDown, Code::PageDown),
        (Key::Delete, Code::Delete),
        (Key::F11, Code::F11),
    ];
    for (key, code) in pairs {
        assert_eq!(strokes(key), [down(code), up(code)], "{key:?}");
    }
}

#[test]
fn text_is_every_unit_down_and_up_and_never_a_key() {
    let plan = typed("aü👋");
    assert!(plan.iter().all(|s| matches!(s, Stroke::Unit { .. })));
    // a unit goes down, then the same unit comes up, one after the other
    for pair in plan.chunks(2) {
        let [Stroke::Unit { unit: a, up: false }, Stroke::Unit { unit: b, up: true }] = pair else {
            panic!("not a down and its up");
        };
        assert_eq!(a, b);
    }
    assert_eq!(text_of(&plan), "aü👋");
    assert_eq!(plan.len(), 2 * "aü👋".encode_utf16().count());
}

#[test]
fn control_characters_and_line_breaks_are_never_typed() {
    assert_eq!(
        text_of(&typed(
            "a\u{0}b\nc\u{1b}[d\u{7f}\u{85}\u{2028}\u{2029}\te\r"
        )),
        "abc[de"
    );
    assert!(typed("\n\t\r").is_empty());
    assert!(typed("").is_empty());
}

#[test]
fn long_text_is_cut_at_a_whole_character() {
    // 600 emoji = 1200 units: cut at the cap, never inside a pair
    let plan = typed(&"👋".repeat(600));
    assert_eq!(plan.len(), 2 * TEXT_UNITS);
    assert_eq!(text_of(&plan).chars().count(), TEXT_UNITS / 2);
    // an odd position at the cap: one unit of room is not enough for a pair
    let plan = typed(&format!("a{}", "👋".repeat(600)));
    assert_eq!(plan.len(), 2 * (TEXT_UNITS - 1));
    assert!(text_of(&plan).starts_with('a'));
}

#[test]
fn text_and_keys_arrive_in_the_order_they_were_sent_each_as_one_call() {
    let (keyboard, log) = keyboard(None);
    assert!(keyboard.supported());
    assert!(keyboard.send(KeyAction::Text("grüße 👋".into())));
    assert!(keyboard.send(KeyAction::Key(Key::Enter)));
    assert!(keyboard.send(KeyAction::Key(Key::AltTab)));
    // nothing to type is no call at all
    assert!(keyboard.send(KeyAction::Text("\n".into())));
    assert!(keyboard.send(KeyAction::Key(Key::Tab)));
    let calls = log.until(4);
    assert_eq!(calls.len(), 4);
    assert_eq!(text_of(&calls[0]), "grüße 👋");
    assert_eq!(calls[1], strokes(Key::Enter));
    assert_eq!(calls[2], strokes(Key::AltTab));
    assert_eq!(calls[3], strokes(Key::Tab));
}

#[test]
fn a_call_the_system_took_only_part_of_gets_its_releases_once_more() {
    // the system takes "Alt down" and nothing else
    let (keyboard, log) = keyboard(Some(1));
    assert!(keyboard.send(KeyAction::Key(Key::AltTab)));
    let calls = log.until(2);
    assert_eq!(calls[0], strokes(Key::AltTab));
    assert_eq!(calls[1], [up(Code::Tab), up(Code::Alt)]);
    // … once, not again and again
    std::thread::sleep(Duration::from_millis(30));
    assert_eq!(log.until(2).len(), 2);
}

#[test]
fn a_full_queue_drops_instead_of_piling_up() {
    let log = Log::default();
    let (open, gate) = mpsc::channel::<()>();
    let fake = Fake {
        log: log.clone(),
        takes: None,
        gate: Some(gate),
    };
    let keyboard = Keyboard::with(Box::new(fake));
    // the thread takes the first key and waits at the gate; the queue fills behind it
    let taken = (0..KEY_QUEUE * 3)
        .filter(|_| keyboard.send(KeyAction::Key(Key::Space)))
        .count();
    assert!((KEY_QUEUE..=KEY_QUEUE + 1).contains(&taken), "{taken}");
    drop(open);
    assert_eq!(log.until(taken).len(), taken);
}

#[cfg(not(windows))]
#[test]
fn where_input_cannot_be_simulated_nothing_is_typed() {
    let keyboard = Keyboard::start();
    assert!(!keyboard.supported());
    assert!(!keyboard.send(KeyAction::Key(Key::Enter)));
}
