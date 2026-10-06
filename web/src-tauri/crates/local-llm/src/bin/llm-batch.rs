//! Evaluation helper: runs a batch of prompts through one loaded model and writes one JSON line per
//! answer plus a summary (load time, peak memory). `npm run ai:eval` builds the prompts and grammars
//! in TypeScript and scores the answers there; this binary only runs the model (the same engine the
//! app ships), so what is measured is what runs.
//!
//! `llm-batch --model m.gguf --input cases.jsonl --output out.jsonl [--gpu-layers N] [--context N] [--threads N]`
//! Input line: `{"id": "...", "prompt": "...", "grammar": "...", "max_tokens": 400}`.

use local_llm::{peak_memory_bytes, Engine, GenerateRequest, LoadParams};
use serde::Deserialize;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

#[derive(Deserialize)]
struct Case {
    id: String,
    prompt: String,
    grammar: Option<String>,
    max_tokens: Option<u32>,
}

fn arg(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let model = PathBuf::from(arg(&args, "--model").ok_or("--model is required")?);
    let input = arg(&args, "--input").ok_or("--input is required")?;
    let output = arg(&args, "--output").ok_or("--output is required")?;
    let params = LoadParams {
        gpu_layers: arg(&args, "--gpu-layers")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0),
        context: arg(&args, "--context")
            .and_then(|v| v.parse().ok())
            .unwrap_or(4096),
        threads: arg(&args, "--threads").and_then(|v| v.parse().ok()),
    };
    let mut engine = Engine::load(&model, &params)?;
    let mut out = std::fs::File::create(output)?;
    let cancel = AtomicBool::new(false);
    for line in BufReader::new(std::fs::File::open(input)?).lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let case: Case = serde_json::from_str(&line)?;
        let request = GenerateRequest {
            prompt: case.prompt,
            grammar: case.grammar,
            max_tokens: case.max_tokens.unwrap_or(400),
        };
        let row = match engine.generate(&request, &cancel, |_| true) {
            Ok(r) => serde_json::json!({ "id": case.id, "ok": true, "result": r }),
            Err(e) => serde_json::json!({ "id": case.id, "ok": false, "error": e.to_string() }),
        };
        writeln!(out, "{row}")?;
    }
    writeln!(
        out,
        "{}",
        serde_json::json!({ "summary": { "info": engine.info, "peak_memory_bytes": peak_memory_bytes() } })
    )?;
    Ok(())
}
