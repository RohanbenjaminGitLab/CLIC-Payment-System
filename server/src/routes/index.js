import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { adminOnly, adminOrManager, anyRole, requireRoles } from '../middleware/roles.js';
import { authLimiter, apiLimiter } from '../middleware/security.js';
import { requireAdminDelete } from '../middleware/deletePolicy.js';
import * as auth from '../controllers/authController.js';
import * as courses from '../controllers/courseController.js';
import * as batches from '../controllers/batchController.js';
import * as students from '../controllers/studentController.js';
import * as payments from '../controllers/paymentController.js';
import * as installments from '../controllers/installmentController.js';
import * as dashboard from '../controllers/dashboardController.js';
import * as reports from '../controllers/reportController.js';
import * as settings from '../controllers/settingsController.js';

const router = Router();

const validate = (req, res, next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return res.status(400).json({ errors: e.array() });
  next();
};

router.post(
  '/auth/login',
  authLimiter,
  body('email').isEmail(),
  body('password').isString().isLength({ min: 1 }),
  validate,
  auth.login
);
router.post('/auth/refresh', authLimiter, auth.refresh);
router.post('/auth/logout', authenticate, auth.logout);
router.get('/auth/me', authenticate, auth.me);

router.post(
  '/auth/register',
  authenticate,
  requireRoles('admin', 'manager'),
  body('email').isEmail(),
  body('name').isString().trim().isLength({ min: 2 }),
  body('password').isString().isLength({ min: 8 }),
  body('role').isIn(['admin', 'manager', 'staff']),
  validate,
  auth.registerUser
);

router.get('/users', authenticate, adminOrManager, auth.listUsers);
router.get('/users/:id/stats', authenticate, auth.userStats);
router.patch('/users/:id', authenticate, adminOrManager, auth.updateUser);
router.delete('/users/:id', authenticate, requireAdminDelete, auth.deleteUser);
router.post('/auth/change-request', authenticate, anyRole, auth.requestCredentialChange);
router.get('/auth/change-requests', authenticate, adminOnly, auth.listCredentialRequests);
router.post('/auth/change-requests/:id/approve', authenticate, adminOnly, auth.approveCredentialRequest);
router.post('/auth/change-requests/:id/reject', authenticate, adminOnly, auth.rejectCredentialRequest);

router.get('/dashboard/stats', authenticate, anyRole, dashboard.stats);

router.get('/courses', authenticate, anyRole, courses.list);
router.get('/courses/:id', authenticate, anyRole, courses.getOne);
router.post('/courses', authenticate, adminOrManager, courses.create);
router.put('/courses/:id', authenticate, adminOrManager, courses.update);
router.delete('/courses/:id', authenticate, adminOrManager, courses.remove);

router.get('/batches', authenticate, anyRole, batches.list);
router.get('/batches/:id', authenticate, anyRole, batches.getOne);
router.post('/batches', authenticate, adminOrManager, batches.create);
router.put('/batches/:id', authenticate, adminOrManager, batches.update);
router.delete('/batches/:id', authenticate, adminOrManager, batches.remove);

router.get('/students', authenticate, anyRole, students.list);
router.get('/students/batch-balances', authenticate, anyRole, students.batchBalances);
router.get('/students/:id', authenticate, anyRole, students.getOne);
router.post('/students', authenticate, anyRole, students.create);
router.put('/students/:id', authenticate, anyRole, students.update);
router.delete('/students/:id', authenticate, requireAdminDelete, students.remove);

router.get('/payments', authenticate, anyRole, payments.list);
router.post('/payments', authenticate, anyRole, payments.collect);
router.get('/payments/student/:studentId', authenticate, anyRole, payments.historyForStudent);
router.get('/payments/:id/receipt', authenticate, anyRole, payments.receipt);

router.get('/installments/student/:studentId', authenticate, anyRole, installments.listByStudent);
router.get('/installments/alerts', authenticate, anyRole, installments.listAlerts);
router.get('/installments/whatsapp-reminders', authenticate, anyRole, installments.whatsappReminders);

router.get('/reports/course-revenue', authenticate, adminOrManager, reports.courseRevenue);
router.get('/reports/batch-payment-summary', authenticate, anyRole, reports.batchPaymentSummary);
router.get('/reports/batches', authenticate, adminOrManager, reports.batchReport);
router.get('/reports/student-payments', authenticate, adminOrManager, reports.studentPaymentHistory);
router.get('/reports/staff-performance', authenticate, adminOnly, reports.staffPerformance);
router.get('/reports/installment-due', authenticate, anyRole, reports.installmentDueReport);
router.get('/reports/audit', authenticate, adminOnly, reports.auditReport);
router.get('/reports/enrollments', authenticate, adminOnly, reports.enrollmentTracking);
router.get('/reports/staff-commissions', authenticate, adminOnly, reports.staffCommissions);

router.get('/reports/login-history', authenticate, adminOnly, async (req, res) => {
  const { query } = await import('../config/db.js');
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const rows = await query(
    `SELECT lh.*, u.name AS user_name FROM login_history lh
     LEFT JOIN users u ON u.id = lh.user_id
     ORDER BY lh.id DESC LIMIT ?`,
    [limit]
  );
  res.json(rows);
});

router.get('/settings', authenticate, anyRole, settings.getSettings);
router.patch('/settings/commission-per-student', authenticate, adminOnly, settings.updateCommissionPerStudent);

export default router;
