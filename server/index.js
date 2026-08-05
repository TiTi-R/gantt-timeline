import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { initDb, getDb } from './db/connection.js';
import { errorHandler } from './middleware/error-handler.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import dependenciesRouter from './routes/dependencies.js';
import resourcesRouter from './routes/resources.js';
import templatesRouter from './routes/templates.js';
import exportRouter from './routes/export.js';
import settingsRouter from './routes/settings.js';
import phasesRouter from './routes/phases.js';
import filesRouter from './routes/files.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// API Routes (registered before DB init - routes are lazy)
app.use('/api/projects', projectsRouter);
app.use('/api', tasksRouter);
app.use('/api', dependenciesRouter);
app.use('/api', phasesRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/templates', templatesRouter);
app.use('/api', exportRouter);
app.use('/api/settings', settingsRouter);
app.use('/api', filesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(join(clientDist, 'index.html'));
    }
  });
}

// Error handler (must be last)
app.use(errorHandler);

// Initialize database then start listening
const start = async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api/health`);
  });
};

start();
