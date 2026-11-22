-- QR scans are stored separately from Wi-Fi records and do not change points.
CREATE TABLE IF NOT EXISTS qr_attendance_scans (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('start', 'end')),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, student_id, phase)
);
