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
  ,AuditEntry,
  RecycleEntry,
  UserRole
  ,WorkSettings
  ,BrandSettings
  ,ProductionHandoff
  ,RejectedGood
  ,ProductionTaskLog
  ,PackingTask
  ,AttendanceAdjustment
  ,CashAdvanceTransaction
  ,AttendanceBonusPayout, isEligibleForAttendanceBonus, PaymentEntry, purchaseRemaining, orderRemaining, clockMinutes, checkoutMetrics, AttendanceFailure } from './types';
import { pushKeyToCloud, pushAttendanceToCloud, clearAttendanceInCloud } from './cloudSync';

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
// Koordinat kantor/pabrik ARI SPORTINDO (acuan geofence absensi).
// Sumber: Google Maps 6°48'33.2"S 107°36'05.7"E
const COORDS = {
  eva_foam: { lat: -6.8092099, lng: 107.6015847 },
  konveksi: { lat: -6.8092099, lng: 107.6015847 },
};

// Waktu WIB (GMT+7) — dipatok tetap supaya absensi konsisten di semua perangkat,
// tidak tergantung pengaturan zona waktu HP masing-masing.
export const wibNowISO = (): string =>
  new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('Z', '+07:00');
export const wibTodayStr = (): string => wibNowISO().split('T')[0];

/**
 * Periode gaji mingguan berjalan: Sabtu s/d Jumat, dibayarkan hari Sabtu
 * setelah periode berakhir. Minggu adalah hari libur.
 */
export const currentWeeklyPayrollPeriod = (): { start: string; end: string; payDate: string } => {
  const today = new Date(`${wibTodayStr()}T00:00:00Z`);
  const dow = today.getUTCDay(); // 0=Minggu ... 6=Sabtu
  // Sabtu awal periode: Sabtu terakhir yang <= hari ini
  const sinceSaturday = (dow + 1) % 7; // Sabtu=0, Minggu=1, Senin=2, ... Jumat=6
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - sinceSaturday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6); // Jumat
  const payDate = new Date(start);
  payDate.setUTCDate(start.getUTCDate() + 7); // Sabtu berikutnya
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end), payDate: fmt(payDate) };
};

const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'dept-eva-foam', name: 'Eva Foam', latitude: COORDS.eva_foam.lat, longitude: COORDS.eva_foam.lng },
  { id: 'dept-konveksi', name: 'Departemen Konveksi', latitude: COORDS.konveksi.lat, longitude: COORDS.konveksi.lng },
];

// Setiap orang punya satu akun login (nama + PIN). Field access_role menentukan
// menu yang terbuka: owner / admin_penjualan (Admin) / admin_gudang (Gudang & Produksi) / kosong = karyawan.
// GANTI PIN default di bawah sebelum dipakai produksi.
const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'emp-owner', username: 'ari', name: 'H. Ari Gunawan', department_id: 'dept-eva-foam', role: 'leader', rate_harian: 0, rate_lembur_per_jam: 0, default_live_tiktok_bonus: 0, default_attendance_bonus: 0, default_weekly_cash_advance_deduction: 0, status_aktif: true, phone_number: '081200000001', pin: hashPin('2026'), pin_hashed: true, access_role: 'owner' },
  { id: 'emp-siti', username: 'siti', name: 'Siti Rahma', department_id: 'dept-eva-foam', role: 'leader', rate_harian: 180000, rate_lembur_per_jam: 25000, default_live_tiktok_bonus: 20000, default_attendance_bonus: 0, default_weekly_cash_advance_deduction: 50000, status_aktif: true, phone_number: '081234567891', pin: hashPin('4321'), pin_hashed: true, access_role: 'admin_penjualan' },
  { id: 'emp-dewi', username: 'dewi', name: 'Dewi Lestari', department_id: 'dept-konveksi', role: 'leader', rate_harian: 175000, rate_lembur_per_jam: 22000, default_live_tiktok_bonus: 20000, default_attendance_bonus: 0, default_weekly_cash_advance_deduction: 50000, status_aktif: true, phone_number: '087899008877', pin: hashPin('8765'), pin_hashed: true, access_role: 'admin_gudang' },
  { id: 'emp-asep', username: 'asep', name: 'Asep Saputra', department_id: 'dept-eva-foam', role: 'karyawan', rate_harian: 150000, rate_lembur_per_jam: 20000, default_live_tiktok_bonus: 20000, default_attendance_bonus: 0, default_weekly_cash_advance_deduction: 50000, status_aktif: true, phone_number: '081234567890', pin: hashPin('1234'), pin_hashed: true },
  { id: 'emp-budi', username: 'budi', name: 'Budi Hartono', department_id: 'dept-konveksi', role: 'karyawan', rate_harian: 140000, rate_lembur_per_jam: 18000, default_live_tiktok_bonus: 20000, default_attendance_bonus: 0, default_weekly_cash_advance_deduction: 50000, status_aktif: true, phone_number: '085711223344', pin: hashPin('5678'), pin_hashed: true },
];

const INITIAL_ORDERS: Order[] = [];

const INITIAL_PRODUCTION_JOBS: ProductionJob[] = [];
const INITIAL_PRODUCTION_HANDOFFS: ProductionHandoff[] = [];
const INITIAL_REJECTED_GOODS: RejectedGood[] = [];
const INITIAL_PRODUCTION_TASK_LOGS: ProductionTaskLog[] = [];
const INITIAL_PACKING_TASKS: PackingTask[] = [];
const INITIAL_ATTENDANCE_ADJUSTMENTS: AttendanceAdjustment[] = [];

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
  // department_id menentukan divisi pemakai bahan. Dibiarkan kosong = bahan Umum,
  // artinya dipakai kedua divisi dan ikut tampil di daftar Eva Foam maupun Konveksi.
  { id: 'mat-foam-2cm', name: 'Eva Foam Sheet 2cm Raw', department_id: 'dept-eva-foam', unit: 'Lembar', stock_minimum: 100, current_stock: 250 },
  { id: 'mat-foam-3cm', name: 'Eva Foam Sheet 3cm Raw', department_id: 'dept-eva-foam', unit: 'Lembar', stock_minimum: 80, current_stock: 35 }, // Below threshold!
  { id: 'mat-fabric-nylon', name: 'Nylon Fabric Heavy', department_id: 'dept-konveksi', unit: 'Meter', stock_minimum: 200, current_stock: 450 },
  { id: 'mat-leather-pu', name: 'Synthetic Leather (PU)', department_id: 'dept-konveksi', unit: 'Meter', stock_minimum: 150, current_stock: 180 },
  { id: 'mat-dakron', name: 'Isian Dakron/Busa', department_id: 'dept-konveksi', unit: 'Kg', stock_minimum: 50, current_stock: 40 }, // Below threshold!
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'cust-dojo', name: 'Dojo Garuda Bandung', address: 'Jl. Sukajadi No. 123, Bandung', contact: '08123456789' },
  { id: 'cust-sasana', name: 'Sasana Muay Thai Jakarta', address: 'Kawasan PIK Ruko No. 4, Jakarta Utara', contact: '08198765432' },
  { id: 'cust-persatuan', name: 'Persatuan Silat Surabaya', address: 'Komp. Olahraga Kertajaya Indah, Surabaya', contact: '08571122334' },
];


const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [];

const INITIAL_PRODUCTION_LOGS: ProductionLog[] = [];

const INITIAL_ATTENDANCE: Attendance[] = [];

const INITIAL_CASH_ADVANCES: CashAdvance[] = [];
const INITIAL_CASH_ADVANCE_TRANSACTIONS: CashAdvanceTransaction[] = [];

const INITIAL_PAYROLL_WEEKLY: PayrollWeekly[] = [];

const INITIAL_INVOICES: Invoice[] = [];

const INITIAL_DELIVERY_NOTES: DeliveryNote[] = [];

const INITIAL_RETURNS: Return[] = [];

const INITIAL_MARKETPLACE_SALES: MarketplaceSale[] = [];

const INITIAL_MARKETPLACE_ITEM_SALES: MarketplaceItemSale[] = [];

const INITIAL_PURCHASES: Purchase[] = [];

const INITIAL_DAILY_EXPENSES: DailyExpense[] = [];

const INITIAL_NOTIFICATIONS: NotificationLog[] = [];
const INITIAL_EXPENSE_CATEGORIES = [
  'Konsumsi & Lembur',
  'Listrik & Utilitas',
  'Biaya Transportasi & BBM',
  'Perbaikan & Maintenance',
  'Lain-lain / Overhead'
];
// Default brand mengikuti instalasi awal (ARI SPORTINDO) — klien lain tinggal
// mengubahnya sendiri di menu Pengaturan tanpa menyentuh code (white label).
const INITIAL_BRAND_SETTINGS: BrandSettings = {
  company_name: 'ARI SPORTINDO',
  legal_name: 'PT ARI SPORTINDO',
  tagline: 'Sistem Produksi & Manajemen',
  logo_data_url: '',
  primary_color: '#1F4B36',
};

// Alur produksi bawaan per departemen — dipakai bila produk belum punya alur sendiri
export const DEFAULT_PRODUCTION_STAGES: Record<string, string[]> = {
  'dept-eva-foam': ['Campur Bahan', 'Cetak', 'Potong', 'Finishing', 'Cek Kualitas', 'Packing'],
  'dept-konveksi': ['Potong', 'Sablon', 'Jahit', 'Finishing', 'Cek Kualitas', 'Packing'],
};

// Saran nama tahap untuk tombol cepat di editor alur
export const STAGE_SUGGESTIONS = ['Potong', 'Jahit', 'Sablon', 'Lem', 'Campur Bahan', 'Cetak', 'Finishing', 'Cek Kualitas', 'Packing'];

/** Alur produksi efektif sebuah produk (alur produk sendiri, atau bawaan departemennya). */
export const stagesForProduct = (product?: { department_id: string; production_stages?: string[] }): string[] => {
  if (product?.production_stages?.length) return product.production_stages;
  return DEFAULT_PRODUCTION_STAGES[product?.department_id || ''] || DEFAULT_PRODUCTION_STAGES['dept-konveksi'];
};

/**
 * Porsi hari kerja dari seluruh log absensi satu tanggal, murni dari JAM SCAN PULANG.
 *   0   = tidak ada scan pulang, atau pulang sebelum half_day_start (12:00)
 *         -> tidak dibayar otomatis, perlu koreksi manual owner
 *   0.5 = pulang antara half_day_start dan sebelum full_day_from (12:00-13:59)
 *   1   = pulang pada/setelah full_day_from (14:00). Bila masih sebelum end_time,
 *         recordAttendance mewajibkan early_leave_reason.
 * Scan pulang TERAKHIR yang menentukan, supaya scan ganda tidak ambigu.
 */
export const dayFraction = (dayLogs: Attendance[], settings: WorkSettings): 0 | 0.5 | 1 => {
  const last = dayLogs.filter(a => a.type_scan === 'pulang').map(a => a.timestamp.slice(11, 16)).sort().pop();
  if (!last || last < settings.half_day_start) return 0;
  return last < settings.full_day_from ? 0.5 : 1;
};

const INITIAL_WORK_SETTINGS: WorkSettings = {
  start_time: '08:00',
  end_time: '16:00',
  timezone: 'Asia/Jakarta',
  half_day_start: '12:00',
  full_day_from: '14:00',
  attendance_radius_meters: 100,
  monthly_bonus_amount: 0,
  location_qr_token: 'ari-hq-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
  production_handoff_mode: 'hybrid'
};

const INITIAL_CALIBRATION: PrinterCalibration = {
  offset_x: 0,
  offset_y: 0
};

// Main DataStore wrapper class to synchronize with LocalStorage
class DataStore {
  private auditKey = 'audit_logs';
  private recycleKey = 'recycle_bin';

  getCurrentActor = (): { id?: string; name: string; role: UserRole | 'system' } => this.currentActor();

  private currentActor = (): { id?: string; name: string; role: UserRole | 'system' } => {
    try {
      const session = JSON.parse(localStorage.getItem('nxty_session') || 'null');
      return session ? { id: session.employeeId, name: session.name || 'Pengguna', role: session.role || 'system' } : { name: 'Sistem', role: 'system' };
    } catch { return { name: 'Sistem', role: 'system' }; }
  };

  private safeSnapshot = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(item => this.safeSnapshot(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (['pin', 'password', 'attendance_qr_token', 'token', 'selfie_url'].includes(key)) return [key, '[REDACTED]'];
      return [key, this.safeSnapshot(item)];
    }));
  };

  private appendAudit = (entry: Omit<AuditEntry, 'id' | 'timestamp' | 'actor_name' | 'actor_role' | 'actor_id'>): void => {
    const actor = this.currentActor();
    const current = this.get<AuditEntry[]>(this.auditKey, []);
    const audit: AuditEntry = { ...entry, id: uuid(), timestamp: wibNowISO(), actor_id: actor.id, actor_name: actor.name, actor_role: actor.role };
    const next = [audit, ...current].slice(0, 5000);
    localStorage.setItem(`nxty_${this.auditKey}`, JSON.stringify(next));
    pushKeyToCloud(this.auditKey, next);
  };

  private captureChanges = <T>(key: string, previous: T, next: T): void => {
    if (key === this.auditKey || key === this.recycleKey || !Array.isArray(previous) || !Array.isArray(next)) return;
    const oldItems = previous.filter(item => item && typeof item === 'object' && 'id' in item) as Array<Record<string, unknown>>;
    const newItems = next.filter(item => item && typeof item === 'object' && 'id' in item) as Array<Record<string, unknown>>;
    if (!oldItems.length && !newItems.length) return;
    const oldMap = new Map(oldItems.map(item => [String(item.id), item]));
    const newMap = new Map(newItems.map(item => [String(item.id), item]));
    const actor = this.currentActor();

    for (const [id, item] of oldMap) {
      if (newMap.has(id)) continue;
      const recycle = this.get<RecycleEntry[]>(this.recycleKey, []).filter(entry => entry.id !== `${key}:${id}`);
      const deletedAt = wibNowISO();
      recycle.unshift({
        id: `${key}:${id}`, entity_type: key, entity_id: id,
        label: String(item.name || item.employee_name || item.invoice_number || item.order_number || item.description || id),
        data: item, deleted_at: deletedAt, deleted_by_id: actor.id, deleted_by_name: actor.name,
        reason: `Dihapus melalui modul ${key}`,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString()
      });
      localStorage.setItem(`nxty_${this.recycleKey}`, JSON.stringify(recycle));
      pushKeyToCloud(this.recycleKey, recycle);
      this.appendAudit({ action: 'delete', entity_type: key, entity_id: id, description: `Menghapus ${key}: ${String(item.name || item.description || id)}`, metadata: { before: this.safeSnapshot(item), recycle_expires_at: recycle[0].expires_at } });
    }

    for (const [id, item] of newMap) {
      const old = oldMap.get(id);
      if (!old) this.appendAudit({ action: 'create', entity_type: key, entity_id: id, description: `Membuat data ${key}: ${String(item.name || item.description || id)}` });
      else if (JSON.stringify(old) !== JSON.stringify(item)) this.appendAudit({ action: 'update', entity_type: key, entity_id: id, description: `Memperbarui data ${key}: ${String(item.name || item.description || id)}`, metadata: { before: this.safeSnapshot(old), after: this.safeSnapshot(item) } });
    }
  };

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
      const previous = this.get<T>(key, data);
      this.captureChanges(key, previous, data);
      localStorage.setItem(`nxty_${key}`, JSON.stringify(data));
      // Dispatch a storage event so components can listen to changes in real-time
      window.dispatchEvent(new Event('nxty_storage_change'));
      // Sinkron ke Supabase bila dikonfigurasi (no-op saat offline / saat menerapkan data dari cloud)
      pushKeyToCloud(key, data);
    } catch (e) {
      console.error('Failed to write to localStorage', e);
    }
  }

  getAuditLogs = (): AuditEntry[] => this.get(this.auditKey, []);
  getRecycleBin = (): RecycleEntry[] => {
    const now = Date.now();
    const current = this.get<RecycleEntry[]>(this.recycleKey, []);
    const active = current.filter(entry => new Date(entry.expires_at).getTime() > now);
    if (active.length !== current.length) {
      localStorage.setItem(`nxty_${this.recycleKey}`, JSON.stringify(active));
      pushKeyToCloud(this.recycleKey, active);
    }
    return active;
  };

  logAudit = (action: AuditEntry['action'], entityType: string, description: string, entityId?: string, metadata?: Record<string, unknown>) =>
    this.appendAudit({ action, entity_type: entityType, entity_id: entityId, description, metadata: this.safeSnapshot(metadata) as Record<string, unknown> | undefined });

  restoreRecycleEntry = (recycleId: string): boolean => {
    const recycle = this.getRecycleBin();
    const entry = recycle.find(item => item.id === recycleId);
    if (!entry) return false;
    const records = this.get<Array<Record<string, unknown>>>(entry.entity_type, []);
    if (records.some(item => String(item.id) === entry.entity_id)) throw new Error('Data dengan ID yang sama sudah aktif.');
    const restored = [entry.data, ...records];
    localStorage.setItem(`nxty_${entry.entity_type}`, JSON.stringify(restored));
    pushKeyToCloud(entry.entity_type, restored);
    if (entry.entity_type === 'attendance') pushAttendanceToCloud(entry.data as unknown as Attendance);
    const nextRecycle = recycle.filter(item => item.id !== recycleId);
    localStorage.setItem(`nxty_${this.recycleKey}`, JSON.stringify(nextRecycle));
    pushKeyToCloud(this.recycleKey, nextRecycle);
    this.appendAudit({ action: 'restore', entity_type: entry.entity_type, entity_id: entry.entity_id, description: `Memulihkan ${entry.entity_type}: ${entry.label}` });
    window.dispatchEvent(new Event('nxty_storage_change'));
    return true;
  };

  permanentlyDeleteRecycleEntry = (recycleId: string): boolean => {
    const recycle = this.getRecycleBin();
    const entry = recycle.find(item => item.id === recycleId);
    if (!entry) return false;
    const next = recycle.filter(item => item.id !== recycleId);
    localStorage.setItem(`nxty_${this.recycleKey}`, JSON.stringify(next));
    pushKeyToCloud(this.recycleKey, next);
    this.appendAudit({ action: 'permanent_delete', entity_type: entry.entity_type, entity_id: entry.entity_id, description: `Menghapus permanen ${entry.entity_type}: ${entry.label}` });
    window.dispatchEvent(new Event('nxty_storage_change'));
    return true;
  };

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
      let next = e;
      if (!next.username) {
        const base = (next.name.split(' ')[0] || 'user').toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
        let candidate = base;
        let i = 2;
        while (taken.has(candidate)) candidate = `${base}${i++}`;
        taken.add(candidate);
        next = { ...next, username: candidate };
        migrated = true;
      }
      if (!next.attendance_qr_token) {
        const random = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        next = { ...next, attendance_qr_token: random };
        migrated = true;
      }
      if (next.default_live_tiktok_bonus === undefined || next.default_attendance_bonus === undefined || next.default_weekly_cash_advance_deduction === undefined) {
        const isOwnerWithoutPayroll = next.access_role === 'owner' && next.rate_harian === 0;
        next = {
          ...next,
          default_live_tiktok_bonus: next.default_live_tiktok_bonus ?? (isOwnerWithoutPayroll ? 0 : 20000),
          default_attendance_bonus: next.default_attendance_bonus ?? 0,
          default_weekly_cash_advance_deduction: next.default_weekly_cash_advance_deduction ?? (isOwnerWithoutPayroll ? 0 : 50000)
        };
        migrated = true;
      }
      return next;
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

  getAttendanceAdjustments = (): AttendanceAdjustment[] => this.get('attendance_adjustments', INITIAL_ATTENDANCE_ADJUSTMENTS);
  setAttendanceAdjustments = (data: AttendanceAdjustment[]) => this.set('attendance_adjustments', data);

  getCashAdvances = (): CashAdvance[] => this.get('cash_advances', INITIAL_CASH_ADVANCES);
  setCashAdvances = (data: CashAdvance[]) => this.set('cash_advances', data);
  getCashAdvanceTransactions = (): CashAdvanceTransaction[] => this.get('cash_advance_transactions', INITIAL_CASH_ADVANCE_TRANSACTIONS);
  setCashAdvanceTransactions = (data: CashAdvanceTransaction[]) => this.set('cash_advance_transactions', data);

  getPayrollWeekly = (): PayrollWeekly[] => this.get('payroll_weekly', INITIAL_PAYROLL_WEEKLY);

  getAttendanceBonusPayouts = (): AttendanceBonusPayout[] => this.get('attendance_bonus_payouts', []);
  setAttendanceBonusPayouts = (data: AttendanceBonusPayout[]) => this.set('attendance_bonus_payouts', data);
  setAttendanceBonusPaymentStatus = (payoutId: string, status: 'paid' | 'unpaid'): void => {
    const payouts = this.getAttendanceBonusPayouts().map(p =>
      p.id === payoutId ? { ...p, payment_status: status, paid_at: status === 'paid' ? wibNowISO() : undefined } : p
    );
    this.setAttendanceBonusPayouts(payouts);
  };

  /**
   * Evaluasi bonus kehadiran satu karyawan untuk satu bulan — MURNI dari data absensi.
   *
   * Bonusnya AKUMULASI HARIAN, bukan penuh-atau-gugur sebulan: tiap hari kerja yang
   * layak menambah tarif harian ke saldo, dan hari yang tidak layak hanya kehilangan
   * hari itu — saldo yang sudah terkumpul tidak hangus.
   *
   * Satu hari layak bila ketiganya terpenuhi:
   *   1. ada scan MASUK,
   *   2. tidak telat (setelah kompensasi yang disetujui),
   *   3. harinya penuh menurut dayFraction() — bukan setengah hari, dan ada scan pulang.
   *      Pulang cepat yang tetap dihitung 1 hari (sudah wajib beralasan saat scan)
   *      TIDAK menggugurkan bonus.
   *
   * Minggu tidak dihitung hari kerja. Untuk bulan berjalan, hari ini belum dinilai.
   * Hari sebelum attendance_effective_from dilewati (masa sebelum absensi dipakai).
   */
  evaluateAttendanceBonus = (employeeId: string, month: string): {
    workingDays: number; presentDays: number; qualifiedDays: number; dailyRate: number;
    lateMinutesNet: number; halfDays: number;
    absentDates: string[]; halfDayDates: string[]; lateDates: string[]; earlyLeaveDates: string[];
    reasons: string[]; amount: number; potentialAmount: number;
  } => {
    const employee = this.getEmployees().find(e => e.id === employeeId);
    const settings = this.getWorkSettings();
    // Nilai ini adalah tarif PER HARI layak, bukan per bulan
    const dailyRate = Math.round(Number(employee?.default_attendance_bonus ?? settings.monthly_bonus_amount) || 0);

    const today = wibTodayStr();
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const isCurrentMonth = month === today.slice(0, 7);

    const workingDates: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      if (new Date(`${dateStr}T00:00:00Z`).getUTCDay() === 0) continue; // Minggu libur
      if (isCurrentMonth && dateStr >= today) continue; // hari ini belum selesai
      if (settings.attendance_effective_from && dateStr < settings.attendance_effective_from) continue;
      // Hari sebelum karyawan ini masuk kerja bukan hari kerja DIA — tanpa ini karyawan
      // baru tercatat mangkir sepanjang tanggal sebelum dia bergabung.
      if (employee?.join_date && dateStr < employee.join_date) continue;
      workingDates.push(dateStr);
    }

    const logs = this.getAttendance().filter(a => a.employee_id === employeeId && a.timestamp.startsWith(month));
    const byDate = new Map<string, Attendance[]>();
    logs.forEach(log => {
      const date = log.timestamp.slice(0, 10);
      byDate.set(date, [...(byDate.get(date) || []), log]);
    });

    // Kompensasi telat yang disetujui, per tanggal
    const compensationByDate = new Map<string, number>();
    this.getAttendanceAdjustments()
      .filter(item => item.employee_id === employeeId && item.date.startsWith(month) && item.type !== 'ignored' && item.status !== 'rejected')
      .forEach(item => compensationByDate.set(
        item.date,
        (compensationByDate.get(item.date) || 0) + (item.late_compensation_minutes || 0)
      ));

    const absentDates: string[] = [];
    const lateDates: string[] = [];
    const earlyLeaveDates: string[] = [];
    const halfDayDates: string[] = [];
    let qualifiedDays = 0;
    let lateMinutesNet = 0;

    for (const date of workingDates) {
      const dayLogs = byDate.get(date) || [];
      const masuk = dayLogs.filter(a => a.type_scan === 'masuk');
      if (masuk.length === 0) { absentDates.push(date); continue; }

      const lateRaw = dayLogs.reduce((sum, a) => sum + (a.late_minutes || 0), 0);
      const lateNet = Math.max(0, lateRaw - (compensationByDate.get(date) || 0));
      lateMinutesNet += lateNet;

      const fraction = dayFraction(dayLogs, settings);
      if (fraction === 0.5) halfDayDates.push(date);
      // Bonus gugur hanya bila harinya tidak penuh (setengah hari, atau tanpa scan pulang
      // yang sah). Pulang cepat yang tetap dihitung 1 hari — sudah wajib beralasan saat
      // scan — tidak menggugurkan bonus.
      const pulangSah = fraction === 1;

      if (lateNet > 0) { lateDates.push(date); continue; }
      if (!pulangSah) { earlyLeaveDates.push(date); continue; }
      qualifiedDays++;
    }

    const fmtShort = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
    const ringkas = (dates: string[]) =>
      `${dates.slice(0, 3).map(fmtShort).join(', ')}${dates.length > 3 ? ', …' : ''}`;
    const reasons: string[] = [];
    const eligible = isEligibleForAttendanceBonus(employee);
    if (!eligible) reasons.push('Masih berstatus training');
    if (lateDates.length > 0) reasons.push(`Telat ${lateDates.length} hari (${ringkas(lateDates)})`);
    if (absentDates.length > 0) reasons.push(`Tidak hadir ${absentDates.length} hari (${ringkas(absentDates)})`);
    if (earlyLeaveDates.length > 0) reasons.push(`Hari tidak penuh (setengah hari atau tanpa scan pulang) ${earlyLeaveDates.length} hari (${ringkas(earlyLeaveDates)})`);

    // Training tidak berhak, jadi tidak ada hari yang dihitung
    const paidDays = eligible ? qualifiedDays : 0;
    return {
      workingDays: workingDates.length,
      presentDays: workingDates.length - absentDates.length,
      qualifiedDays: paidDays,
      dailyRate,
      lateMinutesNet,
      halfDays: halfDayDates.length,
      absentDates,
      halfDayDates,
      lateDates,
      earlyLeaveDates,
      reasons,
      amount: paidDays * dailyRate,
      potentialAmount: workingDates.length * dailyRate,
    };
  };

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

  getMarketplaceItemSales = (): MarketplaceItemSale[] => {
    const sales = this.get('marketplace_item_sales', INITIAL_MARKETPLACE_ITEM_SALES);
    // Migrasi: baris lama belum punya divisi. Diisi dari produk yang ditautkan, karena
    // itulah sumber kebenarannya. Baris deskripsi bebas (tanpa product_id) dibiarkan
    // kosong = belum berdivisi, dan bisa dipilih manual lewat form.
    const products = this.getProducts();
    const migrated = sales.map(sale => (sale.department_id || !sale.product_id)
      ? sale
      : { ...sale, department_id: products.find(p => p.id === sale.product_id)?.department_id });
    if (migrated.some((sale, i) => sale !== sales[i])) this.set('marketplace_item_sales', migrated);
    return migrated;
  };
  setMarketplaceItemSales = (data: MarketplaceItemSale[]) => this.set('marketplace_item_sales', data);
  setMarketplaceShippingProof = (orderNumber: string, photoUrl: string | undefined): void => {
    const items = this.getMarketplaceItemSales().map(item => item.order_number === orderNumber
      ? { ...item, shipping_proof_url: photoUrl, shipping_proof_uploaded_at: photoUrl ? wibNowISO() : undefined }
      : item);
    this.setMarketplaceItemSales(items);
  };

  getPurchases = (): Purchase[] => this.get('purchases', INITIAL_PURCHASES);
  setPurchases = (data: Purchase[]) => this.set('purchases', data);

  /**
   * Catat satu pembayaran hutang ke supplier. Nilainya dibatasi sisa hutang supaya
   * total terbayar tidak pernah melebihi nilai PO.
   */
  addPurchasePayment = (purchaseId: string, amount: number, date: string, note?: string): boolean => {
    const purchases = this.getPurchases();
    const purchase = purchases.find(item => item.id === purchaseId);
    if (!purchase || amount <= 0) return false;
    const bayar = Math.min(amount, purchaseRemaining(purchase));
    if (bayar <= 0) return false;
    const entry: PaymentEntry = {
      id: uuid(),
      date,
      amount: bayar,
      note,
      recorded_by: this.getCurrentActor().name,
    };
    this.setPurchases(purchases.map(item => item.id === purchaseId
      ? { ...item, payments: [...(item.payments || []), entry] }
      : item));
    this.logAudit('update', 'purchases',
      `Bayar hutang PO ${purchase.po_number} ke ${purchase.supplier} sebesar ${bayar}`, purchase.id);
    return true;
  };

  /**
   * Catat satu pembayaran piutang dari pelanggan. DP order lama dipindahkan lebih dulu
   * menjadi entri pembayaran, supaya tidak terhitung dua kali.
   */
  addOrderPayment = (orderId: string, amount: number, date: string, note?: string): boolean => {
    const orders = this.getOrders();
    const order = orders.find(item => item.id === orderId);
    if (!order || amount <= 0) return false;
    const bayar = Math.min(amount, orderRemaining(order));
    if (bayar <= 0) return false;
    const riwayat: PaymentEntry[] = order.payments?.length
      ? order.payments
      : (order.dp ? [{ id: uuid(), date: order.date, amount: order.dp, note: 'DP awal' }] : []);
    const entry: PaymentEntry = {
      id: uuid(),
      date,
      amount: bayar,
      note,
      recorded_by: this.getCurrentActor().name,
    };
    this.setOrders(orders.map(item => item.id === orderId
      ? { ...item, payments: [...riwayat, entry] }
      : item));
    this.logAudit('update', 'orders',
      `Terima pembayaran order ${order.order_number} dari ${order.customer_name} sebesar ${bayar}`, order.id);
    return true;
  };

  getDailyExpenses = (): DailyExpense[] => this.get('daily_expenses', INITIAL_DAILY_EXPENSES);
  setDailyExpenses = (data: DailyExpense[]) => this.set('daily_expenses', data);

  getNotifications = (): NotificationLog[] => this.get('notifications', INITIAL_NOTIFICATIONS);
  setNotifications = (data: NotificationLog[]) => this.set('notifications', data);

  getExpenseCategories = (): string[] => this.get('expense_categories', INITIAL_EXPENSE_CATEGORIES);
  setExpenseCategories = (data: string[]) => this.set('expense_categories', data);

  getWorkSettings = (): WorkSettings => {
    const settings = { ...INITIAL_WORK_SETTINGS, ...this.get<Partial<WorkSettings>>('work_settings', INITIAL_WORK_SETTINGS) };
    if (!localStorage.getItem('nxty_work_settings') || !settings.attendance_radius_meters) this.setWorkSettings(settings);
    return settings;
  };
  setWorkSettings = (data: WorkSettings) => this.set('work_settings', data);

  getBrandSettings = (): BrandSettings =>
    ({ ...INITIAL_BRAND_SETTINGS, ...this.get<Partial<BrandSettings>>('brand_settings', INITIAL_BRAND_SETTINGS) });
  setBrandSettings = (data: BrandSettings) => this.set('brand_settings', data);

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
      // Job multi-output: nama selalu daftar lengkap "Produk (varian), Produk (varian)".
      // Memperbaiki juga label lama "Produk A +1 output" dan label tanpa varian.
      const multiLabel = job.outputs && job.outputs.length > 1
        ? job.outputs.map(output => (output.variant ? `${output.product_name} (${output.variant})` : output.product_name)).join(', ')
        : null;
      const oldLabel = Boolean(multiLabel) && multiLabel !== job.product_name;
      const needs = job.stages.some(s => RENAME[s.stage]) || RENAME[job.current_stage] || oldLabel;
      if (!needs) return job;
      changed = true;
      return {
        ...job,
        product_name: oldLabel ? multiLabel! : job.product_name,
        current_stage: RENAME[job.current_stage] || job.current_stage,
        stages: job.stages.map(s => ({ ...s, stage: RENAME[s.stage] || s.stage })),
      };
    });
    if (changed) this.setProductionJobs(migrated);
    return migrated;
  };
  setProductionJobs = (data: ProductionJob[]) => this.set('production_jobs', data);

  getProductionHandoffs = (): ProductionHandoff[] => this.get('production_handoffs', INITIAL_PRODUCTION_HANDOFFS);
  setProductionHandoffs = (data: ProductionHandoff[]) => this.set('production_handoffs', data);

  getRejectedGoods = (): RejectedGood[] => this.get('rejected_goods', INITIAL_REJECTED_GOODS);
  setRejectedGoods = (data: RejectedGood[]) => this.set('rejected_goods', data);

  getProductionTaskLogs = (): ProductionTaskLog[] => this.get('production_task_logs', INITIAL_PRODUCTION_TASK_LOGS);
  setProductionTaskLogs = (data: ProductionTaskLog[]) => this.set('production_task_logs', data);

  getPackingTasks = (): PackingTask[] => this.get('packing_tasks', INITIAL_PACKING_TASKS);
  setPackingTasks = (data: PackingTask[]) => this.set('packing_tasks', data);

  getAssets = (): Asset[] => this.get('assets', INITIAL_ASSETS);
  setAssets = (data: Asset[]) => this.set('assets', data);

  // Business Transactions
  assignPackingTask = (orderId: string, employeeId: string): PackingTask | null => {
    const orders = this.getOrders();
    const order = orders.find(item => item.id === orderId);
    const employee = this.getEmployees().find(item => item.id === employeeId);
    if (!order || !employee) return null;

    const current = this.getPackingTasks().filter(task => !(task.order_id === orderId && task.status === 'assigned'));
    const task: PackingTask = {
      id: uuid(),
      order_id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      employee_id: employee.id,
      employee_name: employee.name,
      items: order.items,
      status: 'assigned',
      notes: order.notes,
      created_at: wibNowISO()
    };

    this.setPackingTasks([task, ...current]);
    this.setOrders(orders.map(item => item.id === orderId ? { ...item, packing_employee_id: employee.id, packing_employee_name: employee.name, shipping_status: item.shipping_status || 'belum_dikirim' } : item));
    this.logAudit('create', 'packing_task', `Menugaskan packing ${order.order_number} ke ${employee.name}`, task.id);
    return task;
  };

  completePackingTask = (taskId: string, note?: string, photo?: { url: string; uploaded_by: string }): boolean => {
    const tasks = this.getPackingTasks();
    const task = tasks.find(item => item.id === taskId);
    if (!task) return false;
    this.setPackingTasks(tasks.map(item => item.id === taskId ? {
      ...item,
      status: 'completed',
      completed_note: note,
      completed_at: wibNowISO(),
      ...(photo ? { photo_url: photo.url, photo_uploaded_at: wibNowISO(), photo_uploaded_by: photo.uploaded_by } : {})
    } : item));
    this.setOrders(this.getOrders().map(order => order.id === task.order_id ? { ...order, shipping_status: 'siap_dikirim' } : order));
    this.logAudit('update', 'packing_task', `${task.employee_name} menyelesaikan packing ${task.order_number}`, task.id);
    return true;
  };

  /** Lampirkan / ganti foto dokumentasi pada packing yang sudah selesai (upload gagal atau terlewat). */
  setPackingTaskPhoto = (taskId: string, photo: { url: string; uploaded_by: string }): boolean => {
    const tasks = this.getPackingTasks();
    const task = tasks.find(item => item.id === taskId);
    if (!task) return false;
    this.setPackingTasks(tasks.map(item => item.id === taskId
      ? { ...item, photo_url: photo.url, photo_uploaded_at: wibNowISO(), photo_uploaded_by: photo.uploaded_by }
      : item));
    this.logAudit('update', 'packing_task', `${photo.uploaded_by} melengkapi foto dokumentasi packing ${task.order_number}`, task.id);
    return true;
  };

  deletePackingTaskPhoto = (taskId: string): boolean => {
    const tasks = this.getPackingTasks();
    const task = tasks.find(item => item.id === taskId);
    if (!task) return false;
    this.setPackingTasks(tasks.map(item => item.id === taskId ? { ...item, photo_url: undefined, photo_uploaded_at: undefined, photo_uploaded_by: undefined } : item));
    this.logAudit('update', 'packing_task', `Menghapus foto dokumentasi packing ${task.order_number}`, task.id);
    return true;
  };

  updateOrderShipping = (orderId: string, patch: Partial<Order>): boolean => {
    const orders = this.getOrders();
    if (!orders.some(order => order.id === orderId)) return false;
    this.setOrders(orders.map(order => order.id === orderId ? { ...order, ...patch } : order));
    this.logAudit('update', 'order_shipping', `Memperbarui resi pengiriman order ${orders.find(order => order.id === orderId)?.order_number || orderId}`, orderId);
    return true;
  };

  approveAttendanceAdjustment = (adjustment: AttendanceAdjustment): void => {
    const current = this.getAttendanceAdjustments().filter(item => item.attendance_id !== adjustment.attendance_id);
    this.setAttendanceAdjustments([adjustment, ...current]);
    this.logAudit('create', 'attendance_adjustment', `ACC ${adjustment.type} untuk ${adjustment.employee_name} tanggal ${adjustment.date}`, adjustment.id);
  };

  createManualProductionJob = (job: ProductionJob): { ok: boolean; shortages: string[] } => {
    const materialsUsed = job.materials_planned || [];
    const materials = this.getRawMaterials();
    const shortages: string[] = [];

    for (const item of materialsUsed) {
      const mat = materials.find(m => m.id === item.material_id);
      if (!mat || mat.current_stock < item.qty) {
        shortages.push(`${item.material_name || mat?.name || item.material_id}: butuh ${item.qty}${item.unit ? ` ${item.unit}` : ''}, tersedia ${mat ? mat.current_stock : 0}`);
      }
    }
    if (shortages.length > 0) return { ok: false, shortages };

    const movements = this.getStockMovements();
    const notifications = this.getNotifications();
    let notifChanged = false;

    const updatedMaterials = materials.map(mat => {
      const used = materialsUsed.find(item => item.material_id === mat.id);
      if (!used) return mat;
      const newStock = mat.current_stock - used.qty;
      movements.unshift({
        id: uuid(),
        type: 'bahan_keluar',
        department_id: mat.department_id,
        item_id: mat.id,
        item_name: mat.name,
        amount: used.qty,
        reference: `Order Produksi ${job.order_number || job.id}`,
        created_at: wibNowISO()
      });
      if (newStock <= mat.stock_minimum) {
        notifications.unshift({
          id: uuid(),
          type: 'low_stock',
          message: `Stok kritis: ${mat.name} tersisa ${newStock} ${mat.unit} (Batas minimum: ${mat.stock_minimum} ${mat.unit})`,
          target_role: 'admin_gudang',
          is_read: false,
          created_at: wibNowISO()
        });
        notifChanged = true;
      }
      return { ...mat, current_stock: newStock };
    });

    this.setRawMaterials(updatedMaterials);
    this.setStockMovements(movements);
    if (notifChanged) this.setNotifications(notifications);
    this.setProductionJobs([job, ...this.getProductionJobs()]);
    this.logAudit('create', 'production_job', `Membuat order produksi manual ${job.order_number || job.id} untuk ${job.product_name}`, job.id);
    return { ok: true, shortages: [] };
  };

  postProductionTaskLog = (log: ProductionTaskLog): void => {
    this.setProductionTaskLogs([log, ...this.getProductionTaskLogs()]);
    this.logAudit('create', 'production_task_log', `${log.employee_name} mencatat kerja ${log.task_name} (${log.qty_done} selesai, ${log.qty_rejected} reject)`, log.id);
  };

  deleteProductionTaskLog = (logId: string): boolean => {
    const logs = this.getProductionTaskLogs();
    const target = logs.find(log => log.id === logId);
    if (!target) return false;
    this.setProductionTaskLogs(logs.filter(log => log.id !== logId));
    this.logAudit('delete', 'production_task_log', `Menghapus catatan kerja ${target.task_name} milik ${target.employee_name}`, logId);
    return true;
  };

  // Hapus job produksi + balikin efek stoknya, agar bisa dibuat ulang dari awal.
  // Bahan baku yang sudah dipotong dikembalikan; kalau job sudah selesai, barang jadi ditarik lagi
  // dan barang reject terkait ikut dihapus.
  deleteProductionJob = (jobId: string): { ok: boolean; message?: string } => {
    const jobs = this.getProductionJobs();
    const job = jobs.find(item => item.id === jobId);
    if (!job) return { ok: false, message: 'Order produksi tidak ditemukan.' };

    const movements = this.getStockMovements();
    const ref = `Batal Produksi ${job.order_number || job.id}`;

    // 1. Kembalikan bahan baku yang dipotong saat produksi dibuat
    const materials = this.getRawMaterials();
    const updatedMaterials = materials.map(mat => {
      const used = (job.materials_planned || []).find(item => item.material_id === mat.id);
      if (!used) return mat;
      movements.unshift({
        id: uuid(), type: 'bahan_masuk', department_id: mat.department_id, item_id: mat.id, item_name: mat.name,
        amount: used.qty, reference: ref, created_at: wibNowISO()
      });
      return { ...mat, current_stock: mat.current_stock + used.qty };
    });
    this.setRawMaterials(updatedMaterials);

    // 2. Kalau job sudah selesai, barang jadi sudah masuk gudang -> tarik lagi
    if (job.status === 'completed') {
      const pulls = (job.outputs && job.outputs.length > 0)
        ? job.outputs.map(o => ({ product_id: o.product_id, product_name: o.product_name, qty: o.good_qty }))
        : [{ product_id: job.product_id, product_name: job.product_name, qty: job.qty }];
      const products = this.getProducts();
      const updatedProducts = products.map(product => {
        const pull = pulls.find(p => p.product_id === product.id && p.qty > 0);
        if (!pull) return product;
        movements.unshift({
          id: uuid(), type: 'barang_jadi_keluar', item_id: product.id, item_name: product.name,
          amount: pull.qty, reference: ref, created_at: wibNowISO()
        });
        return { ...product, stock: Math.max(0, product.stock - pull.qty) };
      });
      this.setProducts(updatedProducts);
      // Buang barang reject yang tercatat dari job ini
      this.setRejectedGoods(this.getRejectedGoods().filter(rg => rg.production_job_id !== job.id));
    }

    this.setStockMovements(movements);
    this.setProductionJobs(jobs.filter(item => item.id !== jobId));
    this.logAudit('delete', 'production_job', `Menghapus order produksi ${job.order_number || job.id} (${job.product_name}) & mengembalikan stok bahan`, jobId);
    return { ok: true };
  };

  finalizeProductionOutput = (
    jobId: string,
    outputs: Array<{ product_id: string; product_name: string; variant: string; good_qty: number; reject_qty: number; reject_reason?: string }>
  ): { ok: boolean; message?: string } => {
    const jobs = this.getProductionJobs();
    const job = jobs.find(item => item.id === jobId);
    if (!job) return { ok: false, message: 'Order produksi tidak ditemukan.' };

    const products = this.getProducts();
    const movements = this.getStockMovements();
    const rejectedGoods = this.getRejectedGoods();
    const actor = this.currentActor();

    const updatedProducts = products.map(product => {
      const output = outputs.find(item => item.product_id === product.id);
      if (!output || output.good_qty <= 0) return product;
      movements.unshift({
        id: uuid(),
        type: 'barang_jadi_masuk',
        department_id: product.department_id,
        item_id: product.id,
        item_name: product.name,
        amount: output.good_qty,
        reference: `Hasil Produksi ${job.order_number || job.id}`,
        created_at: wibNowISO()
      });
      return { ...product, stock: product.stock + output.good_qty };
    });

    for (const output of outputs) {
      if (output.reject_qty <= 0) continue;
      rejectedGoods.unshift({
        id: uuid(),
        production_job_id: job.id,
        product_id: output.product_id,
        product_name: output.product_name,
        variant: output.variant,
        qty: output.reject_qty,
        reason: output.reject_reason || 'Reject produksi',
        status: 'disimpan',
        created_at: wibNowISO(),
        created_by_id: actor.id,
        created_by_name: actor.name
      });
    }

    const updatedJobs = jobs.map(item => {
      if (item.id !== job.id) return item;
      const savedOutputs = outputs.map(output => ({
        product_id: output.product_id,
        product_name: output.product_name,
        variant: output.variant,
        target_qty: item.outputs?.find(saved => saved.product_id === output.product_id)?.target_qty || item.qty,
        good_qty: output.good_qty,
        reject_qty: output.reject_qty
      }));
      return {
        ...item,
        outputs: savedOutputs,
        status: 'completed' as const,
        stages: item.stages.map(stage => ({ ...stage, status: 'completed' as const, updated_at: wibNowISO(), updated_by: actor.name })),
        current_stage: item.stages[item.stages.length - 1]?.stage || item.current_stage
      };
    });

    this.setProducts(updatedProducts);
    this.setStockMovements(movements);
    this.setRejectedGoods(rejectedGoods);
    this.setProductionJobs(updatedJobs);
    this.logAudit('update', 'production_job', `Finalisasi hasil produksi ${job.order_number || job.id}`, job.id);
    return { ok: true };
  };

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
          department_id: mat.department_id,
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
          department_id: p.department_id,
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
      id: `PR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
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
    this.setProductionHandoffs([]);
    this.setRejectedGoods([]);
    this.setProductionTaskLogs([]);
    this.setPackingTasks([]);
    this.setAttendanceAdjustments([]);
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
    clearAttendanceInCloud();
    this.setPayrollWeekly([]);
    this.setCashAdvances([]);
    this.setCashAdvanceTransactions([]);
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
        department_id: mat.department_id,
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
      department_id: product.department_id, // snapshot: divisi produk bisa berubah nanti
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
          department_id: p.department_id,
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

  createCashAdvance = (input: {
    employee_id: string;
    amount: number;
    date?: string;
    note?: string;
    created_by_id?: string;
    created_by_name?: string;
  }): CashAdvance => {
    const employee = this.getEmployees().find(emp => emp.id === input.employee_id);
    if (!employee) throw new Error('Karyawan tidak ditemukan.');
    const amount = Math.round(Number(input.amount) || 0);
    if (amount <= 0) throw new Error('Nominal kasbon harus lebih dari nol.');
    const date = input.date || wibTodayStr();
    const cashAdvance: CashAdvance = {
      id: uuid(),
      employee_id: employee.id,
      employee_name: employee.name,
      amount,
      date,
      remaining_balance: amount
    };
    const transaction: CashAdvanceTransaction = {
      id: uuid(),
      cash_advance_id: cashAdvance.id,
      employee_id: employee.id,
      employee_name: employee.name,
      type: 'create',
      amount,
      date,
      note: input.note,
      created_at: wibNowISO(),
      created_by_id: input.created_by_id,
      created_by_name: input.created_by_name
    };
    this.setCashAdvances([cashAdvance, ...this.getCashAdvances()]);
    this.setCashAdvanceTransactions([transaction, ...this.getCashAdvanceTransactions()]);
    this.logAudit('create', 'cash_advance', `Membuat kasbon ${employee.name} sebesar Rp ${amount.toLocaleString('id-ID')}`, cashAdvance.id, { note: input.note });
    return cashAdvance;
  };

  topUpCashAdvance = (input: {
    cash_advance_id: string;
    amount: number;
    date?: string;
    note?: string;
    created_by_id?: string;
    created_by_name?: string;
  }): CashAdvance => {
    const amount = Math.round(Number(input.amount) || 0);
    if (amount <= 0) throw new Error('Nominal tambah saldo harus lebih dari nol.');
    const advances = this.getCashAdvances();
    const target = advances.find(adv => adv.id === input.cash_advance_id);
    if (!target) throw new Error('Data kasbon tidak ditemukan.');
    const updatedTarget = {
      ...target,
      amount: (Number(target.amount) || 0) + amount,
      remaining_balance: (Number(target.remaining_balance) || 0) + amount
    };
    this.setCashAdvances(advances.map(adv => adv.id === target.id ? updatedTarget : adv));
    const transaction: CashAdvanceTransaction = {
      id: uuid(),
      cash_advance_id: target.id,
      employee_id: target.employee_id,
      employee_name: target.employee_name,
      type: 'topup',
      amount,
      date: input.date || wibTodayStr(),
      note: input.note,
      created_at: wibNowISO(),
      created_by_id: input.created_by_id,
      created_by_name: input.created_by_name
    };
    this.setCashAdvanceTransactions([transaction, ...this.getCashAdvanceTransactions()]);
    this.logAudit('update', 'cash_advance', `Menambah saldo kasbon ${target.employee_name} sebesar Rp ${amount.toLocaleString('id-ID')}`, target.id, { note: input.note });
    return updatedTarget;
  };

  applyCashAdvancePayment = (input: {
    employee_id: string;
    amount: number;
    type: 'deduction' | 'payment' | 'adjustment';
    date?: string;
    note?: string;
    payroll_id?: string;
    created_by_id?: string;
    created_by_name?: string;
  }): number => {
    let remainingPayment = Math.round(Number(input.amount) || 0);
    if (remainingPayment <= 0) throw new Error('Nominal pembayaran kasbon harus lebih dari nol.');
    const advances = this.getCashAdvances();
    const transactions: CashAdvanceTransaction[] = [];
    const date = input.date || wibTodayStr();
    const updatedAdvances = advances.map(adv => {
      if (adv.employee_id !== input.employee_id || adv.remaining_balance <= 0 || remainingPayment <= 0) return adv;
      const paid = Math.min(adv.remaining_balance, remainingPayment);
      remainingPayment -= paid;
      transactions.push({
        id: uuid(),
        cash_advance_id: adv.id,
        employee_id: adv.employee_id,
        employee_name: adv.employee_name,
        type: input.type,
        amount: paid,
        date,
        note: input.note,
        payroll_id: input.payroll_id,
        created_at: wibNowISO(),
        created_by_id: input.created_by_id,
        created_by_name: input.created_by_name
      });
      return { ...adv, remaining_balance: adv.remaining_balance - paid };
    });
    if (transactions.length === 0) throw new Error('Tidak ada saldo kasbon aktif untuk karyawan ini.');
    this.setCashAdvances(updatedAdvances);
    this.setCashAdvanceTransactions([...transactions, ...this.getCashAdvanceTransactions()]);
    const applied = Math.round(Number(input.amount) || 0) - remainingPayment;
    this.logAudit('update', 'cash_advance', `Mencatat pembayaran kasbon sebesar Rp ${applied.toLocaleString('id-ID')}`, input.employee_id, { type: input.type, note: input.note, payroll_id: input.payroll_id });
    return applied;
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

  setPayrollPaymentStatus = (payrollId: string, status: 'paid' | 'unpaid'): void => {
    const payrolls = this.getPayrollWeekly().map(p =>
      p.id === payrollId ? { ...p, payment_status: status, paid_at: status === 'paid' ? wibNowISO() : undefined } : p
    );
    this.setPayrollWeekly(payrolls);
  };

  getAttendanceFailures = (): AttendanceFailure[] => this.get('attendance_failures', []);

  /**
   * Catat satu percobaan scan yang gagal. Sengaja TIDAK melempar error apa pun:
   * pencatatan jejak tidak boleh ikut menggagalkan alur scan yang sudah gagal.
   * Disimpan 500 terakhir saja supaya localStorage perangkat kiosk tidak penuh.
   */
  logAttendanceFailure = (entry: Omit<AttendanceFailure, 'id' | 'timestamp' | 'employee_name'> & { employee_name?: string }): void => {
    try {
      const timestamp = wibNowISO();
      const employee = this.getEmployees().find(e => e.id === entry.employee_id);
      const record: AttendanceFailure = {
        ...entry,
        id: `fail-${entry.employee_id || 'anon'}-${timestamp}`,
        timestamp,
        employee_name: entry.employee_name || employee?.name || '(belum dipilih)',
      };
      this.set('attendance_failures', [record, ...this.getAttendanceFailures()].slice(0, 500));
    } catch { /* jejak gagal ditulis: abaikan, jangan ganggu alur scan */ }
  };

  /**
   * Koreksi admin: catatkan scan PULANG yang tidak pernah dilakukan karyawan
   * (mis. lupa scan saat pulang Sabtu). Tanpa GPS — dipertanggungjawabkan lewat
   * alasan wajib + audit log, dan hanya untuk hari yang scan masuknya sudah ada.
   */
  recordMissingCheckout = (employeeId: string, date: string, time: string, reason: string): Attendance => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error('Koreksi ditolak: alasan wajib diisi.');
    if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('Koreksi ditolak: jam pulang tidak valid.');
    if (date > wibTodayStr()) throw new Error('Koreksi ditolak: tanggal belum terjadi.');

    const emp = this.getEmployees().find(e => e.id === employeeId);
    if (!emp) throw new Error('Karyawan tidak ditemukan.');

    const logs = this.getAttendance();
    const dayLogs = logs.filter(l => l.employee_id === employeeId && l.timestamp.slice(0, 10) === date);
    const checkIn = dayLogs.find(l => l.type_scan === 'masuk');
    if (!checkIn) throw new Error(`Koreksi ditolak: ${emp.name} tidak punya scan MASUK pada ${date}.`);
    if (dayLogs.some(l => l.type_scan === 'pulang')) throw new Error(`Koreksi ditolak: scan PULANG ${date} sudah ada.`);
    if (time < checkIn.timestamp.slice(11, 16)) throw new Error('Koreksi ditolak: jam pulang lebih awal dari jam masuk.');

    const actor = this.getCurrentActor();
    const timestamp = `${date}T${time}:00+07:00`;
    const record: Attendance = {
      id: `att-${employeeId}-${date}-pulang`,
      employee_id: employeeId,
      employee_name: emp.name,
      timestamp,
      type_scan: 'pulang',
      // Koreksi manual tidak punya titik GPS; dipakai koordinat departemen sebagai penanda.
      latitude: 0,
      longitude: 0,
      distance_meters: 0,
      selfie_url: '',
      device_token: 'koreksi-admin',
      is_mock_location_flag: false,
      status: 'normal',
      verification_method: 'admin_qr',
      assisted_by_id: actor.id,
      assisted_by_name: actor.name,
      assistance_reason: trimmedReason,
      early_leave_reason: time < this.getWorkSettings().end_time ? trimmedReason : undefined,
      ...checkoutMetrics(checkIn, timestamp, this.getWorkSettings()),
    };

    logs.unshift(record);
    this.setAttendance(logs);
    pushAttendanceToCloud(record);
    this.logAudit('update', 'attendance', `Koreksi scan pulang ${emp.name} ${date} jam ${time} — ${trimmedReason}`);
    return record;
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

    const workSettings = this.getWorkSettings();
    const distance = R * c; // meters
    const allowedRadius = Math.max(1, workSettings.attendance_radius_meters || INITIAL_WORK_SETTINGS.attendance_radius_meters);
    if (distance > allowedRadius) {
      throw new Error(`Absen ditolak: lokasi Anda ${Math.round(distance)} m dari ${dept.name}. Batas radius absensi adalah ${allowedRadius} m.`);
    }

    const pulangClock = att.timestamp.slice(11, 16);
    // Absen MASUK di sore hari hampir selalu salah pencet (niatnya pulang) dan merusak
    // data: late_minutes jadi berjam-jam dan bonus kehadiran hari itu gugur. Kejadian
    // nyata (datang siang karena izin) tetap bisa lewat jalur admin yang wajib beralasan.
    if (
      att.type_scan === 'masuk' &&
      pulangClock >= workSettings.full_day_from &&
      att.verification_method !== 'admin_qr'
    ) {
      throw new Error(`Absen MASUK ditolak: sudah lewat ${workSettings.full_day_from}. Bila memang baru datang, minta admin mencatatkan lewat QR pribadi disertai alasan.`);
    }

    if (
      att.type_scan === 'pulang' &&
      pulangClock >= workSettings.full_day_from && pulangClock < workSettings.end_time &&
      !att.early_leave_reason?.trim()
    ) {
      throw new Error(`Pulang sebelum ${workSettings.end_time} tetap dihitung 1 hari, tapi wajib disertai alasan.`);
    }

    const status: Attendance['status'] = 'normal';
    const timestampClock = att.timestamp.slice(11, 16);
    let attendanceMetrics: Partial<Attendance> = {};
    if (att.type_scan === 'masuk') {
      attendanceMetrics.late_minutes = Math.max(0, clockMinutes(timestampClock) - clockMinutes(workSettings.start_time));
    } else {
      const checkIn = sameDayLogs.find(log => log.type_scan === 'masuk');
      if (checkIn) attendanceMetrics = checkoutMetrics(checkIn, att.timestamp, workSettings);
    }

    const newAttendance: Attendance = {
      ...att,
      ...attendanceMetrics,
      // Id deterministik: satu baris per karyawan/tanggal/jenis scan. Primary key di
      // Supabase yang jadi penjaga terakhir bila dua perangkat scan bersamaan —
      // pemeriksaan di atas hanya melihat data lokal yang bisa saja belum ter-sync.
      id: `att-${att.employee_id}-${dateStr}-${att.type_scan}`,
      employee_name: emp.name,
      distance_meters: Math.round(distance * 10) / 10,
      is_mock_location_flag: false,
      status,
      // Pengajuan lembur / live TikTok hanya sah pada scan pulang.
      overtime_request: att.type_scan === 'pulang' ? att.overtime_request : undefined,
      live_tiktok_request: att.type_scan === 'pulang' ? att.live_tiktok_request : undefined,
    };

    attendanceLogs.unshift(newAttendance);
    this.setAttendance(attendanceLogs);
    // Kirim per baris ke cloud (bebas tabrakan antar perangkat, dengan antrean offline)
    pushAttendanceToCloud(newAttendance);
    return newAttendance;
  };
}

export const dataStore = new DataStore();
