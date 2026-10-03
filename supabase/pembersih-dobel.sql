-- PEMBERSIH DATA DOBEL ARI — digenerate dari dry-run data live.
-- Jalankan SEMUA dalam SATU transaksi; bila ada error, semuanya batal.
-- Tukang hapus di bawah sengaja diperbatas <=8 baris per statement agar
-- tidak tersandung trigger guard-mass-delete (>8 DAN >25%).
BEGIN;
update ari_attendance set id = 'att-emp-owner-2026-07-06-masuk', value = value || '{"employee_id":"emp-owner","id":"att-emp-owner-2026-07-06-masuk"}'::jsonb where id = 'cp6dgt32a' and not exists (select 1 from ari_attendance where id = 'att-emp-owner-2026-07-06-masuk');
update ari_attendance set id = 'att-emp-asep-2026-07-06-masuk', value = value || '{"employee_id":"emp-asep","id":"att-emp-asep-2026-07-06-masuk"}'::jsonb where id = '6ra7puwoi' and not exists (select 1 from ari_attendance where id = 'att-emp-asep-2026-07-06-masuk');
update ari_attendance set id = 'att-emp-asep-2026-07-07-pulang', value = value || '{"employee_id":"emp-asep","id":"att-emp-asep-2026-07-07-pulang"}'::jsonb where id = '0fb2odh60' and not exists (select 1 from ari_attendance where id = 'att-emp-asep-2026-07-07-pulang');
update ari_attendance set id = 'att-emp-1365-2026-08-04-masuk', value = value || '{"employee_id":"emp-1365","id":"att-emp-1365-2026-08-04-masuk"}'::jsonb where id = 'pr95uzbne' and not exists (select 1 from ari_attendance where id = 'att-emp-1365-2026-08-04-masuk');
update ari_attendance set id = 'att-emp-1070-2026-08-07-masuk', value = value || '{"employee_id":"emp-1070","id":"att-emp-1070-2026-08-07-masuk"}'::jsonb where id = 'k0hzywaxa' and not exists (select 1 from ari_attendance where id = 'att-emp-1070-2026-08-07-masuk');
update ari_attendance set id = 'att-emp-1365-2026-08-05-masuk', value = value || '{"employee_id":"emp-1365","id":"att-emp-1365-2026-08-05-masuk"}'::jsonb where id = '5mk367kl8' and not exists (select 1 from ari_attendance where id = 'att-emp-1365-2026-08-05-masuk');
update ari_attendance set id = 'att-emp-2704-2026-07-25-masuk', value = value || '{"employee_id":"emp-2704","id":"att-emp-2704-2026-07-25-masuk"}'::jsonb where id = 'g1tben8v6' and not exists (select 1 from ari_attendance where id = 'att-emp-2704-2026-07-25-masuk');
update ari_attendance set id = 'att-emp-3059-2026-07-25-masuk', value = value || '{"employee_id":"emp-3059","id":"att-emp-3059-2026-07-25-masuk"}'::jsonb where id = 'r8f2tg1d4' and not exists (select 1 from ari_attendance where id = 'att-emp-3059-2026-07-25-masuk');
update ari_attendance set id = 'att-emp-3059-2026-07-31-masuk', value = value || '{"employee_id":"emp-3059","id":"att-emp-3059-2026-07-31-masuk"}'::jsonb where id = 'jm8v8veyo' and not exists (select 1 from ari_attendance where id = 'att-emp-3059-2026-07-31-masuk');
update ari_attendance set id = 'att-emp-5199-2026-08-15-masuk', value = value || '{"employee_id":"emp-5199","id":"att-emp-5199-2026-08-15-masuk"}'::jsonb where id = 'o4yekb5bd' and not exists (select 1 from ari_attendance where id = 'att-emp-5199-2026-08-15-masuk');
update ari_attendance set id = 'att-emp-9574-2026-08-18-masuk', value = value || '{"employee_id":"emp-9574","id":"att-emp-9574-2026-08-18-masuk"}'::jsonb where id = 'qi9qvtvd4' and not exists (select 1 from ari_attendance where id = 'att-emp-9574-2026-08-18-masuk');
update ari_attendance set id = 'att-emp-3059-2026-08-13-masuk', value = value || '{"employee_id":"emp-3059","id":"att-emp-3059-2026-08-13-masuk"}'::jsonb where id = 'pjvqmwxnd' and not exists (select 1 from ari_attendance where id = 'att-emp-3059-2026-08-13-masuk');
update ari_attendance set id = 'att-emp-1070-2026-08-20-masuk', value = value || '{"employee_id":"emp-1070","id":"att-emp-1070-2026-08-20-masuk"}'::jsonb where id = 'vvilwbit1' and not exists (select 1 from ari_attendance where id = 'att-emp-1070-2026-08-20-masuk');
update ari_attendance set id = 'att-emp-9574-2026-08-03-masuk', value = value || '{"employee_id":"emp-9574","id":"att-emp-9574-2026-08-03-masuk"}'::jsonb where id = 'v89pq8zjf' and not exists (select 1 from ari_attendance where id = 'att-emp-9574-2026-08-03-masuk');
update ari_attendance set id = 'att-emp-3059-2026-08-03-masuk', value = value || '{"employee_id":"emp-3059","id":"att-emp-3059-2026-08-03-masuk"}'::jsonb where id = 'ttirb61o6' and not exists (select 1 from ari_attendance where id = 'att-emp-3059-2026-08-03-masuk');
update ari_attendance set id = 'att-emp-5163-2026-08-11-masuk', value = value || '{"employee_id":"emp-5163","id":"att-emp-5163-2026-08-11-masuk"}'::jsonb where id = 'fkez3l0zd' and not exists (select 1 from ari_attendance where id = 'att-emp-5163-2026-08-11-masuk');
update ari_attendance set id = 'att-emp-9574-2026-08-18-pulang', value = value || '{"employee_id":"emp-9574","id":"att-emp-9574-2026-08-18-pulang"}'::jsonb where id = 'r0na5csyq' and not exists (select 1 from ari_attendance where id = 'att-emp-9574-2026-08-18-pulang');
update ari_attendance set id = 'att-emp-9574-2026-08-01-masuk', value = value || '{"employee_id":"emp-9574","id":"att-emp-9574-2026-08-01-masuk"}'::jsonb where id = 'vvrchiut8' and not exists (select 1 from ari_attendance where id = 'att-emp-9574-2026-08-01-masuk');
update ari_attendance set id = 'att-emp-5163-2026-08-03-masuk', value = value || '{"employee_id":"emp-5163","id":"att-emp-5163-2026-08-03-masuk"}'::jsonb where id = '0mdlxpvt9' and not exists (select 1 from ari_attendance where id = 'att-emp-5163-2026-08-03-masuk');
update ari_attendance set id = 'att-emp-5163-2026-08-20-masuk', value = value || '{"employee_id":"emp-5163","id":"att-emp-5163-2026-08-20-masuk"}'::jsonb where id = 'lud2zq9c5' and not exists (select 1 from ari_attendance where id = 'att-emp-5163-2026-08-20-masuk');
update ari_attendance set id = 'att-emp-3059-2026-08-05-masuk', value = value || '{"employee_id":"emp-3059","id":"att-emp-3059-2026-08-05-masuk"}'::jsonb where id = 'hrwrc3d6h' and not exists (select 1 from ari_attendance where id = 'att-emp-3059-2026-08-05-masuk');
update ari_attendance set id = 'att-emp-1070-2026-08-08-masuk', value = value || '{"employee_id":"emp-1070","id":"att-emp-1070-2026-08-08-masuk"}'::jsonb where id = '10ff501se' and not exists (select 1 from ari_attendance where id = 'att-emp-1070-2026-08-08-masuk');
update ari_attendance set id = 'att-emp-9574-2026-08-15-masuk', value = value || '{"employee_id":"emp-9574","id":"att-emp-9574-2026-08-15-masuk"}'::jsonb where id = 'b1ees6fmf' and not exists (select 1 from ari_attendance where id = 'att-emp-9574-2026-08-15-masuk');
update ari_attendance set id = 'att-emp-8617-2026-08-22-masuk', value = value || '{"employee_id":"emp-8617","id":"att-emp-8617-2026-08-22-masuk"}'::jsonb where id = 'ohg52xfyh' and not exists (select 1 from ari_attendance where id = 'att-emp-8617-2026-08-22-masuk');
update ari_attendance set id = 'att-emp-8617-2026-08-15-masuk', value = value || '{"employee_id":"emp-8617","id":"att-emp-8617-2026-08-15-masuk"}'::jsonb where id = 'ae4rv2fn8' and not exists (select 1 from ari_attendance where id = 'att-emp-8617-2026-08-15-masuk');
update ari_attendance set id = 'att-emp-3059-2026-08-12-masuk', value = value || '{"employee_id":"emp-3059","id":"att-emp-3059-2026-08-12-masuk"}'::jsonb where id = 'uzs9ssd96' and not exists (select 1 from ari_attendance where id = 'att-emp-3059-2026-08-12-masuk');
update ari_attendance set id = 'att-emp-2704-2026-08-01-masuk', value = value || '{"employee_id":"emp-2704","id":"att-emp-2704-2026-08-01-masuk"}'::jsonb where id = 'jqffp10tg' and not exists (select 1 from ari_attendance where id = 'att-emp-2704-2026-08-01-masuk');
update ari_attendance set id = 'att-emp-6840-2026-07-07-masuk', value = value || '{"employee_id":"emp-6840","id":"att-emp-6840-2026-07-07-masuk"}'::jsonb where id = 'dsljmfrb9' and not exists (select 1 from ari_attendance where id = 'att-emp-6840-2026-07-07-masuk');
update ari_attendance set id = 'att-emp-9164-2026-07-07-masuk', value = value || '{"employee_id":"emp-9164","id":"att-emp-9164-2026-07-07-masuk"}'::jsonb where id = '72ky5sd5y' and not exists (select 1 from ari_attendance where id = 'att-emp-9164-2026-07-07-masuk');
update ari_attendance set id = 'att-emp-6202-2026-07-07-masuk', value = value || '{"employee_id":"emp-6202","id":"att-emp-6202-2026-07-07-masuk"}'::jsonb where id = '7qvdq0udm' and not exists (select 1 from ari_attendance where id = 'att-emp-6202-2026-07-07-masuk');
update ari_attendance set id = 'att-emp-1154-2026-07-07-masuk', value = value || '{"employee_id":"emp-1154","id":"att-emp-1154-2026-07-07-masuk"}'::jsonb where id = '5e4kzz92z' and not exists (select 1 from ari_attendance where id = 'att-emp-1154-2026-07-07-masuk');
update ari_attendance set id = 'att-emp-2788-2026-07-07-masuk', value = value || '{"employee_id":"emp-2788","id":"att-emp-2788-2026-07-07-masuk"}'::jsonb where id = 'yvetu9mmm' and not exists (select 1 from ari_attendance where id = 'att-emp-2788-2026-07-07-masuk');
update ari_attendance set id = 'att-emp-1739-2026-07-07-masuk', value = value || '{"employee_id":"emp-1739","id":"att-emp-1739-2026-07-07-masuk"}'::jsonb where id = 'dfvn3pom8' and not exists (select 1 from ari_attendance where id = 'att-emp-1739-2026-07-07-masuk');
update ari_attendance set id = 'att-emp-8122-2026-07-07-masuk', value = value || '{"employee_id":"emp-8122","id":"att-emp-8122-2026-07-07-masuk"}'::jsonb where id = 'sh95rjcwj' and not exists (select 1 from ari_attendance where id = 'att-emp-8122-2026-07-07-masuk');
update ari_attendance set id = 'att-emp-1154-2026-07-07-pulang', value = value || '{"employee_id":"emp-1154","id":"att-emp-1154-2026-07-07-pulang"}'::jsonb where id = '5oh6ew2dj' and not exists (select 1 from ari_attendance where id = 'att-emp-1154-2026-07-07-pulang');
update ari_attendance set id = 'att-emp-8122-2026-07-07-pulang', value = value || '{"employee_id":"emp-8122","id":"att-emp-8122-2026-07-07-pulang"}'::jsonb where id = '0kzlc16v1' and not exists (select 1 from ari_attendance where id = 'att-emp-8122-2026-07-07-pulang');
update ari_attendance set id = 'att-emp-6202-2026-07-07-pulang', value = value || '{"employee_id":"emp-6202","id":"att-emp-6202-2026-07-07-pulang"}'::jsonb where id = '13nktki71' and not exists (select 1 from ari_attendance where id = 'att-emp-6202-2026-07-07-pulang');
update ari_attendance set id = 'att-emp-2788-2026-07-07-pulang', value = value || '{"employee_id":"emp-2788","id":"att-emp-2788-2026-07-07-pulang"}'::jsonb where id = 'xcvky1rxa' and not exists (select 1 from ari_attendance where id = 'att-emp-2788-2026-07-07-pulang');
update ari_attendance set id = 'att-emp-6202-2026-07-08-masuk', value = value || '{"employee_id":"emp-6202","id":"att-emp-6202-2026-07-08-masuk"}'::jsonb where id = 'bjh40j35h' and not exists (select 1 from ari_attendance where id = 'att-emp-6202-2026-07-08-masuk');
update ari_attendance set id = 'att-emp-1154-2026-07-08-masuk', value = value || '{"employee_id":"emp-1154","id":"att-emp-1154-2026-07-08-masuk"}'::jsonb where id = 'n9fbt2i30' and not exists (select 1 from ari_attendance where id = 'att-emp-1154-2026-07-08-masuk');
update ari_attendance set id = 'att-emp-5199-2026-07-08-masuk', value = value || '{"employee_id":"emp-5199","id":"att-emp-5199-2026-07-08-masuk"}'::jsonb where id = 'ztrwjuyuu' and not exists (select 1 from ari_attendance where id = 'att-emp-5199-2026-07-08-masuk');
update ari_attendance set id = 'att-emp-6840-2026-07-08-masuk', value = value || '{"employee_id":"emp-6840","id":"att-emp-6840-2026-07-08-masuk"}'::jsonb where id = '0u3dzhc3b' and not exists (select 1 from ari_attendance where id = 'att-emp-6840-2026-07-08-masuk');
update ari_attendance set id = 'att-emp-6840-2026-07-08-pulang', value = value || '{"employee_id":"emp-6840","id":"att-emp-6840-2026-07-08-pulang"}'::jsonb where id = '4rk7kdadf' and not exists (select 1 from ari_attendance where id = 'att-emp-6840-2026-07-08-pulang');
update ari_attendance set id = 'att-emp-1070-2026-07-08-masuk', value = value || '{"employee_id":"emp-1070","id":"att-emp-1070-2026-07-08-masuk"}'::jsonb where id = 'otv92zrm0' and not exists (select 1 from ari_attendance where id = 'att-emp-1070-2026-07-08-masuk');
update ari_attendance set id = 'att-emp-1070-2026-07-08-pulang', value = value || '{"employee_id":"emp-1070","id":"att-emp-1070-2026-07-08-pulang"}'::jsonb where id = 'hl2gqfbsd' and not exists (select 1 from ari_attendance where id = 'att-emp-1070-2026-07-08-pulang');
update ari_attendance set id = 'att-emp-2504-2026-07-08-masuk', value = value || '{"employee_id":"emp-2504","id":"att-emp-2504-2026-07-08-masuk"}'::jsonb where id = '8sf4zojfo' and not exists (select 1 from ari_attendance where id = 'att-emp-2504-2026-07-08-masuk');
update ari_attendance set id = 'att-emp-2504-2026-07-08-pulang', value = value || '{"employee_id":"emp-2504","id":"att-emp-2504-2026-07-08-pulang"}'::jsonb where id = '6ch546l48' and not exists (select 1 from ari_attendance where id = 'att-emp-2504-2026-07-08-pulang');
update ari_attendance set id = 'att-emp-8077-2026-07-08-masuk', value = value || '{"employee_id":"emp-8077","id":"att-emp-8077-2026-07-08-masuk"}'::jsonb where id = '19mz0blgl' and not exists (select 1 from ari_attendance where id = 'att-emp-8077-2026-07-08-masuk');
update ari_attendance set id = 'att-emp-8077-2026-07-08-pulang', value = value || '{"employee_id":"emp-8077","id":"att-emp-8077-2026-07-08-pulang"}'::jsonb where id = 'gah98a5xt' and not exists (select 1 from ari_attendance where id = 'att-emp-8077-2026-07-08-pulang');
update ari_attendance set id = 'att-emp-5604-2026-09-30-masuk', value = value || '{"employee_id":"emp-5604","id":"att-emp-5604-2026-09-30-masuk"}'::jsonb where id = 'att-emp-6004-2026-09-30-masuk' and not exists (select 1 from ari_attendance where id = 'att-emp-5604-2026-09-30-masuk');


update ari_attendance_adjustments set value = value || '{"attendance_id":"att-emp-9574-2026-08-18-pulang"}'::jsonb where id = '3fazoscz5';
update ari_attendance_adjustments set value = value || '{"attendance_id":"att-emp-1154-2026-07-07-pulang","employee_id":"emp-1154"}'::jsonb where id = 'fetei4yqh';
update ari_attendance_adjustments set value = value || '{"attendance_id":"att-emp-9574-2026-08-18-pulang"}'::jsonb where id = 'j34mq0kl0';
update ari_attendance_adjustments set value = value || '{"attendance_id":"att-emp-6202-2026-07-07-pulang","employee_id":"emp-6202"}'::jsonb where id = 'pretnxlx2';
update ari_attendance_adjustments set value = value || '{"attendance_id":"att-emp-2788-2026-07-07-pulang","employee_id":"emp-2788"}'::jsonb where id = 'eqpy6bs5l';

update ari_production_handoffs set value = value || '{"to_employee_id":"emp-1070"}'::jsonb where id = 'handoff-1783497471975-ka07j';
update ari_production_handoffs set value = value || '{"to_employee_id":"emp-6840"}'::jsonb where id = 'handoff-1783479871856-tbrcn';
update ari_production_handoffs set value = value || '{"to_employee_id":"emp-5199"}'::jsonb where id = 'handoff-1783479412298-l1uso';
update ari_production_handoffs set value = value || '{"to_employee_id":"emp-5199"}'::jsonb where id = 'handoff-1783479322771-afuc2';
update ari_production_task_logs set value = value || '{"employee_id":"emp-6840"}'::jsonb where id = 'ptask-1783479958792-1mxa4';
update ari_production_task_logs set value = value || '{"employee_id":"emp-6840"}'::jsonb where id = 'ptask-1783479935250-9z523';

delete from ari_attendance_adjustments where id in ('3fazoscz5');

delete from ari_attendance where id in ('nd17qtu4r', 'omfxpym73', 'ztl5gkx3f', 'g9pehllp2', '4qz4zoucc', '1aa0noa7p', 'uwg1cnwl1', '5jhv47s0h');
delete from ari_attendance where id in ('ki21okyl0', '91nxr8hvl', '5t57skpuo', 'z53cw5898', 'mgzx5ixy2', 'dhbqccad6', 'ujj1t2rpa', '9pcj2vser');
delete from ari_attendance where id in ('nnitinxtc', 'nibeip73b', 'l929zhkl9', 'j1gyv8us2', 'sjrapnct8', 'eck6qmynb', 'htix56tcw', 'p4szzjaoz');
delete from ari_attendance where id in ('848di8pgu', 'ghzyhfqt0', 'mhn2u3har');

delete from ari_employees where id in ('emp-6004', 'emp-8123', 'emp-4353', 'emp-9985', 'emp-5188', 'emp-8972', 'emp-4617');
delete from ari_employees where id in ('emp-7827', 'emp-3063', 'emp-8876', 'emp-7366', 'emp-8882', 'emp-1643');

COMMIT;

-- VERIFIKASI: masing-masing query di bawah HARUS menghasilkan 0 baris.
select lower(trim(value->>'name')) as nama, count(*) c from ari_employees group by 1 having count(*) > 1;
select left(value->>'timestamp', 10) as tgl, value->>'type_scan' as tipe, value->>'employee_id' as emp, count(*) c from ari_attendance group by emp, left(value->>'timestamp', 10), tipe having count(*) > 1;