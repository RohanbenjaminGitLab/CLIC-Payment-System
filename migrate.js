import { query } from './server/src/config/db.js';

async function migrate() {
  try {
    console.log('Adding timing column to batches...');
    await query("ALTER TABLE batches ADD COLUMN timing ENUM('MORNING','EVENING','WEEKDAY','WEEKEND') NOT NULL DEFAULT 'MORNING' AFTER course_id");
    console.log('Migration successful.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column timing already exists.');
    } else {
      console.error('Migration failed:', err.message);
    }
  } finally {
    process.exit(0);
  }
}

migrate();
