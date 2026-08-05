import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// List all resources
router.get('/', (req, res) => {
  const db = getDb();
  const { search, role } = req.query;
  let sql = `SELECT r.*, (SELECT COUNT(*) FROM task_resources WHERE resource_id = r.id) as task_count FROM resources r`;
  const conditions = [];
  const params = [];

  if (search) { conditions.push('(r.name LIKE ? OR r.department LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (role) { conditions.push('r.role = ?'); params.push(role); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY r.name';

  res.json(db.prepare(sql).all(...params));
});

// Create resource
router.post('/', (req, res) => {
  const db = getDb();
  const { name, role, email, department, color, availability } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(
    `INSERT INTO resources (name, role, email, department, color, availability)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(name, role || null, email || null, department || null, color || null, availability ?? 1.0);

  const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(resource);
});

// Update resource
router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Resource not found' });

  const fields = ['name', 'role', 'email', 'department', 'color', 'availability'];
  const sets = [];
  const values = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  });
  if (!sets.length) return res.json(existing);

  db.prepare(`UPDATE resources SET ${sets.join(', ')} WHERE id = ?`).run(...values, req.params.id);
  res.json(db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id));
});

// Delete resource
router.delete('/:id', (req, res) => {
  const db = getDb();
  const used = db.prepare('SELECT COUNT(*) as cnt FROM task_resources WHERE resource_id = ?').get(req.params.id);
  if (used.cnt > 0) {
    return res.status(400).json({ error: `Resource is assigned to ${used.cnt} task(s). Remove assignments first.` });
  }
  db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
