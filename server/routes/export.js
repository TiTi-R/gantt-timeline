import { Router } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

// Export PDF (placeholder - full implementation in Phase 6)
router.get('/projects/:id/export/pdf', (req, res) => {
  res.status(501).json({ error: 'PDF export will be implemented in Phase 6' });
});

// Export Excel (placeholder - full implementation in Phase 7)
router.get('/projects/:id/export/xlsx', (req, res) => {
  res.status(501).json({ error: 'Excel export will be implemented in Phase 7' });
});

export default router;
