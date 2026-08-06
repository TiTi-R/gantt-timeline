import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

// List all projects
router.get('/', (req, res) => {
  const db = getDb();
  const { status, search } = req.query;
  let sql = `SELECT p.*, (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count FROM projects p`;
  const conditions = [];
  const params = [];

  if (status) { conditions.push('p.status = ?'); params.push(status); }
  if (search) { conditions.push("(p.name LIKE ? OR p.study_id LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY p.updated_at DESC';

  res.json(db.prepare(sql).all(...params));
});

// Get project with full details
router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const phases = db.prepare('SELECT * FROM phases WHERE project_id = ? ORDER BY sort_order').all(req.params.id);
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(req.params.id);
  const deps = db.prepare('SELECT * FROM dependencies WHERE project_id = ?').all(req.params.id);

  // Attach resource info to each task
  const taskResources = db.prepare(`
    SELECT tr.task_id, r.id, r.name, r.role, r.color, tr.allocation_pct
    FROM task_resources tr JOIN resources r ON tr.resource_id = r.id
    WHERE tr.task_id IN (SELECT id FROM tasks WHERE project_id = ?)
  `).all(req.params.id);

  const resourceMap = {};
  taskResources.forEach(tr => {
    if (!resourceMap[tr.task_id]) resourceMap[tr.task_id] = [];
    resourceMap[tr.task_id].push(tr);
  });

  const tasksWithResources = tasks.map(t => ({
    ...t,
    resources: resourceMap[t.id] || [],
  }));

  // Auto-calc project dates from tasks & persist
  if (tasks.length > 0) {
    const dates = tasks.map(t => t.start_date).filter(Boolean).sort();
    const ends = tasks.map(t => t.end_date).filter(Boolean).sort();
    const newStart = dates[0] || project.start_date;
    const newEnd = ends[ends.length - 1] || project.end_date;
    if (newStart !== project.start_date || newEnd !== project.end_date) {
      db.prepare('UPDATE projects SET start_date = ?, end_date = ?, updated_at = datetime("now") WHERE id = ?')
        .run(newStart, newEnd, req.params.id);
    }
    project.start_date = newStart;
    project.end_date = newEnd;
  }

  res.json({ ...project, phases, tasks: tasksWithResources, dependencies: deps });
});

// Create project
router.post('/', validate(schemas.projectCreate), (req, res) => {
  const db = getDb();
  const { name, description, study_id, indication, start_date, end_date, status } = req.body;
  const sd = start_date || new Date().toISOString().split('T')[0];
  const result = db.prepare(
    `INSERT INTO projects (name, description, study_id, indication, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(name, description || null, study_id || null, indication || null, sd, end_date || null, status || 'draft');
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

// Update project
router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Project not found' });

  const fields = ['name', 'description', 'study_id', 'indication', 'start_date', 'end_date', 'status'];
  const sets = [];
  const values = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  });
  if (!sets.length) return res.json(existing);

  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values, req.params.id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// Delete project
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get Gantt data in dhtmlx format
router.get('/:id/gantt-data', (req, res) => {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(req.params.id);
  const deps = db.prepare('SELECT * FROM dependencies WHERE project_id = ?').all(req.params.id);

  const data = tasks.map(t => {
    const parts = (t.end_date || '').split('-').map(Number);
    const shifted = new Date(parts[0], parts[1] - 1, parts[2] + 1);
    const ed = shifted.getFullYear() + '-' + String(shifted.getMonth() + 1).padStart(2, '0') + '-' + String(shifted.getDate()).padStart(2, '0');
    return {
      id: t.id,
      text: t.name,
      start_date: t.start_date,
      end_date: ed,
      duration: (t.duration_days || 0) + 1,
      progress: t.progress || 0,
      parent: t.parent_id || 0,
      type: t.is_milestone ? 'milestone' : t.task_type,
      color: t.is_milestone ? '#f59e0b' : (t.parent_id ? '#4472C4' : '#8b5cf6'),
      phase_id: t.phase_id,
      wbs: t.wbs_code,
      real_end: t.end_date,
      resource_names: t.resource_names || '',
    };
  });

  const links = deps.map(d => ({
    id: d.id,
    source: d.predecessor_id,
    target: d.successor_id,
    type: String(d.dependency_type),
    lag: d.lag_days || 0,
  }));

  res.json({ data, links });
});

export default router;
