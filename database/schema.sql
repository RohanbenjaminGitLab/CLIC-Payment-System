-- CLIC Campus Student Payment & Course Management System
-- MySQL 8+

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS login_history;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS credential_change_requests;
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS installments;
DROP TABLE IF EXISTS commissions;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS batches;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','staff') NOT NULL DEFAULT 'staff',
  commission_rate DECIMAL(12,2) NOT NULL DEFAULT 5.00,
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  lock_until DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE courses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_name VARCHAR(200) NOT NULL,
  course_code VARCHAR(20),
  description TEXT,
  duration VARCHAR(80),
  fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_courses_name (course_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE batches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_name VARCHAR(120) NOT NULL,
  timing ENUM('MORNING','EVENING') NOT NULL DEFAULT 'MORNING',
  schedule ENUM('WEEKDAY','WEEKEND') NOT NULL DEFAULT 'WEEKDAY',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_batches_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE students (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reg_no VARCHAR(40) UNIQUE,
  course_combo_code VARCHAR(40),
  join_ym CHAR(4),
  serial_no INT,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40),
  whatsapp_no VARCHAR(40),
  address VARCHAR(255),
  course_id INT UNSIGNED NOT NULL,
  batch_id INT UNSIGNED NOT NULL,
  total_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_type ENUM('FIXED','PERCENTAGE') NULL,
  discount_value DECIMAL(12,2) NULL,
  payment_type ENUM('FULL','INSTALLMENT') NOT NULL DEFAULT 'FULL',
  installment_count INT NOT NULL DEFAULT 0,
  status ENUM('active','dropout') NOT NULL DEFAULT 'active',
  dropout_date DATE NULL,
  dropout_reason VARCHAR(255) NULL,
  enrollment_date DATE NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_students_batch FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_students_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_students_course (course_id),
  INDEX idx_students_batch (batch_id),
  INDEX idx_students_creator (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE student_courses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  course_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_student_courses_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_student_courses_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY uq_student_course (student_id, course_id),
  INDEX idx_student_courses_student (student_id),
  INDEX idx_student_courses_course (course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  staff_id INT UNSIGNED NOT NULL,
  receipt_no VARCHAR(40) NOT NULL,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payments_staff FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY uq_receipt_no (receipt_no),
  INDEX idx_payments_student (student_id),
  INDEX idx_payments_staff (staff_id),
  INDEX idx_payments_date (payment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE commissions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE installments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT UNSIGNED NOT NULL,
  installment_amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',
  reminder_sent_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_installments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_installments_student (student_id),
  INDEX idx_installments_due (due_date),
  INDEX idx_installments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_token_hash (token_hash),
  INDEX idx_refresh_user (user_id),
  INDEX idx_refresh_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  email_attempt VARCHAR(190),
  ip_address VARCHAR(45) NOT NULL,
  user_agent VARCHAR(512),
  success TINYINT(1) NOT NULL DEFAULT 0,
  failure_reason VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_login_user (user_id),
  INDEX idx_login_ip (ip_address),
  INDEX idx_login_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(80),
  entity_id VARCHAR(40),
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE app_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_setting_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE credential_change_requests (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
