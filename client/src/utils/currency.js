/** Sri Lankan Rupee — Rs. 25,000.00 */
export function formatLKR(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return 'Rs. 0.00';
  const formatted = n.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Rs. ${formatted}`;
}

export function formatLKRNoPrefix(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return '0.00';
  return n.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
