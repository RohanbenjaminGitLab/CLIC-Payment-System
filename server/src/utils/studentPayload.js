const PHONE_REGEX = /^\+?[0-9][0-9\s-]{7,19}$/;

export function isValidPhone(value) {
  if (!value) return true;
  return PHONE_REGEX.test(String(value).trim());
}

export function normalizeCourseIds(selectedCourseIds, fallbackCourseId = null) {
  const raw = Array.isArray(selectedCourseIds) && selectedCourseIds.length
    ? selectedCourseIds
    : [fallbackCourseId];

  return [...new Set(
    raw
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  )];
}

export function normalizeStudentStatus(status, fallback = 'active') {
  if (status == null || status === '') return fallback;
  return String(status).toLowerCase() === 'dropout' ? 'dropout' : 'active';
}

export function normalizeDropoutFields(status, dropoutDate, dropoutReason, fallbackDate) {
  if (status !== 'dropout') {
    return {
      dropoutDate: null,
      dropoutReason: null,
    };
  }

  const normalizedDate = String(dropoutDate || fallbackDate || '').slice(0, 10) || null;
  const normalizedReason = String(dropoutReason || '').trim().slice(0, 255) || null;

  return {
    dropoutDate: normalizedDate,
    dropoutReason: normalizedReason,
  };
}

export function buildInstallmentPlan(totalFee, installmentCount, enrollmentDate) {
  const total = Number(totalFee);
  const count = Number(installmentCount);
  const start = new Date(enrollmentDate);

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('Total fee must be a positive number for installments');
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('Installment count must be a positive whole number');
  }
  if (Number.isNaN(start.getTime())) {
    throw new Error('Enrollment date is required to build installments');
  }

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  let remainder = totalCents - (baseCents * count);

  return Array.from({ length: count }, (_unused, index) => {
    const due = new Date(start);
    due.setMonth(due.getMonth() + index);

    const cents = baseCents + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);

    return {
      installment_amount: cents / 100,
      due_date: due.toISOString().slice(0, 10),
    };
  });
}
