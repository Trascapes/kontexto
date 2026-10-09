import { db } from '../lib/firebase.js';

const words = db.collection('dailyWords');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Methode nicht erlaubt' });
  }

  const date = typeof req.query?.date === 'string'
    ? req.query.date
    : new Date().toISOString().split('T')[0];

  try {
    const existing = await words.doc(date).get();
    if (existing.exists) {
      return res.status(200).json({ word: existing.data().word });
    }

    const prompt = 'Generiere ein einzelnes, häufiges deutsches Substantiv (kein Eigenname, kein Plural). Nur das Wort, sonst nichts.';
    const aiRes = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`);
    const generated = (await aiRes.text()).trim().toLowerCase();

    if (!aiRes.ok || !generated || generated.startsWith('{"error"')) {
      throw new Error(`Wortdienst antwortete mit HTTP ${aiRes.status}`);
    }

    await words.doc(date).set({
      date,
      word: generated,
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({ word: generated });
  } catch (error) {
    console.error('daily-word failed', error);
    return res.status(500).json({ error: 'Das Wort des Tages konnte nicht geladen werden.' });
  }
}
