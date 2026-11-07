//! The store passes the shared contracts: the LWW rule (`contract/lww-cases.json`) and the
//! `store` level of the paging contract (`contract/sync-paging-cases.json`). The same files are
//! read by the TypeScript client and the Node server.

use lan_sync::{FieldOp, Store};
use serde_json::{json, Value};
use std::collections::BTreeMap;

fn contract(name: &str) -> Value {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../../contract/");
    let text = std::fs::read_to_string(format!("{path}{name}")).expect("contract file");
    serde_json::from_str(&text).expect("contract json")
}

fn ops(v: &Value) -> Vec<FieldOp> {
    serde_json::from_value(v.clone()).expect("ops")
}

/// Final state as a client would rebuild it from a full pull: "collection/id" → field → {hlc, value}.
fn final_state(batches: &[Vec<FieldOp>]) -> Value {
    let mut store = Store::open(":memory:").unwrap();
    for batch in batches {
        store.push(batch).unwrap();
    }
    let mut state: BTreeMap<String, BTreeMap<String, Value>> = BTreeMap::new();
    for op in store.pull(0, 100_000).unwrap().ops {
        state
            .entry(format!("{}/{}", op.collection, op.id))
            .or_default()
            .insert(op.field, json!({ "hlc": op.hlc, "value": op.value }));
    }
    serde_json::to_value(state).unwrap()
}

#[test]
fn lww_cases() {
    let doc = contract("lww-cases.json");
    let cases = doc["cases"].as_array().unwrap();
    assert!(cases.len() > 5);
    for c in cases {
        let name = c["name"].as_str().unwrap();
        let batches: Vec<Vec<FieldOp>> = c["batches"].as_array().unwrap().iter().map(ops).collect();
        assert_eq!(final_state(&batches), c["expected"], "{name}");
        // Arrival order must not matter.
        let reversed: Vec<Vec<FieldOp>> = batches
            .iter()
            .rev()
            .map(|b| b.iter().rev().cloned().collect())
            .collect();
        assert_eq!(final_state(&reversed), c["expected"], "{name} (reversed)");
    }
}

#[test]
fn paging_store_cases() {
    let doc = contract("sync-paging-cases.json");
    let mut run = 0;
    for c in doc["cases"].as_array().unwrap() {
        if c["level"] != "store" {
            continue;
        }
        run += 1;
        let name = c["name"].as_str().unwrap();
        let mut store = Store::open(":memory:").unwrap();
        let mut epoch = store.epoch().unwrap();
        let mut check_epoch = |want: &Value, seen: String, name: &str| {
            match want.as_str() {
                Some("same") => assert_eq!(seen, epoch, "{name}: epoch"),
                Some("changed") => assert_ne!(seen, epoch, "{name}: epoch"),
                _ => {}
            }
            epoch = seen;
        };
        for step in c["steps"].as_array().unwrap() {
            let want = &step["expect"];
            if let Some(batch) = step.get("push") {
                let res = store.push(&ops(batch)).unwrap();
                assert_eq!(res.accepted as u64, want["accepted"], "{name}: accepted");
                assert_eq!(res.cursor as u64, want["cursor"], "{name}: cursor");
                check_epoch(&want["epoch"], store.epoch().unwrap(), name);
            } else if let Some(p) = step.get("pull") {
                let res = store
                    .pull(
                        p["since"].as_i64().unwrap(),
                        p["limit"].as_u64().unwrap() as usize,
                    )
                    .unwrap();
                assert_eq!(
                    serde_json::to_value(&res.ops).unwrap(),
                    want["ops"],
                    "{name}: ops"
                );
                assert_eq!(res.cursor as u64, want["cursor"], "{name}: cursor");
                assert_eq!(res.more, want["more"], "{name}: more");
            } else if step.get("reset").is_some() {
                check_epoch(&want["epoch"], store.reset().unwrap(), name);
            } else {
                panic!("{name}: unknown step {step}");
            }
        }
    }
    assert!(run >= 5, "store-level cases are missing");
}

#[test]
fn data_survives_reopen() {
    let dir = std::env::temp_dir().join(format!("lan-sync-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("hub.db");
    let path = path.to_str().unwrap();
    let op = FieldOp {
        collection: "todos_task".into(),
        id: "r1".into(),
        field: "title".into(),
        hlc: "0000000001000-0000-aaaa0001".into(),
        value: json!("enc:v1:x"),
    };
    let epoch = {
        let mut s = Store::open(path).unwrap();
        s.push(&[op.clone()]).unwrap();
        s.epoch().unwrap()
    };
    let mut s = Store::open(path).unwrap();
    assert_eq!(s.epoch().unwrap(), epoch);
    assert_eq!(s.pull(0, 10).unwrap().ops, vec![op.clone()]);
    // The sequence continues instead of restarting.
    let next = FieldOp {
        id: "r2".into(),
        ..op
    };
    assert_eq!(s.push(&[next]).unwrap().cursor, 2);
    drop(s);
    std::fs::remove_dir_all(dir).ok();
}
