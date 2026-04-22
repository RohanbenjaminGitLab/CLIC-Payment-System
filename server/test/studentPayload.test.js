import assert from 'node:assert/strict';

import {
  buildInstallmentPlan,
  normalizeCourseIds,
  normalizeDropoutFields,
  normalizeStudentStatus,
} from '../src/utils/studentPayload.js';
import { visibleStudentScope } from '../src/utils/staffVisibility.js';

function run() {
  assert.deepEqual(normalizeCourseIds(['2', 2, 5, 0, 'x'], 7), [2, 5]);
  assert.deepEqual(normalizeCourseIds([], '7'), [7]);

  const status = normalizeStudentStatus('dropout', 'active');
  assert.equal(status, 'dropout');
  assert.deepEqual(
    normalizeDropoutFields(status, '', 'Left campus', '2026-04-21'),
    {
      dropoutDate: '2026-04-21',
      dropoutReason: 'Left campus',
    }
  );
  assert.deepEqual(
    normalizeDropoutFields(normalizeStudentStatus('active', 'dropout'), '2026-04-21', 'ignored', '2026-04-21'),
    {
      dropoutDate: null,
      dropoutReason: null,
    }
  );

  const plan = buildInstallmentPlan(1000, 3, '2026-01-15');
  assert.equal(plan.length, 3);
  assert.deepEqual(
    plan.map((row) => row.due_date),
    ['2026-01-15', '2026-02-15', '2026-03-15']
  );
  assert.equal(
    Number(plan.reduce((sum, row) => sum + row.installment_amount, 0).toFixed(2)),
    1000
  );

  assert.deepEqual(
    visibleStudentScope({ user: { role: 'staff', id: 9 } }, 's'),
    {
      clause: ` AND (
      s.created_by = ?
      OR s.created_by IN (SELECT id FROM users WHERE role = 'admin')
      OR (
        s.created_by IS NULL
        AND EXISTS (
          SELECT 1
          FROM audit_logs a
          LEFT JOIN users audit_u ON audit_u.id = a.user_id
          WHERE a.entity_type = 'student'
            AND a.entity_id = CAST(s.id AS CHAR)
            AND a.action = 'STUDENT_CREATE'
            AND (a.user_id = ? OR audit_u.role = 'admin')
        )
      )
    )`,
      params: [9, 9],
    }
  );
  assert.deepEqual(visibleStudentScope({ user: { role: 'admin', id: 1 } }, 's'), { clause: '', params: [] });

  console.log('studentPayload tests passed');
}

run();
