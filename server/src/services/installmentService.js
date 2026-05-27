import { query } from '../config/db.js';

export async function refreshOverdueInstallments() {
  try {
    await query(
      `UPDATE installments
       SET status = 'overdue'
       WHERE due_date < CURDATE()
         AND paid_amount < installment_amount
         AND status NOT IN ('paid')`
    );
  } catch (error) {
    console.error('overdue refresh failed', error.message);
  }
}
