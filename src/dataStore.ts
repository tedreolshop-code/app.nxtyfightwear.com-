import { 
  Department, 
  Employee, 
  Product, 
  RawMaterial, 
  StockMovement, 
  ProductionLog, 
  Attendance, 
  CashAdvance, 
  PayrollWeekly, 
  Customer, 
  Invoice, 
  DeliveryNote, 
  Return, 
  MarketplaceSale, 
  MarketplaceItemSale,
  Purchase, 
  DailyExpense, 
  NotificationLog, 
  PrinterCalibration,
  Order,
  ProductionJob,
  Asset
} from './types';
import { pushKeyToCloud } from './cloudSync';

// Helper to generate UUIDs
const uuid = () => Math.random().toString(36).substring(2, 11);

// Simulated 1-way hashing function for PIN security
export const hashPin = (pin: string): string => {
  if (!pin) return '';
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    h = (h << 5) - h + pin.charCodeAt(i);
    h |= 0;
  }
  return `sha256_sim_${Math.abs(h)}`;
};

// Resep produksi (BOM): product_id -> kebutuhan bahan baku per unit.
// Dipakai untuk memotong stok bahan baku otomatis saat order masuk produksi.
export const RECIPES: Record<string, Array<{ material_id: string; qtyPerUnit: number }>> = {
  'prod-matras-2cm': [
    { material_id: 'mat-foam-2cm', qtyPerUnit: 1.0 }
  ],
  'prod-matras-3cm': [
    { material_id: 'mat-foam-3cm', qtyPerUnit: 1.0 }
  ],
  'prod-pelampung-anak': [
    { material_id: 'mat-foam-2cm', qtyPerUnit: 0.25 }
  ],
  'prod-samsak-120': [
    { material_id: 'mat-leather-pu', qtyPerUnit: 3.0 },
    { material_id: 'mat-dakron', qtyPerUnit: 5.0 }
  ],
  'prod-body-protector': [
    { material_id: 'mat-fabric-nylon', qtyPerUnit: 1.5 },
    { material_id: 'mat-dakron', qtyPerUnit: 1.0 }
  ]
};

// Standard GPS coordinates for ARI SPORTINDO HQ in Bandung, Indonesia
const COORDS = {
  eva_foam: { lat: -6.914744, lng: 107.609810 },
  konveksi: { lat: -6.915800, lng: 107.610500 },
};

const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'dept-eva-foam', name: 'Eva Foam', latitude: COORDS.eva_foam.lat, longitude: COORDS.eva_foam.lng },
  { id: 'dept-konveksi', name: 'Departemen Konveksi', latitude: COORDS.konveksi.lat, longitude: COORDS.konveksi.lng },
];

// Setiap orang punya satu akun login (nama + PIN). Field access_role menentukan
// menu yang terbuka: owner / admin_penjualan (Admin) / admin_gudang (Gudang & Produksi) / kosong = karyawan.
// GANTI PIN default di bawah sebelum dipakai produksi.
const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', department_id: 'dept-eva-foam', role: 'leader', rate_harian: 0, rate_lembur_per_jam: 0, status_aktif: true, phone_number: '081200000001', pin: hashPin('2026'), pin_hashed: true, access_role: 'owner' },
  { id: 'emp-siti', username: 'siti', name: 'Siti Rahma', department_id: 'dept-eva-foam', role: 'leader', rate_harian: 180000, rate_lembur_per_jam: 25000, status_aktif: true, phone_number: '081234567891', pin: hashPin('4321'), pin_hashed: true, access_role: 'admin_penjualan' },
  { id: 'emp-dewi', username: 'dewi', name: 'Dewi Lestari', department_id: 'dept-konveksi', role: 'leader', rate_harian: 175000, rate_lembur_per_jam: 22000, status_aktif: true, phone_number: '087899008877', pin: hashPin('8765'), pin_hashed: true, access_role: 'admin_gudang' },
  { id: 'emp-asep', username: 'asep', name: 'Asep Saputra', department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 150000, rate_lembur_per_jam: 20000, status_aktif: true, phone_number: '081234567890', pin: hashPin('1234'), pin_hashed: true },
  { id: 'emp-budi', username: 'budi', name: 'Budi Hartono', department_id: 'dept-konveksi', role: 'karyawan', rate_harian: 140000, rate_lembur_per_jam: 18000, status_aktif: true, phone_number: '085711223344', pin: hashPin('5678'), pin_hashed: true },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-1',
    order_number: 'ORD/2026/06/001',
    customer_name: 'Dojo Garuda Bandung',
    customer_phone: '08122334455',
    source: 'offline',
    date: '2026-06-28',
    total: 3300000,
    status: 'production',
    notes: 'Matras beladiri 2cm merah-biru custom logo Dojo',
    items: [
      { id: uuid(), product_id: 'prod-matras-2cm', product_name: 'Matras Beladiri Eva Foam 2cm', variant: 'Merah-Biru', qty: 20, price: 165000, subtotal: 3300000 }
    ]
  },
  {
    id: 'ord-2',
    order_number: 'ORD/2026/06/002',
    customer_name: 'Dwi Saputro',
    customer_phone: '08775566332',
    source: 'online',
    marketplace_name: 'Shopee',
    date: '2026-06-29',
    total: 1050000,
    status: 'pending',
    notes: 'Samsak premium 120cm',
    items: [
      { id: uuid(), product_id: 'prod-samsak-120', product_name: 'Samsak Gantung 120cm', variant: 'Premium Hitam', qty: 3, price: 350000, subtotal: 1050000 }
    ]
  }
];

const INITIAL_PRODUCTION_JOBS: ProductionJob[] = [
  {
    id: 'job-1',
    order_id: 'ord-1',
    order_number: 'ORD/2026/06/001',
    product_id: 'prod-matras-2cm',
    product_name: 'Matras Beladiri Eva Foam 2cm',
    variant: 'Merah-Biru',
    qty: 20,
    department_id: 'dept-eva-foam',
    status: 'ongoing',
    current_stage: 'Molding',
    created_at: '2026-06-28T09:00:00.000Z',
    stages: [
      { stage: 'Formulation', status: 'completed', updated_at: '2026-06-28T10:00:00.000Z', updated_by: 'Siti Rahma', notes: 'Bahan EVA Foam grade A dicampur rata' },
      { stage: 'Molding', status: 'ongoing', updated_at: '2026-06-28T11:00:00.000Z', updated_by: 'Asep Saputra', notes: 'Proses pengepresan panas matras' },
      { stage: 'Cutting', status: 'pending' },
      { stage: 'Finishing', status: 'pending' }
    ]
  },
  {
    id: 'job-2',
    order_id: 'ord-2',
    order_number: 'ORD/2026/06/002',
    product_id: 'prod-samsak-120',
    product_name: 'Samsak Gantung 120cm',
    variant: 'Premium Hitam',
    qty: 3,
    department_id: 'dept-konveksi',
    status: 'pending',
    current_stage: 'Cutting',
    created_at: '2026-06-29T14:30:00.000Z',
    stages: [
      { stage: 'Cutting', status: 'ongoing', updated_at: '2026-06-29T15:00:00.000Z', updated_by: 'Budi Hartono', notes: 'Pemotongan bahan Cordura heavy duty' },
      { stage: 'Sablon', status: 'pending' },
      { stage: 'Jahit', status: 'pending' },
      { stage: 'Finishing', status: 'pending' }
    ]
  }
];

const INITIAL_ASSETS: Asset[] = [
  {
    id: 'ast-1',
    name: 'Mesin Press Eva Foam Hidrolik',
    category: 'Mesin Berat',
    department_id: 'dept-eva-foam',
    department_name: 'Eva Foam',
    purchase_date: '2025-01-10',
    cost: 45000000,
    status: 'baik',
    notes: 'Kapasitas press 50 ton, perawatan rutin bulanan'
  },
  {
    id: 'ast-2',
    name: 'Mesin Potong Foam Presisi',
    category: 'Peralatan Potong',
    department_id: 'dept-eva-foam',
    department_name: 'Eva Foam',
    purchase_date: '2025-03-15',
    cost: 18500000,
    status: 'baik',
    notes: 'Mata pisau diganti per 6 bulan'
  },
  {
    id: 'ast-3',
    name: 'Mesin Jahit High Speed Juki',
    category: 'Mesin Jahit',
    department_id: 'dept-konveksi',
    department_name: 'Departemen Konveksi',
    purchase_date: '2024-11-20',
    cost: 8500000,
    status: 'baik',
    notes: 'Digunakan Budi, performa sangat lancar'
  },
  {
    id: 'ast-4',
    name: 'Meja Sablon Rel Panjang Presisi',
    category: 'Peralatan Sablon',
    department_id: 'dept-konveksi',
    department_name: 'Departemen Konveksi',
    purchase_date: '2025-02-05',
    cost: 12000000,
    status: 'diservis',
    notes: 'Perbaikan rel geser sablon presisi sedikit macet'
  }
];

const INITIAL_PRODUCTS: Product[] = [
  { id: 'prod-matras-2cm', department_id: 'dept-eva-foam', name: 'Matras Beladiri Eva Foam 2cm', category: 'Matras', variant: 'Merah-Biru', harga_jual: 165000, stock: 85 },
  { id: 'prod-matras-3cm', department_id: 'dept-eva-foam', name: 'Matras Beladiri Eva Foam 3cm', category: 'Matras', variant: 'Hitam', harga_jual: 210000, stock: 42 },
  { id: 'prod-pelampung-anak', department_id: 'dept-eva-foam', name: 'Pelampung Anak Ring', category: 'Pelampung', variant: 'Kuning', harga_jual: 75000, stock: 12 },
  { id: 'prod-samsak-120', department_id: 'dept-konveksi', name: 'Samsak Gantung 120cm', category: 'Apparel', variant: 'Premium Hitam', harga_jual: 350000, stock: 15 },
  { id: 'prod-body-protector', department_id: 'dept-konveksi', name: 'Body Protector Pencak Silat', category: 'Pelindung', variant: 'Size L', harga_jual: 185000, stock: 6 },
];

const INITIAL_RAW_MATERIALS: RawMaterial[] = [
  { id: 'mat-foam-2cm', name: 'Eva Foam Sheet 2cm Raw', unit: 'Lembar', stock_minimum: 100, current_stock: 250 },
  { id: 'mat-foam-3cm', name: 'Eva Foam Sheet 3cm Raw', unit: 'Lembar', stock_minimum: 80, current_stock: 35 }, // Below threshold!
  { id: 'mat-fabric-nylon', name: 'Nylon Fabric Heavy', unit: 'Meter', stock_minimum: 200, current_stock: 450 },
  { id: 'mat-leather-pu', name: 'Synthetic Leather (PU)', unit: 'Meter', stock_minimum: 150, current_stock: 180 },
  { id: 'mat-dakron', name: 'Isian Dakron/Busa', unit: 'Kg', stock_minimum: 50, current_stock: 40 }, // Below threshold!
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'cust-dojo', name: 'Dojo Garuda Bandung', address: 'Jl. Sukajadi No. 123, Bandung', contact: '08123456789' },
  { id: 'cust-sasana', name: 'Sasana Muay Thai Jakarta', address: 'Kawasan PIK Ruko No. 4, Jakarta Utara', contact: '08198765432' },
  { id: 'cust-persatuan', name: 'Persatuan Silat Surabaya', address: 'Komp. Olahraga Kertajaya Indah, Surabaya', contact: '08571122334' },
];

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  { id: uuid(), type: 'bahan_masuk', item_id: 'mat-foam-2cm', item_name: 'Eva Foam Sheet 2cm Raw', amount: 300, reference: 'Pembelian #P-001', created_at: `${threeDaysAgo}T09:00:00.000Z` },
  { id: uuid(), type: 'bahan_keluar', item_id: 'mat-foam-2cm', item_name: 'Eva Foam Sheet 2cm Raw', amount: 50, reference: 'Produksi #PR-001', created_at: `${yesterday}T10:15:00.000Z` },
  { id: uuid(), type: 'barang_jadi_masuk', item_id: 'prod-matras-2cm', item_name: 'Matras Beladiri Eva Foam 2cm', amount: 50, reference: 'Produksi #PR-001', created_at: `${yesterday}T16:45:00.000Z` },
  { id: uuid(), type: 'barang_jadi_keluar', item_id: 'prod-matras-2cm', item_name: 'Matras Beladiri Eva Foam 2cm', amount: 15, reference: 'Invoice #INV-26001', created_at: `${today}T11:30:00.000Z` },
];

const INITIAL_PRODUCTION_LOGS: ProductionLog[] = [
  {
    id: 'pr-001',
    department_id: 'dept-eva-foam',
    product_id: 'prod-matras-2cm',
    product_name: 'Matras Beladiri Eva Foam 2cm',
    qty_produced: 50,
    materials_used: [
      { material_id: 'mat-foam-2cm', material_name: 'Eva Foam Sheet 2cm Raw', qty: 50 }
    ],
    date: yesterday
  }
];

const INITIAL_ATTENDANCE: Attendance[] = [
  {
    id: uuid(),
    employee_id: 'emp-asep',
    employee_name: 'Asep Saputra',
    timestamp: `${yesterday}T07:15:22.000Z`,
    type_scan: 'masuk',
    latitude: -6.914740,
    longitude: 107.609820,
    distance_meters: 1.5,
    selfie_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    device_token: 'dev-token-asep-123',
    is_mock_location_flag: false,
    status: 'normal',
    note: 'Tepat waktu'
  },
  {
    id: uuid(),
    employee_id: 'emp-asep',
    employee_name: 'Asep Saputra',
    timestamp: `${yesterday}T16:02:44.000Z`,
    type_scan: 'pulang',
    latitude: -6.914750,
    longitude: 107.609800,
    distance_meters: 2.1,
    selfie_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    device_token: 'dev-token-asep-123',
    is_mock_location_flag: false,
    status: 'normal',
    note: 'Pulang kerja reguler'
  },
  {
    id: uuid(),
    employee_id: 'emp-budi',
    employee_name: 'Budi Hartono',
    timestamp: `${yesterday}T08:45:10.000Z`,
    type_scan: 'masuk',
    latitude: -6.918900, // Outside radius
    longitude: 107.615200,
    distance_meters: 610.5,
    selfie_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    device_token: 'dev-token-budi-999',
    is_mock_location_flag: false,
    status: 'anomaly',
    note: 'Absen di luar radius (~610m dari Konveksi)'
  }
];

const INITIAL_CASH_ADVANCES: CashAdvance[] = [
  { id: uuid(), employee_id: 'emp-asep', employee_name: 'Asep Saputra', amount: 150000, date: threeDaysAgo, remaining_balance: 100000 }
];

const INITIAL_PAYROLL_WEEKLY: PayrollWeekly[] = [
  {
    id: uuid(),
    employee_id: 'emp-asep',
    employee_name: 'Asep Saputra',
    period_start: '2026-06-22',
    period_end: '2026-06-28',
    days_worked: 6,
    overtime_hours: 4,
    base_pay: 900000, // 6 x 150.000
    bonus: 50000,
    cash_advance_deduction: 50000,
    total_pay: 930000, // 900k + (4 * 20k = 80k) + 50k - 50k
    is_printed: true
  }
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    customer_id: 'cust-dojo',
    customer_name: 'Dojo Garuda Bandung',
    invoice_number: 'INV/2026/06/001',
    date: `${yesterday}`,
    due_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    items: [
      { id: uuid(), product_id: 'prod-matras-2cm', product_name: 'Matras Beladiri Eva Foam 2cm', variant: 'Merah-Biru', qty: 15, price: 165000, subtotal: 2475000 }
    ],
    subtotal: 2475000,
    dp: 500000,
    tax: 247500, // 10%
    total: 2222500, // 2,475,000 + 247,500 - 500,000
    payment_status: 'belum_lunas'
  },
  {
    id: 'inv-2',
    customer_id: 'cust-sasana',
    customer_name: 'Sasana Muay Thai Jakarta',
    invoice_number: 'INV/2026/06/002',
    date: threeDaysAgo,
    due_date: `${yesterday}`,
    items: [
      { id: uuid(), product_id: 'prod-samsak-120', product_name: 'Samsak Gantung 120cm', variant: 'Premium Hitam', qty: 2, price: 350000, subtotal: 700000 }
    ],
    subtotal: 700000,
    dp: 0,
    tax: 0,
    total: 700000,
    payment_status: 'lunas'
  }
];

const INITIAL_DELIVERY_NOTES: DeliveryNote[] = [
  {
    id: 'sj-1',
    customer_id: 'cust-dojo',
    customer_name: 'Dojo Garuda Bandung',
    delivery_number: 'SJ/2026/06/001',
    date: `${yesterday}`,
    expedition: 'JNE Trucking (JTR)',
    items: [
      { product_id: 'prod-matras-2cm', product_name: 'Matras Beladiri Eva Foam 2cm', variant: 'Merah-Biru', qty: 15 }
    ],
    status: 'dikirim'
  }
];

const INITIAL_RETURNS: Return[] = [
  {
    id: uuid(),
    invoice_id: 'inv-1',
    invoice_number: 'INV/2026/06/001',
    date: today,
    reason: 'Satu matras ada cacat permukaan foam di sudut kiri atas',
    product_id: 'prod-matras-2cm',
    product_name: 'Matras Beladiri Eva Foam 2cm',
    qty: 1
  }
];

const INITIAL_MARKETPLACE_SALES: MarketplaceSale[] = [
  { id: uuid(), channel: 'tokopedia', date: yesterday, order_count: 14, revenue: 1540000, admin_name: 'Admin Online Siska' },
  { id: uuid(), channel: 'shopee', date: yesterday, order_count: 22, revenue: 2150000, admin_name: 'Admin Online Siska' },
  { id: uuid(), channel: 'tiktok', date: yesterday, order_count: 8, revenue: 980000, admin_name: 'Admin Online Siska' },
  { id: uuid(), channel: 'tokopedia', date: today, order_count: 18, revenue: 2240000, admin_name: 'Admin Online Siska' },
  { id: uuid(), channel: 'shopee', date: today, order_count: 25, revenue: 2780000, admin_name: 'Admin Online Siska' }
];

const INITIAL_MARKETPLACE_ITEM_SALES: MarketplaceItemSale[] = [
  { id: uuid(), date: today, order_number: '583776129442416403', marketplace_ref: 'Tokopedia', description: 'Pecing pad 50x30 rosegold', qty: 1, price: 120000, subtotal: 120000, admin_fee: 25850, total: 94150, admin_staff: 'Admin Online Siska' },
  { id: uuid(), date: today, order_number: '583789590635578944', marketplace_ref: 'Shopee', description: 'Pelampung berenang anak', qty: 1, price: 19900, subtotal: 19900, admin_fee: 5330, total: 14570, admin_staff: 'Admin Online Siska' },
  { id: uuid(), date: today, order_number: '583774569685157446', marketplace_ref: 'TikTok Shop', description: 'Body taekwondo No. 1', qty: 1, price: 110000, subtotal: 110000, admin_fee: 34800, total: 75200, admin_staff: 'Admin Online Siska' },
  { id: uuid(), date: yesterday, order_number: '583780696599725207', marketplace_ref: 'Tokopedia', description: 'Deker tangan putih M', qty: 1, price: 45000, subtotal: 45000, admin_fee: 0, total: 45000, admin_staff: 'Admin Online Siska' },
  { id: uuid(), date: yesterday, order_number: '583773892121429096', marketplace_ref: 'Shopee', description: 'Deker kaki putih M', qty: 1, price: 50000, subtotal: 50000, admin_fee: 0, total: 50000, admin_staff: 'Admin Online Siska' },
  { id: uuid(), date: yesterday, order_number: '583775555425698874', marketplace_ref: 'TikTok Shop', description: 'Gentle cup putih M', qty: 1, price: 55000, subtotal: 55000, admin_fee: 0, total: 55000, admin_staff: 'Admin Online Siska' },
  { id: uuid(), date: yesterday, order_number: '583790874127140854', marketplace_ref: 'Tokopedia', description: 'Body taekwondo No. 2', qty: 1, price: 110000, subtotal: 110000, admin_fee: 59905, total: 50095, admin_staff: 'Admin Online Siska' },
  { id: uuid(), date: yesterday, order_number: '583802843230799026', marketplace_ref: 'Shopee', description: 'Body taekwondo No. 3', qty: 1, price: 110000, subtotal: 110000, admin_fee: 34100, total: 75900, admin_staff: 'Admin Online Siska' }
];

const INITIAL_PURCHASES: Purchase[] = [
  {
    id: uuid(),
    po_number: '08/TA/14/26',
    supplier: 'Toko anyar',
    date: '2026-06-08',
    status: 'completed',
    total_price: 6688000,
    admin_staff: 'Dewi Lestari',
    items: [
      { id: uuid(), description: 'Liverpool hitam', qty: 1, price: 1475000, subtotal: 1475000 },
      { id: uuid(), description: 'Liverpool biru', qty: 10, price: 60000, subtotal: 600000 },
      { id: uuid(), description: 'Liverpool merah', qty: 10, price: 60000, subtotal: 600000 },
      { id: uuid(), description: 'Jersy hitam', qty: 2, price: 815000, subtotal: 1630000 },
      { id: uuid(), description: 'Lem', qty: 4, price: 347000, subtotal: 1388000 },
      { id: uuid(), description: 'Condura', qty: 1, price: 995000, subtotal: 995000 }
    ]
  },
  {
    id: uuid(),
    po_number: '08/TN/10/26',
    supplier: 'Toko nasional',
    date: '2026-06-12',
    status: 'completed',
    total_price: 3450000,
    admin_staff: 'Siti Rahma',
    items: [
      { id: uuid(), description: 'Eva Foam Sheet 2cm Raw', qty: 50, price: 45000, subtotal: 2250000, material_id: 'mat-foam-2cm' },
      { id: uuid(), description: 'Resleting YKK Jumbo', qty: 100, price: 12000, subtotal: 1200000 }
    ]
  },
  {
    id: uuid(),
    po_number: '06/SB/04/26',
    supplier: 'PT Sumber Busaindo',
    date: threeDaysAgo,
    status: 'completed',
    total_price: 4500000,
    admin_staff: 'Dewi Lestari',
    items: [
      { id: uuid(), description: 'Eva Foam Sheet 2cm Raw', qty: 100, price: 45000, subtotal: 4500000, material_id: 'mat-foam-2cm' }
    ]
  }
];

const INITIAL_DAILY_EXPENSES: DailyExpense[] = [
  { id: uuid(), date: '2026-06-05', category: 'Lain-lain / Overhead', description: 'Fitting pipa Maspion & aksesoris', amount: 90000, admin_name: 'Dewi Lestari', qty: 3, price: 30000 },
  { id: uuid(), date: '2026-06-08', category: 'Perbaikan & Maintenance', description: 'Kipas angin dinding Maspion', amount: 256000, admin_name: 'Dewi Lestari', qty: 2, price: 128000 },
  { id: uuid(), date: '2026-06-15', category: 'Lain-lain / Overhead', description: 'Galon Air mineral kantor', amount: 63000, admin_name: 'Siti Rahma', qty: 3, price: 21000 },
  { id: uuid(), date: '2026-06-15', category: 'Biaya Transportasi & BBM', description: 'Bensin kurir pengiriman barang', amount: 200000, admin_name: 'Siti Rahma', qty: 10, price: 20000 },
  { id: uuid(), date: '2026-06-16', category: 'Lain-lain / Overhead', description: 'Tali rapia pengikat packing', amount: 40000, admin_name: 'Dewi Lestari', qty: 2, price: 20000 },
  { id: uuid(), date: '2026-06-18', category: 'Lain-lain / Overhead', description: 'Tali rapia pengikat packing jumbo', amount: 40000, admin_name: 'Siti Rahma', qty: 2, price: 20000 }
];

const INITIAL_NOTIFICATIONS: NotificationLog[] = [
  {
    id: uuid(),
    type: 'attendance_anomaly',
    message: 'Absensi anomali: Karyawan Budi Hartono absen masuk di luar radius kantor (~610m dari Departemen Konveksi)',
    target_role: 'owner',
    is_read: false,
    created_at: `${yesterday}T08:45:15.000Z`
  },
  {
    id: uuid(),
    type: 'low_stock',
    message: 'Stok kritis: Eva Foam Sheet 3cm Raw tersisa 35 Lembar (Batas minimum: 80 Lembar)',
    target_role: 'admin_gudang',
    is_read: false,
    created_at: `${yesterday}T12:00:00.000Z`
  }
];

const INITIAL_CALIBRATION: PrinterCalibration = {
  offset_x: 0,
  offset_y: 0
};

// Main DataStore wrapper class to synchronize with LocalStorage
class DataStore {
  private get<T>(key: string, initial: T): T {
    try {
      const stored = localStorage.getItem(`nxty_${key}`);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  }

  private set<T>(key: string, data: T): void {
    try {
      localStorage.setItem(`nxty_${key}`, JSON.stringify(data));
      // Dispatch a storage event so components can listen to changes in real-time
      window.dispatchEvent(new Event('nxty_storage_change'));
      // Sinkron ke Supabase bila dikonfigurasi (no-op saat offline / saat menerapkan data dari cloud)
      pushKeyToCloud(key, data);
    } catch (e) {
      console.error('Failed to write to localStorage', e);
    }
  }

  getDepartments = (): Department[] => this.get('departments', INITIAL_DEPARTMENTS);
  setDepartments = (data: Department[]) => this.set('departments', data);

  getEmployees = (): Employee[] => {
    let employees = this.get('employees', INITIAL_EMPLOYEES);
    let migrated = false;

    // Migrasi: data lama (sebelum sistem akses per karyawan) tidak punya akun owner —
    // pastikan selalu ada minimal satu akun owner agar tidak terkunci dari sistem.
    if (!employees.some(e => e.access_role === 'owner' && e.status_aktif)) {
      const ownerSeed = INITIAL_EMPLOYEES.find(e => e.access_role === 'owner')!;
      employees = [ownerSeed, ...employees.filter(e => e.id !== ownerSeed.id)];
      migrated = true;
    }

    // Migrasi: isi username yang kosong dari kata pertama nama (huruf kecil, unik)
    const taken = new Set(employees.map(e => e.username).filter(Boolean) as string[]);
    employees = employees.map(e => {
      if (e.username) return e;
      const base = (e.name.split(' ')[0] || 'user').toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
      let candidate = base;
      let i = 2;
      while (taken.has(candidate)) candidate = `${base}${i++}`;
      taken.add(candidate);
      migrated = true;
      return { ...e, username: candidate };
    });

    if (migrated) this.setEmployees(employees);
    return employees;
  };
  setEmployees = (data: Employee[]) => this.set('employees', data);

  getProducts = (): Product[] => this.get('products', INITIAL_PRODUCTS);
  setProducts = (data: Product[]) => this.set('products', data);

  getRawMaterials = (): RawMaterial[] => this.get('raw_materials', INITIAL_RAW_MATERIALS);
  setRawMaterials = (data: RawMaterial[]) => this.set('raw_materials', data);

  getStockMovements = (): StockMovement[] => this.get('stock_movements', INITIAL_STOCK_MOVEMENTS);
  setStockMovements = (data: StockMovement[]) => this.set('stock_movements', data);

  getProductionLogs = (): ProductionLog[] => this.get('production_logs', INITIAL_PRODUCTION_LOGS);
  setProductionLogs = (data: ProductionLog[]) => this.set('production_logs', data);

  getAttendance = (): Attendance[] => this.get('attendance', INITIAL_ATTENDANCE);
  setAttendance = (data: Attendance[]) => this.set('attendance', data);

  getCashAdvances = (): CashAdvance[] => this.get('cash_advances', INITIAL_CASH_ADVANCES);
  setCashAdvances = (data: CashAdvance[]) => this.set('cash_advances', data);

  getPayrollWeekly = (): PayrollWeekly[] => this.get('payroll_weekly', INITIAL_PAYROLL_WEEKLY);
  setPayrollWeekly = (data: PayrollWeekly[]) => this.set('payroll_weekly', data);

  getCustomers = (): Customer[] => this.get('customers', INITIAL_CUSTOMERS);
  setCustomers = (data: Customer[]) => this.set('customers', data);

  getInvoices = (): Invoice[] => this.get('invoices', INITIAL_INVOICES);
  setInvoices = (data: Invoice[]) => this.set('invoices', data);

  getDeliveryNotes = (): DeliveryNote[] => this.get('delivery_notes', INITIAL_DELIVERY_NOTES);
  setDeliveryNotes = (data: DeliveryNote[]) => this.set('delivery_notes', data);

  getReturns = (): Return[] => this.get('returns', INITIAL_RETURNS);
  setReturns = (data: Return[]) => this.set('returns', data);

  getMarketplaceSales = (): MarketplaceSale[] => this.get('marketplace_sales', INITIAL_MARKETPLACE_SALES);
  setMarketplaceSales = (data: MarketplaceSale[]) => this.set('marketplace_sales', data);

  getMarketplaceItemSales = (): MarketplaceItemSale[] => this.get('marketplace_item_sales', INITIAL_MARKETPLACE_ITEM_SALES);
  setMarketplaceItemSales = (data: MarketplaceItemSale[]) => this.set('marketplace_item_sales', data);

  getPurchases = (): Purchase[] => this.get('purchases', INITIAL_PURCHASES);
  setPurchases = (data: Purchase[]) => this.set('purchases', data);

  getDailyExpenses = (): DailyExpense[] => this.get('daily_expenses', INITIAL_DAILY_EXPENSES);
  setDailyExpenses = (data: DailyExpense[]) => this.set('daily_expenses', data);

  getNotifications = (): NotificationLog[] => this.get('notifications', INITIAL_NOTIFICATIONS);
  setNotifications = (data: NotificationLog[]) => this.set('notifications', data);

  getCalibration = (): PrinterCalibration => this.get('calibration', INITIAL_CALIBRATION);
  setCalibration = (data: PrinterCalibration) => this.set('calibration', data);

  getOrders = (): Order[] => this.get('orders', INITIAL_ORDERS);
  setOrders = (data: Order[]) => this.set('orders', data);

  getProductionJobs = (): ProductionJob[] => {
    const jobs = this.get('production_jobs', INITIAL_PRODUCTION_JOBS);
    // Migrasi: ganti nama tahap lama (bahasa Inggris) ke istilah sehari-hari
    const RENAME: Record<string, string> = {
      'Formulation': 'Campur Bahan',
      'Molding': 'Cetak',
      'Cutting': 'Potong',
      'QC': 'Cek Kualitas',
    };
    let changed = false;
    const migrated = jobs.map(job => {
      const needs = job.stages.some(s => RENAME[s.stage]) || RENAME[job.current_stage];
      if (!needs) return job;
      changed = true;
      return {
        ...job,
        current_stage: RENAME[job.current_stage] || job.current_stage,
        stages: job.stages.map(s => ({ ...s, stage: RENAME[s.stage] || s.stage })),
      };
    });
    if (changed) this.setProductionJobs(migrated);
    return migrated;
  };
  setProductionJobs = (data: ProductionJob[]) => this.set('production_jobs', data);

  getAssets = (): Asset[] => this.get('assets', INITIAL_ASSETS);
  setAssets = (data: Asset[]) => this.set('assets', data);

  // Business Transactions
  recordProduction = (
    deptId: string, 
    productId: string, 
    qty: number, 
    materialsUsed: Array<{ material_id: string; qty: number }>
  ): boolean => {
    const products = this.getProducts();
    const materials = this.getRawMaterials();
    const product = products.find(p => p.id === productId);

    if (!product) return false;

    // Verify raw materials stock
    for (const item of materialsUsed) {
      const mat = materials.find(m => m.id === item.material_id);
      if (!mat || mat.current_stock < item.qty) {
        return false; // Insufficient stock
      }
    }

    // Deduct materials & record movements
    const stockMovements = this.getStockMovements();
    const updatedMaterials = materials.map(mat => {
      const used = materialsUsed.find(item => item.material_id === mat.id);
      if (used) {
        stockMovements.push({
          id: uuid(),
          type: 'bahan_keluar',
          item_id: mat.id,
          item_name: mat.name,
          amount: used.qty,
          reference: `Produksi ${product.name}`,
          created_at: new Date().toISOString(),
        });
        
        // Trigger alert if below threshold
        const newStock = mat.current_stock - used.qty;
        if (newStock <= mat.stock_minimum) {
          const notifications = this.getNotifications();
          notifications.unshift({
            id: uuid(),
            type: 'low_stock',
            message: `Stok kritis: ${mat.name} tersisa ${newStock} ${mat.unit} (Batas minimum: ${mat.stock_minimum} ${mat.unit})`,
            target_role: 'admin_gudang',
            is_read: false,
            created_at: new Date().toISOString()
          });
          this.setNotifications(notifications);
        }

        return { ...mat, current_stock: newStock };
      }
      return mat;
    });

    // Add product stock & record movement
    const updatedProducts = products.map(p => {
      if (p.id === productId) {
        stockMovements.push({
          id: uuid(),
          type: 'barang_jadi_masuk',
          item_id: p.id,
          item_name: p.name,
          amount: qty,
          reference: `Produksi Baru`,
          created_at: new Date().toISOString(),
        });
        return { ...p, stock: p.stock + qty };
      }
      return p;
    });

    // Create production log
    const productionLogs = this.getProductionLogs();
    const materialsLogDetails = materialsUsed.map(item => {
      const matObj = materials.find(m => m.id === item.material_id);
      return {
        material_id: item.material_id,
        material_name: matObj ? matObj.name : 'Unknown Material',
        qty: item.qty
      };
    });

    productionLogs.unshift({
      id: `PR-${Date.now().toString().slice(-4)}`,
      department_id: deptId,
      product_id: productId,
      product_name: product.name,
      qty_produced: qty,
      materials_used: materialsLogDetails,
      date: new Date().toISOString().split('T')[0]
    });

    this.setProducts(updatedProducts);
    this.setRawMaterials(updatedMaterials);
    this.setStockMovements(stockMovements);
    this.setProductionLogs(productionLogs);
    return true;
  };

  // Hapus SEMUA data transaksi (pesanan, produksi, penjualan, pembelian, absensi, gaji, dst)
  // untuk memulai pemakaian nyata dengan bersih. Data master (karyawan, produk, bahan baku) dipertahankan.
  clearAllTransactions = (): void => {
    this.setOrders([]);
    this.setProductionJobs([]);
    this.setProductionLogs([]);
    this.setMarketplaceSales([]);
    this.setMarketplaceItemSales([]);
    this.setPurchases([]);
    this.setDailyExpenses([]);
    this.setInvoices([]);
    this.setDeliveryNotes([]);
    this.setReturns([]);
    this.setStockMovements([]);
    this.setAttendance([]);
    this.setPayrollWeekly([]);
    this.setCashAdvances([]);
    this.setNotifications([]);
  };

  // Cek kecukupan bahan untuk seluruh item order sekaligus (kebutuhan bahan yang sama dijumlahkan).
  // Mengembalikan daftar kekurangan; kosong berarti semua cukup. Tidak mengubah stok.
  checkMaterialsForOrder = (items: Array<{ product_id: string; product_name: string; qty: number }>): string[] => {
    const required: Record<string, number> = {};
    for (const item of items) {
      const recipe = RECIPES[item.product_id];
      if (!recipe) continue;
      for (const r of recipe) {
        required[r.material_id] = (required[r.material_id] || 0) + r.qtyPerUnit * item.qty;
      }
    }

    const materials = this.getRawMaterials();
    const shortages: string[] = [];
    for (const [materialId, qtyNeeded] of Object.entries(required)) {
      const mat = materials.find(m => m.id === materialId);
      const available = mat ? mat.current_stock : 0;
      if (available < qtyNeeded) {
        shortages.push(`${mat ? mat.name : materialId}: butuh ${qtyNeeded}${mat ? ` ${mat.unit}` : ''}, tersedia ${available}`);
      }
    }
    return shortages;
  };

  // Potong bahan baku sesuai RECIPES saat produksi dimulai.
  // Mengembalikan false (tanpa perubahan apa pun) bila ada bahan yang kurang.
  consumeMaterialsForProduction = (productId: string, productName: string, qty: number, reference: string): { ok: boolean; shortages: string[] } => {
    const recipe = RECIPES[productId];
    if (!recipe || recipe.length === 0 || qty <= 0) return { ok: true, shortages: [] }; // produk tanpa resep: tidak memotong apa pun

    const materials = this.getRawMaterials();
    const shortages: string[] = [];
    for (const item of recipe) {
      const mat = materials.find(m => m.id === item.material_id);
      const required = item.qtyPerUnit * qty;
      if (!mat || mat.current_stock < required) {
        shortages.push(`${mat ? mat.name : item.material_id}: butuh ${required}${mat ? ` ${mat.unit}` : ''}, tersedia ${mat ? mat.current_stock : 0}`);
      }
    }
    if (shortages.length > 0) return { ok: false, shortages };

    const movements = this.getStockMovements();
    const notifications = this.getNotifications();
    let notifChanged = false;

    const updatedMaterials = materials.map(mat => {
      const item = recipe.find(r => r.material_id === mat.id);
      if (!item) return mat;
      const used = item.qtyPerUnit * qty;
      const newStock = mat.current_stock - used;

      movements.unshift({
        id: uuid(),
        type: 'bahan_keluar',
        item_id: mat.id,
        item_name: mat.name,
        amount: used,
        reference,
        created_at: new Date().toISOString()
      });

      if (newStock <= mat.stock_minimum) {
        notifications.unshift({
          id: uuid(),
          type: 'low_stock',
          message: `Stok kritis: ${mat.name} tersisa ${newStock} ${mat.unit} (Batas minimum: ${mat.stock_minimum} ${mat.unit})`,
          target_role: 'admin_gudang',
          is_read: false,
          created_at: new Date().toISOString()
        });
        notifChanged = true;
      }
      return { ...mat, current_stock: newStock };
    });

    this.setRawMaterials(updatedMaterials);
    this.setStockMovements(movements);
    if (notifChanged) this.setNotifications(notifications);
    return { ok: true, shortages: [] };
  };

  // Tambah/kurangi stok produk jadi dengan pencatatan mutasi.
  // qtyChange negatif = barang keluar (terjual), positif = barang masuk (retur/koreksi).
  adjustProductStock = (productId: string, qtyChange: number, reference: string): boolean => {
    if (qtyChange === 0) return true;
    const products = this.getProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return false;

    const movements = this.getStockMovements();
    movements.unshift({
      id: uuid(),
      type: qtyChange < 0 ? 'barang_jadi_keluar' : 'barang_jadi_masuk',
      item_id: product.id,
      item_name: product.name,
      amount: Math.abs(qtyChange),
      reference,
      created_at: new Date().toISOString()
    });

    const updatedProducts = products.map(p =>
      p.id === productId ? { ...p, stock: Math.max(0, p.stock + qtyChange) } : p
    );

    this.setProducts(updatedProducts);
    this.setStockMovements(movements);
    return true;
  };

  recordSale = (invoice: Omit<Invoice, 'id' | 'invoice_number' | 'subtotal' | 'total'>): Invoice => {
    const invoices = this.getInvoices();
    const products = this.getProducts();
    const movements = this.getStockMovements();

    const invoiceNumber = `INV/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${(invoices.length + 1).toString().padStart(3, '0')}`;
    const subtotal = invoice.items.reduce((acc, item) => acc + item.subtotal, 0);
    // Formula: Subtotal + Tax - DP
    const total = subtotal + invoice.tax - invoice.dp;

    const newInvoice: Invoice = {
      ...invoice,
      id: uuid(),
      invoice_number: invoiceNumber,
      subtotal,
      total
    };

    // Deduct stock for all items
    const updatedProducts = products.map(p => {
      const item = invoice.items.find(i => i.product_id === p.id);
      if (item) {
        movements.push({
          id: uuid(),
          type: 'barang_jadi_keluar',
          item_id: p.id,
          item_name: p.name,
          amount: item.qty,
          reference: `Invoice ${invoiceNumber}`,
          created_at: new Date().toISOString(),
        });
        return { ...p, stock: Math.max(0, p.stock - item.qty) };
      }
      return p;
    });

    invoices.unshift(newInvoice);
    this.setInvoices(invoices);
    this.setProducts(updatedProducts);
    this.setStockMovements(movements);

    return newInvoice;
  };

  recordReturn = (ret: Omit<Return, 'id' | 'invoice_number' | 'product_name'>): Return => {
    const returns = this.getReturns();
    const invoices = this.getInvoices();
    const products = this.getProducts();
    const movements = this.getStockMovements();

    const matchedInv = invoices.find(inv => inv.id === ret.invoice_id);
    const matchedProd = products.find(p => p.id === ret.product_id);

    const invoiceNo = matchedInv ? matchedInv.invoice_number : 'INV/Unknown';
    const prodName = matchedProd ? matchedProd.name : 'Unknown Product';

    const newReturn: Return = {
      ...ret,
      id: uuid(),
      invoice_number: invoiceNo,
      product_name: prodName
    };

    // Add back the returned product to stock
    const updatedProducts = products.map(p => {
      if (p.id === ret.product_id) {
        movements.push({
          id: uuid(),
          type: 'barang_jadi_masuk',
          item_id: p.id,
          item_name: p.name,
          amount: ret.qty,
          reference: `Retur ${invoiceNo}`,
          created_at: new Date().toISOString(),
        });
        return { ...p, stock: p.stock + ret.qty };
      }
      return p;
    });

    // Notify owner
    const notifications = this.getNotifications();
    notifications.unshift({
      id: uuid(),
      type: 'new_return',
      message: `Retur Baru: ${ret.qty} unit ${prodName} dari Invoice ${invoiceNo} dikembalikan. Alasan: ${ret.reason}`,
      target_role: 'owner',
      is_read: false,
      created_at: new Date().toISOString()
    });

    returns.unshift(newReturn);
    this.setReturns(returns);
    this.setProducts(updatedProducts);
    this.setStockMovements(movements);
    this.setNotifications(notifications);

    return newReturn;
  };

  // Login dengan username + PIN; mengembalikan karyawan bila cocok, null bila gagal
  verifyLogin = (username: string, pin: string): Employee | null => {
    const emp = this.getEmployees().find(
      e => e.status_aktif && (e.username || '').toLowerCase() === username.trim().toLowerCase()
    );
    if (!emp) return null;
    return this.verifyEmployeePin(emp.id, pin) ? emp : null;
  };

  verifyEmployeePin = (employeeId: string, inputPin: string): boolean => {
    const employees = this.getEmployees();
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return false;
    const inputHashed = hashPin(inputPin);
    return emp.pin === inputPin || emp.pin === inputHashed;
  };

  recordPayroll = (payroll: PayrollWeekly): boolean => {
    const payrolls = this.getPayrollWeekly();
    const exists = payrolls.some(p => 
      p.employee_id === payroll.employee_id && 
      p.period_start === payroll.period_start && 
      p.period_end === payroll.period_end
    );
    if (exists) {
      throw new Error(`Payroll untuk ${payroll.employee_name} pada periode ${payroll.period_start} s/d ${payroll.period_end} sudah pernah dibuat.`);
    }
    payrolls.unshift(payroll);
    this.setPayrollWeekly(payrolls);
    return true;
  };

  recordAttendance = (att: Omit<Attendance, 'id' | 'employee_name' | 'status' | 'is_mock_location_flag' | 'distance_meters'>): Attendance => {
    const attendanceLogs = this.getAttendance();
    const employees = this.getEmployees();
    const depts = this.getDepartments();

    const emp = employees.find(e => e.id === att.employee_id);
    if (!emp) throw new Error('Employee not found');

    const dept = depts.find(d => d.id === emp.department_id);
    if (!dept) throw new Error('Department not found');

    // Double Check-in/Check-out Validation:
    const dateStr = att.timestamp.split('T')[0];
    const sameDayLogs = attendanceLogs.filter(
      l => l.employee_id === att.employee_id && l.timestamp.split('T')[0] === dateStr
    );

    if (att.type_scan === 'masuk') {
      const alreadyCheckedIn = sameDayLogs.some(l => l.type_scan === 'masuk');
      if (alreadyCheckedIn) {
        throw new Error(`Absen MASUK ditolak: Anda sudah absen masuk hari ini (${dateStr}).`);
      }
    } else if (att.type_scan === 'pulang') {
      const hasCheckedIn = sameDayLogs.some(l => l.type_scan === 'masuk');
      if (!hasCheckedIn) {
        throw new Error(`Absen PULANG ditolak: Anda harus melakukan absen MASUK terlebih dahulu hari ini.`);
      }
      const alreadyCheckedOut = sameDayLogs.some(l => l.type_scan === 'pulang');
      if (alreadyCheckedOut) {
        throw new Error(`Absen PULANG ditolak: Anda sudah absen pulang hari ini (${dateStr}).`);
      }
    }

    // Calculate Geolocation distance
    // Haversine formula
    const lat1 = att.latitude;
    const lon1 = att.longitude;
    const lat2 = dept.latitude;
    const lon2 = dept.longitude;

    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // meters

    // Radius check: anomaly if > 100m
    const status = distance > 100 ? 'anomaly' : 'normal';

    const newAttendance: Attendance = {
      ...att,
      id: uuid(),
      employee_name: emp.name,
      distance_meters: Math.round(distance * 10) / 10,
      is_mock_location_flag: false,
      status,
    };

    if (status === 'anomaly') {
      const notifications = this.getNotifications();
      notifications.unshift({
        id: uuid(),
        type: 'attendance_anomaly',
        message: `Anomali Absensi: ${emp.name} melakukan scan ${att.type_scan} berjarak ${Math.round(distance)}m dari ${dept.name} (Toleransi: 100m)`,
        target_role: 'owner',
        is_read: false,
        created_at: new Date().toISOString()
      });
      this.setNotifications(notifications);
    }

    attendanceLogs.unshift(newAttendance);
    this.setAttendance(attendanceLogs);
    return newAttendance;
  };
}

export const dataStore = new DataStore();
