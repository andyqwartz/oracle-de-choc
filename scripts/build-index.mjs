// scripts/build-index.mjs
// Run with: node scripts/build-index.mjs
// Reads data/transcripts/*.md, chunks by paragraphs, embeds with Xenova/all-MiniLM-L6-v2,
// persists to public/index/oracle-index.json via @orama/orama.

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';
import { create } from '@orama/orama';
import { persist } from '@orama/plugin-data-persistence';
import tokenizer from 'gpt-tokenizer';

const TRANSCRIPTS_DIR = path.resolve(process.cwd(), 'data', 'transcripts');
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'index');
const INDEX_FILE = path.join(OUTPUT_DIR, 'oracle-index.json');
const META_FILE = path.join(OUTPUT_DIR, 'oracle-index.meta.json');

const CHUNK_SIZE = 350;
const CHUNK_OVERLAP = 60;

// 1. Read all .md and .txt files from data/transcripts/
function readTranscriptFiles() {
  const files = new Map();

  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    console.error(`Transcripts directory not found: ${TRANSCRIPTS_DIR}`);
    console.error('Create data/transcripts/ and add .md or .txt files.');
    process.exit(1);
  }

  const entries = fs.readdirSync(TRANSCRIPTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== '.md' && ext !== '.txt') continue;
    const filePath = path.join(TRANSCRIPTS_DIR, entry.name);
    const content = fs.readFileSync(filePath, 'utf-8');
    const id = path.basename(entry.name, ext);
    files.set(id, content);
  }

  return files;
}

// 2. Split text into paragraphs (separated by blank lines), then chunk with overlap
function splitIntoChunks(text, episodeId) {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

  const chunks = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const paraTokens = tokenizer.encode(para).ids.length;

    if (currentChunk.length > 0 && tokenizer.encode(currentChunk).ids.length + paraTokens > CHUNK_SIZE) {
      chunks.push({ content: currentChunk.trim(), episode: episodeId, chunkIndex: chunkIndex++ });
      const overlapTokens = tokenizer.encode(currentChunk).ids.slice(-CHUNK_OVERLAP);
      currentChunk = tokenizer.decode(overlapTokens) + '\n\n' + para;
    } else {
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + para;
      } else {
        currentChunk = para;
      }
    }

    while (tokenizer.encode(currentChunk).ids.length > CHUNK_SIZE) {
      const tokens = tokenizer.encode(currentChunk);
      const limitTokens = tokens.ids.slice(0, CHUNK_SIZE);
      const limitText = tokenizer.decode(limitTokens);
      chunks.push({ content: limitText.trim(), episode: episodeId, chunkIndex: chunkIndex++ });
      const remainderTokens = tokens.ids.slice(CHUNK_SIZE - CHUNK_OVERLAP);
      currentChunk = tokenizer.decode(remainderTokens);
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({ content: currentChunk.trim(), episode: episodeId, chunkIndex: chunkIndex });
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
      const vector = Array.isArray(embedding) ? embedding : Array.from(embedding);

      await db.insert({
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

  const jsonData = await persist(db, 'json');
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
