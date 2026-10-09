import { getDb } from '../lib/firebase.js';

const fallbackWords = [
  'apfel', 'brücke', 'garten', 'haus', 'insel', 'kerze', 'lampe',
  'meer', 'morgen', 'rad', 'schlüssel', 'schnee', 'sonne', 'stuhl',
  'tisch', 'vogel', 'wasser', 'wolke', 'zug', 'baum'
];

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
    const word = fallbackWords[getDateIndex(date)];
    await words.doc(date).set({
      date,
      word,
      createdAt: new Date().toISOString()
    });

    return res.status(200).json({ word });
  } catch (error) {
    console.error('daily-word save failed', error);
    return res.status(500).json({ error: 'Das Wort konnte nicht gespeichert werden.' });
  }
}

function getDateIndex(date) {
  let hash = 0;
  for (const character of date) {
    hash = (hash * 31 + character.charCodeAt(0)) % fallbackWords.length;
  }
  return hash;
}
