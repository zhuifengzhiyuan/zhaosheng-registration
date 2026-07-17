const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'zhaosheng.db');

let _sql;  // Internal SQL.js instance
let _db;   // Internal SQL.js database

function save() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

const db = {
  prepare(sql) {
    const stmt = _db.prepare(sql);
    return {
      get(...params) {
        if (params.length > 0) stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        if (params.length > 0) stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
      },
      run(...params) {
        if (params.length > 0) stmt.bind(params);
        stmt.step();
        stmt.free();
        save();
        return { changes: _db.getRowsModified() };
      }
    };
  },
  exec(sql) {
    _db.exec(sql);
    save();
  }
};

async function initialize() {
  _sql = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    _db = new _sql.Database(buffer);
  } else {
    _db = new _sql.Database();
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'staff')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_name TEXT NOT NULL,
      gender TEXT NOT NULL CHECK(gender IN ('男', '女')),
      ethnicity TEXT NOT NULL DEFAULT '汉族',
      admission_type TEXT NOT NULL CHECK(admission_type IN ('正式录取', '自主招生')),
      registered_address TEXT DEFAULT '',
      home_address TEXT DEFAULT '',
      id_number TEXT UNIQUE NOT NULL,
      middle_school TEXT DEFAULT '',
      father_name TEXT DEFAULT '',
      father_phone TEXT DEFAULT '',
      mother_name TEXT DEFAULT '',
      mother_phone TEXT DEFAULT '',
      zhongkao_score REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = { db, initialize };
