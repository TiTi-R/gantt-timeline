import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { validate, schemas } from '../middleware/validate.js';
import { daysBetween } from '../utils/date-utils.js';

const router = Router();

// Get tasks for a project
router.get('/projects/:projectId/tasks', (req, res) => {
  const db = getDb();
  const tasks = db.prepare(
    'SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order'
  ).all(req.params.projectId);
  res.json(tasks);
});

// Create task
router.post('/projects/:projectId/tasks', validate(schemas.taskCreate), (req, res) => {
  const db = getDb();
  const { projectId } = req.params;
  const { name, phase_id, parent_id, start_date, end_date, duration_days, progress,
          task_type, is_milestone, color, notes, resource_ids } = req.body;

  const duration = duration_days || daysBetween(start_date, end_date);
  const maxSort = db.prepare(
    'SELECT MAX(sort_order) as m FROM tasks WHERE project_id = ? AND phase_id = ?'
  ).get(projectId, phase_id || null);

  // Strip T00:00 from dates
  const sd = (start_date || '').split('T')[0];
  const ed = (end_date || '').split('T')[0];
  const result = db.prepare(
    `INSERT INTO tasks (project_id, phase_id, parent_id, name, start_date, end_date,
      duration_days, progress, task_type, is_milestone, color, notes, sort_order, resource_names, resource_person_names)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(projectId, phase_id || null, parent_id || null, name, sd, ed,
        duration, progress || 0, task_type || 'task', is_milestone ? 1 : 0,
        color || null, notes || null, (maxSort?.m ?? -1) + 1, req.body.resource_names || null,
        req.body.resource_person_names || null);

  const taskId = result.lastInsertRowid;

  // Assign resources
  if (resource_ids?.length) {
    const insertTR = db.prepare('INSERT OR IGNORE INTO task_resources (task_id, resource_id) VALUES (?, ?)');
    resource_ids.forEach(rid => insertTR.run(taskId, rid));
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.status(201).json(task);
});

// Update task
router.patch('/tasks/:taskId', validate(schemas.taskUpdate), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const fields = ['name', 'phase_id', 'parent_id', 'start_date', 'end_date', 'duration_days',
                  'progress', 'task_type', 'is_milestone', 'color', 'notes', 'resource_names', 'resource_person_names'];
  const sets = [];
  const values = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = ?`);
      // Strip T00:00 from dates
      values.push((f === 'start_date' || f === 'end_date') ? String(req.body[f]).split('T')[0] : req.body[f]);
    }
  });

  // Auto-calculate duration if dates changed
  if (req.body.start_date && req.body.end_date) {
    const durIdx = sets.indexOf('duration_days = ?');
    if (durIdx >= 0) {
      sets.splice(durIdx, 1);
      values.splice(durIdx, 1);
    }
    sets.push('duration_days = ?');
    values.push(daysBetween(req.body.start_date, req.body.end_date));
  }

  if (!sets.length) return res.json(existing);

  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values, req.params.taskId);

  // Update resources if provided
  if (req.body.resource_ids !== undefined) {
    db.prepare('DELETE FROM task_resources WHERE task_id = ?').run(req.params.taskId);
    const insertTR = db.prepare('INSERT OR IGNORE INTO task_resources (task_id, resource_id) VALUES (?, ?)');
    req.body.resource_ids.forEach(rid => insertTR.run(req.params.taskId, rid));
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.taskId);
  res.json(task);
});

// Delete task
router.delete('/tasks/:taskId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
  res.json({ success: true });
});

// Batch update tasks (for drag operations)
router.post('/projects/:projectId/tasks/batch', (req, res) => {
  const db = getDb();
  const { tasks } = req.body;
  if (!tasks?.length) return res.status(400).json({ error: 'No tasks provided' });

  const updateTask = db.prepare(
    `UPDATE tasks SET start_date = ?, end_date = ?, duration_days = ?, updated_at = datetime('now') WHERE id = ?`
  );

  const transaction = db.transaction((taskUpdates) => {
    taskUpdates.forEach(t => {
      updateTask.run(t.start_date, t.end_date, t.duration_days, t.id);
    });
  });

  transaction(tasks);
  res.json({ success: true, updated: tasks.length });
});

// Reorder tasks
router.post('/projects/:projectId/tasks/reorder', (req, res) => {
  const db = getDb();
  const { task_ids } = req.body;
  if (!task_ids?.length) return res.status(400).json({ error: 'No task IDs' });

  const update = db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ?');
  const trans = db.transaction(() => {
    task_ids.forEach((id, idx) => update.run(idx, id));
  });
  trans();
  res.json({ success: true });
});

export default router;
