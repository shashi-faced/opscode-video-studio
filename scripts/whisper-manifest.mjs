// Writes src/asr/whisper-models.json: pinned Whisper model files (revision, size, SHA-256).
// Hashes are computed from a full download of the pinned revision and must match the LFS hashes Hugging Face reports.
//   node scripts/whisper-manifest.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODELS = [
  { id: 'base', repo: 'onnx-community/whisper-base_timestamped', label: 'Whisper base (fast, English)', languages: 'English' },
  { id: 'small', repo: 'onnx-community/whisper-small_timestamped', label: 'Whisper small (balanced, all languages)', languages: 'all, incl. Hindi' },
];
const FILES = ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'];
const out = { about: 'Whisper speech models (OpenAI, MIT licence) converted to ONNX by onnx-community on Hugging Face. Only links and checksums ship with Video Studio; the files are downloaded on request (video_assets install whisper-small).', licence: 'MIT', checked: new Date().toISOString().slice(0, 10), models: [] };
for (const m of MODELS) {
  const info = await (await fetch(`https://huggingface.co/api/models/${m.repo}?blobs=true`)).json();
  const blobs = Object.fromEntries(info.siblings.map(s => [s.rfilename, s]));
  const files = [];
  for (const f of FILES) {
    const url = `https://huggingface.co/${m.repo}/resolve/${info.sha}/${f}`;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const lfs = blobs[f]?.lfs?.sha256;
    if (lfs && lfs !== sha256) throw new Error(`${m.repo}/${f}: hash differs from Hugging Face LFS`);
    if (blobs[f]?.size && blobs[f].size !== buf.length) throw new Error(`${m.repo}/${f}: size differs`);
    files.push({ file: f, url, size: buf.length, sha256 });
    process.stderr.write(`${m.id} ${f} ${buf.length}\n`);
  }
  out.models.push({ ...m, revision: info.sha, size: files.reduce((n, f) => n + f.size, 0), files });
}
const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'asr', 'whisper-models.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log(dest);
