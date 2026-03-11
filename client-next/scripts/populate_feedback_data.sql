-- ============================================================
-- POPULATE REALISTIC STUDENTS, ENROLLMENTS, AND FEEDBACK DATA
-- Run in Supabase SQL Editor
-- ============================================================

-- =========================================
-- STEP 1: Insert new student users (8 more)
-- =========================================
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, is_active) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'rahul.sharma@cipd.edu',  '$2b$10$DUMMY_HASH_FOR_SEED_DATA_001', 'student', 'Rahul',   'Sharma',   '9876543210', true),
  ('a2222222-2222-2222-2222-222222222222', 'priya.gupta@cipd.edu',   '$2b$10$DUMMY_HASH_FOR_SEED_DATA_002', 'student', 'Priya',   'Gupta',    '9876543211', true),
  ('a3333333-3333-3333-3333-333333333333', 'arjun.kumar@cipd.edu',   '$2b$10$DUMMY_HASH_FOR_SEED_DATA_003', 'student', 'Arjun',   'Kumar',    '9876543212', true),
  ('a4444444-4444-4444-4444-444444444444', 'sneha.patel@cipd.edu',   '$2b$10$DUMMY_HASH_FOR_SEED_DATA_004', 'student', 'Sneha',   'Patel',    '9876543213', true),
  ('a5555555-5555-5555-5555-555555555555', 'vikram.singh@cipd.edu',  '$2b$10$DUMMY_HASH_FOR_SEED_DATA_005', 'student', 'Vikram',  'Singh',    '9876543214', true),
  ('a6666666-6666-6666-6666-666666666666', 'ananya.reddy@cipd.edu',  '$2b$10$DUMMY_HASH_FOR_SEED_DATA_006', 'student', 'Ananya',  'Reddy',    '9876543215', true),
  ('a7777777-7777-7777-7777-777777777777', 'rohan.mehta@cipd.edu',   '$2b$10$DUMMY_HASH_FOR_SEED_DATA_007', 'student', 'Rohan',   'Mehta',    '9876543216', true),
  ('a8888888-8888-8888-8888-888888888888', 'kavya.nair@cipd.edu',    '$2b$10$DUMMY_HASH_FOR_SEED_DATA_008', 'student', 'Kavya',   'Nair',     '9876543217', true)
ON CONFLICT (email) DO NOTHING;

-- =========================================
-- STEP 2: Insert student records
-- =========================================
INSERT INTO students (id, enrollment_no, department, batch, semester) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'EN21CS1001', 'Computer Science', '2021-2025', 6),
  ('a2222222-2222-2222-2222-222222222222', 'EN21CS1002', 'Computer Science', '2021-2025', 6),
  ('a3333333-3333-3333-3333-333333333333', 'EN21CS1003', 'Computer Science', '2021-2025', 6),
  ('a4444444-4444-4444-4444-444444444444', 'EN21CS1004', 'Computer Science', '2021-2025', 6),
  ('a5555555-5555-5555-5555-555555555555', 'EN21EC1001', 'Electronics',      '2021-2025', 6),
  ('a6666666-6666-6666-6666-666666666666', 'EN21EC1002', 'Electronics',      '2021-2025', 6),
  ('a7777777-7777-7777-7777-777777777777', 'EN21ME1001', 'Mechanical',       '2021-2025', 6),
  ('a8888888-8888-8888-8888-888888888888', 'EN21ME1002', 'Mechanical',       '2021-2025', 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3: Enroll students in courses
-- DSA: 10 (Parsh + Aaman + 8 new)
-- QP:  8  (Parsh + Aaman + 1,2,3,5,6)
-- Calc: 9 (Parsh + Aaman + 1,2,4,5,7,8)
-- TW:  6  (Parsh + 3,4,6,7,8)
-- DBMS: 7 (Parsh + 2,4,5,6,7,8)
-- ============================================================
INSERT INTO course_enrollments (course_id, student_id) VALUES
  -- DSA
  ('36fdb651-1c21-477e-a284-8e808cb5d379', 'a1111111-1111-1111-1111-111111111111'),
  ('36fdb651-1c21-477e-a284-8e808cb5d379', 'a2222222-2222-2222-2222-222222222222'),
  ('36fdb651-1c21-477e-a284-8e808cb5d379', 'a3333333-3333-3333-3333-333333333333'),
  ('36fdb651-1c21-477e-a284-8e808cb5d379', 'a4444444-4444-4444-4444-444444444444'),
  ('36fdb651-1c21-477e-a284-8e808cb5d379', 'a5555555-5555-5555-5555-555555555555'),
  ('36fdb651-1c21-477e-a284-8e808cb5d379', 'a6666666-6666-6666-6666-666666666666'),
  ('36fdb651-1c21-477e-a284-8e808cb5d379', 'a7777777-7777-7777-7777-777777777777'),
  ('36fdb651-1c21-477e-a284-8e808cb5d379', 'a8888888-8888-8888-8888-888888888888'),
  ('36fdb651-1c21-477e-a284-8e808cb5d379', 'dc3401da-5eb2-40e1-b069-2c79cffc4282'),
  -- QP
  ('41c85710-4450-4fbe-8ad0-7033dc7b8906', 'a1111111-1111-1111-1111-111111111111'),
  ('41c85710-4450-4fbe-8ad0-7033dc7b8906', 'a2222222-2222-2222-2222-222222222222'),
  ('41c85710-4450-4fbe-8ad0-7033dc7b8906', 'a3333333-3333-3333-3333-333333333333'),
  ('41c85710-4450-4fbe-8ad0-7033dc7b8906', 'a5555555-5555-5555-5555-555555555555'),
  ('41c85710-4450-4fbe-8ad0-7033dc7b8906', 'a6666666-6666-6666-6666-666666666666'),
  ('41c85710-4450-4fbe-8ad0-7033dc7b8906', 'dc3401da-5eb2-40e1-b069-2c79cffc4282'),
  -- Calc
  ('553da817-72b2-4945-99f5-593cd4af34fc', 'a1111111-1111-1111-1111-111111111111'),
  ('553da817-72b2-4945-99f5-593cd4af34fc', 'a2222222-2222-2222-2222-222222222222'),
  ('553da817-72b2-4945-99f5-593cd4af34fc', 'a4444444-4444-4444-4444-444444444444'),
  ('553da817-72b2-4945-99f5-593cd4af34fc', 'a5555555-5555-5555-5555-555555555555'),
  ('553da817-72b2-4945-99f5-593cd4af34fc', 'a7777777-7777-7777-7777-777777777777'),
  ('553da817-72b2-4945-99f5-593cd4af34fc', 'a8888888-8888-8888-8888-888888888888'),
  ('553da817-72b2-4945-99f5-593cd4af34fc', 'dc3401da-5eb2-40e1-b069-2c79cffc4282'),
  -- TW
  ('0cbf1e32-4a43-48e3-942a-f61f3b8efae2', 'a3333333-3333-3333-3333-333333333333'),
  ('0cbf1e32-4a43-48e3-942a-f61f3b8efae2', 'a4444444-4444-4444-4444-444444444444'),
  ('0cbf1e32-4a43-48e3-942a-f61f3b8efae2', 'a6666666-6666-6666-6666-666666666666'),
  ('0cbf1e32-4a43-48e3-942a-f61f3b8efae2', 'a7777777-7777-7777-7777-777777777777'),
  ('0cbf1e32-4a43-48e3-942a-f61f3b8efae2', 'a8888888-8888-8888-8888-888888888888'),
  -- DBMS
  ('122d0e2f-3660-4ac6-9094-e3344e6d051f', 'a2222222-2222-2222-2222-222222222222'),
  ('122d0e2f-3660-4ac6-9094-e3344e6d051f', 'a4444444-4444-4444-4444-444444444444'),
  ('122d0e2f-3660-4ac6-9094-e3344e6d051f', 'a5555555-5555-5555-5555-555555555555'),
  ('122d0e2f-3660-4ac6-9094-e3344e6d051f', 'a6666666-6666-6666-6666-666666666666'),
  ('122d0e2f-3660-4ac6-9094-e3344e6d051f', 'a7777777-7777-7777-7777-777777777777'),
  ('122d0e2f-3660-4ac6-9094-e3344e6d051f', 'a8888888-8888-8888-8888-888888888888')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 4: Realistic feedback (using correct columns: rating, yes_no, text_answer)
-- question_id f83aad09 = "rating" type
-- question_id 3e047ad8 = "yes_no" type
-- question_id 0f9c2a3f = "text" type
-- ============================================================

-- DSA feedback for session cb9f1f68 (Mar 4) — 5 students submit
INSERT INTO feedback_responses (session_id, student_id, question_id, rating, yes_no, text_answer) VALUES
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a1111111-1111-1111-1111-111111111111', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a1111111-1111-1111-1111-111111111111', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a1111111-1111-1111-1111-111111111111', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'Great lecture on trees!'),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a2222222-2222-2222-2222-222222222222', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a2222222-2222-2222-2222-222222222222', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a3333333-3333-3333-3333-333333333333', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a3333333-3333-3333-3333-333333333333', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'Needed more examples on graph traversal'),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a4444444-4444-4444-4444-444444444444', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a4444444-4444-4444-4444-444444444444', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a5555555-5555-5555-5555-555555555555', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 3, null, null),
  ('cb9f1f68-db43-4f2b-9745-563c4181effc', 'a5555555-5555-5555-5555-555555555555', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'Too fast pacing, slow down on recursion'),

  -- DSA feedback for session 36fb9f21 (Mar 6) — 4 students
  ('36fb9f21-171a-4220-9f82-fc3e4b4d3774', 'a1111111-1111-1111-1111-111111111111', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('36fb9f21-171a-4220-9f82-fc3e4b4d3774', 'a1111111-1111-1111-1111-111111111111', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),
  ('36fb9f21-171a-4220-9f82-fc3e4b4d3774', 'a2222222-2222-2222-2222-222222222222', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('36fb9f21-171a-4220-9f82-fc3e4b4d3774', 'a2222222-2222-2222-2222-222222222222', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'Excellent explanation of sorting algorithms'),
  ('36fb9f21-171a-4220-9f82-fc3e4b4d3774', 'a4444444-4444-4444-4444-444444444444', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 3, null, null),
  ('36fb9f21-171a-4220-9f82-fc3e4b4d3774', 'a6666666-6666-6666-6666-666666666666', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('36fb9f21-171a-4220-9f82-fc3e4b4d3774', 'a6666666-6666-6666-6666-666666666666', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),

  -- DSA feedback for session e3e23b99 (Mar 2) — 3 students
  ('e3e23b99-31f2-4f11-9dee-f125e149d5c0', 'a1111111-1111-1111-1111-111111111111', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 3, null, null),
  ('e3e23b99-31f2-4f11-9dee-f125e149d5c0', 'a1111111-1111-1111-1111-111111111111', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, false, null),
  ('e3e23b99-31f2-4f11-9dee-f125e149d5c0', 'a4444444-4444-4444-4444-444444444444', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('e3e23b99-31f2-4f11-9dee-f125e149d5c0', 'a4444444-4444-4444-4444-444444444444', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),
  ('e3e23b99-31f2-4f11-9dee-f125e149d5c0', 'a7777777-7777-7777-7777-777777777777', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),

  -- QP feedback for session 86d91668 (Mar 3) — 4 students
  ('86d91668-9e3c-4c96-9009-110cadb3d0e7', 'a1111111-1111-1111-1111-111111111111', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('86d91668-9e3c-4c96-9009-110cadb3d0e7', 'a1111111-1111-1111-1111-111111111111', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'Fascinating quantum entanglement demo'),
  ('86d91668-9e3c-4c96-9009-110cadb3d0e7', 'a2222222-2222-2222-2222-222222222222', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('86d91668-9e3c-4c96-9009-110cadb3d0e7', 'a3333333-3333-3333-3333-333333333333', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 3, null, null),
  ('86d91668-9e3c-4c96-9009-110cadb3d0e7', 'a5555555-5555-5555-5555-555555555555', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('86d91668-9e3c-4c96-9009-110cadb3d0e7', 'a5555555-5555-5555-5555-555555555555', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),

  -- QP feedback for session 26ffbc8f (Mar 5) — 3 students
  ('26ffbc8f-ab1b-4746-90b2-f9db2d50fcda', 'a1111111-1111-1111-1111-111111111111', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('26ffbc8f-ab1b-4746-90b2-f9db2d50fcda', 'a3333333-3333-3333-3333-333333333333', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 3, null, null),
  ('26ffbc8f-ab1b-4746-90b2-f9db2d50fcda', 'a3333333-3333-3333-3333-333333333333', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'Double-slit experiment was mind-blowing'),
  ('26ffbc8f-ab1b-4746-90b2-f9db2d50fcda', 'a6666666-6666-6666-6666-666666666666', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),

  -- Calc feedback for session acb73ab6 (Mar 4) — 4 students
  ('acb73ab6-159c-41e8-aee6-c38505ed93ef', 'a1111111-1111-1111-1111-111111111111', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('acb73ab6-159c-41e8-aee6-c38505ed93ef', 'a2222222-2222-2222-2222-222222222222', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 3, null, null),
  ('acb73ab6-159c-41e8-aee6-c38505ed93ef', 'a2222222-2222-2222-2222-222222222222', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'Integrals section was tough, need more practice problems'),
  ('acb73ab6-159c-41e8-aee6-c38505ed93ef', 'a5555555-5555-5555-5555-555555555555', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('acb73ab6-159c-41e8-aee6-c38505ed93ef', 'a8888888-8888-8888-8888-888888888888', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('acb73ab6-159c-41e8-aee6-c38505ed93ef', 'a8888888-8888-8888-8888-888888888888', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),

  -- DBMS feedback for session 3b13390f (Mar 4) — 4 students
  ('3b13390f-6ecd-4ae9-80fb-64c8f5aa62bf', 'a2222222-2222-2222-2222-222222222222', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('3b13390f-6ecd-4ae9-80fb-64c8f5aa62bf', 'a2222222-2222-2222-2222-222222222222', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),
  ('3b13390f-6ecd-4ae9-80fb-64c8f5aa62bf', 'a4444444-4444-4444-4444-444444444444', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 3, null, null),
  ('3b13390f-6ecd-4ae9-80fb-64c8f5aa62bf', 'a4444444-4444-4444-4444-444444444444', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'SQL joins were confusing, need more visual examples'),
  ('3b13390f-6ecd-4ae9-80fb-64c8f5aa62bf', 'a5555555-5555-5555-5555-555555555555', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('3b13390f-6ecd-4ae9-80fb-64c8f5aa62bf', 'a7777777-7777-7777-7777-777777777777', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),

  -- DBMS feedback for session 7831d159 (Mar 6) — 3 students
  ('7831d159-9938-48d1-a25e-76248963d6a1', 'a2222222-2222-2222-2222-222222222222', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('7831d159-9938-48d1-a25e-76248963d6a1', 'a5555555-5555-5555-5555-555555555555', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('7831d159-9938-48d1-a25e-76248963d6a1', 'a5555555-5555-5555-5555-555555555555', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),
  ('7831d159-9938-48d1-a25e-76248963d6a1', 'a7777777-7777-7777-7777-777777777777', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('7831d159-9938-48d1-a25e-76248963d6a1', 'a7777777-7777-7777-7777-777777777777', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'ER diagrams section was very clear and practical'),

  -- TW feedback for session d641b73d (Mar 3) — 3 students
  ('d641b73d-18be-439c-9a3e-fa33bcf79d6b', 'a3333333-3333-3333-3333-333333333333', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 4, null, null),
  ('d641b73d-18be-439c-9a3e-fa33bcf79d6b', 'a3333333-3333-3333-3333-333333333333', '3e047ad8-7a4d-4834-9eaa-d108e29b8b6d', null, true, null),
  ('d641b73d-18be-439c-9a3e-fa33bcf79d6b', 'a4444444-4444-4444-4444-444444444444', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 3, null, null),
  ('d641b73d-18be-439c-9a3e-fa33bcf79d6b', 'a6666666-6666-6666-6666-666666666666', 'f83aad09-e50d-4cab-9b2a-a7c4fdb46735', 5, null, null),
  ('d641b73d-18be-439c-9a3e-fa33bcf79d6b', 'a6666666-6666-6666-6666-666666666666', '0f9c2a3f-1a14-452c-b250-7c20fca30fb7', null, null, 'Writing style feedback was very actionable and helpful')
ON CONFLICT DO NOTHING;
