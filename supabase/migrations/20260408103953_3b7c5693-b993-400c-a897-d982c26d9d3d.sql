DELETE FROM menu_meals WHERE menu_id IN (SELECT id FROM menus WHERE menu_date < '2026-03-01');
DELETE FROM menus WHERE menu_date < '2026-03-01';