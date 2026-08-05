import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// Get all settings
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => {
    try { settings[r.key] = JSON.parse(r.value); }
    catch { settings[r.key] = r.value; }
  });
  res.json(settings);
});

// Set a setting
router.post('/', (req, res) => {
  const db = getDb();
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });

  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, stringValue);
  res.json({ key, value: stringValue });
});

export default router;
