// scripts/build-index.mjs
// Run with: node scripts/build-index.mjs
// Reads data/transcripts/<episode>/formats/transcript_formatted.txt, chunks by
// sentences, embeds with Xenova/all-MiniLM-L6-v2, and writes a COMPACT index:
//   - public/index/chunks.json      : [{ content, episode }]  (texts + refs)
//   - public/index/embeddings.bin   : raw Float32Array (dim * count) — no JSON bloat
//   - public/index/oracle-index.meta.json : metadata
// This replaces the old @orama/orama JSON dump (~200 MB) which forced the browser
// to JSON.parse 200 MB on every load and carried a full-text index we never use
// (we only do vector search). The compact format loads ~instantly.

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';
import tokenizer from 'gpt-tokenizer';

const TRANSCRIPTS_DIR = path.resolve(process.cwd(), 'data', 'transcripts');
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'index');
const CHUNKS_FILE = path.join(OUTPUT_DIR, 'chunks.json');
const EMB_FILE = path.join(OUTPUT_DIR, 'embeddings.bin');
const META_FILE = path.join(OUTPUT_DIR, 'oracle-index.meta.json');

const CHUNK_SIZE = 500;
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DIM = 384;

// 1. Read all episode transcripts.
function readTranscriptFiles() {
  const files = new Map();
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    console.error(`Transcripts directory not found: ${TRANSCRIPTS_DIR}`);
    process.exit(1);
  }
  const entries = fs.readdirSync(TRANSCRIPTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const txtPath = path.join(TRANSCRIPTS_DIR, entry.name, 'formats', 'transcript_formatted.txt');
    if (!fs.existsSync(txtPath)) continue;
    files.set(entry.name, fs.readFileSync(txtPath, 'utf-8'));
  }
  return files;
}

// Separate the leading timestamp "MM:SS" / "H:MM:SS" kept inline by the subtitle file.
function stripTimestamp(line) {
  return line.replace(/^\s*\d{1,2}:\d{2}(:\d{2})?\s*/, '').trim();
}

// 2. Sentence-line chunking within a token budget.
function splitIntoChunks(text, episodeId) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  const chunks = [];
  let currentLines = [];
  let currentTokens = 0;

  const flush = () => {
    if (currentLines.length > 0) {
      const content = currentLines.join('\n').trim();
      if (content.length > 0) chunks.push({ content, episode: episodeId });
      currentLines = [];
      currentTokens = 0;
    }
  };

  for (const para of paragraphs) {
    const lines = para.split('\n').map(stripTimestamp).filter((l) => l.length > 0);
    for (const line of lines) {
      const lineTokens = tokenizer.encode(line).length;
      if (currentLines.length > 0 && currentTokens + lineTokens > CHUNK_SIZE) flush();
      currentLines.push(line);
      currentTokens += lineTokens;
    }
    flush();
  }

  return chunks;
}

// 3. Main
async function main() {
  console.log('Reading transcripts...');
  const files = readTranscriptFiles();
  if (files.size === 0) {
    console.error('No transcripts found in ' + TRANSCRIPTS_DIR);
    process.exit(1);
  }
  console.log(`Found ${files.size} episode(s).`);

  console.log('Loading embedding pipeline...');
  const embedPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL, {
    pooling: 'mean',
    normalize: true,
  });

  const chunks = [];
  // Process in batches for speed/memory; batching is not required, but keep it simple (sequential).
  for (const [episodeId, text] of files) {
    const epChunks = splitIntoChunks(text, episodeId);
    if (epChunks.length === 0) continue;
    console.log(`Embedding ${episodeId} (${epChunks.length} chunks)...`);
    // Embed in batches of 16 to amortize pipeline overhead.
    for (let i = 0; i < epChunks.length; i += 16) {
      const batch = epChunks.slice(i, i + 16);
      const inputs = batch.map((c) => c.content);
      const out = await embedPipeline(inputs, { pooling: 'mean', normalize: true });
      // out is Tensor of shape [batch, DIM]; use its flat data.
      const arr = Array.isArray(out) ? out : out.data;
      const flat = Array.from(arr);
      for (let j = 0; j < batch.length; j++) {
        const vec = flat.slice(j * DIM, (j + 1) * DIM);
        chunks.push({ ...batch[j], embedding: vec });
      }
    }
  }

  console.log(`Total chunks: ${chunks.length}. Writing compact index...`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write metadata-only JSON (texts + refs) — no embeddings here.
  const docs = chunks.map((c) => ({ content: c.content, episode: c.episode }));
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(docs));

  // Write raw Float32 embeddings.
  const floats = new Float32Array(chunks.length * DIM);
  for (let i = 0; i < chunks.length; i++) {
    floats.set(chunks[i].embedding, i * DIM);
  }
  fs.writeFileSync(EMB_FILE, Buffer.from(floats.buffer));

  // Meta
  const meta = {
    embeddingModel: EMBEDDING_MODEL,
    dim: DIM,
    chunkSize: CHUNK_SIZE,
    builtAt: new Date().toISOString(),
    chunkCount: chunks.length,
    episodeCount: files.size,
    format: 'compact',
  };
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

  // Size report
  const chunksMB = (fs.statSync(CHUNKS_FILE).size / 1024 / 1024).toFixed(1);
  const embMB = (fs.statSync(EMB_FILE).size / 1024 / 1024).toFixed(1);
  const totalMB = (+chunksMB + +embMB).toFixed(1);
  console.log('---');
  console.log(`Episodes: ${files.size}`);
  console.log(`Chunks: ${chunks.length}`);
  console.log(`chunks.json: ${chunksMB} MB`);
  console.log(`embeddings.bin: ${embMB} MB`);
  console.log(`TOTAL: ${totalMB} MB`);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
