import { jsPDF } from 'jspdf';
import { formatLKR } from './currency.js';
import dayjs from 'dayjs';
import logo from './logo.png';

export async function generateReceiptPdf(r) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'landscape' });
  const w = doc.internal.pageSize.getWidth();

  // Convert HEX → RGB
  const primary = [117, 28, 88]; // #751c58

  // ===== BORDER =====
  doc.setDrawColor(...primary);
  doc.rect(5, 5, w - 10, 138);

  // ===== LOGO =====
  doc.addImage(logo, 'PNG', 10, 10, 30, 30);

  // ===== HEADER =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...primary);
  doc.text('CLIC CAMPUS', 45, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('Cambridge Languages Infotech Campus', 45, 24);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text('PAYMENT RECEIPT', w - 70, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text(`Receipt No: ${r.receipt_no || ''}`, w - 70, 25);
  doc.text(
    `Date: ${r.payment_date ? dayjs(r.payment_date).format('DD/MM/YYYY') : ''}`,
    w - 70,
    30
  );

  // ===== DIVIDER =====
  doc.setDrawColor(200);
  doc.line(10, 42, w - 10, 42);

  // ===== STUDENT DETAILS =====
  doc.setFontSize(10);
  doc.setTextColor(60);

  doc.text('Student Name:', 10, 52);
  doc.text(String(r.student_name || ''), 40, 52);

  doc.text('Reg No:', 10, 60);
  doc.text(String(r.student_reg_no || ''), 40, 60);

  doc.text('Course:', 10, 68);
  doc.text(String(r.course_name || ''), 40, 68);

  doc.text('Batch:', 10, 76);
  doc.text(String(r.batch_name || ''), 40, 76);

  let baseFee = Number(r.total_fee);
  if (r.discount_type === 'FIXED') baseFee += Number(r.discount_value);
  else if (r.discount_type === 'PERCENTAGE') baseFee /= (1 - (Number(r.discount_value) / 100));

  doc.text('Course Fee:', 10, 84);
  doc.text(formatLKR(baseFee), 40, 84);

  if (r.discount_type) {
    doc.text('Discount:', 10, 92);
    doc.text(r.discount_type === 'FIXED' ? formatLKR(r.discount_value) : `${r.discount_value}%`, 40, 92);
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Final Payment:', 10, 100);
  doc.text(formatLKR(r.total_fee), 40, 100);
  doc.setFont('helvetica', 'normal');

  // ===== PAYMENT BOX =====
  doc.setDrawColor(...primary);
  doc.rect(w - 80, 50, 65, 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primary);
  doc.text('Amount Paid', w - 75, 58);

  doc.setFontSize(16);
  doc.text(formatLKR(r.amount_paid || 0), w - 75, 70);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(`Balance: ${formatLKR(r.balance || 0)}`, w - 75, 80);


  // ===== SIGNATURE =====
  doc.line(w - 65, 110, w - 15, 110);
  doc.text('Authorized Signature', w - 55, 115);
  doc.text(String(r.staff_name || ''), w - 53, 120);

  // ===== FOOTER (CENTERED) =====
  doc.setFontSize(15);
  doc.setTextColor(...primary);
  doc.text(
    'Enjoy the best in learning',
    w / 2,
    135,
    { align: 'center' }
  );

  // ===== SAVE =====
  doc.save(`receipt-${r.receipt_no}.pdf`);
}