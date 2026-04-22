import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const jwtSecret = process.env.JWT_SECRET?.trim() || '';
if (!jwtSecret) {
  console.error(
    'FATAL: JWT_SECRET is missing. Create server/.env (see project .env.example) and set JWT_SECRET.'
  );
  process.exit(1);
}
if (jwtSecret.length < 32 || /^change-me/i.test(jwtSecret)) {
  console.error('FATAL: JWT_SECRET is too weak. Use a random secret with at least 32 characters.');
  process.exit(1);
}
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/security.js';
import { query } from './config/db.js';
import { dispatchDueDateWhatsappReminders } from './services/reminderService.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

const allowedOrigins = String(process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    ...corsOptions,
  })
);
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));
app.use('/api', apiLimiter, routes);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use((err, _req, res, _next) => {
  if (err?.message === 'CORS origin not allowed') {
    return res.status(403).json({ error: err.message });
  }

  console.error('Unhandled server error', err);
  return res.status(500).json({ error: 'Internal server error' });
});

async function refreshOverdueInstallments() {
  try {
    await query(
      `UPDATE installments SET status = 'overdue'
       WHERE due_date < CURDATE() AND paid_amount < installment_amount AND status NOT IN ('paid')`
    );
  } catch (e) {
    console.error('overdue refresh', e.message);
  }
}

async function runReminderDispatch() {
  try {
    await dispatchDueDateWhatsappReminders();
  } catch (e) {
    console.error('reminder dispatch', e.message);
  }
}

async function runMigrations() {
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until DATETIME NULL`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(12,2) NOT NULL DEFAULT 5.00`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS base_salary DECIMAL(12,2) NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE users MODIFY COLUMN commission_rate DECIMAL(12,2) NOT NULL DEFAULT 5.00`);
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
  await query(`ALTER TABLE installments ADD COLUMN IF NOT EXISTS reminder_sent_at DATETIME NULL`);
  await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_code VARCHAR(20) NULL`);
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

await runMigrations();
refreshOverdueInstallments();
setInterval(refreshOverdueInstallments, 60 * 60 * 1000);
runReminderDispatch();
setInterval(runReminderDispatch, 15 * 60 * 1000);

const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  console.log(`CLIC Campus API listening on port ${port}`);
});
