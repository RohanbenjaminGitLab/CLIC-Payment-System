import { fileURLToPath } from 'url';
import { query } from '../src/config/db.js';
import * as migration001 from './001-user-security.js';
import * as migration002 from './002-students-courses.js';
import * as migration003 from './003-supporting-tables.js';

const migrations = [migration001, migration002, migration003];

export async function runMigrations() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(120) PRIMARY KEY,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const migration of migrations) {
    const existing = await query('SELECT name FROM schema_migrations WHERE name = ? LIMIT 1', [migration.name]);
    if (existing.length) {
      continue;
    }

    await migration.up(query);
    await query('INSERT INTO schema_migrations (name) VALUES (?)', [migration.name]);
  }
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  runMigrations()
    .then(() => {
      console.log('Migrations completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration run failed:', error.message);
      process.exit(1);
    });
}
