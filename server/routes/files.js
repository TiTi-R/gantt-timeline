import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// Max file size: 10MB
const MAX_SIZE = 10 * 1024 * 1024;

// List files for a project
router.get('/projects/:id/files', (req, res) => {
  const db = getDb();
  const files = db.prepare(
    'SELECT id, filename, original_name, mime_type, file_size, created_at FROM project_files WHERE project_id = ? ORDER BY created_at DESC'
  ).all(req.params.id);
  res.json(files);
});

// Upload file (base64 JSON body)
router.post('/projects/:id/files', (req, res) => {
  const { filename, mime_type, data } = req.body;
  if (!filename || !data) return res.status(400).json({ error: 'filename and data required' });

  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > MAX_SIZE) return res.status(413).json({ error: 'File too large (>10MB)' });

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO project_files (project_id, filename, original_name, mime_type, file_size, data)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(req.params.id, filename, filename, mime_type || 'application/octet-stream', buffer.length, data);

  const file = db.prepare('SELECT id, filename, original_name, mime_type, file_size, created_at FROM project_files WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(file);
});

// Download file
router.get('/files/:fileId', (req, res) => {
  const db = getDb();
  const file = db.prepare('SELECT * FROM project_files WHERE id = ?').get(req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const buffer = Buffer.from(file.data, 'base64');
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

// Delete file
router.delete('/files/:fileId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM project_files WHERE id = ?').run(req.params.fileId);
  res.json({ success: true });
});

export default router;
