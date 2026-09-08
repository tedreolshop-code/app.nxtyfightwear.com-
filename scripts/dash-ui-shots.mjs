import { chromium } from '@playwright/test';

const browser = await chromium.launch();

const wib = (offsetDays = 0) =>
  new Date(Date.now() - offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const iso = (offsetDays = 0, hour = 8) => {
  const d = new Date(Date.now() - offsetDays * 86400000);
  d.setUTCHours(hour - 7, 5, 0, 0);
  return d.toISOString();
};

const seedModerat = () => {
const wib = (offsetDays = 0) => new Date(Date.now() - offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const iso = (offsetDays = 0, hour = 8) => { const d = new Date(Date.now() - offsetDays * 86400000); d.setUTCHours(hour - 7, 5, 0, 0); return d.toISOString(); };

  const hari = Array.from({ length: 30 }, (_, i) => wib(i));
  const t = hari[0];
  localStorage.setItem('nxty_session', JSON.stringify({ role: 'owner', name: 'H. Ari Gunawan', employeeId: 'emp-owner' }));
  localStorage.setItem('nxty_orders', JSON.stringify([
    { id: 'ord-1', order_number: 'ORD/2026/0901', customer_name: 'SMP Nusantara', date: t, status: 'pending', total: 2100000, items: [{ id: 'i1', product_id: 'p1', product_name: 'Setelan Taekwondo', qty: 6, price: 350000, subtotal: 2100000 }], source: 'online', marketplace_name: 'Shopee' },
    { id: 'ord-2', order_number: 'ORD/2026/0902', customer_name: 'Dojo Harapan', date: t, status: 'production', total: 890000, items: [{ id: 'i2', product_id: 'p2', product_name: 'Body Taekwondo', qty: 2, price: 445000, subtotal: 890000 }], source: 'online', marketplace_name: 'Tokopedia' },
    { id: 'ord-3', order_number: 'ORD/2026/0899', customer_name: 'Bpk. Rudi', date: hari[1], status: 'production', total: 1250000, items: [{ id: 'i3', product_id: 'p3', product_name: 'Matras', qty: 5, price: 250000, subtotal: 1250000 }], source: 'offline' },
    { id: 'ord-4', order_number: 'ORD/2026/0895', customer_name: 'Gym Fitnes 24', date: hari[3], status: 'preorder', total: 3400000, items: [{ id: 'i4', product_id: 'p4', product_name: 'Deker', qty: 20, price: 170000, subtotal: 3400000 }], source: 'offline' },
  ]));
  const items = [
    { id: 'mi1', date: t, marketplace_ref: 'Shopee', description: 'Sarung Tinju Merah', qty: 1, total: 105000, admin_fee: 4200 },
    { id: 'mi2', date: hari[1], marketplace_ref: 'Shopee', description: 'Body Taekwondo No.2', qty: 3, total: 1350000, admin_fee: 54000 },
    { id: 'mi3', date: hari[1], marketplace_ref: 'TikTok', description: 'Sarung Tinju Biru', qty: 2, total: 640000, admin_fee: 25600 },
    { id: 'mi4', date: hari[2], marketplace_ref: 'Tokopedia', description: 'Matras 50x30', qty: 2, total: 900000, admin_fee: 27000 },
    { id: 'mi5', date: hari[3], marketplace_ref: 'Shopee', description: 'Deker Tinju', qty: 4, total: 520000, admin_fee: 20800 },
    { id: 'mi6', date: hari[4], marketplace_ref: 'TikTok', description: 'Sarung Tinju Merah', qty: 5, total: 1550000, admin_fee: 62000 },
    { id: 'mi7', date: hari[5], marketplace_ref: 'Shopee', description: 'Body Taekwondo No.2', qty: 2, total: 890000, admin_fee: 35600 },
    { id: 'mi8', date: hari[6], marketplace_ref: 'Lainnya', description: 'Pecing Glossy', qty: 1, total: 210000, admin_fee: 0 },
    { id: 'mi9', date: hari[7], marketplace_ref: 'Tokopedia', description: 'Deker Kaki', qty: 3, total: 660000, admin_fee: 19800 },
  ].map(s => ({ ...s, status: 'terkirim', order_number: 'INV/' + s.id, price: Math.round(s.total / s.qty), subtotal: s.total, admin_staff: 'Ari' }));
  localStorage.setItem('nxty_marketplace_item_sales', JSON.stringify(items));
  localStorage.setItem('nxty_marketplace_sales', JSON.stringify([]));
  localStorage.setItem('nxty_daily_expenses', JSON.stringify([
    { id: 'ex1', date: t, description: 'Bensin pengiriman', amount: 35000, category: 'Operasional' },
    { id: 'ex2', date: t, description: 'Makan siang tim', amount: 120000, category: 'Operasional' },
  ]));
  localStorage.setItem('nxty_purchases', JSON.stringify([
    { id: 'po1', date: t, status: 'dipesan', total_price: 1250000, supplier_name: 'Toko Kain Jaya', items_note: 'Kain Milena 20m' },
  ]));
  localStorage.setItem('nxty_production_jobs', JSON.stringify([
    { id: 'job-1', order_number: 'PROD/2026/0055', product_id: 'p2', product_name: 'Body Taekwondo (No.2)', variant: 'No.2', qty: 8, department_id: 'dept-konveksi', status: 'ongoing', current_stage: 'Potong', created_at: iso(0, 9), stages: [{ stage: 'Potong', status: 'ongoing' }, { stage: 'Jahit', status: 'pending' }] },
    { id: 'job-2', order_number: 'PROD/2026/0048', product_id: 'p3', product_name: 'Matras 50x30', variant: 'Merah', qty: 5, department_id: 'dept-konveksi', status: 'ongoing', current_stage: 'Jahit', created_at: iso(9, 10), stages: [{ stage: 'Potong', status: 'completed' }, { stage: 'Jahit', status: 'ongoing' }] },
    { id: 'job-3', order_number: 'PROD/2026/0050', product_id: 'p4', product_name: 'Deker Tinju', variant: 'Hitam', qty: 12, department_id: 'dept-eva-foam', status: 'ongoing', current_stage: 'Cetak', created_at: iso(1, 11), stages: [{ stage: 'Campur Bahan', status: 'completed' }, { stage: 'Cetak', status: 'ongoing' }] },
  ]));
  localStorage.setItem('nxty_raw_materials', JSON.stringify([
    { id: 'mat-1', name: 'Kain Milena Biru', current_stock: 2, stock_minimum: 10, unit: 'Meter', department_id: 'dept-konveksi' },
    { id: 'mat-2', name: 'Busa Eva 5mm', current_stock: 4, stock_minimum: 8, unit: 'Lembar', department_id: 'dept-eva-foam' },
    { id: 'mat-3', name: 'Benang Putih', current_stock: 24, stock_minimum: 6, unit: 'Roll', department_id: 'dept-konveksi' },
  ]));
  localStorage.setItem('nxty_products', JSON.stringify([
    { id: 'p1', name: 'Setelan Taekwondo', variant: '160', stock: 14, department_id: 'dept-konveksi' },
    { id: 'p2', name: 'Body Taekwondo', variant: 'No.2', stock: 7, department_id: 'dept-konveksi' },
    { id: 'p3', name: 'Matras', variant: '50x30', stock: 22, department_id: 'dept-eva-foam' },
  ]));
  localStorage.setItem('nxty_attendance', JSON.stringify([
    { id: 'a1', employee_id: 'emp-asep', timestamp: iso(0, 7), type_scan: 'masuk', late_minutes: 0, verification_method: 'gps_self' },
    { id: 'a2', employee_id: 'emp-budi', timestamp: iso(0, 7), type_scan: 'masuk', late_minutes: 0, verification_method: 'gps_self' },
    { id: 'a3', employee_id: 'emp-siti', timestamp: iso(0, 8), type_scan: 'masuk', late_minutes: 35, verification_method: 'gps_self' },
    { id: 'a4', employee_id: 'emp-dewi', timestamp: iso(0, 7), type_scan: 'masuk', late_minutes: 0, verification_method: 'admin_qr' },
  ]));
  localStorage.setItem('nxty_payroll_weekly', JSON.stringify([
    { id: 'pay1', employee_id: 'emp-asep', period_start: hari[5], period_end: t, total_pay: 900000 },
  ]));
  localStorage.setItem('nxty_cash_advances', JSON.stringify([
    { id: 'ca1', employee_id: 'emp-budi', remaining_balance: 750000 },
    { id: 'ca2', employee_id: 'emp-siti', remaining_balance: 400000 },
  ]));
};

const seedKosong = () => {
const wib = (offsetDays = 0) => new Date(Date.now() - offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const iso = (offsetDays = 0, hour = 8) => { const d = new Date(Date.now() - offsetDays * 86400000); d.setUTCHours(hour - 7, 5, 0, 0); return d.toISOString(); };

  const t = wib(0);
  localStorage.setItem('nxty_session', JSON.stringify({ role: 'owner', name: 'H. Ari Gunawan', employeeId: 'emp-owner' }));
  localStorage.setItem('nxty_orders', JSON.stringify([]));
  localStorage.setItem('nxty_marketplace_item_sales', JSON.stringify([]));
  localStorage.setItem('nxty_marketplace_sales', JSON.stringify([]));
  localStorage.setItem('nxty_daily_expenses', JSON.stringify([]));
  localStorage.setItem('nxty_purchases', JSON.stringify([]));
  localStorage.setItem('nxty_production_jobs', JSON.stringify([]));
  localStorage.setItem('nxty_raw_materials', JSON.stringify([]));
  localStorage.setItem('nxty_products', JSON.stringify([]));
  localStorage.setItem('nxty_attendance', JSON.stringify([]));
  localStorage.setItem('nxty_payroll_weekly', JSON.stringify([]));
  localStorage.setItem('nxty_cash_advances', JSON.stringify([]));
  localStorage.setItem('nxty_employees', JSON.stringify([]));
};

const seedSibuk = () => {
const wib = (offsetDays = 0) => new Date(Date.now() - offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const iso = (offsetDays = 0, hour = 8) => { const d = new Date(Date.now() - offsetDays * 86400000); d.setUTCHours(hour - 7, 5, 0, 0); return d.toISOString(); };

  const hari = Array.from({ length: 30 }, (_, i) => wib(i));
  const t = hari[0];
  localStorage.setItem('nxty_session', JSON.stringify({ role: 'owner', name: 'H. Ari Gunawan', employeeId: 'emp-owner' }));
  const orders = [];
  for (let i = 0; i < 8; i++) orders.push({ id: `op${i}`, order_number: `ORD/2026/090${i}`, customer_name: `Pelanggan ${i + 1}`, date: t, status: 'pending', total: 1000000 + i * 250000, items: [{ id: 'i', product_id: 'p1', product_name: 'Setelan', qty: 4, price: 300000, subtotal: 1200000 }], source: 'online', marketplace_name: ['Shopee', 'Tokopedia', 'TikTok'][i % 3] });
  for (let i = 0; i < 6; i++) orders.push({ id: `oq${i}`, order_number: `ORD/2026/089${i}`, customer_name: `Pelanggan ${i + 9}`, date: hari[1], status: 'production', total: 800000, items: [{ id: 'i', product_id: 'p2', product_name: 'Body', qty: 2, price: 400000, subtotal: 800000 }], source: 'offline' });
  localStorage.setItem('nxty_orders', JSON.stringify(orders));
  const items = [];
  for (let d = 0; d < 14; d++) {
    for (let i = 0; i < 8; i++) {
      items.push({ id: `mi${d}-${i}`, date: hari[d], marketplace_ref: ['Shopee', 'Tokopedia', 'TikTok', 'Lainnya'][i % 4], description: ['Body', 'Matras', 'Deker', 'Sarung Tinju'][i % 4] + ` #${i + 1}`, qty: 2 + (i % 3), total: 350000 + (i * 60000) + (d * 100000), admin_fee: 12000 });
    }
  }
  items.forEach((s, i) => items[i] = { ...s, status: 'terkirim', order_number: 'INV/' + s.id, price: Math.round(s.total / s.qty), subtotal: s.total, admin_staff: 'Ari' });
  localStorage.setItem('nxty_marketplace_item_sales', JSON.stringify(items));
  localStorage.setItem('nxty_marketplace_sales', JSON.stringify([]));
  localStorage.setItem('nxty_daily_expenses', JSON.stringify([
    { id: 'ex1', date: t, description: 'Bensin', amount: 85000, category: 'Operasional' },
    { id: 'ex2', date: t, description: 'Konsumsi', amount: 180000, category: 'Operasional' },
    { id: 'ex3', date: t, description: 'Listrik', amount: 450000, category: 'Utilitas' },
  ]));
  localStorage.setItem('nxty_purchases', JSON.stringify([
    { id: 'po1', date: t, status: 'dipesan', total_price: 3500000, supplier_name: 'Toko Kain Jaya', items_note: 'Kain Milena 50m + Benang' },
    { id: 'po2', date: hari[1], status: 'dipesan', total_price: 1800000, supplier_name: 'Busa Sentral', items_note: 'Busa Eva 5mm 30 lbr' },
  ]));
  localStorage.setItem('nxty_production_jobs', JSON.stringify([
    { id: 'j1', order_number: 'PROD/2026/0060', product_id: 'p1', product_name: 'Setelan', variant: '160', qty: 12, department_id: 'dept-konveksi', status: 'ongoing', current_stage: 'Potong', created_at: iso(0, 8), stages: [{ stage: 'Potong', status: 'ongoing' }, { stage: 'Jahit', status: 'pending' }] },
    { id: 'j2', order_number: 'PROD/2026/0059', product_id: 'p1', product_name: 'Setelan', variant: '170', qty: 8, department_id: 'dept-konveksi', status: 'ongoing', current_stage: 'Potong', created_at: iso(0, 8), stages: [{ stage: 'Potong', status: 'ongoing' }, { stage: 'Jahit', status: 'pending' }] },
    { id: 'j3', order_number: 'PROD/2026/0050', product_id: 'p2', product_name: 'Body', variant: 'No.2', qty: 12, department_id: 'dept-konveksi', status: 'ongoing', current_stage: 'Jahit', created_at: iso(8, 10), stages: [{ stage: 'Potong', status: 'completed' }, { stage: 'Jahit', status: 'ongoing' }] },
    { id: 'j4', order_number: 'PROD/2026/0048', product_id: 'p3', product_name: 'Matras', variant: 'Merah', qty: 5, department_id: 'dept-konveksi', status: 'ongoing', current_stage: 'Jahit', created_at: iso(10, 10), stages: [{ stage: 'Potong', status: 'completed' }, { stage: 'Jahit', status: 'ongoing' }] },
    { id: 'j5', order_number: 'PROD/2026/0040', product_id: 'p4', product_name: 'Deker', variant: 'Hitam', qty: 12, department_id: 'dept-eva-foam', status: 'ongoing', current_stage: 'Cetak', created_at: iso(1, 11), stages: [{ stage: 'Campur Bahan', status: 'completed' }, { stage: 'Cetak', status: 'ongoing' }] },
    { id: 'j6', order_number: 'PROD/2026/0038', product_id: 'p3', product_name: 'Matras', variant: 'Biru', qty: 6, department_id: 'dept-eva-foam', status: 'ongoing', current_stage: 'Finishing', created_at: iso(12, 9), stages: [{ stage: 'Campur Bahan', status: 'completed' }, { stage: 'Cetak', status: 'completed' }, { stage: 'Finishing', status: 'ongoing' }] },
  ]));
  localStorage.setItem('nxty_raw_materials', JSON.stringify([
    { id: 'mat-1', name: 'Kain Milena Biru', current_stock: 2, stock_minimum: 10, unit: 'Meter', department_id: 'dept-konveksi' },
    { id: 'mat-2', name: 'Busa Eva 5mm', current_stock: 4, stock_minimum: 8, unit: 'Lembar', department_id: 'dept-eva-foam' },
    { id: 'mat-3', name: 'Benang Putih', current_stock: 24, stock_minimum: 6, unit: 'Roll', department_id: 'dept-konveksi' },
    { id: 'mat-4', name: 'Lem EVA', current_stock: 1, stock_minimum: 5, unit: 'Kaleng', department_id: 'dept-eva-foam' },
  ]));
  localStorage.setItem('nxty_products', JSON.stringify([
    { id: 'p1', name: 'Setelan Taekwondo', variant: '160', stock: 14, department_id: 'dept-konveksi' },
    { id: 'p2', name: 'Body Taekwondo', variant: 'No.2', stock: 7, department_id: 'dept-konveksi' },
    { id: 'p3', name: 'Matras', variant: '50x30', stock: 22, department_id: 'dept-eva-foam' },
  ]));
  localStorage.setItem('nxty_attendance', JSON.stringify([
    { id: 'a1', employee_id: 'emp-asep', timestamp: iso(0, 7), type_scan: 'masuk', late_minutes: 0, verification_method: 'gps_self' },
    { id: 'a2', employee_id: 'emp-budi', timestamp: iso(0, 7), type_scan: 'masuk', late_minutes: 0, verification_method: 'gps_self' },
    { id: 'a3', employee_id: 'emp-siti', timestamp: iso(0, 8), type_scan: 'masuk', late_minutes: 45, verification_method: 'gps_self' },
    { id: 'a4', employee_id: 'emp-dewi', timestamp: iso(0, 7), type_scan: 'masuk', late_minutes: 0, verification_method: 'admin_qr' },
    { id: 'a5', employee_id: 'emp-asep', timestamp: iso(0, 17), type_scan: 'pulang', late_minutes: 0, verification_method: 'gps_self' },
    { id: 'a6', employee_id: 'emp-budi', timestamp: iso(0, 17), type_scan: 'pulang', late_minutes: 0, verification_method: 'gps_self' },
  ]));
  localStorage.setItem('nxty_payroll_weekly', JSON.stringify([
    { id: 'pay1', employee_id: 'emp-asep', period_start: hari[5], period_end: t, total_pay: 900000 },
    { id: 'pay2', employee_id: 'emp-budi', period_start: hari[5], period_end: t, total_pay: 880000 },
  ]));
  localStorage.setItem('nxty_cash_advances', JSON.stringify([
    { id: 'ca1', employee_id: 'emp-budi', remaining_balance: 750000 },
    { id: 'ca2', employee_id: 'emp-siti', remaining_balance: 400000 },
    { id: 'ca3', employee_id: 'emp-dewi', remaining_balance: 200000 },
  ]));
};

async function shot(name, viewportOpts, seedFn) {
  const ctx = await browser.newContext(viewportOpts);
  await ctx.addInitScript(seedFn);
  await ctx.route('**/*', r => new URL(r.request().url()).host.endsWith('supabase.co') ? r.abort() : r.fallback());
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 200)));
  await page.goto('http://localhost:3100/');
  try {
    await page.getByText('Penjualan Hari Ini').waitFor({ timeout: 15000 });
  } catch {
    console.log('DEBUG BODY:', JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 300)));
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/ui-audit/${name}.png`, fullPage: true });
  console.log('saved', name);
  await ctx.close();
}

await shot('desktop-moderat', { viewport: { width: 1440, height: 2600 } }, seedModerat);
await shot('desktop-kosong', { viewport: { width: 1440, height: 2000 } }, seedKosong);
await shot('desktop-sibuk', { viewport: { width: 1440, height: 3200 } }, seedSibuk);
await shot('mobile-moderat', { viewport: { width: 393, height: 4200 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, seedModerat);
await shot('mobile-kosong', { viewport: { width: 393, height: 3000 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, seedKosong);
await shot('mobile-sibuk', { viewport: { width: 393, height: 4800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, seedSibuk);
await browser.close();
