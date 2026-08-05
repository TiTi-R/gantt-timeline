import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

// Get dependencies for a task
router.get('/tasks/:taskId/dependencies', (req, res) => {
  const db = getDb();
  const deps = db.prepare(`
    SELECT d.*,
           pt.name as predecessor_name, st.name as successor_name
    FROM dependencies d
    JOIN tasks pt ON d.predecessor_id = pt.id
    JOIN tasks st ON d.successor_id = st.id
    WHERE d.predecessor_id = ? OR d.successor_id = ?
  `).all(req.params.taskId, req.params.taskId);
  res.json(deps);
});

// Create dependency
router.post('/projects/:projectId/dependencies', validate(schemas.dependencyCreate), (req, res) => {
  const db = getDb();
  const { predecessor_id, successor_id, dependency_type, lag_days } = req.body;

  if (predecessor_id === successor_id) {
    return res.status(400).json({ error: 'Task cannot depend on itself' });
  }

  try {
    const result = db.prepare(
      `INSERT INTO dependencies (project_id, predecessor_id, successor_id, dependency_type, lag_days)
       VALUES (?, ?, ?, ?, ?)`
    ).run(req.params.projectId, predecessor_id, successor_id, dependency_type || 'FS', lag_days || 0);

    const dep = db.prepare('SELECT * FROM dependencies WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(dep);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Dependency already exists' });
    }
    throw e;
  }
});

// Update dependency
router.patch('/dependencies/:depId', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM dependencies WHERE id = ?').get(req.params.depId);
  if (!existing) return res.status(404).json({ error: 'Dependency not found' });

  const { dependency_type, lag_days } = req.body;
  db.prepare(
    `UPDATE dependencies SET dependency_type = COALESCE(?, dependency_type), lag_days = COALESCE(?, lag_days) WHERE id = ?`
  ).run(dependency_type || null, lag_days !== undefined ? lag_days : null, req.params.depId);

  res.json(db.prepare('SELECT * FROM dependencies WHERE id = ?').get(req.params.depId));
});

// Delete dependency
router.delete('/dependencies/:depId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM dependencies WHERE id = ?').run(req.params.depId);
  res.json({ success: true });
});

export default router;
