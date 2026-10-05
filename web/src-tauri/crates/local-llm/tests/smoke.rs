//! Plumbing tests with a tiny random-weights model (`tests/make_smoke_gguf.py`). They are skipped
//! unless `NEMO_SMOKE_GGUF` points at such a file, so CI does not need a model download; the model
//! understands nothing – the grammar is what makes its output valid.

use local_llm::{Engine, GenerateRequest, LoadParams, StopReason, Worker};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

fn model() -> Option<PathBuf> {
    let path = std::env::var("NEMO_SMOKE_GGUF").ok().map(PathBuf::from);
    if path.is_none() {
        eprintln!("NEMO_SMOKE_GGUF not set: skipping");
    }
    path
}

/// Every repetition is bounded: a model that never chooses to stop would otherwise run to the token limit.
const GRAMMAR: &str = r#"
root ::= "{" ws "\"ok\"" ws ":" ws ("true" | "false") ws "," ws "\"n\"" ws ":" ws [0-9]{1,4} ws "}"
ws ::= [ \t\n]{0,2}
"#;

fn request(prompt: &str, grammar: Option<&str>, max_tokens: u32) -> GenerateRequest {
    GenerateRequest { prompt: prompt.into(), grammar: grammar.map(str::to_string), max_tokens }
}

#[test]
fn loads_and_describes_the_model() {
    let Some(path) = model() else { return };
    let engine = Engine::load(&path, &LoadParams { context: 512, ..LoadParams::default() }).unwrap();
    assert_eq!(engine.info.layers, 2);
    assert!(engine.info.parameters > 10_000);
    assert_eq!(engine.info.backend, local_llm::Backend::Cpu);
}

#[test]
fn the_grammar_decides_what_comes_out() {
    let Some(path) = model() else { return };
    let mut engine = Engine::load(&path, &LoadParams { context: 512, ..LoadParams::default() }).unwrap();
    let no = AtomicBool::new(false);
    let mut streamed = String::new();
    let result = engine
        .generate(&request("Write the answer:", Some(GRAMMAR), 200), &no, |p| {
            streamed.push_str(p);
            true
        })
        .unwrap();
    let json: serde_json::Value = serde_json::from_str(&result.text).expect("grammar output is valid JSON");
    assert!(json["ok"].is_boolean() && json["n"].is_number());
    assert_eq!(streamed, result.text);
    assert_eq!(result.stop, StopReason::Done);
}

#[test]
fn reuses_the_prompt_prefix_and_stays_deterministic() {
    let Some(path) = model() else { return };
    let mut engine = Engine::load(&path, &LoadParams { context: 512, ..LoadParams::default() }).unwrap();
    let no = AtomicBool::new(false);
    let prefix = "You turn sentences into JSON. ".repeat(8);
    let first = engine.generate(&request(&format!("{prefix}one"), Some(GRAMMAR), 200), &no, |_| true).unwrap();
    assert_eq!(first.cached_tokens, 0);
    let second = engine.generate(&request(&format!("{prefix}two"), Some(GRAMMAR), 200), &no, |_| true).unwrap();
    assert!(second.cached_tokens > 30, "shared prefix is not evaluated again: {}", second.cached_tokens);
    // The same prompt again gives the same answer, with or without the cache.
    let again = engine.generate(&request(&format!("{prefix}two"), Some(GRAMMAR), 200), &no, |_| true).unwrap();
    assert_eq!(again.text, second.text);
    engine.reset_cache();
    let cold = engine.generate(&request(&format!("{prefix}two"), Some(GRAMMAR), 200), &no, |_| true).unwrap();
    assert_eq!(cold.cached_tokens, 0);
    assert_eq!(cold.text, second.text);
}

#[test]
fn stops_on_cancel_callback_and_token_limit() {
    let Some(path) = model() else { return };
    let mut engine = Engine::load(&path, &LoadParams { context: 512, ..LoadParams::default() }).unwrap();
    let cancel = AtomicBool::new(true);
    let cancelled = engine.generate(&request("hello", None, 50), &cancel, |_| true).unwrap();
    assert_eq!(cancelled.stop, StopReason::Cancelled);
    assert_eq!(cancelled.generated_tokens, 0);

    let no = AtomicBool::new(false);
    let mut pieces = 0;
    let stopped = engine
        .generate(&request("hello", None, 50), &no, |_| {
            pieces += 1;
            pieces < 3
        })
        .unwrap();
    assert_eq!(stopped.stop, StopReason::Cancelled);
    assert!(stopped.generated_tokens <= 3);

    let limited = engine.generate(&request("hello", None, 5), &no, |_| true).unwrap();
    assert!(limited.generated_tokens <= 5);
}

#[test]
fn rejects_a_prompt_that_does_not_fit() {
    let Some(path) = model() else { return };
    let mut engine = Engine::load(&path, &LoadParams { context: 512, ..LoadParams::default() }).unwrap();
    let huge = "x".repeat(4000);
    assert!(engine.generate(&request(&huge, None, 10), &AtomicBool::new(false), |_| true).is_err());
}

#[test]
fn the_worker_serves_requests_from_other_threads_and_unloads_on_drop() {
    let Some(path) = model() else { return };
    let worker = Arc::new(Worker::spawn(&path, &LoadParams { context: 512, ..LoadParams::default() }).unwrap());
    let handles: Vec<_> = (0..3)
        .map(|i| {
            let w = Arc::clone(&worker);
            std::thread::spawn(move || {
                w.generate(request(&format!("job {i}"), Some(GRAMMAR), 200), Arc::new(AtomicBool::new(false)), |_| true)
                    .unwrap()
            })
        })
        .collect();
    for h in handles {
        let r = h.join().unwrap();
        assert!(serde_json::from_str::<serde_json::Value>(&r.text).is_ok());
    }
    let cancel = Arc::new(AtomicBool::new(false));
    cancel.store(true, Ordering::Relaxed);
    let r = worker.generate(request("x", None, 20), cancel, |_| true).unwrap();
    assert_eq!(r.stop, StopReason::Cancelled);
    drop(worker); // joins the thread; the model is freed
}
