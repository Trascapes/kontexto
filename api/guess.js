const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '..', '.data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'words.json');

function ensureStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(STORAGE_FILE, '{}', 'utf8');
  }
}

function readWordStore() {
  try {
    ensureStorage();
    const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (error) {
    console.error('readWordStore error:', error);
    return {};
  }
}

function normalizeWord(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zäöüß]/g, '');
}

function levenshtein(a, b) {
  const x = a.length;
  const y = b.length;
  const dp = Array.from({ length: x + 1 }, () => Array(y + 1).fill(0));

  for (let i = 0; i <= x; i += 1) dp[i][0] = i;
  for (let j = 0; j <= y; j += 1) dp[0][j] = j;

  for (let i = 1; i <= x; i += 1) {
    for (let j = 1; j <= y; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[x][y];
}

function paddingSimilarity(a, b) {
  const aNorm = normalizeWord(a);
  const bNorm = normalizeWord(b);
  if (!aNorm || !bNorm) return 0;

  const maxLen = Math.max(aNorm.length, bNorm.length);
  if (maxLen === 0) return 1;

  return 1 - (levenshtein(aNorm, bNorm) / maxLen);
}

function sharedPrefixBonus(a, b) {
  const aNorm = normalizeWord(a);
  const bNorm = normalizeWord(b);
  let shared = 0;
  const maxLen = Math.min(aNorm.length, bNorm.length);

  for (let i = 0; i < maxLen; i += 1) {
    if (aNorm[i] !== bNorm[i]) break;
    shared += 1;
  }

  return shared / Math.max(1, maxLen);
}

function fallbackSimilarity(a, b) {
  const p = paddingSimilarity(a, b);
  const prefix = sharedPrefixBonus(a, b);
  return Math.max(0, Math.min(1, (p * 0.75) + (prefix * 0.25)));
}

async function getEmbedding(text) {
  const token = process.env.HF_TOKEN;
  if (!token) {
    return null;
  }

  const model = process.env.HF_MODEL || 'alphaedge-ai/Qwen3-Embedding-deu-16384';
  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: text })
  });

  if (!response.ok) {
    throw new Error(`HF error: ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0];
  }

  if (Array.isArray(data)) {
    return data;
  }

  return null;
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function getWordFromDB(date) {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
      fs.writeFileSync(STORAGE_FILE, '{}', 'utf8');
    }
    const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
    const store = JSON.parse(raw || '{}');
    return store[date] || null;
  } catch (error) {
    console.error('getWordFromDB error:', error);
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Nur POST erlaubt' });
  }

  const body = req.body || {};
  const guess = String(body.guess || '').trim();
  const date = String(body.date || new Date().toISOString().split('T')[0]);

  if (!guess) {
    return res.status(400).json({ error: 'Guess fehlt' });
  }

  const secretWord = await getWordFromDB(date);
  if (!secretWord) {
    return res.status(404).json({ error: 'Kein Wort für dieses Datum gefunden' });
  }

  const normalizedGuess = normalizeWord(guess);
  const normalizedSecret = normalizeWord(secretWord);

  if (normalizedGuess === normalizedSecret) {
    return res.status(200).json({ rank: 1, total: 50000, similarity: 1 });
  }

  try {
    const [guessEmbedding, secretEmbedding] = await Promise.all([
      getEmbedding(guess),
      getEmbedding(secretWord)
    ]);

    const similarity = cosineSimilarity(guessEmbedding || [], secretEmbedding || []);
    const rank = Math.max(1, Math.min(50000, Math.round((1 - similarity) * 50000) + 1));

    return res.status(200).json({
      rank,
      total: 50000,
      similarity: Number(similarity.toFixed(6))
    });
  } catch (error) {
    console.warn('Falling back to lexical similarity:', error.message);
    const similarity = fallbackSimilarity(guess, secretWord);
    const rank = Math.max(1, Math.min(50000, Math.round((1 - similarity) * 50000) + 1));

    return res.status(200).json({
      rank,
      total: 50000,
      similarity: Number(similarity.toFixed(6)),
      fallback: true
    });
  }
};
