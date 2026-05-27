export const name = '004-add-batch-timing-schedule';

export async function up(query) {
  // 1. Drop foreign key constraint if it exists
  try {
    await query(`ALTER TABLE batches DROP FOREIGN KEY fk_batches_course`);
    console.log('Successfully dropped foreign key constraint fk_batches_course from batches');
  } catch (err) {
    // Ignore error if foreign key does not exist
    console.log('Note: fk_batches_course foreign key constraint not dropped (probably does not exist):', err.message);
  }

  // 2. Drop course_id column if it exists
  try {
    await query(`ALTER TABLE batches DROP COLUMN course_id`);
    console.log('Successfully dropped column course_id from batches');
  } catch (err) {
    // Ignore error if column does not exist
    console.log('Note: course_id column not dropped (probably does not exist):', err.message);
  }

  // 3. Add timing and schedule columns
  await query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS timing ENUM('MORNING','EVENING') NOT NULL DEFAULT 'MORNING'`);
  await query(`ALTER TABLE batches ADD COLUMN IF NOT EXISTS schedule ENUM('WEEKDAY','WEEKEND') NOT NULL DEFAULT 'WEEKDAY'`);
}
