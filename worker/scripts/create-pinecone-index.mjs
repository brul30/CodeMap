/**
 * create-pinecone-index.mjs — idempotent Pinecone index bootstrap.
 *
 * Creates a SERVERLESS index if it does not already exist.
 * Safe to re-run: it checks the existing index list first and skips if found.
 *
 * Configuration:
 *   PINECONE_API_KEY  — required; Pinecone API key.
 *   PINECONE_INDEX    — optional; index name (default: "codemap").
 *
 * Embedding dimension: 768
 *   768 = Gemini text-embedding-004 output dimension.
 *   If the embedding model changes, update DIMENSION below to match.
 *
 * Usage:
 *   npm run create-index    (reads .env via --env-file flag)
 */

import { Pinecone } from '@pinecone-database/pinecone';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = process.env.PINECONE_INDEX ?? 'codemap';

// 768 = Gemini text-embedding-004; change if the embedding model changes.
const DIMENSION = 768;
const METRIC = 'cosine';
const CLOUD = 'aws';
const REGION = 'us-east-1';

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

if (!API_KEY) {
  console.error('ERROR: PINECONE_API_KEY is not set. Set it in .env and re-run.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Create index (idempotent)
// ---------------------------------------------------------------------------

const pc = new Pinecone({ apiKey: API_KEY });

console.log(`Checking Pinecone for index "${INDEX_NAME}"…`);

let existingIndexes;
try {
  const { indexes } = await pc.listIndexes();
  existingIndexes = indexes ?? [];
} catch (err) {
  console.error('ERROR: Failed to list Pinecone indexes:', err.message ?? err);
  process.exit(1);
}

const alreadyExists = existingIndexes.some((idx) => idx.name === INDEX_NAME);

if (alreadyExists) {
  console.log(`SKIP: Index "${INDEX_NAME}" already exists — nothing to do.`);
  process.exit(0);
}

console.log(`Creating serverless index "${INDEX_NAME}" (dim=${DIMENSION}, metric=${METRIC}, cloud=${CLOUD}, region=${REGION})…`);

try {
  await pc.createIndex({
    name: INDEX_NAME,
    dimension: DIMENSION,
    metric: METRIC,
    spec: {
      serverless: {
        cloud: CLOUD,
        region: REGION,
      },
    },
  });
  console.log(`SUCCESS: Index "${INDEX_NAME}" created.`);
  console.log('Note: serverless indexes may take 30–60 s to become ready.');
} catch (err) {
  console.error(`ERROR: Failed to create index "${INDEX_NAME}":`, err.message ?? err);
  process.exit(1);
}
