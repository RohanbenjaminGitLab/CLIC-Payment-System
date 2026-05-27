export const name = '003-supporting-tables';

export async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS student_courses (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      student_id INT UNSIGNED NOT NULL,
      course_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_student_courses_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_student_courses_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      UNIQUE KEY uq_student_course (student_id, course_id),
      INDEX idx_student_courses_student (student_id),
      INDEX idx_student_courses_course (course_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS commissions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      payment_id INT UNSIGNED NOT NULL,
      enrolled_by_user_id INT UNSIGNED NOT NULL,
      amount_paid DECIMAL(12,2) NOT NULL,
      commission_rate DECIMAL(12,2) NOT NULL,
      commission_amount DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_commission_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_commission_user FOREIGN KEY (enrolled_by_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      UNIQUE KEY uq_commission_payment (payment_id),
      INDEX idx_commission_user (enrolled_by_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`ALTER TABLE commissions MODIFY COLUMN commission_rate DECIMAL(12,2) NOT NULL`);
  await query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(120) NOT NULL UNIQUE,
      setting_value TEXT NULL,
      updated_by INT UNSIGNED NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_setting_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS credential_change_requests (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      new_name VARCHAR(120) NULL,
      new_email VARCHAR(190) NULL,
      new_password_hash VARCHAR(255) NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      reason VARCHAR(255) NULL,
      reviewed_by INT UNSIGNED NULL,
      reviewed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_cred_req_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_cred_req_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      INDEX idx_cred_req_user (user_id),
      INDEX idx_cred_req_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`ALTER TABLE credential_change_requests ADD COLUMN IF NOT EXISTS new_name VARCHAR(120) NULL`);
}
