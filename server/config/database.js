const fs = require('fs');
const path = require('path');
require('dotenv').config();

// This module exports a db object that is populated after async init.
// All controllers require this file — they get the same object reference,
// and by the time any request arrives the object is already populated.
const db = {};

async function initializeDatabase() {

    // ── Try PostgreSQL first (Render / hosted) ────────────────────────────────
    const databaseUrl = process.env.DATABASE_URL;
    const dbType = (process.env.DB_TYPE || '').toLowerCase();

    if (databaseUrl || dbType === 'postgres' || dbType === 'postgresql') {
        try {
            const { Pool } = require('pg');

            const poolConfig = databaseUrl
                ? {
                    connectionString: databaseUrl,
                    // Render requires SSL for external connections
                    ssl: process.env.NODE_ENV === 'production'
                        ? { rejectUnauthorized: false }
                        : false
                }
                : {
                    host:     process.env.DB_HOST     || 'localhost',
                    user:     process.env.DB_USER     || 'postgres',
                    password: process.env.DB_PASSWORD || '',
                    database: process.env.DB_NAME     || 'laundry_db',
                    port:     parseInt(process.env.DB_PORT || '5432', 10),
                };

            const pool = new Pool(poolConfig);

            // Test connection
            const client = await pool.connect();
            console.log('✓ PostgreSQL connected successfully');
            client.release();

            // ── Auto-run schema on first startup ─────────────────────────────
            const schemaPath = path.join(__dirname, '../schema.postgres.sql');
            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf8');
                await pool.query(schema);
                console.log('  ✓ PostgreSQL schema initialised');
            }

            // ── Always sync admin password ────────────────────────────────────
            const bcrypt = require('bcryptjs');
            const { rows } = await pool.query(
                "SELECT id, password FROM users WHERE username = 'admin'"
            );
            if (rows.length > 0) {
                const isValid = await bcrypt.compare('admin123', rows[0].password || '');
                if (!isValid) {
                    const freshHash = await bcrypt.hash('admin123', 10);
                    await pool.query(
                        "UPDATE users SET password = $1 WHERE username = 'admin'",
                        [freshHash]
                    );
                    console.log('  ✓ Admin password hash corrected');
                }
            }

            console.log('  Login → username: admin  password: admin123');

            // ── pg adapter: translate mysql2-style ? → $1,$2,... ─────────────
            function toPositional(sql, params) {
                let i = 0;
                const converted = sql.replace(/\?/g, () => `$${++i}`);
                return { text: converted, values: params };
            }

            // pg returns rows in result.rows, and insertId via RETURNING id
            async function pgQuery(sql, params = []) {
                let finalSql = sql;
                const upper = sql.trimStart().toUpperCase();

                // Auto-append RETURNING id to INSERT statements so insertId is always populated
                if (upper.startsWith('INSERT') && !upper.includes('RETURNING')) {
                    finalSql = sql.trimEnd() + ' RETURNING id';
                }

                const { text, values } = toPositional(finalSql, params);
                const result = await pool.query(text, values);

                // Mimic mysql2: return [rows] for SELECT, [{insertId, affectedRows}] for DML
                if (upper.startsWith('SELECT')) {
                    return [result.rows];
                }
                const insertId = result.rows?.[0]?.id ?? null;
                return [{ insertId, affectedRows: result.rowCount }];
            }

            // Rewrite MySQL-specific SQL to PostgreSQL equivalents
            function toPostgres(sql) {
                return sql
                    // MySQL backtick identifiers → double-quote
                    .replace(/`([^`]+)`/g, '"$1"')
                    // Date functions
                    .replace(/CURDATE\(\)/gi, 'CURRENT_DATE')
                    .replace(/\bNOW\(\)\b/gi, 'NOW()')
                    // DATE_SUB(CURDATE(), INTERVAL n DAY)
                    .replace(
                        /DATE_SUB\s*\(\s*(?:CURDATE\(\)|CURRENT_DATE)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
                        "CURRENT_DATE - INTERVAL '$1 days'"
                    )
                    // DATE(expr) → (expr)::date
                    .replace(/\bDATE\(([^)]+)\)/gi, '($1)::date')
                    // MONTH / YEAR / WEEK aggregate functions
                    .replace(/\bMONTH\(([^)]+)\)/gi, 'EXTRACT(MONTH FROM $1)')
                    .replace(/\bYEAR\(([^)]+)\)/gi,  'EXTRACT(YEAR  FROM $1)')
                    .replace(/\bWEEK\(([^)]+)\)/gi,  'EXTRACT(WEEK  FROM $1)')
                    // INSERT IGNORE → INSERT (ON CONFLICT handled by RETURNING logic or schema)
                    .replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT INTO');
            }

            db.query = async (sql, params) => pgQuery(toPostgres(sql), params);
            db.type = 'postgres';

            db.getConnection = async () => {
                const client = await pool.connect();
                return {
                    query: async (sql, params) => {
                        // Use same pgQuery logic (auto RETURNING id) but with a dedicated client
                        const upper = (sql || '').trimStart().toUpperCase();
                        let finalSql = toPostgres(sql);
                        if (upper.startsWith('INSERT') && !upper.includes('RETURNING')) {
                            finalSql = finalSql.trimEnd() + ' RETURNING id';
                        }
                        const { text, values } = toPositional(finalSql, params || []);
                        const result = await client.query(text, values);
                        if (upper.startsWith('SELECT')) return [result.rows];
                        const insertId = result.rows?.[0]?.id ?? null;
                        return [{ insertId, affectedRows: result.rowCount }];
                    },
                    beginTransaction: async () => client.query('BEGIN'),
                    commit:           async () => client.query('COMMIT'),
                    rollback:         async () => client.query('ROLLBACK'),
                    release:          ()        => client.release()
                };
            };

            return; // Done — skip MySQL + SQLite
        } catch (err) {
            console.error('✗ PostgreSQL connection failed:', err.message);
            if (databaseUrl) {
                // If DATABASE_URL was explicitly set but failed, we should not silently
                // fall back — raise the error so the user knows something is wrong.
                throw err;
            }
            console.log('  Falling through to MySQL / SQLite...');
        }
    }

    // ── Try MySQL ─────────────────────────────────────────────────────────────
    try {
        const mysql = require('mysql2/promise');
        const pool = mysql.createPool({
            host:             process.env.DB_HOST     || 'localhost',
            user:             process.env.DB_USER     || 'root',
            password:         process.env.DB_PASSWORD || '',
            database:         process.env.DB_NAME     || 'laundry_db',
            waitForConnections: true,
            connectionLimit:  10,
            queueLimit:       0
        });

        const connection = await pool.getConnection();
        console.log('✓ MySQL database connected successfully');
        connection.release();

        db.query         = pool.query.bind(pool);
        db.getConnection = pool.getConnection.bind(pool);
        db.type          = 'mysql';
        return;
    } catch (err) {
        console.log('⚠  MySQL unavailable, falling back to SQLite...');
        console.log('   Reason:', err.message);
    }

    // ── Fallback: SQLite ──────────────────────────────────────────────────────
    const Database = require('better-sqlite3');
    const dbPath   = path.join(__dirname, '../../laundry.db');
    const sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');

    const schemaPath = path.join(__dirname, '../schema.sqlite.sql');
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        sqliteDb.exec(schema);
    }

    const bcrypt    = require('bcryptjs');
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

    // ── SQLite adapter (mysql2-compatible API) ────────────────────────────────
    function extractArg(sql, pos) {
        let depth = 0, i = pos;
        while (i < sql.length) {
            if (sql[i] === '(') depth++;
            else if (sql[i] === ')') { depth--; if (depth === 0) return sql.slice(pos + 1, i); }
            i++;
        }
        return sql.slice(pos + 1);
    }

    function replaceFn(sql, fnName, template) {
        const upper  = sql.toUpperCase();
        const search = fnName.toUpperCase() + '(';
        let result = '', i = 0;
        while (i < sql.length) {
            const idx = upper.indexOf(search, i);
            if (idx === -1) { result += sql.slice(i); break; }
            result += sql.slice(i, idx);
            const arg       = extractArg(sql, idx + fnName.length);
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

        s = s.replace(
            /DATE_SUB\s*\(\s*CURDATE\(\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
            "date('now','-$1 days')"
        );
        s = s.replace(
            /DATE_SUB\s*\(\s*date\('now'\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi,
            "date('now','-$1 days')"
        );
        s = s.replace(/DATE\(([^)]+)\)/gi, 'date($1)');
        s = replaceFn(s, 'MONTH', "CAST(strftime('%m',$1) AS INTEGER)");
        s = replaceFn(s, 'YEAR',  "CAST(strftime('%Y',$1) AS INTEGER)");
        s = replaceFn(s, 'WEEK',  "CAST(strftime('%W',$1) AS INTEGER)");
        return s;
    }

    function runQuery(sql, params = []) {
        const converted = toSQLite(sql);
        const isSelect  = converted.trimStart().toUpperCase().startsWith('SELECT');
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
    db.type  = 'sqlite';

    db.getConnection = async () => {
        let inTx = false;
        return {
            query:            async (sql, params) => runQuery(sql, params),
            beginTransaction: async () => { sqliteDb.exec('BEGIN');    inTx = true;  },
            commit:           async () => { if (inTx) { sqliteDb.exec('COMMIT');   inTx = false; } },
            rollback:         async () => { if (inTx) { sqliteDb.exec('ROLLBACK'); inTx = false; } },
            release:          () => {}
        };
    };
}

// Kick off init; export the promise so server.js can await it
db.ready = initializeDatabase();

module.exports = db;
