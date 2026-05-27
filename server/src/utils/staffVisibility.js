export function visibleStudentScope(req, alias = 's') {
  if (req.user?.role !== 'staff') {
    return { clause: '', params: [] };
  }

  return {
    clause: ` AND (
      ${alias}.created_by = ?
      OR ${alias}.created_by IN (SELECT id FROM users WHERE role = 'admin')
      OR (
        ${alias}.created_by IS NULL
        AND EXISTS (
          SELECT 1
          FROM audit_logs a
          LEFT JOIN users audit_u ON audit_u.id = a.user_id
          WHERE a.entity_type = 'student'
            AND a.entity_id = CAST(${alias}.id AS CHAR)
            AND a.action = 'STUDENT_CREATE'
            AND (a.user_id = ? OR audit_u.role = 'admin')
        )
      )
    )`,
    params: [req.user.id, req.user.id],
  };
}

export function visibleStudentWhere(req, alias = 's') {
  if (req.user?.role !== 'staff') {
    return { clause: '', params: [] };
  }

  return {
    clause: ` (
      ${alias}.created_by = ?
      OR ${alias}.created_by IN (SELECT id FROM users WHERE role = 'admin')
      OR (
        ${alias}.created_by IS NULL
        AND EXISTS (
          SELECT 1
          FROM audit_logs a
          LEFT JOIN users audit_u ON audit_u.id = a.user_id
          WHERE a.entity_type = 'student'
            AND a.entity_id = CAST(${alias}.id AS CHAR)
            AND a.action = 'STUDENT_CREATE'
            AND (a.user_id = ? OR audit_u.role = 'admin')
        )
      )
    ) `,
    params: [req.user.id, req.user.id],
  };
}
