import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// List all templates (with ms/task counts). ?published=true excludes drafts
router.get('/', (req, res) => {
  const db = getDb();
  const published = req.query.published === 'true';
  let sql = 'SELECT * FROM templates';
  if (published) sql += " WHERE status = 'published'";
  sql += ' ORDER BY updated_at DESC';
  const templates = db.prepare(sql).all();
  templates.forEach(t => {
    const stats = db.prepare(
      'SELECT COUNT(*) as ms FROM template_tasks WHERE template_id = ? AND task_type = ? AND parent_id IS NULL'
    ).get(t.id, 'milestone');
    const total = db.prepare('SELECT COUNT(*) as c FROM template_tasks WHERE template_id = ?').get(t.id);
    t.milestone_count = stats?.ms || 0;
    t.task_count = total?.c || 0;
  });
  res.json(templates);
});

// Get template with full task tree
router.get('/:id', (req, res) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const tasks = db.prepare('SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order').all(req.params.id);
  const deps = db.prepare('SELECT * FROM template_dependencies WHERE template_id = ?').all(req.params.id);

  res.json({ ...template, tasks, dependencies: deps });
});

// Create template (blank or from existing project)
router.post('/', (req, res) => {
  const db = getDb();
  const { source_id, name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const templateResult = db.prepare(
    `INSERT INTO templates (name, description, template_type, task_count, total_duration, status)
     VALUES (?, ?, 'project', 0, 0, 'draft')`
  ).run(name, description || null);

  const templateId = templateResult.lastInsertRowid;

  // If source_id is provided, export from that project
  if (source_id) {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(source_id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order').all(source_id);
    const projectStart = new Date(project.start_date);

    const insertTask = db.prepare(
      `INSERT INTO template_tasks (template_id, parent_id, name, relative_start, relative_end,
        duration_days, task_type, is_milestone, color, sort_order, wbs_code, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const taskIdMap = {};
    tasks.forEach(t => {
      const relStart = Math.round((new Date(t.start_date) - projectStart) / (1000 * 60 * 60 * 24));
      const relEnd = Math.round((new Date(t.end_date) - projectStart) / (1000 * 60 * 60 * 24));
      const r = insertTask.run(
        templateId, t.parent_id ? (taskIdMap[t.parent_id] || null) : null,
        t.name, relStart, relEnd, t.duration_days,
        t.task_type, t.is_milestone, t.color, t.sort_order, t.wbs_code, t.notes
      );
      taskIdMap[t.id] = r.lastInsertRowid;
    });

    const deps = db.prepare('SELECT * FROM dependencies WHERE project_id = ?').all(source_id);
    const insertDep = db.prepare(
      'INSERT INTO template_dependencies (template_id, predecessor_ref, successor_ref, dependency_type, lag_days) VALUES (?, ?, ?, ?, ?)'
    );
    deps.forEach(d => {
      const preTask = tasks.find(t => t.id === d.predecessor_id);
      const sucTask = tasks.find(t => t.id === d.successor_id);
      if (preTask && sucTask) insertDep.run(templateId, preTask.name, sucTask.name, d.dependency_type, d.lag_days);
    });

    db.prepare('UPDATE templates SET task_count = ?, total_duration = ? WHERE id = ?')
      .run(tasks.length, tasks.reduce((sum, t) => sum + t.duration_days, 0), templateId);
  }

  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId);
  res.status(201).json(template);
});

// ============================================================
// Template Tasks CRUD (for manually editing blank templates)
// ============================================================

// Add task to template (supports milestones as group headers + subtask hierarchy)
router.post('/:id/tasks', (req, res) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const { name, parent_id, relative_start, relative_end, duration_days, task_type, is_milestone, color, resource_names } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM template_tasks WHERE template_id = ?').get(req.params.id);
  const dur = duration_days ?? (is_milestone ? 0 : 5);
  const result = db.prepare(
    `INSERT INTO template_tasks (template_id, parent_id, name, relative_start, relative_end, duration_days, task_type, is_milestone, color, sort_order, resource_names)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.params.id, parent_id || null, name,
        0, Math.max(0, dur - 1),
        dur, task_type || (is_milestone ? 'milestone' : 'task'),
        is_milestone ? 1 : 0, color || null, (maxSort?.m ?? -1) + 1, resource_names || null);

  autoSchedule(db, req.params.id);

  const count = db.prepare('SELECT COUNT(*) as cnt FROM template_tasks WHERE template_id = ?').get(req.params.id);
  db.prepare('UPDATE templates SET task_count = ? WHERE id = ?')
    .run(count.cnt, req.params.id);

  const task = db.prepare('SELECT * FROM template_tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(task);
});

// Update template task
router.patch('/:templateId/tasks/:taskId', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT * FROM template_tasks WHERE id = ? AND template_id = ?').get(req.params.taskId, req.params.templateId);
  if (!task) return res.status(404).json({ error: 'Template task not found' });

  const fields = ['name', 'parent_id', 'relative_start', 'relative_end', 'duration_days', 'task_type', 'is_milestone', 'color', 'resource_names'];
  const sets = [];
  const values = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  });
  if (!sets.length) return res.json(task);

  db.prepare(`UPDATE template_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values, req.params.taskId);

  autoSchedule(db, req.params.templateId);

  res.json(db.prepare('SELECT * FROM template_tasks WHERE id = ?').get(req.params.taskId));
});

// Delete template task
router.delete('/:templateId/tasks/:taskId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM template_tasks WHERE id = ? AND template_id = ?').run(req.params.taskId, req.params.templateId);

  autoSchedule(db, req.params.templateId);

  const count = db.prepare('SELECT COUNT(*) as cnt FROM template_tasks WHERE template_id = ?').get(req.params.templateId);
  db.prepare('UPDATE templates SET task_count = ? WHERE id = ?')
    .run(count.cnt, req.params.templateId);

  res.json({ success: true });
});

// Publish or draft a template
router.patch('/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  if (!status || !['published', 'draft'].includes(status)) return res.status(400).json({ error: 'status required (published/draft)' });
  // Validate: publishing requires no orphans
  if (status === 'published') {
    const orphans = db.prepare(
      "SELECT COUNT(*) as c FROM template_tasks WHERE template_id = ? AND task_type != 'milestone' AND parent_id IS NULL"
    ).get(req.params.id);
    if (orphans?.c > 0) return res.status(400).json({ error: '存在无归属的任务，请先把所有任务归入里程碑后再保存。' });
  }
  db.prepare("UPDATE templates SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  res.json({ success: true, status });
});

// Batch reorder template tasks
router.post('/:templateId/tasks/reorder', (req, res) => {
  const db = getDb();
  const { task_ids } = req.body;
  if (!task_ids?.length) return res.status(400).json({ error: 'task_ids required' });

  const update = db.prepare('UPDATE template_tasks SET sort_order = ? WHERE id = ? AND template_id = ?');
  const trans = db.transaction(() => {
    task_ids.forEach((id, idx) => update.run(idx, id, req.params.templateId));
  });
  trans();

  // Auto-schedule after reorder
  autoSchedule(db, req.params.templateId);

  res.json({ success: true });
});

// Auto-schedule: milestones start at Day 0 (parallel), children cumulative within each milestone
router.post('/:templateId/autoschedule', (req, res) => {
  const db = getDb();
  autoSchedule(db, req.params.templateId);
  res.json({ success: true });
});

function autoSchedule(db, templateId) {
  const all = db.prepare(
    'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order'
  ).all(templateId);

  const milestones = all.filter(t => t.task_type === 'milestone' && !t.parent_id);
  const orphans = all.filter(t => t.task_type !== 'milestone' && !t.parent_id);
  const getChildren = (pid) => all.filter(t => t.parent_id === pid).sort((a,b) => a.sort_order - b.sort_order);

  const updateTask = db.prepare(
    'UPDATE template_tasks SET relative_start = ?, relative_end = ?, duration_days = ? WHERE id = ?'
  );

  let maxEnd = 0;

  // Each milestone starts at Day 0 (parallel)
  milestones.forEach(m => {
    // Children chain sequentially within this milestone
    const children = getChildren(m.id);
    // Milestone duration = sum of all children's durations
    const msDuration = children.reduce((sum, c) => sum + Math.max(1, c.duration_days || 1), 0);

    if (msDuration > 0) {
      updateTask.run(0, msDuration - 1, msDuration, m.id);
    } else {
      updateTask.run(0, 0, 0, m.id);
    }

    let childDay = 0;
    children.forEach(c => {
      const dur = Math.max(1, c.duration_days || 1);
      updateTask.run(childDay, childDay + dur - 1, dur, c.id);
      childDay += dur;
    });
    maxEnd = Math.max(maxEnd, msDuration);
  });

  // Orphans after the last milestone's end
  orphans.forEach(t => {
    const dur = Math.max(1, t.duration_days || 1);
    updateTask.run(maxEnd, maxEnd + dur - 1, dur, t.id);
    maxEnd += dur;
  });

  // Recalc total duration (sum of all parent-less task durations)
  const totalDur = db.prepare(
    'SELECT COALESCE(SUM(CASE WHEN parent_id IS NULL THEN duration_days ELSE 0 END), 0) as d FROM template_tasks WHERE template_id = ?'
  ).get(templateId);
  db.prepare('UPDATE templates SET total_duration = COALESCE(?, 0), updated_at = datetime("now") WHERE id = ?')
    .run(totalDur.d || 0, templateId);
}

// Update template metadata
router.patch('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Template not found' });

  const sets = [];
  const values = [];
  ['name', 'description'].forEach(f => {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  });
  if (!sets.length) return res.json(existing);

  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE templates SET ${sets.join(', ')} WHERE id = ?`).run(...values, req.params.id);
  res.json(db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id));
});

// Delete template
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Import template into project
router.post('/:id/import', (req, res) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (template.status === 'draft') return res.status(400).json({ error: '草稿模板不可导入，请先在模板编辑器中保存。' });

  const { target_project_id, target_phase_id, anchor_date } = req.body;
  if (!target_project_id || !anchor_date) {
    return res.status(400).json({ error: 'target_project_id and anchor_date are required' });
  }

  const anchorDate = new Date(anchor_date);
  const templateTasks = db.prepare(
    'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY sort_order'
  ).all(req.params.id);

  const templateDeps = db.prepare(
    'SELECT * FROM template_dependencies WHERE template_id = ?'
  ).all(req.params.id);

  // Create a new phase for imported tasks
  let phaseId = target_phase_id || null;
  if (!phaseId) {
    const phaseResult = db.prepare(
      `INSERT INTO phases (project_id, name, sort_order)
       SELECT ?, COALESCE(?, 'Imported'), COALESCE((SELECT MAX(sort_order)+1 FROM phases WHERE project_id = ?), 0)`
    ).run(target_project_id, template.phase_name || template.name, target_project_id);
    phaseId = phaseResult.lastInsertRowid;
  }

  // Create tasks with date offset
  const insertTask = db.prepare(
    `INSERT INTO tasks (project_id, phase_id, parent_id, name, start_date, end_date, duration_days,
      task_type, is_milestone, color, sort_order, wbs_code, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const nameToIdMap = {};
  const idToTimelineId = {};

  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  // First pass: create all tasks without parents
  templateTasks.forEach(tt => {
    const startDate = addDays(anchorDate, tt.relative_start || 0);
    const endDate = addDays(anchorDate, tt.relative_end || tt.relative_start || 0);
    const r = insertTask.run(
      target_project_id, phaseId, null, tt.name,  // parent set to null first
      startDate, endDate, tt.duration_days,
      tt.task_type, tt.is_milestone, tt.color,
      tt.sort_order, tt.wbs_code, tt.notes
    );
    nameToIdMap[tt.name] = r.lastInsertRowid;
    idToTimelineId[tt.id] = r.lastInsertRowid;
  });

  // Second pass: fix parent relationships
  templateTasks.forEach(tt => {
    if (tt.parent_id && idToTimelineId[tt.parent_id]) {
      db.prepare('UPDATE tasks SET parent_id = ? WHERE id = ?')
        .run(idToTimelineId[tt.parent_id], idToTimelineId[tt.id]);
    }
  });

  // Create dependencies
  const insertDep = db.prepare(
    `INSERT OR IGNORE INTO dependencies (project_id, predecessor_id, successor_id, dependency_type, lag_days)
     VALUES (?, ?, ?, ?, ?)`
  );

  templateDeps.forEach(td => {
    const predId = nameToIdMap[td.predecessor_ref];
    const succId = nameToIdMap[td.successor_ref];
    if (predId && succId) {
      insertDep.run(target_project_id, predId, succId, td.dependency_type, td.lag_days);
    }
  });

  res.json({
    success: true,
    imported_tasks: templateTasks.length,
    imported_dependencies: templateDeps.length,
    phase_id: phaseId,
  });
});

export default router;
