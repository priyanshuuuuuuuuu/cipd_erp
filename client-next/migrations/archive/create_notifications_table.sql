-- Run this SQL in your Supabase SQL Editor to create the notifications table

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    type TEXT NOT NULL DEFAULT 'general',  -- 'feedback_reminder', 'class_reminder', 'general'
    
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Optional references for context
    course_id UUID REFERENCES courses(id),
    session_id UUID REFERENCES sessions(id),
    
    is_read BOOLEAN DEFAULT FALSE,
    
    sent_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
