const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function run() {
    await db.ready;

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
        console.log('No migrations directory found, nothing to do.');
        return;
    }

    console.log('Using DB type:', db.type);

    // Create migrations table if not exists
    let createMigrationsTableSql;
    if (db.type === 'postgres') {
        createMigrationsTableSql = `CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, applied_at TIMESTAMP NOT NULL)`;
    } else if (db.type === 'mysql') {
        createMigrationsTableSql = `CREATE TABLE IF NOT EXISTS migrations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
    } else {
        // sqlite
        createMigrationsTableSql = `CREATE TABLE IF NOT EXISTS migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT NOT NULL)`;
    }

    await db.query(createMigrationsTableSql);

    // Discover migration files and pick the best file per migration base name for this DB type.
    const allSqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

    // Group files by base name (without db-specific suffix)
    const groups = {};
    for (const f of allSqlFiles) {
        let base = f;
        if (f.endsWith('.pg.sql')) base = f.slice(0, -7);
        else if (f.endsWith('.mysql.sql')) base = f.slice(0, -10);
        else if (f.endsWith('.sqlite.sql')) base = f.slice(0, -11);
        else if (f.endsWith('.sql')) base = f.slice(0, -4);
        groups[base] = groups[base] || [];
        groups[base].push(f);
    }

    // Preferences per DB type: prefer DB-specific variants, fall back to generic .sql
    const prefs = {
        postgres: ['.pg.sql', '.sql'],
        sqlite: ['.sql', '.sqlite.sql', '.pg.sql'],
        mysql: ['.mysql.sql', '.sql', '.pg.sql']
    };

    const prefList = prefs[db.type] || ['.sql'];
    const files = Object.keys(groups).map(base => {
        const candidates = groups[base];
        for (const ext of prefList) {
            const name = base + ext;
            if (candidates.includes(name)) return name;
        }
        // fallback: pick the first candidate
        return candidates[0];
    }).filter(Boolean).sort();

    for (const file of files) {
        const already = await db.query('SELECT name FROM migrations WHERE name = ?', [file]);
        const applied = (already[0] || []).length > 0;
        if (applied) {
            console.log('Skipping already applied migration:', file);
            continue;
        }

        console.log('Applying migration:', file);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        try {
            if (db.type === 'sqlite') {
                // For SQLite, prefer running only the missing ALTER statements so we avoid duplicate column errors.
                const Database = require('better-sqlite3');
                const dbPath = require('path').join(__dirname, '..', 'laundry.db');
                const sqlite = new Database(dbPath);

                const hasCol = (table, col) => {
                    try {
                        const rows = sqlite.prepare(`PRAGMA table_info('${table}')`).all();
                        return rows.some(r => r.name === col);
                    } catch (e) { return false; }
                };

                const alters = [];
                if (!hasCol('users', 'address')) alters.push("ALTER TABLE users ADD COLUMN address TEXT DEFAULT NULL;");
                if (!hasCol('users', 'phone'))   alters.push("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL;");
                if (!hasCol('sale_items', 'description')) alters.push("ALTER TABLE sale_items ADD COLUMN description TEXT DEFAULT NULL;");
                if (!hasCol('sale_items', 'total_pieces')) alters.push("ALTER TABLE sale_items ADD COLUMN total_pieces INTEGER DEFAULT 1;");

                if (alters.length > 0) {
                    sqlite.exec('PRAGMA foreign_keys = OFF; BEGIN; ' + alters.join(' ') + ' COMMIT; PRAGMA foreign_keys = ON;');
                } else {
                    console.log('SQLite: all columns already present, skipping ALTERs for', file);
                }

                sqlite.close();
            } else {
                // For Postgres/MySQL, split by semicolon and run statements sequentially
                const stmts = sql.split(/;\s*\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
                for (const stmt of stmts) {
                    await db.query(stmt);
                }
            }

            // Mark migration as applied
            await db.query('INSERT INTO migrations (name, applied_at) VALUES (?, ?)', [file, new Date().toISOString()]);
            console.log('Applied:', file);
        } catch (err) {
            const msg = String(err.message || '').toLowerCase();
            // If the migration already applied (duplicate column / already exists), treat as ok
            if (msg.includes('duplicate column') || msg.includes('duplicate column name') || msg.includes('already exists') || msg.includes('duplicate')) {
                console.warn('Migration appears partially applied or columns already exist — marking as applied:', file);
                try {
                    await db.query('INSERT INTO migrations (name, applied_at) VALUES (?, ?)', [file, new Date().toISOString()]);
                } catch (e) {
                    console.warn('Failed to mark migration as applied:', e.message || e);
                }
                continue;
            }

            console.error('Failed to apply migration', file, err.message || err);
            process.exitCode = 1;
            return;
        }
    }

    console.log('Migrations finished.');
}

// Export the runner so it can be invoked programmatically (e.g., via an admin-only API)
module.exports = {
    run
};

// If run directly (node server/migrate.js), execute immediately.
if (require.main === module) {
    run().catch(err => {
        console.error('Migration runner error:', err);
        process.exit(1);
    });
}
