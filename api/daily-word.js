// Vercel Serverless Function – läuft täglich um 00:00 Uhr
export default async function handler(req, res) {
  const today = new Date().toISOString().split('T')[0];

  // 1. Prüfen, ob das Wort für heute schon existiert
  const existing = await getWordFromDB(today);
  if (existing) {
    return res.status(200).json({ word: existing });
  }

  // 2. Neues Wort von Pollinations.ai generieren (kostenlos, kein Key nötig)
  const prompt = `Generiere ein einzelnes, häufiges deutsches Substantiv (kein Eigenname, kein Plural). Nur das Wort, sonst nichts.`;
  const aiRes = await fetch(
    `https://text.pollinations.ai/${encodeURIComponent(prompt)}`
  );
  const word = (await aiRes.text()).trim().toLowerCase();

  // 3. In der Datenbank speichern
  await saveWordToDB(today, word);

  return res.status(200).json({ word });
}

// Platzhalter – durch deine DB ersetzen (z. B. Vercel KV oder Supabase)
async function getWordFromDB(date) {
  // Beispiel mit Vercel KV:
  // const { kv } = await import('@vercel/kv');
  // return await kv.get(`word:${date}`);
  return null;
}

async function saveWordToDB(date, word) {
  // await kv.set(`word:${date}`, word);
  console.log(`Gespeichert: ${date} → ${word}`);
}

