#!/usr/bin/env node
// Copies what the scanned-report reader (Tesseract) needs into public/ocr/, so it is served from Intus itself and a
// report is never read with files fetched from a third party at run time. Runs before dev and build; the folder is
// not committed (see .gitignore), because it is ~15 MB of files that come from node_modules anyway.
//
//   worker.min.js                       the Tesseract worker
//   tesseract-core-*-lstm.wasm.js       the engine, in the three builds the worker picks between by browser support
//   eng.traineddata.gz                  English, the smaller "best_int" model
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/ocr');
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];
await mkdir(out, { recursive: true });
for (const [from, to] of files) await copyFile(resolve(root, from), resolve(out, to));
console.log(`copied ${files.length} OCR files to public/ocr/`);
