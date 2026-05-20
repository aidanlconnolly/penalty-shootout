// Vercel Node serverless function — shared leaderboard backed by Vercel KV.
// GET  /api/leaderboard       -> { entries: [{ name, country, points, games }, ...] }
// POST /api/leaderboard       -> body { name, country, pointsDelta, won, difficulty }
//
// No auth — this is a friend-group toy. Names are sanitized to 24 chars.

import { kv } from '@vercel/kv';

const POINTS_KEY = 'penalty:points'; // sorted set: member = "name|country", score = points
const GAMES_KEY = 'penalty:games';   // hash:    field = "name|country", value = games played

function sanitizeName(s) {
  return String(s || '').replace(/[\x00-\x1f]/g, '').trim().slice(0, 24);
}
function sanitizeCountry(s) {
  return String(s || '').replace(/[\x00-\x1f|]/g, '').trim().slice(0, 32);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      // top 50 by points desc
      const range = await kv.zrange(POINTS_KEY, 0, 49, { rev: true, withScores: true });
      // range is [member, score, member, score, ...]
      const entries = [];
      const ids = [];
      for (let i = 0; i < range.length; i += 2) {
        ids.push(range[i]);
      }
      const games = ids.length ? await kv.hmget(GAMES_KEY, ...ids) : {};
      for (let i = 0; i < range.length; i += 2) {
        const id = range[i];
        const score = Number(range[i + 1]) || 0;
        const [name, country] = String(id).split('|');
        const g = (games && games[id] != null) ? Number(games[id]) : 0;
        entries.push({ name, country, points: score, games: g });
      }
      return res.status(200).json({ entries });
    } catch (err) {
      return res.status(500).json({ error: 'kv_unavailable', message: String(err && err.message || err) });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const name = sanitizeName(body.name);
      const country = sanitizeCountry(body.country);
      const pts = Math.max(-10, Math.min(10, Number(body.pointsDelta) || 0));
      if (!name) return res.status(400).json({ error: 'name_required' });
      const id = `${name}|${country}`;
      await kv.zincrby(POINTS_KEY, pts, id);
      await kv.hincrby(GAMES_KEY, id, 1);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: 'kv_unavailable', message: String(err && err.message || err) });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
