import { query } from './server/src/config/db.js';

async function migrate() {
  try {
    console.log('Dropping fk_batches_course...');
    await query("ALTER TABLE batches DROP FOREIGN KEY fk_batches_course");
  } catch (err) {
    console.log('Key might not exist:', err.message);
  }
  
  try {
    console.log('Dropping course_id...');
    await query("ALTER TABLE batches DROP COLUMN course_id");
    console.log('Migration successful.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
