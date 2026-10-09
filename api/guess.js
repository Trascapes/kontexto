import { db } from '../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode nicht erlaubt' });
  }

  const { guess, date } = req.body ?? {};
  if (typeof guess !== 'string' || !guess.trim() || typeof date !== 'string') {
    return res.status(400).json({ error: 'Vermutung und Datum sind erforderlich' });
  }

  try {
    const snapshot = await db.collection('dailyWords').doc(date).get();
    const secretWord = snapshot.data()?.word;
    if (!secretWord) {
      return res.status(404).json({ error: 'Kein Wort für dieses Datum' });
    }

    const token = process.env.HF_TOKEN;
    if (!token) {
      throw new Error('HF_TOKEN is not configured');
    }

    const model = 'alphaedge-ai/Qwen3-Embedding-deu-16384';
    const [guessEmb, secretEmb] = await Promise.all([
      getEmbedding(guess.trim().toLowerCase(), model, token),
      getEmbedding(secretWord, model, token)
    ]);
    const similarity = cosineSimilarity(guessEmb, secretEmb);
    const total = 50000;
    const rank = Math.max(1, Math.round((1 - similarity) * total) + 1);

    return res.status(200).json({ rank, total, similarity });
  } catch (error) {
    console.error('guess failed', error);
    return res.status(500).json({ error: 'Die Ähnlichkeit konnte nicht berechnet werden.' });
  }
}

async function getEmbedding(text, model, token) {
  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: text })
  });

  const data = await response.json();
  if (!response.ok || !Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error(`Embedding-Dienst antwortete mit HTTP ${response.status}`);
  }
  return data[0];
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) {
    throw new Error('Ungültige Embedding-Vektoren');
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
