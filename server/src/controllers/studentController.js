import { getPool, query } from '../config/db.js';
import { writeAudit } from '../services/auditService.js';
import {
  buildInstallmentPlan,
  isValidPhone,
  normalizeCourseIds,
  normalizeDropoutFields,
  normalizeStudentStatus,
} from '../utils/studentPayload.js';
import { visibleStudentScope } from '../utils/staffVisibility.js';

function toSql(value) {
  return value === undefined ? null : value;
}

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || '';
}

async function runQuery(executor, sql, params = []) {
  if (typeof executor === 'function') {
    return executor(sql, params);
  }
  const [rows] = await executor.execute(sql, params);
  return rows;
}

function staffScope(req, alias = 's') {
  return visibleStudentScope(req, alias);
}

function selectedCoursesSql() {
  return `
    COALESCE(
      (
        SELECT GROUP_CONCAT(DISTINCT sc.course_id ORDER BY sc.course_id SEPARATOR ',')
        FROM student_courses sc
        WHERE sc.student_id = s.id
      ),
      CAST(s.course_id AS CHAR)
    ) AS selected_course_ids,
    COALESCE(
      (
        SELECT GROUP_CONCAT(DISTINCT c2.course_name ORDER BY c2.course_name SEPARATOR ' + ')
        FROM student_courses sc
        JOIN courses c2 ON c2.id = sc.course_id
        WHERE sc.student_id = s.id
      ),
      c.course_name
    ) AS selected_courses
  `;
}

function studentSelectSql() {
  return `
    SELECT s.*, c.course_name, b.batch_name,
           COALESCE(u.name, audit_creator.name) AS enrolled_staff_name,
           ${selectedCoursesSql()}
    FROM students s
    JOIN courses c ON c.id = s.course_id
    JOIN batches b ON b.id = s.batch_id
    LEFT JOIN users u ON u.id = s.created_by
    LEFT JOIN users audit_creator ON audit_creator.id = (
      SELECT a.user_id
      FROM audit_logs a
      WHERE a.entity_type = 'student'
        AND a.entity_id = CAST(s.id AS CHAR)
        AND a.action = 'STUDENT_CREATE'
        AND a.user_id IS NOT NULL
      ORDER BY a.id ASC
      LIMIT 1
    )
    WHERE 1=1
  `;
}

function sanitizeInstallments(installments) {
  if (!Array.isArray(installments)) return [];

  return installments
    .map((row) => ({
      installment_amount: Number(row?.installment_amount),
      due_date: String(row?.due_date || '').slice(0, 10),
    }))
    .filter((row) => Number.isFinite(row.installment_amount) && row.installment_amount > 0 && row.due_date);
}

function validateCoreStudentFields(body, { requireRequiredFields }) {
  if (requireRequiredFields) {
    if (!String(body.name || '').trim()) {
      return 'Student name is required';
    }
    if (!body.batch_id) {
      return 'Batch is required';
    }
    if (!body.enrollment_date) {
      return 'Enrollment date is required';
    }
  }

  if (body.phone !== undefined && !isValidPhone(body.phone)) {
    return 'Invalid phone number';
  }
  if (body.whatsapp_no !== undefined && !isValidPhone(body.whatsapp_no)) {
    return 'Invalid WhatsApp number';
  }
  if (body.total_fee !== undefined) {
    const totalFee = Number(body.total_fee);
    if (!Number.isFinite(totalFee) || totalFee < 0) {
      return 'Total fee must be a valid non-negative number';
    }
  }
  if (body.discount_type && !['FIXED', 'PERCENTAGE'].includes(String(body.discount_type))) {
    return 'Invalid discount type';
  }
  if (body.discount_value !== undefined && body.discount_value !== null) {
    const discountValue = Number(body.discount_value);
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return 'Discount value must be a valid non-negative number';
    }
  }
  if (body.payment_type && !['FULL', 'INSTALLMENT'].includes(String(body.payment_type))) {
    return 'Invalid payment type';
  }
  if ((body.payment_type === 'INSTALLMENT' || body.installment_count !== undefined) && body.installment_count !== null) {
    const installmentCount = Number(body.installment_count);
    if (!Number.isInteger(installmentCount) || installmentCount <= 0) {
      return 'Installment count must be a positive whole number';
    }
  }
  return null;
}

async function courseCombinationCode(executor, courseIds) {
  const ids = [...new Set((courseIds || []).map(Number).filter((value) => value > 0))];
  if (!ids.length) return null;

  const rows = await runQuery(
    executor,
    `SELECT id, course_name, course_code FROM courses WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );

  if (rows.length !== ids.length) return null;

  const known = {
    english: 'E',
    it: 'I',
    'information technology': 'I',
    sinhala: 'S',
    science: 'S',
  };
  const codeMap = { eng: 'E', it: 'I', sin: 'S', sci: 'S' };
  const order = { E: 1, I: 2, S: 3 };

  const tokens = rows
    .map((row) => {
      const name = String(row.course_name || '').trim().toLowerCase();
      if (known[name]) return known[name];

      const code = String(row.course_code || '').trim().toLowerCase();
      if (codeMap[code]) return codeMap[code];

      const courseName = String(row.course_name || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (courseName) return courseName[0];

      const courseCode = String(row.course_code || '').toUpperCase().replace(/[^A-Z]/g, '');
      return courseCode ? courseCode[0] : '';
    })
    .filter(Boolean)
    .sort((left, right) => (order[left] ?? 999) - (order[right] ?? 999));

  return [...new Set(tokens)].join('') || null;
}

function yearFromDate(input) {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return String(parsed.getFullYear());
}

async function nextRegistrationNo(executor, combo, year, excludeId = null) {
  if (!combo || !year) return null;

  const rows = await runQuery(
    executor,
    `SELECT COALESCE(MAX(serial_no), 0) AS max_serial
     FROM students
     WHERE course_combo_code = ? AND join_ym = ?
     ${excludeId ? 'AND id != ?' : ''}`,
    excludeId ? [combo, year, Number(excludeId)] : [combo, year]
  );

  const serial = Number(rows[0]?.max_serial || 0) + 1;
  return {
    serial,
    regNo: `CL/${combo}/${year}/${String(serial).padStart(4, '0')}`,
  };
}

async function syncStudentCourses(connection, studentId, courseIds) {
  await connection.execute('DELETE FROM student_courses WHERE student_id = ?', [studentId]);

  if (!courseIds.length) return;

  const placeholders = courseIds.map(() => '(?, ?)').join(', ');
  const params = courseIds.flatMap((courseId) => [studentId, courseId]);
  await connection.execute(
    `INSERT INTO student_courses (student_id, course_id) VALUES ${placeholders}`,
    params
  );
}

async function replaceInstallments(connection, studentId, plan) {
  await connection.execute('DELETE FROM installments WHERE student_id = ?', [studentId]);

  if (!plan.length) return;

  const placeholders = plan.map(() => '(?, ?, ?, 0, ?)').join(', ');
  const params = plan.flatMap((row) => [
    studentId,
    Number(row.installment_amount),
    row.due_date,
    row.due_date < new Date().toISOString().slice(0, 10) ? 'overdue' : 'pending',
  ]);

  await connection.execute(
    `INSERT INTO installments (student_id, installment_amount, due_date, paid_amount, status)
     VALUES ${placeholders}`,
    params
  );
}

async function getAccessibleStudent(req, studentId) {
  const scope = staffScope(req);
  const rows = await query(
    `SELECT * FROM students s WHERE s.id = ?${scope.clause}`,
    [studentId, ...scope.params]
  );
  return rows[0] || null;
}

function normalizeStudentPayload(body, existingStudent = null) {
  const base = existingStudent || {};
  const status = normalizeStudentStatus(body.status, normalizeStudentStatus(base.status || 'active'));
  const enrollmentDate = String(body.enrollment_date || base.enrollment_date || '').slice(0, 10) || null;
  const courseIds = normalizeCourseIds(body.selected_course_ids, body.course_id ?? base.course_id);
  const primaryCourseId = courseIds[0] ?? Number(base.course_id);
  const paymentType = String(body.payment_type || base.payment_type || 'FULL');
  const installmentCount = Number(
    body.installment_count ?? base.installment_count ?? (paymentType === 'INSTALLMENT' ? 3 : 0)
  );

  const { dropoutDate, dropoutReason } = normalizeDropoutFields(
    status,
    body.dropout_date ?? base.dropout_date,
    body.dropout_reason ?? base.dropout_reason,
    new Date().toISOString().slice(0, 10)
  );

  return {
    name: body.name !== undefined ? String(body.name).trim() : String(base.name || '').trim(),
    phone: body.phone !== undefined ? String(body.phone).trim() : base.phone,
    whatsapp_no: body.whatsapp_no !== undefined ? String(body.whatsapp_no).trim() : base.whatsapp_no,
    address: body.address !== undefined ? String(body.address).trim() : base.address,
    course_id: primaryCourseId,
    batch_id: Number(body.batch_id ?? base.batch_id),
    total_fee: Number(body.total_fee ?? base.total_fee ?? 0),
    discount_type: body.discount_type !== undefined ? body.discount_type || null : base.discount_type,
    discount_value:
      body.discount_value !== undefined
        ? (body.discount_value === null || body.discount_value === '' ? null : Number(body.discount_value))
        : base.discount_value,
    payment_type: paymentType,
    installment_count: paymentType === 'INSTALLMENT' ? installmentCount : 0,
    enrollment_date: enrollmentDate,
    status,
    dropout_date: dropoutDate,
    dropout_reason: dropoutReason,
    selected_course_ids: courseIds,
    installments: sanitizeInstallments(body.installments),
  };
}

export async function list(req, res) {
  const { search, batch_id, status } = req.query;
  const scope = staffScope(req);
  let sql = studentSelectSql();
  const params = [...scope.params];

  if (scope.clause) {
    sql += scope.clause;
  }
  if (batch_id) {
    sql += ' AND s.batch_id = ?';
    params.push(batch_id);
  }
  if (status === 'active' || status === 'dropout') {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  if (search) {
    const term = `%${String(search).trim()}%`;
    sql += ' AND (s.reg_no LIKE ? OR s.name LIKE ? OR s.phone LIKE ? OR b.batch_name LIKE ?)';
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY s.id DESC';

  res.json(await query(sql, params));
}

export async function batchBalances(req, res) {
  const { batch_id, search } = req.query;
  if (!batch_id) {
    return res.status(400).json({ error: 'batch_id required' });
  }

  const scope = staffScope(req);
  let sql = `
    SELECT s.id, s.name, s.reg_no, s.phone, s.whatsapp_no, s.address,
           s.total_fee, s.payment_type, s.status, s.dropout_date, s.dropout_reason,
           b.batch_name,
           COALESCE(SUM(p.amount_paid), 0) AS paid_amount,
           GREATEST(0, s.total_fee - COALESCE(SUM(p.amount_paid), 0)) AS balance
    FROM students s
    JOIN batches b ON b.id = s.batch_id
    LEFT JOIN payments p ON p.student_id = s.id
    WHERE s.batch_id = ?
  `;
  const params = [batch_id, ...scope.params];

  if (scope.clause) {
    sql += scope.clause;
  }
  if (search) {
    const term = `%${String(search).trim()}%`;
    sql += ' AND (s.name LIKE ? OR s.phone LIKE ? OR s.reg_no LIKE ?)';
    params.push(term, term, term);
  }

  sql += `
    GROUP BY s.id, s.name, s.reg_no, s.phone, s.whatsapp_no, s.address,
             s.total_fee, s.payment_type, s.status, s.dropout_date, s.dropout_reason, b.batch_name
    ORDER BY s.name ASC
  `;

  res.json(await query(sql, params));
}

export async function getOne(req, res) {
  const scope = staffScope(req);
  const rows = await query(
    `${studentSelectSql()} AND s.id = ?${scope.clause}`,
    [req.params.id, ...scope.params]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(rows[0]);
}

export async function create(req, res) {
  const validationError = validateCoreStudentFields(req.body || {}, { requireRequiredFields: true });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const student = normalizeStudentPayload(req.body || {});
  if (!student.selected_course_ids.length || !student.course_id) {
    return res.status(400).json({ error: 'At least one valid course is required' });
  }

  const combo = await courseCombinationCode(query, student.selected_course_ids);
  if (!combo) {
    return res.status(400).json({ error: 'Invalid course selection' });
  }

  const year = yearFromDate(student.enrollment_date);
  if (!year) {
    return res.status(400).json({ error: 'Invalid enrollment date' });
  }

  let installmentPlan = [];
  if (student.payment_type === 'INSTALLMENT') {
    try {
      installmentPlan = student.installments.length
        ? student.installments
        : buildInstallmentPlan(student.total_fee, student.installment_count || 3, student.enrollment_date);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const idPack = await nextRegistrationNo(connection, combo, year);

    const [insertResult] = await connection.execute(
      `INSERT INTO students
       (reg_no, course_combo_code, join_ym, serial_no, name, phone, whatsapp_no, address,
        course_id, batch_id, total_fee, discount_type, discount_value, payment_type,
        installment_count, status, dropout_date, dropout_reason, enrollment_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toSql(idPack?.regNo),
        toSql(combo),
        toSql(year),
        toSql(idPack?.serial),
        student.name,
        toSql(student.phone),
        toSql(student.whatsapp_no),
        toSql(student.address),
        student.course_id,
        student.batch_id,
        student.total_fee,
        toSql(student.discount_type),
        toSql(student.discount_value),
        student.payment_type,
        student.installment_count,
        student.status,
        toSql(student.dropout_date),
        toSql(student.dropout_reason),
        student.enrollment_date,
        req.user.id,
      ]
    );

    const studentId = insertResult.insertId;
    await syncStudentCourses(connection, studentId, student.selected_course_ids);
    if (student.payment_type === 'INSTALLMENT') {
      await replaceInstallments(connection, studentId, installmentPlan);
    }

    await connection.commit();

    await writeAudit(
      req.user.id,
      'STUDENT_CREATE',
      'student',
      String(studentId),
      { status: student.status, batch_id: student.batch_id, course_ids: student.selected_course_ids },
      clientIp(req)
    );

    return res.status(201).json({ id: studentId, reg_no: idPack?.regNo, status: student.status });
  } catch (error) {
    await connection.rollback();
    console.error('student create failed', error.message);
    return res.status(500).json({ error: 'Failed to create student' });
  } finally {
    connection.release();
  }
}

export async function update(req, res) {
  const existing = await getAccessibleStudent(req, req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const validationError = validateCoreStudentFields(req.body || {}, { requireRequiredFields: false });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const student = normalizeStudentPayload(req.body || {}, existing);
  if (!student.selected_course_ids.length || !student.course_id) {
    return res.status(400).json({ error: 'At least one valid course is required' });
  }

  const combo = await courseCombinationCode(query, student.selected_course_ids);
  if (!combo) {
    return res.status(400).json({ error: 'Invalid course selection' });
  }

  const year = yearFromDate(student.enrollment_date);
  if (!year) {
    return res.status(400).json({ error: 'Invalid enrollment date' });
  }

  let regNo = existing.reg_no;
  let serialNo = existing.serial_no;
  if (!existing.reg_no || existing.course_combo_code !== combo || existing.join_ym !== year) {
    const idPack = await nextRegistrationNo(query, combo, year, req.params.id);
    regNo = idPack?.regNo || existing.reg_no;
    serialNo = idPack?.serial || existing.serial_no;
  }

  let installmentPlan = [];
  if (student.payment_type === 'INSTALLMENT' && student.installments.length) {
    installmentPlan = student.installments;
  } else if (
    student.payment_type === 'INSTALLMENT' &&
    Number(student.installment_count) > 0 &&
    Number(student.installment_count) !== Number(existing.installment_count || 0)
  ) {
    try {
      installmentPlan = buildInstallmentPlan(student.total_fee, student.installment_count, student.enrollment_date);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE students SET
         reg_no = ?,
         course_combo_code = ?,
         join_ym = ?,
         serial_no = ?,
         name = ?,
         phone = ?,
         whatsapp_no = ?,
         address = ?,
         course_id = ?,
         batch_id = ?,
         total_fee = ?,
         discount_type = ?,
         discount_value = ?,
         payment_type = ?,
         installment_count = ?,
         status = ?,
         dropout_date = ?,
         dropout_reason = ?,
         enrollment_date = ?
       WHERE id = ?`,
      [
        toSql(regNo),
        toSql(combo),
        toSql(year),
        toSql(serialNo),
        student.name,
        toSql(student.phone),
        toSql(student.whatsapp_no),
        toSql(student.address),
        student.course_id,
        student.batch_id,
        student.total_fee,
        toSql(student.discount_type),
        toSql(student.discount_value),
        student.payment_type,
        student.installment_count,
        student.status,
        toSql(student.dropout_date),
        toSql(student.dropout_reason),
        student.enrollment_date,
        req.params.id,
      ]
    );

    await syncStudentCourses(connection, req.params.id, student.selected_course_ids);

    if (student.payment_type === 'FULL') {
      await connection.execute(
        `DELETE FROM installments
         WHERE student_id = ? AND paid_amount = 0`,
        [req.params.id]
      );
    } else if (installmentPlan.length) {
      const [payments] = await connection.execute(
        'SELECT COUNT(*) AS payment_count FROM payments WHERE student_id = ?',
        [req.params.id]
      );
      if (Number(payments[0]?.payment_count || 0) > 0) {
        await connection.rollback();
        return res.status(400).json({
          error: 'Installment schedule cannot be rebuilt after payments have been recorded',
        });
      }
      await replaceInstallments(connection, req.params.id, installmentPlan);
    }

    await connection.commit();

    await writeAudit(
      req.user.id,
      student.status === 'dropout' ? 'STUDENT_DROPOUT' : 'STUDENT_UPDATE',
      'student',
      String(req.params.id),
      {
        status: student.status,
        batch_id: student.batch_id,
        course_ids: student.selected_course_ids,
      },
      clientIp(req)
    );

    const refreshed = await query(
      `${studentSelectSql()} AND s.id = ?`,
      [req.params.id]
    );

    return res.json({
      ok: true,
      status: student.status,
      student: refreshed[0] || null,
    });
  } catch (error) {
    await connection.rollback();
    console.error('student update failed', error.message);
    return res.status(500).json({ error: 'Failed to update student' });
  } finally {
    connection.release();
  }
}

export async function remove(req, res) {
  await query('DELETE FROM students WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}
