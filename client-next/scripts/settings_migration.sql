-- 1. Add 'is_active' column to venues table
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Create the system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    ping_interval INT DEFAULT 10,
    pings_per_session INT DEFAULT 6,
    presence_threshold INT DEFAULT 3,
    attendance_window INT DEFAULT 60,
    updated_at TIMESTAMP DEFAULT now()
);

-- 3. Insert default config row (if it doesn't exist)
INSERT INTO public.system_settings (id, ping_interval, pings_per_session, presence_threshold, attendance_window)
VALUES (1, 10, 6, 3, 60)
ON CONFLICT (id) DO NOTHING;

-- 4. Grant permissions to API roles so the frontend can access them
GRANT ALL ON public.venues TO anon, authenticated, service_role;
GRANT ALL ON public.system_settings TO anon, authenticated, service_role;

-- 5. Force schema cache to reload
NOTIFY pgrst, 'reload schema';
