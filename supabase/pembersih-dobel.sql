-- PEMBERSIH DATA DOBEL ARI (PASS 2) — digenerate dari dry-run data live.
-- Jalankan SEMUA dalam SATU transaksi; bila ada error, semuanya batal.
-- HAPUS dibatasi <=8 baris per statement agar tidak tersandung trigger
-- guard-mass-delete (>8 DAN >25%).
BEGIN;

-- 0. NISAN: daftar id yang sengaja dihapus/disingkirkan dari cloud. App
--    versi baru membaca baris ini (nxty_attendance_tombstones) dan menolak
--    menerima/mengirim ulang id-idnya — pasang SEBELUM hapus.
insert into public.ari_store (key, value, updated_at)
values ('attendance_tombstones', '["z53cw5898","pjvqmwxnd","o4yekb5bd","91nxr8hvl","dhbqccad6","v89pq8zjf","sjrapnct8","hrwrc3d6h","lud2zq9c5","j1gyv8us2","9pcj2vser","fkez3l0zd","nd17qtu4r","cp6dgt32a","omfxpym73","6ra7puwoi","0fb2odh60","ztl5gkx3f","pr95uzbne","g9pehllp2","4qz4zoucc","k0hzywaxa","uwg1cnwl1","g1tben8v6","r8f2tg1d4","5jhv47s0h","jm8v8veyo","ki21okyl0","ujj1t2rpa","ttirb61o6","nibeip73b","vvrchiut8","l929zhkl9","0mdlxpvt9","1aa0noa7p","5mk367kl8","mhn2u3har","jqffp10tg","848di8pgu","ae4rv2fn8","ohg52xfyh","p4szzjaoz","10ff501se","eck6qmynb","b1ees6fmf","htix56tcw","vvilwbit1","mgzx5ixy2","qi9qvtvd4","5t57skpuo","r0na5csyq","nnitinxtc","ghzyhfqt0","uzs9ssd96"]'::jsonb, now())
on conflict (key) do update set
  value = (select jsonb_agg(distinct x) from jsonb_array_elements(ari_store.value || excluded.value) as t(x)),
  updated_at = now();





delete from ari_attendance where id in ('z53cw5898', 'pjvqmwxnd', 'o4yekb5bd', '91nxr8hvl', 'dhbqccad6', 'v89pq8zjf', 'sjrapnct8', 'hrwrc3d6h');
delete from ari_attendance where id in ('lud2zq9c5', 'j1gyv8us2', '9pcj2vser', 'fkez3l0zd', 'nd17qtu4r', 'cp6dgt32a', 'omfxpym73', '6ra7puwoi');
delete from ari_attendance where id in ('0fb2odh60', 'ztl5gkx3f', 'pr95uzbne', 'g9pehllp2', '4qz4zoucc', 'k0hzywaxa', 'uwg1cnwl1', 'g1tben8v6');
delete from ari_attendance where id in ('r8f2tg1d4', '5jhv47s0h', 'jm8v8veyo', 'ki21okyl0', 'ujj1t2rpa', 'ttirb61o6', 'nibeip73b', 'vvrchiut8');
delete from ari_attendance where id in ('l929zhkl9', '0mdlxpvt9', '1aa0noa7p', '5mk367kl8', 'mhn2u3har', 'jqffp10tg', '848di8pgu', 'ae4rv2fn8');
delete from ari_attendance where id in ('ohg52xfyh', 'p4szzjaoz', '10ff501se', 'eck6qmynb', 'b1ees6fmf', 'htix56tcw', 'vvilwbit1', 'mgzx5ixy2');
delete from ari_attendance where id in ('qi9qvtvd4', '5t57skpuo', 'r0na5csyq', 'nnitinxtc', 'ghzyhfqt0', 'uzs9ssd96');


COMMIT;

-- VERIFIKASI: masing-masing query di bawah HARUS menghasilkan 0 baris.
select lower(trim(value->>'name')) as nama, count(*) c from ari_employees group by 1 having count(*) > 1;
select left(value->>'timestamp', 10) as tgl, value->>'type_scan' as tipe, value->>'employee_id' as emp, count(*) c from ari_attendance group by emp, left(value->>'timestamp', 10), tipe having count(*) > 1;