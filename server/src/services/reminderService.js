import { query } from '../config/db.js';
import { writeAudit } from './auditService.js';

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('94')) return digits;
  if (digits.startsWith('0')) return `94${digits.slice(1)}`;
  return digits;
}

function buildReminderMessage(row, dueAmount) {
  return (
    `Hello ${row.student_name}, this is a payment reminder from CLIC Campus. ` +
    `Due amount: LKR ${dueAmount.toFixed(2)}. ` +
    `Deadline: ${row.due_date}. Please settle this payment.`
  );
}

async function sendViaWebhook(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Webhook failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

export async function dispatchDueDateWhatsappReminders() {
  const webhookUrl = process.env.WHATSAPP_REMINDER_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { sent: 0, skipped: 0, reason: 'webhook_not_configured' };

  const rows = await query(
    `SELECT i.id AS installment_id, i.student_id, i.due_date, i.installment_amount, i.paid_amount,
            s.name AS student_name, COALESCE(s.whatsapp_no, s.phone) AS contact_no
     FROM installments i
     JOIN students s ON s.id = i.student_id
     WHERE i.status != 'paid'
       AND i.paid_amount < i.installment_amount
       AND i.due_date <= CURDATE()
       AND i.reminder_sent_at IS NULL
     ORDER BY i.due_date ASC, i.id ASC`
  );

  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const dueAmount = Math.max(0, Number(row.installment_amount) - Number(row.paid_amount));
    const phone = normalizePhone(row.contact_no);
    if (!phone || dueAmount <= 0) {
      skipped += 1;
      continue;
    }
    const message = buildReminderMessage(row, dueAmount);

    try {
      await sendViaWebhook(webhookUrl, {
        phone,
        studentId: row.student_id,
        studentName: row.student_name,
        installmentId: row.installment_id,
        dueAmount,
        dueDate: row.due_date,
        message,
      });
      await query(`UPDATE installments SET reminder_sent_at = NOW() WHERE id = ?`, [row.installment_id]);
      await writeAudit(
        null,
        'WHATSAPP_DUE_REMINDER_SENT',
        'installment',
        String(row.installment_id),
        { student_id: row.student_id, phone, due_amount: dueAmount, due_date: row.due_date },
        null
      );
      sent += 1;
    } catch (err) {
      await writeAudit(
        null,
        'WHATSAPP_DUE_REMINDER_FAILED',
        'installment',
        String(row.installment_id),
        { error: String(err?.message || err), student_id: row.student_id },
        null
      );
    }
  }

  return { sent, skipped, reason: 'ok' };
}

