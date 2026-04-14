-- ============================================================
-- CiPD Categories Seed Script
-- Paste this entire script into the Supabase SQL Editor and run it.
-- It uses course NAMES to look up course_id automatically —
-- no UUIDs required from you.
--
-- If a category already exists for that course, it is SKIPPED safely.
-- ============================================================

INSERT INTO categories (id, course_id, name)
SELECT
    gen_random_uuid(),
    c.id,
    cat.name
FROM (VALUES

    -- ── Embedded Systems and IoT ─────────────────────────────────
    ('Embedded Systems and IoT', 'Microcontroller'),
    ('Embedded Systems and IoT', 'FPGAs/ DSP'),
    ('Embedded Systems and IoT', 'Wireless Technologies'),
    ('Embedded Systems and IoT', 'Memory map'),
    ('Embedded Systems and IoT', 'Clock configuration'),
    ('Embedded Systems and IoT', 'Programming Basic'),
    ('Embedded Systems and IoT', 'OTA'),
    ('Embedded Systems and IoT', 'TCP/IP'),
    ('Embedded Systems and IoT', 'GIT HUB'),
    ('Embedded Systems and IoT', 'Documentation Writing'),
    ('Embedded Systems and IoT', 'Code review'),
    ('Embedded Systems and IoT', 'PWM'),
    ('Embedded Systems and IoT', 'Emulation'),
    ('Embedded Systems and IoT', 'Basic Electronics'),
    ('Embedded Systems and IoT', 'EMS'),

    -- ── Product Development (adjust course name to match yours) ─
    ('Product Development', 'AlxDesign (Designing for AI)'),
    ('Product Development', 'App Design'),
    ('Product Development', 'Battery'),
    ('Product Development', 'Battery management'),
    ('Product Development', 'Cognitive & Behavioral Design'),
    ('Product Development', 'Contextual & Environmental Design'),
    ('Product Development', 'Design for Data'),
    ('Product Development', 'Design Thinking'),
    ('Product Development', 'Ergonomics & Human Factors'),
    ('Product Development', 'Ethical & Responsible Design'),
    ('Product Development', 'Experience Design (XD)'),
    ('Product Development', 'Human-Centered Design'),
    ('Product Development', 'Ideating/Ideation'),
    ('Product Development', 'Industrial/Form Factor Design'),
    ('Product Development', 'Interaction Design (ixD)'),
    ('Product Development', 'Market Analysis'),
    ('Product Development', 'PCB Design'),
    ('Product Development', 'Product Design'),
    ('Product Development', 'Product-System Design'),
    ('Product Development', 'Program Management'),
    ('Product Development', 'Prototyping'),
    ('Product Development', 'Rapid Prototyping Tools'),
    ('Product Development', 'System Thinking'),
    ('Product Development', 'Testing'),
    ('Product Development', 'Usability Evaluation/Testing'),
    ('Product Development', 'Usability Engineering'),
    ('Product Development', 'User/Design Research'),
    ('Product Development', 'Visual and Interface Design'),

    -- ── Business & Entrepreneurship ──────────────────────────────
    ('Business & Entrepreneurship', 'Business and Leadership'),
    ('Business & Entrepreneurship', 'Entrepreneurship'),
    ('Business & Entrepreneurship', 'Market Analysis')

) AS cat(domain, name)
-- Join on your courses table by name
JOIN courses c ON c.name = cat.domain
-- Skip if this category already exists for this course
WHERE NOT EXISTS (
    SELECT 1 FROM categories x
    WHERE x.course_id = c.id
      AND x.name = cat.name
);

-- ── Verify what was inserted ─────────────────────────────────────
SELECT
    c.name  AS domain,
    cat.name AS category
FROM categories cat
JOIN courses c ON c.id = cat.course_id
ORDER BY c.name, cat.name;
