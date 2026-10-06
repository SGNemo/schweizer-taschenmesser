#!/usr/bin/env python3
"""Writes a tiny llama-architecture GGUF with RANDOM weights (~400 KB) for plumbing tests: loading, grammar-
constrained generation, KV-cache reuse and cancel. It cannot understand anything – the grammar is what makes
its output valid. Usage: python3 make_smoke_gguf.py out.gguf   (needs `pip install gguf numpy`)."""
import sys
import numpy as np
import gguf

out = sys.argv[1] if len(sys.argv) > 1 else "smoke.gguf"
rng = np.random.default_rng(7)
N_EMBD, N_HEAD, N_LAYER, N_FF, N_CTX = 64, 4, 2, 128, 512

# Vocabulary: <unk>, <s>, </s>, 256 byte tokens, printable ASCII as single-character pieces.
tokens = ["<unk>", "<s>", "</s>"] + [f"<0x{b:02X}>" for b in range(256)]
types = [gguf.TokenType.UNKNOWN, gguf.TokenType.CONTROL, gguf.TokenType.CONTROL] + [gguf.TokenType.BYTE] * 256
for c in range(32, 127):
    tokens.append("▁" if c == 32 else chr(c))
    types.append(gguf.TokenType.NORMAL)
scores = [0.0] * len(tokens)
n_vocab = len(tokens)

w = gguf.GGUFWriter(out, "llama")
w.add_name("nemo-smoke")
w.add_context_length(N_CTX)
w.add_embedding_length(N_EMBD)
w.add_block_count(N_LAYER)
w.add_feed_forward_length(N_FF)
w.add_head_count(N_HEAD)
w.add_head_count_kv(N_HEAD)
w.add_layer_norm_rms_eps(1e-5)
w.add_rope_dimension_count(N_EMBD // N_HEAD)
w.add_file_type(gguf.LlamaFileType.ALL_F32)
w.add_tokenizer_model("llama")
w.add_token_list(tokens)
w.add_token_scores(scores)
w.add_token_types(types)
w.add_bos_token_id(1)
w.add_eos_token_id(2)
w.add_unk_token_id(0)
w.add_add_bos_token(True)


def t(name, *shape, norm=False):
    data = np.ones(shape, dtype=np.float32) if norm else (rng.standard_normal(shape) * 0.05).astype(np.float32)
    w.add_tensor(name, data)


t("token_embd.weight", n_vocab, N_EMBD)
t("output_norm.weight", N_EMBD, norm=True)
t("output.weight", n_vocab, N_EMBD)
for i in range(N_LAYER):
    t(f"blk.{i}.attn_norm.weight", N_EMBD, norm=True)
    for p in ("q", "k", "v"):
        t(f"blk.{i}.attn_{p}.weight", N_EMBD, N_EMBD)
    t(f"blk.{i}.attn_output.weight", N_EMBD, N_EMBD)
    t(f"blk.{i}.ffn_norm.weight", N_EMBD, norm=True)
    t(f"blk.{i}.ffn_gate.weight", N_FF, N_EMBD)
    t(f"blk.{i}.ffn_up.weight", N_FF, N_EMBD)
    t(f"blk.{i}.ffn_down.weight", N_EMBD, N_FF)

w.write_header_to_file()
w.write_kv_data_to_file()
w.write_tensors_to_file()
w.close()
print(f"wrote {out}")
