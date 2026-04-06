-- ============================================================
-- Feedback System Migration — STEP 2: Run this AFTER Step 1
-- Seeds all 18 feedback questions
-- ============================================================

-- Clear old questions and seed the full feedback form (18 questions)
DELETE FROM feedback_responses;
DELETE FROM feedback_questions;

INSERT INTO feedback_questions (question, category, type, active) VALUES
-- I. Structure of the Session
('The objectives of the session were clearly explained.', 'Structure', 'yes_no', true),
('The session flow was easy to follow.', 'Structure', 'yes_no', true),
('Time and pace of the session were well managed.', 'Structure', 'yes_no', true),
('Overall rating for the structure of the session:', 'Structure', 'rating', true),

-- II. Content
('The content of the session was useful and relevant.', 'Content', 'yes_no', true),
('The concepts were explained clearly.', 'Content', 'yes_no', true),
('There was a good balance between theory and practical examples.', 'Content', 'yes_no', true),
('Overall rating for the content:', 'Content', 'rating', true),

-- III. Faculty / Instructor
('The instructor was punctual and approachable.', 'Faculty', 'yes_no', true),
('The instructor addressed doubts effectively.', 'Faculty', 'yes_no', true),
('The instructor encouraged active participation.', 'Faculty', 'yes_no', true),
('Overall rating for the instructor:', 'Faculty', 'rating', true),

-- IV. Logistics and Support
('The venue and facilities were adequate.', 'Logistics', 'yes_no', true),
('The audio/visual arrangements were seamless.', 'Logistics', 'yes_no', true),
('The support staff was helpful.', 'Logistics', 'yes_no', true),
('Overall rating for logistics and support:', 'Logistics', 'rating', true),

-- V. Engagement Level
('How engaging was the session?', 'Engagement', 'mcq', true),

-- VI. Additional Comments
('Any additional comments or suggestions?', 'General', 'text', true);
