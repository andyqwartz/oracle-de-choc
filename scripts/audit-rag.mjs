// scripts/audit-rag.mjs — end-to-end RAG audit harness (Node).
// Verifies: index integrity, embedding load, query embedding, retrieval relevance.
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from '@huggingface/transformers';

const DIR = path.resolve('public/index');
const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';

async function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'oracle-index.meta.json'), 'utf-8'));
  const docs = JSON.parse(fs.readFileSync(path.join(DIR, 'chunks.json'), 'utf-8'));
  // Must copy to a real ArrayBuffer: new Float32Array(Buffer) would mis-read bytes as floats.
  const embBuf = fs.readFileSync(path.join(DIR, 'embeddings.bin'));
  const emb = new Float32Array(embBuf.buffer.slice(embBuf.byteOffset, embBuf.byteOffset + embBuf.byteLength));

  console.log('=== INDEX ===');
  console.log('meta:', JSON.stringify(meta));
  console.log(`docs=${docs.length} embFloats=${emb.length} expected=${docs.length * meta.dim}`);
  if (emb.length !== docs.length * meta.dim) throw new Error('SIZE MISMATCH');
  console.log('OK: index self-consistent');

  console.log('\n=== EMBEDDING MODEL ===');
  const extract = await pipeline('feature-extraction', EMBED_MODEL, { pooling: 'mean', normalize: true });
  console.log('pipeline ready');

  const queries = [
    'dérives sectaires et emprise mentale',
    'les croyances dans le sport et les compléments nutritionnels',
    'la méthode Coué et l\'autosuggestion',
    'sophrologie et hypnose',
    'compléments alimentaires Herbalife dans le sport',
  ];

  for (const q of queries) {
    const out = await extract(q, { pooling: 'mean', normalize: true });
    const qvec = Array.from(out.data);
    const top = topK(docs, emb, meta.dim, qvec, 3);
    console.log(`\nQ: "${q}"`);
    top.forEach((t) => {
      const snippet = t.content.replace(/\n/g, ' ').slice(0, 110);
      console.log(`  [${t.score.toFixed(3)}] (${t.episode.slice(0, 45)}) ${snippet}`);
    });
  }
}

function topK(docs, emb, dim, qvec, k) {
  let qn = 0;
  for (let i = 0; i < dim; i++) qn += qvec[i] * qvec[i];
  qn = Math.sqrt(qn) || 1;
  const scored = [];
  for (let d = 0; d < docs.length; d++) {
    const base = d * dim;
    let dot = 0, norm = 0;
    for (let i = 0; i < dim; i++) {
      const v = emb[base + i];
      dot += qvec[i] * v;
      norm += v * v;
    }
    const cos = dot / (qn * (Math.sqrt(norm) || 1));
    scored.push({ i: d, s: Math.max(0, cos) });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, k).map(({ i, s }) => ({ content: docs[i].content, episode: docs[i].episode, score: s }));
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
