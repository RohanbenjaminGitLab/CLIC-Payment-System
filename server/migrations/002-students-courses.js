export const name = '002-students-courses';

export async function up(query) {
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_no VARCHAR(40) NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS address VARCHAR(255) NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS reg_no VARCHAR(40) NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS course_combo_code VARCHAR(40) NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS join_ym CHAR(4) NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS serial_no INT NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS discount_type ENUM('FIXED','PERCENTAGE') NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2) NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS installment_count INT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_date DATE NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS created_by INT UNSIGNED NULL`);
  await query(
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS status ENUM('active','dropout') NOT NULL DEFAULT 'active'`
  );
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS dropout_date DATE NULL`);
  await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS dropout_reason VARCHAR(255) NULL`);
  await query(`ALTER TABLE installments ADD COLUMN IF NOT EXISTS reminder_sent_at DATETIME NULL`);
  await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_code VARCHAR(20) NULL`);
  await query(`
    UPDATE students s
    JOIN (
      SELECT CAST(a.entity_id AS UNSIGNED) AS student_id,
             SUBSTRING_INDEX(GROUP_CONCAT(a.user_id ORDER BY a.id ASC), ',', 1) AS creator_user_id
      FROM audit_logs a
      WHERE a.entity_type = 'student'
        AND a.action = 'STUDENT_CREATE'
        AND a.user_id IS NOT NULL
        AND a.entity_id REGEXP '^[0-9]+$'
      GROUP BY CAST(a.entity_id AS UNSIGNED)
    ) enrollment_audit ON enrollment_audit.student_id = s.id
    SET s.created_by = CAST(enrollment_audit.creator_user_id AS UNSIGNED)
    WHERE s.created_by IS NULL
  `);
}
