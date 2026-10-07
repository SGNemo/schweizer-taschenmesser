use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::context::LlamaContext;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::LlamaModel;
use llama_cpp_2::sampling::LlamaSampler;
use llama_cpp_2::token::LlamaToken;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Instant;

#[derive(Debug)]
pub enum EngineError {
    Backend(String),
    Load(String),
    Context(String),
    Prompt(String),
    Decode(String),
    Grammar(String),
    /// The worker thread is gone (the model was unloaded or crashed).
    Closed,
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let (kind, detail) = match self {
            Self::Backend(e) => ("backend", e.as_str()),
            Self::Load(e) => ("load", e.as_str()),
            Self::Context(e) => ("context", e.as_str()),
            Self::Prompt(e) => ("prompt", e.as_str()),
            Self::Decode(e) => ("decode", e.as_str()),
            Self::Grammar(e) => ("grammar", e.as_str()),
            Self::Closed => ("closed", ""),
        };
        write!(f, "{kind}: {detail}")
    }
}

impl std::error::Error for EngineError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Backend {
    Cpu,
    Gpu,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadParams {
    /// Layers to offload to the GPU (0 = CPU only). Ignored by a build without GPU support.
    pub gpu_layers: u32,
    /// Context size in tokens (prompt + answer).
    pub context: u32,
    /// CPU threads; `None` = what the machine offers (physical cores are the best choice).
    pub threads: Option<i32>,
}

impl Default for LoadParams {
    fn default() -> Self {
        Self {
            gpu_layers: 0,
            context: 4096,
            threads: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub parameters: u64,
    pub file_bytes: u64,
    pub train_context: u32,
    pub layers: u32,
    /// Recurrent or hybrid models cannot drop a prompt suffix from the cache.
    pub recurrent: bool,
    /// What the weights actually run on.
    pub backend: Backend,
    pub load_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendDevice {
    pub name: String,
    pub description: String,
    pub backend: String,
    pub memory_total: u64,
    pub memory_free: u64,
    pub gpu: bool,
}

/// Can this CPU run the llama.cpp build of this app? The build uses AVX2/FMA/F16C/BMI2 (see
/// `web/src-tauri/.cargo/config.toml`); on an older x86 CPU nothing of llama.cpp may be called at all.
pub fn cpu_supported() -> bool {
    #[cfg(target_arch = "x86_64")]
    {
        std::is_x86_feature_detected!("avx2")
            && std::is_x86_feature_detected!("fma")
            && std::is_x86_feature_detected!("f16c")
            && std::is_x86_feature_detected!("bmi2")
    }
    #[cfg(not(target_arch = "x86_64"))]
    {
        true
    }
}

/// The ggml devices of this build (CPU always; a GPU only when the build has a GPU backend and the
/// driver is there). Used to offer "GPU" in the settings.
pub fn backend_devices() -> Vec<BackendDevice> {
    use llama_cpp_2::LlamaBackendDeviceType as T;
    if !cpu_supported() {
        return Vec::new();
    }
    llama_cpp_2::list_llama_ggml_backend_devices()
        .into_iter()
        .map(|d| BackendDevice {
            gpu: matches!(d.device_type, T::Gpu | T::IntegratedGpu),
            name: d.name,
            description: d.description,
            backend: d.backend,
            memory_total: d.memory_total as u64,
            memory_free: d.memory_free as u64,
        })
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateRequest {
    /// The fully formatted prompt (chat template applied by the caller).
    pub prompt: String,
    /// GBNF grammar; the answer can only be text the grammar allows. `None` = free text.
    pub grammar: Option<String>,
    pub max_tokens: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum StopReason {
    /// The model (or the grammar) ended the answer.
    Done,
    MaxTokens,
    Cancelled,
    /// The prompt plus the answer would not fit the context.
    ContextFull,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResult {
    pub text: String,
    pub prompt_tokens: u32,
    /// Prompt tokens that were still in the KV cache from the previous request (not evaluated again).
    pub cached_tokens: u32,
    pub generated_tokens: u32,
    pub prompt_ms: u64,
    pub generate_ms: u64,
    pub stop: StopReason,
}

/// A loaded model and its context. Not `Send`: use [`Worker`] to share it between threads.
pub struct Engine {
    // Field order matters: the context borrows the model and must be dropped first.
    ctx: LlamaContext<'static>,
    model: Box<LlamaModel>,
    _backend: LlamaBackend,
    /// Tokens whose keys/values are in the cache (sequence 0).
    cached: Vec<LlamaToken>,
    pub info: ModelInfo,
    n_batch: usize,
}

impl Engine {
    pub fn load(path: &Path, params: &LoadParams) -> Result<Self, EngineError> {
        let started = Instant::now();
        if !cpu_supported() {
            return Err(EngineError::Backend("cpu-unsupported".into()));
        }
        let mut backend = LlamaBackend::init().map_err(|e| EngineError::Backend(e.to_string()))?;
        backend.void_logs(); // nothing from llama.cpp is printed or logged
        let wants_gpu = params.gpu_layers > 0 && backend.supports_gpu_offload();
        let model_params = LlamaModelParams::default().with_n_gpu_layers(if wants_gpu {
            params.gpu_layers
        } else {
            0
        });
        let model = Box::new(
            LlamaModel::load_from_file(&backend, path, &model_params)
                .map_err(|e| EngineError::Load(e.to_string()))?,
        );
        let n_batch = 512u32;
        let mut ctx_params = LlamaContextParams::default()
            .with_n_ctx(NonZeroU32::new(params.context.max(512)))
            .with_n_batch(n_batch)
            .with_n_ubatch(n_batch);
        if let Some(t) = params.threads {
            ctx_params = ctx_params.with_n_threads(t).with_n_threads_batch(t);
        }
        let ctx = model
            .new_context(&backend, ctx_params)
            .map_err(|e| EngineError::Context(e.to_string()))?;
        // SAFETY: the context only borrows `model`, which lives in a `Box` (stable address) owned by
        // the same struct and declared after `ctx`, so it is dropped after it and never moved out.
        let ctx: LlamaContext<'static> = unsafe { std::mem::transmute(ctx) };
        let info = ModelInfo {
            parameters: model.n_params(),
            file_bytes: model.size(),
            train_context: model.n_ctx_train(),
            layers: model.n_layer(),
            recurrent: model.is_recurrent() || model.is_hybrid(),
            backend: if wants_gpu {
                Backend::Gpu
            } else {
                Backend::Cpu
            },
            load_ms: started.elapsed().as_millis() as u64,
        };
        Ok(Self {
            ctx,
            model,
            _backend: backend,
            cached: Vec::new(),
            info,
            n_batch: n_batch as usize,
        })
    }

    /// Forgets the cached prompt (the next request evaluates everything again).
    pub fn reset_cache(&mut self) {
        self.ctx.clear_kv_cache();
        self.cached.clear();
    }

    /// Generates an answer. `on_piece` receives text as it is produced (valid UTF-8 only) and returns
    /// `false` to stop; `cancel` stops at the next token as well.
    ///
    /// The prompt prefix shared with the previous request (system prompt, schema, examples) is not
    /// evaluated again – that is what keeps a request on a phone-class CPU in seconds.
    pub fn generate(
        &mut self,
        req: &GenerateRequest,
        cancel: &AtomicBool,
        mut on_piece: impl FnMut(&str) -> bool,
    ) -> Result<GenerateResult, EngineError> {
        let vocab = self.model.vocab();
        let tokens = vocab.tokenize(req.prompt.as_bytes(), vocab.should_add_bos(), true);
        if tokens.is_empty() {
            return Err(EngineError::Prompt("empty prompt".into()));
        }
        let n_ctx = self.ctx.n_ctx() as usize;
        if tokens.len() + 1 >= n_ctx {
            return Err(EngineError::Prompt(format!(
                "prompt of {} tokens does not fit {n_ctx}",
                tokens.len()
            )));
        }

        // Reuse the common prefix. The last prompt token is always evaluated again (we need its logits).
        let mut keep = tokens
            .iter()
            .zip(&self.cached)
            .take_while(|(a, b)| a == b)
            .count();
        keep = keep.min(tokens.len() - 1);
        if keep < self.cached.len() {
            let trimmed = !self.info.recurrent
                && self.ctx.kv_cache_seq_rm(0, Some(keep as u32), None).is_ok();
            if !trimmed {
                self.ctx.clear_kv_cache();
                keep = 0;
            }
        }
        self.cached.truncate(keep);

        let started = Instant::now();
        let mut batch = LlamaBatch::new(self.n_batch, 1);
        let mut pos = keep;
        while pos < tokens.len() {
            batch.clear();
            let end = (pos + self.n_batch).min(tokens.len());
            for (i, token) in tokens[pos..end].iter().enumerate() {
                let last = pos + i == tokens.len() - 1;
                batch
                    .add(*token, (pos + i) as i32, &[0], last)
                    .map_err(|e| EngineError::Decode(e.to_string()))?;
            }
            self.ctx
                .decode(&mut batch)
                .map_err(|e| EngineError::Decode(e.to_string()))?;
            self.cached.extend_from_slice(&tokens[pos..end]);
            pos = end;
            if cancel.load(Ordering::Relaxed) {
                return Ok(GenerateResult {
                    text: String::new(),
                    prompt_tokens: tokens.len() as u32,
                    cached_tokens: keep as u32,
                    generated_tokens: 0,
                    prompt_ms: started.elapsed().as_millis() as u64,
                    generate_ms: 0,
                    stop: StopReason::Cancelled,
                });
            }
        }
        let prompt_ms = started.elapsed().as_millis() as u64;

        let mut sampler = match &req.grammar {
            Some(grammar) => LlamaSampler::chain_simple([
                LlamaSampler::grammar(&self.model, grammar, "root")
                    .map_err(|e| EngineError::Grammar(e.to_string()))?,
                LlamaSampler::greedy(),
            ]),
            None => LlamaSampler::chain_simple([LlamaSampler::greedy()]),
        };

        let generating = Instant::now();
        let mut text = String::new();
        let mut pending: Vec<u8> = Vec::new();
        let mut generated = 0u32;
        let mut stop = StopReason::MaxTokens;
        let mut at = tokens.len();
        let mut last_index = batch.n_tokens() - 1;
        while generated < req.max_tokens {
            if cancel.load(Ordering::Relaxed) {
                stop = StopReason::Cancelled;
                break;
            }
            let token = sampler.sample(&self.ctx, last_index);
            if vocab.is_eog(token) {
                stop = StopReason::Done;
                break;
            }
            generated += 1;
            pending.extend(vocab.token_to_piece(token, false, None));
            // Emit the longest valid UTF-8 prefix; a split multi-byte character waits for its rest.
            let valid = match std::str::from_utf8(&pending) {
                Ok(s) => s.len(),
                Err(e) => e.valid_up_to(),
            };
            if valid > 0 {
                let piece = String::from_utf8_lossy(&pending[..valid]).into_owned();
                pending.drain(..valid);
                text.push_str(&piece);
                if !on_piece(&piece) {
                    stop = StopReason::Cancelled;
                    break;
                }
            }
            if at + 1 >= n_ctx {
                stop = StopReason::ContextFull;
                break;
            }
            batch.clear();
            batch
                .add(token, at as i32, &[0], true)
                .map_err(|e| EngineError::Decode(e.to_string()))?;
            self.ctx
                .decode(&mut batch)
                .map_err(|e| EngineError::Decode(e.to_string()))?;
            self.cached.push(token);
            at += 1;
            last_index = 0;
        }
        Ok(GenerateResult {
            text,
            prompt_tokens: tokens.len() as u32,
            cached_tokens: keep as u32,
            generated_tokens: generated,
            prompt_ms,
            generate_ms: generating.elapsed().as_millis() as u64,
            stop,
        })
    }
}

type Job = Box<dyn FnOnce(&mut Engine) + Send>;

/// An [`Engine`] on its own thread, usable from any thread (the Tauri state holds one). Dropping the
/// worker unloads the model.
pub struct Worker {
    tx: Option<Sender<Job>>,
    thread: Option<JoinHandle<()>>,
    pub info: ModelInfo,
}

impl Worker {
    pub fn spawn(path: &Path, params: &LoadParams) -> Result<Self, EngineError> {
        let (tx, rx): (Sender<Job>, Receiver<Job>) = mpsc::channel();
        let (ready_tx, ready_rx) = mpsc::channel();
        let path = path.to_path_buf();
        let params = params.clone();
        let thread = thread::Builder::new()
            .name("nemo-local-llm".into())
            .spawn(move || match Engine::load(&path, &params) {
                Ok(mut engine) => {
                    let _ = ready_tx.send(Ok(engine.info.clone()));
                    while let Ok(job) = rx.recv() {
                        job(&mut engine);
                    }
                }
                Err(e) => {
                    let _ = ready_tx.send(Err(e));
                }
            })
            .map_err(|e| EngineError::Backend(e.to_string()))?;
        let info = ready_rx.recv().map_err(|_| EngineError::Closed)??;
        Ok(Self {
            tx: Some(tx),
            thread: Some(thread),
            info,
        })
    }

    /// Runs one generation on the worker thread and waits for it. Requests are served one at a time.
    pub fn generate(
        &self,
        req: GenerateRequest,
        cancel: Arc<AtomicBool>,
        on_piece: impl FnMut(&str) -> bool + Send + 'static,
    ) -> Result<GenerateResult, EngineError> {
        let (reply_tx, reply_rx) = mpsc::channel();
        let job: Job = Box::new(move |engine| {
            let mut on_piece = on_piece;
            let _ = reply_tx.send(engine.generate(&req, &cancel, |p| on_piece(p)));
        });
        self.tx
            .as_ref()
            .ok_or(EngineError::Closed)?
            .send(job)
            .map_err(|_| EngineError::Closed)?;
        reply_rx.recv().map_err(|_| EngineError::Closed)?
    }

    pub fn reset_cache(&self) {
        if let Some(tx) = &self.tx {
            let _ = tx.send(Box::new(|e: &mut Engine| e.reset_cache()));
        }
    }
}

impl Drop for Worker {
    fn drop(&mut self) {
        self.tx.take(); // ends the loop; the engine is dropped on its own thread
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}
