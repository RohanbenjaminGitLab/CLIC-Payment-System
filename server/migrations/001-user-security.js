export const name = '001-user-security';

export async function up(query) {
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until DATETIME NULL`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(12,2) NOT NULL DEFAULT 5.00`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS base_salary DECIMAL(12,2) NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE users MODIFY COLUMN commission_rate DECIMAL(12,2) NOT NULL DEFAULT 5.00`);
}
