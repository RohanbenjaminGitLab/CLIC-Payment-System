// migrate4.js
import { query } from './server/src/config/db.js';

async function migrate() {
  try {
    console.log('Adding status column to students...');
    // We use an ENUM to ensure data integrity
    await query(`
      ALTER TABLE students 
      ADD COLUMN status ENUM('ACTIVE', 'DROPPED_OUT', 'GRADUATED') 
      NOT NULL DEFAULT 'ACTIVE'
    `);
    console.log('Migration successful.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Status column already exists.');
    } else {
      console.error('Migration failed:', err.message);
    }
  } finally {
    process.exit(0);
  }
}

migrate();