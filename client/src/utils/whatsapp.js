import { formatLKRNoPrefix } from './currency.js';

/**
 * Opens WhatsApp Web/App with prefilled message. Phone: digits only, Sri Lanka 94XXXXXXXXX.
 */
export function buildWhatsAppReceiptUrl(phone, { studentName, amount, receiptNo, balance }) {
  const digits = String(phone || '').replace(/\D/g, '');
  let wa = digits;
  if (wa.length === 9 && !wa.startsWith('0')) {
    wa = `94${wa}`;
  } else if (wa.startsWith('0') && wa.length === 10) {
    wa = `94${wa.slice(1)}`;
  }
  if (!wa || wa.length < 10) return null;

  const msg = [
    `Hello ${studentName || 'Student'},`,
    '',
    `Your payment of LKR ${formatLKRNoPrefix(amount)} has been received.`,
    `Receipt No: ${receiptNo}`,
    `Balance: LKR ${formatLKRNoPrefix(balance)}`,
    '',
    'Thank you!',
  ].join('\n');

  return `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
}
