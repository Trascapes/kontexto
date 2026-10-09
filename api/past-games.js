import { db } from '../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Methode nicht erlaubt' });
  }

  try {
    const snapshot = await db.collection('dailyWords').orderBy('date', 'desc').limit(100).get();
    const games = snapshot.docs.map((doc) => {
      const { date } = doc.data();
      return {
        date,
        dateFormatted: new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        })
      };
    });

    return res.status(200).json({ games });
  } catch (error) {
    console.error('past-games failed', error);
    return res.status(500).json({ error: 'Vergangene Spiele konnten nicht geladen werden.' });
  }
}
