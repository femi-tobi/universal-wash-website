const fs = require('fs');
const path = require('path');
require('dotenv').config();

// This module exports a db object that is populated after async init.
// All controllers require this file — they get the same object reference,
// and by the time any request arrives the object is already populated.
const db = {};

async function initializeDatabase() {
    // ── Try MySQL first ──────────────────────────────────────────────────────
    try {
        const mysql = require('mysql2/promise');
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'laundry_db',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        const connection = await pool.getConnection();
        console.log('✓ MySQL database connected successfully');
        connection.release();

        // Copy pool methods onto the shared db object
        db.query = pool.query.bind(pool);
        db.getConnection = pool.getConnection.bind(pool);
        db.type = 'mysql';
        return;
    } catch (err) {
        console.log('⚠  MySQL unavailable, falling back to SQLite...');
        console.log('   Reason:', err.message);
    }

    // ── Fallback: SQLite ─────────────────────────────────────────────────────
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '../../laundry.db');
    const sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');

    // Run schema
    const schemaPath = path.join(__dirname, '../schema.sqlite.sql');
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        sqliteDb.exec(schema);
    }

    // Always ensure admin password is correct (bcrypt hash can't be hardcoded in SQL reliably)
    const bcrypt = require('bcryptjs');
    const adminUser = sqliteDb.prepare("SELECT id, password FROM users WHERE username = 'admin'").get();
    if (adminUser) {
        const isValid = await bcrypt.compare('admin123', adminUser.password || '');
        if (!isValid) {
            const freshHash = await bcrypt.hash('admin123', 10);
            sqliteDb.prepare("UPDATE users SET password = ? WHERE username = 'admin'").run(freshHash);
            console.log('  ✓ Admin password hash corrected');
        }
    }

    console.log('✓ SQLite database ready at:', dbPath);
    console.log('  Login → username: admin  password: admin123');

    // ── SQLite adapter (mysql2-compatible API) ───────────────────────────────

    // Extract the argument of a MySQL function call starting at `pos` (points to '(')
    function extractArg(sql, pos) {
        let depth = 0, i = pos;
        while (i < sql.length) {
            if (sql[i] === '(') depth++;
            else if (sql[i] === ')') { depth--; if (depth === 0) return sql.slice(pos + 1, i); }
            i++;
        }
        return sql.slice(pos + 1); // fallback
    }

    // Replace MySQL function calls that may have nested parens in their args
    function replaceFn(sql, fnName, template) {
        const upper = sql.toUpperCase();
        const search = fnName.toUpperCase() + '(';
        let result = '';
        let i = 0;
        while (i < sql.length) {
            const idx = upper.indexOf(search, i);
            if (idx === -1) { result += sql.slice(i); break; }
            result += sql.slice(i, idx);
            const arg = extractArg(sql, idx + fnName.length);
            const fullMatch = fnName + '(' + arg + ')';
            result += template.replace('$1', arg);
            i = idx + fullMatch.length;
        }
        return result;
    }

    function toSQLite(sql) {
        let s = sql
            .replace(/CURDATE\(\)/gi, "date('now')")
            .replace(/NOW\(\)/gi,     "datetime('now')");

        // DATE_SUB before DATE() so DATE() doesn't eat into it
        s = s.replace(/DATE_SUB\s*\(\s*CURDATE\(\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
                      "date('now','-$1 days')");
        s = s.replace(/DATE_SUB\s*\(\s*date\('now'\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
                      "date('now','-$1 days')");

        // DATE() wrapper — safe because date('now') has no nested parens after CURDATE replaced
        s = s.replace(/DATE\(([^)]+)\)/gi, "date($1)");

        // MONTH / YEAR / WEEK — use depth-aware replacer
        s = replaceFn(s, 'MONTH', "CAST(strftime('%m',$1) AS INTEGER)");
        s = replaceFn(s, 'YEAR',  "CAST(strftime('%Y',$1) AS INTEGER)");
        s = replaceFn(s, 'WEEK',  "CAST(strftime('%W',$1) AS INTEGER)");

        return s;
    }

    function runQuery(sql, params = []) {
        const converted = toSQLite(sql);
        const isSelect = converted.trimStart().toUpperCase().startsWith('SELECT');
        try {
            const stmt = sqliteDb.prepare(converted);
            if (isSelect) {
                return [stmt.all(...params)];
            } else {
                const r = stmt.run(...params);
                return [{ insertId: r.lastInsertRowid, affectedRows: r.changes }];
            }
        } catch (e) {
            console.error('SQLite error:', e.message);
            console.error('SQL:', converted);
            throw e;
        }
    }

    db.query = async (sql, params) => runQuery(sql, params);
    db.type = 'sqlite';

    db.getConnection = async () => {
        // Emulate a MySQL connection with transaction support
        let inTx = false;
        return {
            query: async (sql, params) => runQuery(sql, params),
            beginTransaction: async () => {
                sqliteDb.exec('BEGIN');
                inTx = true;
            },
            commit: async () => {
                if (inTx) { sqliteDb.exec('COMMIT'); inTx = false; }
            },
            rollback: async () => {
                if (inTx) { sqliteDb.exec('ROLLBACK'); inTx = false; }
            },
            release: () => {}
        };
    };
}

// Kick off init; export the promise so server.js can await it
db.ready = initializeDatabase();

module.exports = db;
