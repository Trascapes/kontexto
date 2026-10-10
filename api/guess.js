import { getDb } from '../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode nicht erlaubt' });
  }

  const { guess, date } = req.body ?? {};
  if (typeof guess !== 'string' || !guess.trim() || typeof date !== 'string') {
    return res.status(400).json({ error: 'Vermutung und Datum sind erforderlich' });
  }

  try {
    const snapshot = await getDb().collection('dailyWords').doc(date).get();
    const secretWord = snapshot.data()?.word;
    if (!secretWord) {
      return res.status(404).json({ error: 'Kein Wort für dieses Datum' });
    }

    const total = 50000;
    const normalizedGuess = guess.trim().toLowerCase();
    const rank = calculateRank(normalizedGuess, secretWord, total);

    return res.status(200).json({
      rank,
      total,
      similarity: rank === 1 ? 1 : null
    });
  } catch (error) {
    console.error('guess failed', error);
    return res.status(500).json({ error: 'Die Vermutung konnte nicht bewertet werden.' });
  }
}

function calculateRank(guess, secretWord, total) {
  if (guess === secretWord) {
    return 1;
  }

  const guessLetters = new Set(guess);
  const secretLetters = new Set(secretWord);
  const shared = [...guessLetters].filter((letter) => secretLetters.has(letter)).length;
  const possible = new Set([...guessLetters, ...secretLetters]).size;
  const similarity = possible === 0 ? 0 : shared / possible;

  return Math.max(2, Math.round((1 - similarity) * total));
}
