UPDATE users
SET password_hash = crypt('Admin123*', gen_salt('bf'))
WHERE role = 'admin';
