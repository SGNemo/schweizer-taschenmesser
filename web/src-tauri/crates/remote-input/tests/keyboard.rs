//! The keyboard's behaviour over keys that only write down what they were asked to type.

use remote_input::{Key, KeyAction, Keyboard, Keys, KEYS, KEY_QUEUE, TEXT_UNITS};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone, PartialEq, Eq)]
enum Did {
    Key(Key),
    Text(Vec<u16>),
}

#[derive(Clone, Default)]
struct Log(Arc<Mutex<Vec<Did>>>);

impl Log {
    fn until(&self, count: usize) -> Vec<Did> {
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

/// Writes down what it is asked; with a gate, every key waits until the gate opens.
struct Fake(Log, Option<Receiver<()>>);

impl Keys for Fake {
    fn key(&mut self, key: Key) {
        if let Some(gate) = &self.1 {
            let _ = gate.recv();
        }
        self.0 .0.lock().unwrap().push(Did::Key(key));
    }
    fn text(&mut self, units: &[u16]) {
        self.0 .0.lock().unwrap().push(Did::Text(units.to_vec()));
    }
}

fn keyboard() -> (Keyboard, Log) {
    let log = Log::default();
    (Keyboard::with(Box::new(Fake(log.clone(), None))), log)
}

fn typed(text: &str) -> Did {
    Did::Text(text.encode_utf16().collect())
}

#[test]
fn text_and_keys_arrive_in_the_order_they_were_sent() {
    let (keyboard, log) = keyboard();
    assert!(keyboard.supported());
    assert!(keyboard.send(KeyAction::Text("grüße 👋".into())));
    assert!(keyboard.send(KeyAction::Key(Key::Enter)));
    assert!(keyboard.send(KeyAction::Key(Key::AltTab)));
    assert_eq!(
        log.until(3),
        [
            typed("grüße 👋"),
            Did::Key(Key::Enter),
            Did::Key(Key::AltTab)
        ]
    );
}

#[test]
fn control_characters_are_never_typed_and_empty_text_is_nothing() {
    let (keyboard, log) = keyboard();
    assert!(keyboard.send(KeyAction::Text("a\u{0}b\nc\u{1b}[d\u{7f}\u{85}".into())));
    assert!(keyboard.send(KeyAction::Text("\n\t\r".into())));
    assert!(keyboard.send(KeyAction::Text("".into())));
    assert!(keyboard.send(KeyAction::Key(Key::Tab)));
    assert_eq!(log.until(2), [typed("abc[d"), Did::Key(Key::Tab)]);
}

#[test]
fn long_text_is_cut_at_a_whole_character() {
    let (keyboard, log) = keyboard();
    // 600 emoji = 1200 units: cut at the cap, never inside a pair
    assert!(keyboard.send(KeyAction::Text("👋".repeat(600).into())));
    // an odd position at the cap: one unit of room is not enough for a pair
    assert!(keyboard.send(KeyAction::Text(format!("a{}", "👋".repeat(600)).into())));
    let all = log.until(2);
    let units = |d: &Did| match d {
        Did::Text(u) => u.clone(),
        Did::Key(_) => panic!("a key"),
    };
    assert_eq!(units(&all[0]).len(), TEXT_UNITS);
    assert!(String::from_utf16(&units(&all[0])).is_ok());
    assert_eq!(units(&all[1]).len(), TEXT_UNITS - 1);
    assert!(String::from_utf16(&units(&all[1])).is_ok());
}

#[test]
fn a_full_queue_drops_instead_of_piling_up() {
    let log = Log::default();
    let (open, gate) = mpsc::channel::<()>();
    let keyboard = Keyboard::with(Box::new(Fake(log.clone(), Some(gate))));
    // the thread takes the first key and waits at the gate; the queue fills behind it
    let taken = (0..KEY_QUEUE * 3)
        .filter(|_| keyboard.send(KeyAction::Key(Key::Space)))
        .count();
    assert!((KEY_QUEUE..=KEY_QUEUE + 1).contains(&taken), "{taken}");
    drop(open);
    assert_eq!(log.until(taken).len(), taken);
}

#[test]
fn the_list_has_sixteen_keys_and_each_one_once() {
    let mut seen = Vec::new();
    for key in KEYS {
        assert!(!seen.contains(&key));
        seen.push(key);
    }
    assert_eq!(seen.len(), 16);
}

#[cfg(not(windows))]
#[test]
fn where_input_cannot_be_simulated_nothing_is_typed() {
    let keyboard = Keyboard::start();
    assert!(!keyboard.supported());
    assert!(!keyboard.send(KeyAction::Key(Key::Enter)));
}
