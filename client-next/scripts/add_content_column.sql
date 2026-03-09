-- Add content column to session_materials for storing lecture notes text
ALTER TABLE session_materials ADD COLUMN IF NOT EXISTS content TEXT;

-- Add file_type column to distinguish between PDFs, slides, notes, links
ALTER TABLE session_materials ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'pdf';
