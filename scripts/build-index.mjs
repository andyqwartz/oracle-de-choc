// scripts/build-index.mjs
// Run with: node scripts/build-index.mjs
// Reads data/transcripts/*.md, chunks by paragraphs, embeds with Xenova/all-MiniLM-L6-v2,
// persists to public/index/oracle-index.json via @orama/orama.

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';
import { create, insert, save } from '@orama/orama';
import tokenizer from 'gpt-tokenizer';

const TRANSCRIPTS_DIR = path.resolve(process.cwd(), 'data', 'transcripts');
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'index');
const INDEX_FILE = path.join(OUTPUT_DIR, 'oracle-index.json');
const META_FILE = path.join(OUTPUT_DIR, 'oracle-index.meta.json');

const CHUNK_SIZE = 350;
const CHUNK_OVERLAP = 60;

// 1. Read all episode transcripts. Each sub-directory of data/transcripts/ is one
//    episode; its formatted text lives at <episode>/formats/transcript_formatted.txt.
function readTranscriptFiles() {
  const files = new Map();

  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    console.error(`Transcripts directory not found: ${TRANSCRIPTS_DIR}`);
    console.error('Expected one sub-directory per episode, each containing formats/transcript_formatted.txt.');
    process.exit(1);
  }

  const entries = fs.readdirSync(TRANSCRIPTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const episodeDir = path.join(TRANSCRIPTS_DIR, entry.name);
    const txtPath = path.join(episodeDir, 'formats', 'transcript_formatted.txt');
    if (!fs.existsSync(txtPath)) continue;
    const content = fs.readFileSync(txtPath, 'utf-8');
    files.set(entry.name, content);
  }

  return files;
}

// 2. Split text into chunks. The formatted transcripts are one subtitle-style line
//    per sentence, each prefixed with a timestamp like "56:02 ". Every line is a
//    phrase block separated by a blank line. We strip the timestamp prefix, drop
//    empty/short markers, then accumulate lines until the CHUNK_SIZE token budget.
//    gpt-tokenizer v2 returns a plain number[] from encode() (no .ids), so we use it directly.
function stripTimestamp(line) {
  // Matches "MM:SS", "H:MM:SS", with optional trailing space.
  return line.replace(/^\s*\d{1,2}:\d{2}(:\d{2})?\s*/, '').trim();
}

function splitIntoChunks(text, episodeId) {
  // Split into line-blocks (paragraphs separated by blank lines), then into lines.
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

  const chunks = [];
  let currentLines = [];
  let currentTokens = 0;

  const flush = () => {
    if (currentLines.length > 0) {
      const content = currentLines.join('\n').trim();
      if (content.length > 0) {
        chunks.push({ content, episode: episodeId, chunkIndex: chunks.length });
      }
      currentLines = [];
      currentTokens = 0;
    }
  };

  for (const para of paragraphs) {
    const lines = para.split('\n')
      .map(stripTimestamp)
      .filter(l => l.length > 0);

    for (const line of lines) {
      const lineTokens = tokenizer.encode(line).length;
      if (currentLines.length > 0 && currentTokens + lineTokens > CHUNK_SIZE) {
        flush();
      }
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
    console.error('No .md or .txt files found in data/transcripts/');
    process.exit(1);
  }

  console.log(`Found ${files.size} transcript file(s).`);

  // Load embedding pipeline once
  console.log('Loading embedding pipeline...');
  const embedPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    pooling: 'mean',
    normalize: true,
  });

  // Create Orama instance
  console.log('Creating Orama index...');
  const db = await create({
    schema: {
      content: 'string',
      embedding: 'vector[384]',
      episode: 'string',
      chunkIndex: 'number',
    },
  });

  // Process each file
  let totalChunks = 0;
  for (const [episodeId, text] of files) {
    console.log(`Processing ${episodeId}...`);
    const chunks = splitIntoChunks(text, episodeId);

    for (const chunk of chunks) {
      const embedding = await embedPipeline(chunk.content, { pooling: 'mean', normalize: true });
      // transformers.js returns a Tensor; its flat data (typed array) is the 384-dim vector.
      const vector = Array.from(embedding.data);

      await insert(db, {
        content: chunk.content,
        embedding: vector,
        episode: chunk.episode,
        chunkIndex: chunk.chunkIndex,
      });

      totalChunks++;
    }
  }

  // Persist
  console.log(`Total chunks: ${totalChunks}. Persisting index...`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const jsonData = await save(db);
  fs.writeFileSync(INDEX_FILE, JSON.stringify(jsonData));

  // Write meta
  const meta = {
    embeddingModel: 'Xenova/all-MiniLM-L6-v2',
    dim: 384,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    builtAt: new Date().toISOString(),
    chunkCount: totalChunks,
    episodeCount: files.size,
  };
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

  // Size report
  const stats = fs.statSync(INDEX_FILE);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('---');
  console.log(`Files processed: ${files.size}`);
  console.log(`Total chunks: ${totalChunks}`);
  console.log(`Index size: ${sizeMb} MB`);
  console.log(`Output: ${INDEX_FILE}`);
  console.log(`Meta: ${META_FILE}`);

  if (stats.size >= 50 * 1024 * 1024) {
    console.log('WARNING: Index is >= 50 MB. Consider pushing to a Hugging Face dataset repo.');
  }
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
