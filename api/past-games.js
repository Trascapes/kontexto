// Vercel Serverless Function – liefert alle vergangenen Spiele
export default async function handler(req, res) {
  // Alle gespeicherten Wörter aus der DB abrufen
  const games = []; // z. B. aus Vercel KV oder Supabase

  const formatted = games.map(g => ({
    date: g.date,
    dateFormatted: new Date(g.date + 'T12:00:00').toLocaleDateString('de-DE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    })
  }));

  return res.status(200).json({ games: formatted });
}

