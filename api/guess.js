// Vercel Serverless Function – berechnet den Rang einer Vermutung
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { guess, date } = req.body;
  const secretWord = await getWordFromDB(date);
  if (!secretWord) return res.status(404).json({ error: 'Kein Wort für dieses Datum' });

  // Embeddings über Hugging Face Inference API (kostenlos)
  const HF_TOKEN = process.env.HF_TOKEN; // In Vercel als Env-Variable setzen
  const HF_MODEL = 'alphaedge-ai/Qwen3-Embedding-deu-16384';

  const [guessEmb, secretEmb] = await Promise.all([
    getEmbedding(guess, HF_MODEL, HF_TOKEN),
    getEmbedding(secretWord, HF_MODEL, HF_TOKEN)
  ]);

  // Kosinus-Ähnlichkeit berechnen
  const similarity = cosineSimilarity(guessEmb, secretEmb);

  // Rang ermitteln: Wir brauchen eine Liste aller möglichen Wörter.
  // Für den Anfang: Mock-Rang basierend auf Ähnlichkeit.
  // In Produktion: Vektor-Index (z. B. Pinecone, Qdrant) mit 10.000+ deutschen Wörtern.
  const rank = Math.round((1 - similarity) * 50000) + 1;
  const total = 50000; // Annahme: 50.000 Wörter im Vokabular

  return res.status(200).json({
    rank: Math.max(1, rank),
    total,
    similarity
  });
}

async function getEmbedding(text, model, token) {
  const res = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: text })
    }
  );
  const data = await res.json();
  return data[0]; // Embedding-Vektor
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function getWordFromDB(date) {
  // Wie oben – durch deine DB ersetzen
  return null;
}

