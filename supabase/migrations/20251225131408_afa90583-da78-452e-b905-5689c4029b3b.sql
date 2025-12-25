-- Dodati jedinstveni indeks na user_id kolonu da omogući upsert
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_unique ON user_roles(user_id);

-- Ručno popraviti postojećeg korisnika admin@simpler.rs
INSERT INTO user_roles (user_id, role) 
VALUES ('9bad4ea2-94b6-420b-a271-f0189dacdb80', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';