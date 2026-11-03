-- Leave requests for attendance exemption
-- Run against Supabase production DB

BEGIN;

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  leave_date DATE NOT NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_student ON leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date ON leave_requests(leave_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_session ON leave_requests(session_id);

COMMENT ON TABLE leave_requests IS 'Student leave requests; approved leaves exempt from absent penalty';

-- Extend attendance_status enum for leave tracking
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'leave';

COMMIT;
