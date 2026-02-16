-- Rename OWNER role to ADMIN
UPDATE "staff" SET role = 'ADMIN' WHERE role = 'OWNER';
