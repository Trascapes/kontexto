import { getDb } from '../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Methode nicht erlaubt' });
  }

  const date = typeof req.query?.date === 'string'
    ? req.query.date
    : new Date().toISOString().split('T')[0];

  let words;
  try {
    words = getDb().collection('dailyWords');
    const existing = await words.doc(date).get();
    if (existing.exists) {
      return res.status(200).json({ word: existing.data().word });
    }
  } catch (error) {
    console.error('daily-word firebase failed', error);
    return res.status(500).json({ error: 'Firebase konnte nicht verbunden werden.' });
  }

  try {
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
    console.error('daily-word provider failed', error);
    return res.status(502).json({ error: 'Der Wortdienst ist momentan nicht erreichbar.' });
  }
}
