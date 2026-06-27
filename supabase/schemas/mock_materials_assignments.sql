-- ============================================================================
-- SQL Script: Populate Detailed Assignments and Materials for 8 Courses
-- Run this script in your Supabase SQL Editor
-- ============================================================================

DO $$
DECLARE
    v_course_id uuid;
    v_course_name text;
    v_faculty_id uuid;
BEGIN
    -- Loop through each of the 8 specific courses by NAME instead of code
    FOR v_course_name IN 
        SELECT unnest(ARRAY[
            'Business & Leadership', 
            'Design & UI', 
            'Entrepreneurship', 
            'Product Development', 
            'Capstone', 
            'Electronics & Basics', 
            'Embedded Systems & IOT', 
            'Software & App Development'
        ])
    LOOP
        -- Get the course ID by name (case-insensitive partial match to be safe, grabbing the most recently created if duplicates exist)
        SELECT id INTO v_course_id FROM courses WHERE name ILIKE v_course_name ORDER BY created_at DESC LIMIT 1;
        
        -- Fallback if ampersand vs 'and' was used
        IF v_course_id IS NULL THEN
            SELECT id INTO v_course_id FROM courses WHERE name ILIKE REPLACE(v_course_name, '&', 'and') ORDER BY created_at DESC LIMIT 1;
        END IF;

        -- Fallback if exact match failed but partial match works
        IF v_course_id IS NULL THEN
            SELECT id INTO v_course_id FROM courses WHERE name ILIKE '%' || v_course_name || '%' ORDER BY created_at DESC LIMIT 1;
        END IF;
        
        -- If course still doesn't exist, skip to next
        IF v_course_id IS NULL THEN
            RAISE NOTICE 'Could not find course: %', v_course_name;
            CONTINUE;
        END IF;

        -- Try to find a faculty ID associated with this course via sessions, or just leave NULL
        SELECT faculty_id INTO v_faculty_id FROM sessions WHERE course_id = v_course_id AND faculty_id IS NOT NULL LIMIT 1;

        -- ==========================================
        -- 1. Insert Assignments
        -- ==========================================
        
        IF v_course_name = 'Business & Leadership' THEN
            INSERT INTO assignments (id, course_id, faculty_id, title, description, created_at, due_date, total_marks) VALUES 
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Leadership Case Study Analysis', 'Analyze the organizational restructuring of a Fortune 500 company. Max 1500 words.', now(), now() + interval '7 days', 100),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Financial Modeling Basics', 'Create a 3-year projection model based on the provided balance sheet.', now(), now() + interval '14 days', 50);
            
            INSERT INTO session_materials (id, course_id, faculty_id, title, content, file_type, file_url, created_at) VALUES
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'L1: Intro to Org Behavior', 'Success is often seen as a destination, a fixed point where all goals are achieved and satisfaction is guaranteed. However, in reality, success is better understood as a continuous journey shaped by effort, resilience, and personal growth. It is not defined solely by wealth, status, or recognition, but by the progress an individual makes toward meaningful goals and the lessons learned along the way.

One of the key elements of success is consistency. Small, disciplined actions performed regularly can lead to significant outcomes over time. Whether it is studying for exams, building a career, or improving personal health, consistent effort creates a strong foundation for long-term achievement. Equally important is the ability to adapt. Life is unpredictable, and challenges are inevitable. Those who succeed are often the ones who learn from failure rather than being discouraged by it.

Another crucial aspect is mindset. A positive and growth-oriented mindset enables individuals to see obstacles as opportunities rather than barriers. Instead of fearing failure, they embrace it as a part of the learning process. This perspective not only builds confidence but also encourages innovation and creativity.

Moreover, success is deeply personal. What may be considered successful for one person may not hold the same value for another. For some, it may mean achieving professional excellence, while for others, it could be maintaining meaningful relationships or contributing to society. Understanding one’s own definition of success is essential to finding true fulfillment.

In conclusion, success is not a single achievement but an ongoing process of learning, improving, and striving toward one’s goals. By staying consistent, adapting to challenges, and maintaining the right mindset, individuals can create their own path to a meaningful and fulfilling life.
', 'pdf', 'https://example.com/materials/bl_l1.pdf', now()),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Case Study: Enron', 'Required reading for the week 2 case study assignment.', 'pdf', 'https://example.com/materials/enron_case.pdf', now());

        ELSIF v_course_name = 'Design & UI' THEN
            INSERT INTO assignments (id, course_id, faculty_id, title, description, created_at, due_date, total_marks) VALUES 
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Figma Wireframing Task', 'Design low-fidelity wireframes for a food delivery mobile app (min 5 screens).', now(), now() + interval '5 days', 100),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Accessibility Audit', 'Perform an accessibility audit on the university website using WCAG guidelines.', now(), now() + interval '12 days', 50);
            
            INSERT INTO session_materials (id, course_id, faculty_id, title, content, file_type, file_url, created_at) VALUES
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'UI vs UX Fundamentals', 'Core differences and overlap between UI and UX.', 'pdf', 'https://example.com/materials/ui_ux.pdf', now()),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Color Theory Cheat Sheet', 'Quick reference for accessible color palettes.', 'image/png', 'https://example.com/materials/colors.png', now());

        ELSIF v_course_name = 'Entrepreneurship' THEN
            INSERT INTO assignments (id, course_id, faculty_id, title, description, created_at, due_date, total_marks) VALUES 
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Elevator Pitch Video', 'Submit a 60-second video pitching your startup idea.', now(), now() + interval '10 days', 100),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Market Research Report', 'Identify TAM, SAM, and SOM for a SaaS product in the ed-tech space.', now(), now() + interval '20 days', 100);

            INSERT INTO session_materials (id, course_id, faculty_id, title, content, file_type, file_url, created_at) VALUES
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Pitch Deck Template', 'Standard Sequoia Capital pitch deck template.', 'pptx', 'https://example.com/materials/pitch_template.pptx', now()),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Lean Startup Summary', 'Summary notes on building a minimum viable product.', 'pdf', 'https://example.com/materials/lean_startup.pdf', now());

        ELSIF v_course_name = 'Product Development' THEN
            INSERT INTO assignments (id, course_id, faculty_id, title, description, created_at, due_date, total_marks) VALUES 
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'PRD Documentation', 'Write a complete Product Requirements Document for a new fitness tracker.', now(), now() + interval '14 days', 100),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Agile Sprint Planning', 'Create a backlog and plan a 2-week sprint in Jira (submit screenshots).', now(), now() + interval '7 days', 50);

            INSERT INTO session_materials (id, course_id, faculty_id, title, content, file_type, file_url, created_at) VALUES
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Example PRD', 'Sample PRD from an actual product launch.', 'pdf', 'https://example.com/materials/sample_prd.pdf', now()),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Scrum Framework Guide', 'Official Scrum guide for product owners.', 'pdf', 'https://example.com/materials/scrum_guide.pdf', now());

        ELSIF v_course_name = 'Capstone' THEN
            INSERT INTO assignments (id, course_id, faculty_id, title, description, created_at, due_date, total_marks) VALUES 
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Project Proposal', 'Submit your final capstone project proposal including tech stack and timeline.', now(), now() + interval '7 days', 50),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Mid-Project Review', 'Submit current codebase and progress report for review.', now(), now() + interval '45 days', 100);

            INSERT INTO session_materials (id, course_id, faculty_id, title, content, file_type, file_url, created_at) VALUES
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Capstone Guidelines', 'Rules, grading rubric, and expectations for the capstone project.', 'pdf', 'https://example.com/materials/capstone_rules.pdf', now()),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Past Project Examples', 'Archive of excellent past capstone submissions.', 'zip', 'https://example.com/materials/past_projects.zip', now());

        ELSIF v_course_name = 'Electronics & Basics' THEN
            INSERT INTO assignments (id, course_id, faculty_id, title, description, created_at, due_date, total_marks) VALUES 
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Circuit Analysis Set 1', 'Solve problems 1-15 in Chapter 4 (Kirchhoffs Laws).', now(), now() + interval '5 days', 100),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Breadboard Implementation', 'Implement the logic gate circuit from Lab 2 and submit a video of it working.', now(), now() + interval '10 days', 50);

            INSERT INTO session_materials (id, course_id, faculty_id, title, content, file_type, file_url, created_at) VALUES
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Resistor Color Codes', 'Handy reference chart for resistor values.', 'image/jpeg', 'https://example.com/materials/resistors.jpg', now()),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Ohm''s Law Worksheet', 'Practice problems for Ohm''s Law.', 'pdf', 'https://example.com/materials/ohms_law.pdf', now());

        ELSIF v_course_name = 'Embedded Systems & IOT' THEN
            INSERT INTO assignments (id, course_id, faculty_id, title, description, created_at, due_date, total_marks) VALUES 
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Arduino Sensor Reading', 'Write a sketch to read temperature from a DHT11 and print to Serial monitor.', now(), now() + interval '7 days', 100),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'MQTT Data Publish', 'Publish the sensor data to a public MQTT broker. Submit code and broker topic.', now(), now() + interval '14 days', 100);

            INSERT INTO session_materials (id, course_id, faculty_id, title, content, file_type, file_url, created_at) VALUES
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'ESP32 Pinout Guide', 'Pinout diagram for the NodeMCU ESP32 board.', 'pdf', 'https://example.com/materials/esp32_pinout.pdf', now()),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Arduino I2C Library Docs', 'Documentation for the Wire library.', 'pdf', 'https://example.com/materials/wire_docs.pdf', now());

        ELSIF v_course_name = 'Software & App Development' THEN
            INSERT INTO assignments (id, course_id, faculty_id, title, description, created_at, due_date, total_marks) VALUES 
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'React To-Do App', 'Build a simple React application that uses localStorage to persist data.', now(), now() + interval '7 days', 100),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'REST API with Express', 'Create a CRUD API using Node/Express and submit the Postman collection.', now(), now() + interval '14 days', 100);

            INSERT INTO session_materials (id, course_id, faculty_id, title, content, file_type, file_url, created_at) VALUES
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'Git Basics Cheat Sheet', 'Essential Git commands for version control.', 'pdf', 'https://example.com/materials/git_cheat_sheet.pdf', now()),
            (uuid_generate_v4(), v_course_id, v_faculty_id, 'React Hooks Guide', 'Deep dive into useState, useEffect, and custom hooks.', 'pdf', 'https://example.com/materials/react_hooks.pdf', now());

        END IF;

    END LOOP;
END;
$$;
