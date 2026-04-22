import { query } from '../config/db.js';
import { writeAudit } from '../services/auditService.js';

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

async function generateBatchCode(startDate, timing, schedule, excludeId = null) {
  const d = new Date(startDate);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = String(d.getFullYear());

  const rows = await query(`SELECT batch_name FROM batches ${excludeId ? 'WHERE id != ?' : ''}`, excludeId ? [excludeId] : []);
  let maxN = 0;
  for (const row of rows) {
    const m = String(row.batch_name || '').match(/^B(\d+)-/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isInteger(n) && n > maxN) maxN = n;
    }
  }
  const timingStr = String(timing || 'MORNING').toUpperCase();
  const scheduleStr = String(schedule || 'WEEKDAY').toUpperCase();
  return `B${maxN + 1}-CL/${mm}${dd}/${yyyy}-${timingStr}-${scheduleStr}`;
}

export async function list(req, res) {
  const { status, search, timing, schedule } = req.query;
  let sql = 'SELECT * FROM batches WHERE 1=1';
  const params = [];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (timing) {
    sql += ' AND timing = ?';
    params.push(timing);
  }
  if (schedule) {
    sql += ' AND schedule = ?';
    params.push(schedule);
  }
  if (search) {
    const q = `%${search}%`;
    sql += ' AND batch_name LIKE ?';
    params.push(q);
  }
  sql += ' ORDER BY start_date DESC';
  const rows = await query(sql, params);
  res.json(rows);
}

export async function getOne(req, res) {
  const rows = await query('SELECT * FROM batches WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Batch not found' });
  res.json(rows[0]);
}

export async function create(req, res) {
  const { timing, schedule, start_date, end_date, status } = req.body;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date, end_date required' });
  }
  const batch_name = await generateBatchCode(start_date, timing, schedule);
  if (!batch_name) return res.status(400).json({ error: 'Invalid batch creation data' });
  const dupe = await query(
    'SELECT id FROM batches WHERE batch_name = ? LIMIT 1',
    [String(batch_name).trim()]
  );
  if (dupe.length) return res.status(409).json({ error: 'Batch already exists' });
  const r = await query(
    `INSERT INTO batches (batch_name, timing, schedule, start_date, end_date, fee, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [batch_name, timing || 'MORNING', schedule || 'WEEKDAY', start_date, end_date, 0, status || 'upcoming']
  );
  await writeAudit(req.user.id, 'BATCH_CREATE', 'batch', String(r.insertId), { batch_name, timing, schedule }, ip(req));
  res.status(201).json({ id: r.insertId });
}

export async function update(req, res) {
  const cur = (await query('SELECT * FROM batches WHERE id = ?', [req.params.id]))[0];
  if (!cur) return res.status(404).json({ error: 'Batch not found' });
  const { timing, schedule, start_date, end_date, status } = req.body;
  const nextTiming = timing ?? cur.timing;
  const nextSchedule = schedule ?? cur.schedule;
  const nextStartDate = start_date ?? cur.start_date;
  const batch_name = await generateBatchCode(nextStartDate, nextTiming, nextSchedule, Number(req.params.id));
  if (!batch_name) return res.status(400).json({ error: 'Invalid batch update data' });
  await query(
    `UPDATE batches SET batch_name=?, timing=?, schedule=?, start_date=?, end_date=?, fee=?, status=? WHERE id=?`,
    [
      batch_name,
      nextTiming,
      nextSchedule,
      nextStartDate,
      end_date ?? cur.end_date,
      0,
      status ?? cur.status,
      req.params.id,
    ]
  );
  await writeAudit(req.user.id, 'BATCH_UPDATE', 'batch', String(req.params.id), req.body, ip(req));
  res.json({ ok: true });
}

export async function remove(req, res) {
  try {
    await query('DELETE FROM batches WHERE id = ?', [req.params.id]);
    await writeAudit(req.user.id, 'BATCH_DELETE', 'batch', String(req.params.id), null, ip(req));
    res.json({ ok: true });
  } catch (err) {
    if (err?.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        error: 'Cannot delete this batch because students are linked to it.',
      });
    }
    return res.status(500).json({ error: 'Failed to delete batch' });
  }
}
