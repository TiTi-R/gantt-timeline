import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// List phases for a project
router.get('/projects/:projectId/phases', (req, res) => {
  const db = getDb();
  const phases = db.prepare(
    'SELECT * FROM phases WHERE project_id = ? ORDER BY sort_order'
  ).all(req.params.projectId);
  res.json(phases);
});

// Create phase
router.post('/projects/:projectId/phases', (req, res) => {
  const db = getDb();
  const { name, description, color } = req.body;
  const maxSort = db.prepare(
    'SELECT MAX(sort_order) as m FROM phases WHERE project_id = ?'
  ).get(req.params.projectId);

  const result = db.prepare(
    'INSERT INTO phases (project_id, name, description, sort_order, color) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.projectId, name, description || null, (maxSort?.m ?? -1) + 1, color || null);

  res.status(201).json(db.prepare('SELECT * FROM phases WHERE id = ?').get(result.lastInsertRowid));
});

// Update phase
router.patch('/phases/:phaseId', (req, res) => {
  const db = getDb();
  const fields = ['name', 'description', 'color', 'sort_order'];
  const sets = [];
  const values = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  });
  if (sets.length) {
    db.prepare(`UPDATE phases SET ${sets.join(', ')} WHERE id = ?`).run(...values, req.params.phaseId);
  }
  res.json(db.prepare('SELECT * FROM phases WHERE id = ?').get(req.params.phaseId));
});

// Delete phase
router.delete('/phases/:phaseId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM phases WHERE id = ?').run(req.params.phaseId);
  res.json({ success: true });
});

// Reorder phases
router.post('/projects/:projectId/phases/reorder', (req, res) => {
  const db = getDb();
  const { phase_ids } = req.body;
  const update = db.prepare('UPDATE phases SET sort_order = ? WHERE id = ?');
  const trans = db.transaction(() => {
    phase_ids.forEach((id, idx) => update.run(idx, id));
  });
  trans();
  res.json({ success: true });
});

export default router;
