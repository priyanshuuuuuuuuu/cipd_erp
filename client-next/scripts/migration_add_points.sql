-- Add points column to attendance_records
-- Points: 0.0 to 1.0, representing attendance quality score
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS points NUMERIC(3,2) DEFAULT 0.0;

-- Add comment
COMMENT ON COLUMN attendance_records.points IS 'Attendance quality score: 0.0-1.0. Deductions: -0.5 if late (not in first 2 snapshots), -0.2 if <75% presence, -0.3 if <50% presence, 0 if <30% presence (absent)';
