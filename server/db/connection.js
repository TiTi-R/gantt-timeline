import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const DB_PATH = join(DATA_DIR, 'gantt.db');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;
let SQL = null;

class SqlJsWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
    this._saveTimer = null;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self._db.run(sql, params);
        self._scheduleSave();
        return { changes: self._db.getRowsModified(), lastInsertRowid: self._getLastInsertId() };
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        try {
          stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => { row[c] = vals[i]; });
            return row;
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params) {
        const rows = [];
        const stmt = self._db.prepare(sql);
        try {
          stmt.bind(params);
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => { row[c] = vals[i]; });
            rows.push(row);
          }
          return rows;
        } finally {
          stmt.free();
        }
      },
    };
  }

  exec(sql) {
    this._db.exec(sql);
    this._scheduleSave();
  }

  run(sql, params) {
    this._db.run(sql, params);
    this._scheduleSave();
    return { changes: this._db.getRowsModified(), lastInsertRowid: this._getLastInsertId() };
  }

  transaction(fn) {
    return (...args) => {
      this._db.run('BEGIN');
      try {
        fn(...args);
        this._db.run('COMMIT');
        this._scheduleSave();
      } catch (e) {
        this._db.run('ROLLBACK');
        throw e;
      }
    };
  }

  _getLastInsertId() {
    const result = this._db.exec('SELECT last_insert_rowid() as id');
    if (result.length && result[0].values.length) {
      return result[0].values[0][0];
    }
    return 0;
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveToDisk(), 200);
  }

  saveToDisk() {
    try {
      const data = this._db.export();
      // Convert Uint8Array to Node.js Buffer
      const buf = Buffer.alloc(data.byteLength);
      for (let i = 0; i < data.byteLength; i++) {
        buf[i] = data[i];
      }
      writeFileSync(DB_PATH, buf);
    } catch (e) {
      console.error('Failed to save DB:', e.message || e);
    }
  }

  close() {
    this.saveToDisk();
    this._db.close();
  }
}

// Sync getter - returns null if not initialized
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

// Async initializer - call once at startup
export async function initDb() {
  if (db) return db;

  SQL = await initSqlJs();

  let sqlDb;
  if (existsSync(DB_PATH)) {
    try {
      const buffer = readFileSync(DB_PATH);
      sqlDb = new SQL.Database(new Uint8Array(buffer));
    } catch {
      sqlDb = new SQL.Database();
    }
  } else {
    sqlDb = new SQL.Database();
  }

  db = new SqlJsWrapper(sqlDb);

  // Initialize schema
  const schemaPath = join(__dirname, 'schema.sql');
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8');
    try {
      sqlDb.exec(schema);
      db.saveToDisk();
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
        console.warn('Schema warning:', e.message);
      }
    }
  }

  // Migration: add members column if missing (multi-person roles)
  try {
    sqlDb.exec("ALTER TABLE resources ADD COLUMN members TEXT");
    db.saveToDisk();
  } catch (e) {
    if (!e.message.includes('duplicate') && !e.message.includes('already exists')) {
      console.warn('Migration warning:', e.message);
    }
  }

  // Migration: add resource_names column to tasks if missing
  try {
    sqlDb.exec("ALTER TABLE tasks ADD COLUMN resource_names TEXT");
    db.saveToDisk();
  } catch (e) {
    if (!e.message.includes('duplicate') && !e.message.includes('already exists')) {
      console.warn('Migration warning:', e.message);
    }
  }

  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
