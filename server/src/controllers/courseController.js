import { query } from '../config/db.js';
import { writeAudit } from '../services/auditService.js';

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function courseLettersFromName(courseName) {
  const known = { english: 'E', it: 'I', sinhala: 'S', science: 'S' };
  const parts = String(courseName || '')
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  const tokens = parts.length ? parts : [String(courseName || '').trim().toLowerCase()];
  const letters = tokens
    .map((t) => known[t] || String(t).toUpperCase().replace(/[^A-Z0-9]/g, '')[0] || '')
    .filter(Boolean)
    .sort();
  return [...new Set(letters)].join('');
}

function buildCourseCode(courseName, yearInput) {
  const year = Number(yearInput || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2999) return null;
  const letters = courseLettersFromName(courseName);
  if (!letters) return null;
  return `CL/${letters}/${year}`;
}

export async function list(req, res) {
  const { search, category } = req.query;
  let sql = 'SELECT * FROM courses WHERE 1=1';
  const params = [];
  if (search) {
    sql += ' AND (course_name LIKE ? OR description LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY id DESC';
  const rows = await query(sql, params);
  res.json(rows);
}

export async function getOne(req, res) {
  const rows = await query('SELECT * FROM courses WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Course not found' });
  res.json(rows[0]);
}

export async function create(req, res) {
  const { course_name, course_code, year, description, duration, fee, category } = req.body;
  if (!course_name) return res.status(400).json({ error: 'course_name required' });
  const normalizedCode = course_code ? String(course_code).trim().toUpperCase() : buildCourseCode(course_name, year);
  if (!normalizedCode) return res.status(400).json({ error: 'Invalid course code' });
  const dup = await query(`SELECT id FROM courses WHERE course_code = ? LIMIT 1`, [normalizedCode]);
  if (dup.length) return res.status(409).json({ error: 'Course code already exists' });
  const r = await query(
    `INSERT INTO courses (course_name, course_code, description, duration, fee, category) VALUES (?, ?, ?, ?, ?, ?)`,
    [course_name, normalizedCode, description || null, duration || null, fee ?? 0, category || null]
  );
  await writeAudit(req.user.id, 'COURSE_CREATE', 'course', String(r.insertId), { course_name }, ip(req));
  res.status(201).json({ id: r.insertId });
}

export async function update(req, res) {
  const cur = (await query('SELECT * FROM courses WHERE id = ?', [req.params.id]))[0];
  if (!cur) return res.status(404).json({ error: 'Course not found' });
  const { course_name, course_code, year, description, duration, fee, category } = req.body;
  const nextName = course_name ?? cur.course_name;
  const normalizedCode =
    course_code == null ? buildCourseCode(nextName, year) || cur.course_code : String(course_code).trim().toUpperCase();
  if (!normalizedCode) return res.status(400).json({ error: 'Invalid course code' });
  const dup = await query(`SELECT id FROM courses WHERE course_code = ? AND id != ? LIMIT 1`, [normalizedCode, req.params.id]);
  if (dup.length) return res.status(409).json({ error: 'Course code already exists' });
  await query(
    `UPDATE courses SET course_name=?, course_code=?, description=?, duration=?, fee=?, category=? WHERE id=?`,
    [
      course_name ?? cur.course_name,
      normalizedCode,
      description ?? cur.description,
      duration ?? cur.duration,
      fee ?? cur.fee,
      category ?? cur.category,
      req.params.id,
    ]
  );
  await writeAudit(req.user.id, 'COURSE_UPDATE', 'course', String(req.params.id), req.body, ip(req));
  res.json({ ok: true });
}

export async function remove(req, res) {
  try {
    await query('DELETE FROM courses WHERE id = ?', [req.params.id]);
    await writeAudit(req.user.id, 'COURSE_DELETE', 'course', String(req.params.id), null, ip(req));
    res.json({ ok: true });
  } catch (err) {
    if (err?.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'Cannot delete this course because batches or students are linked to it.',
      });
    }
    return res.status(500).json({ error: 'Failed to delete course' });
  }
}
