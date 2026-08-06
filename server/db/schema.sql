-- ============================================================
-- Projects & Tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    study_id        TEXT,
    indication      TEXT,
    start_date      TEXT NOT NULL,
    end_date        TEXT,
    status          TEXT DEFAULT 'draft',
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phases (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    color           TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_id        INTEGER REFERENCES phases(id) ON DELETE SET NULL,
    parent_id       INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    wbs_code        TEXT,
    name            TEXT NOT NULL,
    description     TEXT,
    start_date      TEXT NOT NULL,
    end_date        TEXT NOT NULL,
    duration_days   INTEGER NOT NULL DEFAULT 1,
    progress        REAL DEFAULT 0.0,
    task_type       TEXT DEFAULT 'task',
    is_milestone    INTEGER DEFAULT 0,
    color           TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_critical     INTEGER DEFAULT 0,
    notes           TEXT,
    resource_names  TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_phase ON tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);

-- ============================================================
-- Dependencies
-- ============================================================

CREATE TABLE IF NOT EXISTS dependencies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    predecessor_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    successor_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'FS',
    lag_days        INTEGER DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(predecessor_id, successor_id)
);

CREATE INDEX IF NOT EXISTS idx_deps_project ON dependencies(project_id);

-- ============================================================
-- Resources
-- ============================================================

CREATE TABLE IF NOT EXISTS resources (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    role            TEXT,
    email           TEXT,
    department      TEXT,
    color           TEXT,
    availability    REAL DEFAULT 1.0,
    members         TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_resources (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    resource_id     INTEGER NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    allocation_pct  REAL DEFAULT 100.0,
    UNIQUE(task_id, resource_id)
);

-- ============================================================
-- Template System
-- ============================================================

CREATE TABLE IF NOT EXISTS templates (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    template_type   TEXT NOT NULL DEFAULT 'project',
    phase_name      TEXT,
    task_count      INTEGER DEFAULT 0,
    total_duration  INTEGER,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS template_tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id     INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    parent_id       INTEGER REFERENCES template_tasks(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    relative_start  INTEGER NOT NULL,
    relative_end    INTEGER NOT NULL,
    duration_days   INTEGER NOT NULL,
    task_type       TEXT DEFAULT 'task',
    is_milestone    INTEGER DEFAULT 0,
    color           TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    wbs_code        TEXT,
    resource_names  TEXT,
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS template_dependencies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id     INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    predecessor_ref TEXT NOT NULL,
    successor_ref   TEXT NOT NULL,
    dependency_type TEXT NOT NULL DEFAULT 'FS',
    lag_days        INTEGER DEFAULT 0
);

-- ============================================================
-- Project Files
-- ============================================================

CREATE TABLE IF NOT EXISTS project_files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    mime_type       TEXT NOT NULL DEFAULT 'application/octet-stream',
    file_size       INTEGER NOT NULL DEFAULT 0,
    data            TEXT,                              -- base64-encoded blob for small files (<5MB)
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pfiles_project ON project_files(project_id);

-- ============================================================
-- User Preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('language', 'zh'),
    ('date_format', 'YYYY-MM-DD'),
    ('working_days', '[1,2,3,4,5]'),
    ('first_day_of_week', '1');

-- Note: resources.members column added via migration in connection.js if missing
