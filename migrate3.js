import { query } from './server/src/config/db.js';

async function migrate() {
  try {
    console.log('Adding schedule column to batches...');
    await query("ALTER TABLE batches ADD COLUMN schedule ENUM('WEEKDAY','WEEKEND') NOT NULL DEFAULT 'WEEKDAY'");
  } catch (err) {
    console.log('schedule column might already exist:', err.message);
  }

  try {
    console.log('Adding temp_timing column to batches...');
    await query("ALTER TABLE batches ADD COLUMN temp_timing ENUM('MORNING','EVENING') NOT NULL DEFAULT 'MORNING'");
  } catch (err) {
    console.log('temp_timing column might already exist:', err.message);
  }

  try {
    console.log('Migrating batch data...');
    await query("UPDATE batches SET temp_timing = 'MORNING', schedule = 'WEEKDAY' WHERE timing = 'WEEKDAY'");
    await query("UPDATE batches SET temp_timing = 'MORNING', schedule = 'WEEKEND' WHERE timing = 'WEEKEND'");
    await query("UPDATE batches SET temp_timing = 'MORNING', schedule = 'WEEKDAY' WHERE timing = 'MORNING'");
    await query("UPDATE batches SET temp_timing = 'EVENING', schedule = 'WEEKDAY' WHERE timing = 'EVENING'");
  } catch (err) {
    console.error('Data migration failed:', err.message);
  }

  try {
    console.log('Dropping old timing column...');
    await query("ALTER TABLE batches DROP COLUMN timing");
    console.log('Renaming temp_timing to timing...');
    await query("ALTER TABLE batches CHANGE temp_timing timing ENUM('MORNING','EVENING') NOT NULL DEFAULT 'MORNING'");
  } catch(err) {
    console.error('Column swap failed:', err.message);
  }

  try {
    console.log('Adding discount columns to students...');
    await query("ALTER TABLE students ADD COLUMN discount_type ENUM('FIXED','PERCENTAGE') NULL");
    await query("ALTER TABLE students ADD COLUMN discount_value DECIMAL(12,2) NULL");
  } catch (err) {
    console.log('Discount columns might already exist:', err.message);
  }

  console.log('Migration completed.');
  process.exit(0);
}

migrate();
