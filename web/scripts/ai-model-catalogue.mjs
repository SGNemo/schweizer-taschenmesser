#!/usr/bin/env node
/**
 * Pins the local model catalogue: for every entry asks the Hugging Face API for the current commit of
 * the repository and the SHA-256 + size of the file (LFS metadata), and writes them to
 * `src/core/ai/local/catalogue.json`. Needs network access to huggingface.co. Review the diff:
 * a changed checksum for an already pinned file means the file was replaced upstream.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/core/ai/local/catalogue.json', import.meta.url);
const catalogue = JSON.parse(readFileSync(path, 'utf8'));

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

let failed = 0;
for (const model of catalogue.models) {
  try {
    const info = await json(`https://huggingface.co/api/models/${model.repo}`);
    const revision = info.sha;
    const tree = await json(
      `https://huggingface.co/api/models/${model.repo}/tree/${revision}?recursive=1`,
    );
    const file = tree.find((f) => f.path === model.file);
    if (!file?.lfs?.oid) throw new Error(`file ${model.file} not found or not LFS`);
    if (model.sha256 && model.sha256 !== file.lfs.oid) {
      console.warn(`! ${model.id}: checksum changed upstream`);
    }
    Object.assign(model, { revision, sha256: file.lfs.oid, bytes: file.lfs.size ?? file.size });
    console.log(`ok ${model.id} ${revision.slice(0, 8)} ${model.bytes}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${model.id}: ${e.message}`);
  }
}
writeFileSync(path, `${JSON.stringify(catalogue, null, 2)}\n`);
process.exit(failed ? 1 : 0);
