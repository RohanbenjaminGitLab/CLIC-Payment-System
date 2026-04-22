-- Sample data for CLIC Campus System
-- Passwords (bcrypt 12 rounds): Admin@123, Manager@123, Staff@123

SET NAMES utf8mb4;

INSERT INTO users (name, email, password, role) VALUES
('System Admin', 'admin@clic.edu', '$2b$12$XuHX8dgRjfwY2xk91PHNKuNVz52HgTOp6DA8ytTO9cWE6mRfE8i4q', 'admin'),
('Campus Manager', 'manager@clic.edu', '$2b$12$eOo7LoaUXSXNdLCR4A0jw.VJ69iNwg4L/qsGCjPJd.ZGaBZRIsgK2', 'manager'),
('Front Desk Staff', 'staff@clic.edu', '$2b$12$QugH4zWlD7Uq6ax/yLuQP.BOnqKk0jVVwL3Gy2n8VpwaFLHXlMSDK', 'staff');

INSERT INTO courses (course_name, description, duration, fee, category) VALUES
('Full Stack Web Development', 'React, Node, MySQL end-to-end', '6 months', 45000.00, 'Technology'),
('Data Science Fundamentals', 'Python, statistics, ML intro', '4 months', 38000.00, 'Analytics'),
('Digital Marketing Pro', 'SEO, ads, analytics', '3 months', 22000.00, 'Marketing');

INSERT INTO batches (batch_name, timing, schedule, start_date, end_date, fee, status) VALUES
('B1-CL/0115/2026-MORNING-WEEKDAY', 'MORNING', 'WEEKDAY', '2026-01-15', '2026-07-15', 45000.00, 'active'),
('B2-CL/0301/2026-EVENING-WEEKDAY', 'EVENING', 'WEEKDAY', '2026-03-01', '2026-07-01', 38000.00, 'upcoming'),
('B3-CL/0601/2025-MORNING-WEEKEND', 'MORNING', 'WEEKEND', '2025-06-01', '2025-12-01', 22000.00, 'completed');

INSERT INTO students (name, phone, course_id, batch_id, total_fee, payment_type, installment_count, enrollment_date, created_by) VALUES
('Rohan Kumar', '+919876543210', 1, 1, 45000.00, 'INSTALLMENT', 3, '2026-01-20', 3),
('Priya Sharma', '+919812345678', 1, 1, 45000.00, 'FULL', 0, '2026-02-01', 2),
('Amit Verma', '+919900112233', 2, 2, 38000.00, 'INSTALLMENT', 3, '2026-03-05', 3);

INSERT INTO student_courses (student_id, course_id) VALUES
(1, 1),
(2, 1),
(3, 2);

INSERT INTO installments (student_id, installment_amount, due_date, paid_amount, status) VALUES
(1, 15000.00, '2026-02-01', 15000.00, 'paid'),
(1, 15000.00, '2026-03-01', 5000.00, 'partial'),
(1, 15000.00, '2026-04-10', 0, 'pending'),
(3, 12666.67, '2026-03-15', 0, 'overdue'),
(3, 12666.67, '2026-04-15', 0, 'pending'),
(3, 12666.66, '2026-05-15', 0, 'pending');

INSERT INTO payments (student_id, amount_paid, payment_date, staff_id, receipt_no, notes) VALUES
(1, 15000.00, '2026-02-01', 3, 'RCP-2026-00001', 'First installment'),
(1, 5000.00, '2026-03-05', 3, 'RCP-2026-00002', 'Partial second'),
(2, 45000.00, '2026-02-01', 2, 'RCP-2026-00003', 'Full payment');
