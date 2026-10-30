-- jumlah baris semua tabel ari_*, satu hasil.
SELECT 'ari_store' AS t, count(*) AS c FROM ari_store
UNION ALL SELECT 'ari_attendance', count(*) FROM ari_attendance
UNION ALL SELECT 'ari_departments', count(*) FROM ari_departments
UNION ALL SELECT 'ari_customers', count(*) FROM ari_customers
UNION ALL SELECT 'ari_assets', count(*) FROM ari_assets
UNION ALL SELECT 'ari_employees', count(*) FROM ari_employees
UNION ALL SELECT 'ari_products', count(*) FROM ari_products
UNION ALL SELECT 'ari_raw_materials', count(*) FROM ari_raw_materials
UNION ALL SELECT 'ari_stock_movements', count(*) FROM ari_stock_movements
UNION ALL SELECT 'ari_orders', count(*) FROM ari_orders
UNION ALL SELECT 'ari_marketplace_sales', count(*) FROM ari_marketplace_sales
UNION ALL SELECT 'ari_marketplace_item_sales', count(*) FROM ari_marketplace_item_sales
UNION ALL SELECT 'ari_invoices', count(*) FROM ari_invoices
UNION ALL SELECT 'ari_delivery_notes', count(*) FROM ari_delivery_notes
UNION ALL SELECT 'ari_returns', count(*) FROM ari_returns
UNION ALL SELECT 'ari_production_jobs', count(*) FROM ari_production_jobs
UNION ALL SELECT 'ari_production_handoffs', count(*) FROM ari_production_handoffs
UNION ALL SELECT 'ari_rejected_goods', count(*) FROM ari_rejected_goods
UNION ALL SELECT 'ari_production_task_logs', count(*) FROM ari_production_task_logs
UNION ALL SELECT 'ari_production_logs', count(*) FROM ari_production_logs
UNION ALL SELECT 'ari_packing_tasks', count(*) FROM ari_packing_tasks
UNION ALL SELECT 'ari_purchases', count(*) FROM ari_purchases
UNION ALL SELECT 'ari_daily_expenses', count(*) FROM ari_daily_expenses
UNION ALL SELECT 'ari_payroll_weekly', count(*) FROM ari_payroll_weekly
UNION ALL SELECT 'ari_cash_advances', count(*) FROM ari_cash_advances
UNION ALL SELECT 'ari_cash_advance_transactions', count(*) FROM ari_cash_advance_transactions
UNION ALL SELECT 'ari_attendance_bonus_payouts', count(*) FROM ari_attendance_bonus_payouts
UNION ALL SELECT 'ari_attendance_adjustments', count(*) FROM ari_attendance_adjustments
UNION ALL SELECT 'ari_attendance_failures', count(*) FROM ari_attendance_failures
UNION ALL SELECT 'ari_notifications', count(*) FROM ari_notifications
ORDER BY t;
