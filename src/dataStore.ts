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
} from './types';
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
// Koordinat kantor/pabrik ARI SPORTINDO (acuan geofence absensi, radius 100 m)
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

const INITIAL_ORDERS: Order[] = [];

const INITIAL_PRODUCTION_JOBS: ProductionJob[] = [];

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


const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [];

const INITIAL_PRODUCTION_LOGS: ProductionLog[] = [];

const INITIAL_ATTENDANCE: Attendance[] = [];

const INITIAL_CASH_ADVANCES: CashAdvance[] = [];

const INITIAL_PAYROLL_WEEKLY: PayrollWeekly[] = [];

const INITIAL_INVOICES: Invoice[] = [];

const INITIAL_DELIVERY_NOTES: DeliveryNote[] = [];

const INITIAL_RETURNS: Return[] = [];

const INITIAL_MARKETPLACE_SALES: MarketplaceSale[] = [];

const INITIAL_MARKETPLACE_ITEM_SALES: MarketplaceItemSale[] = [];

const INITIAL_PURCHASES: Purchase[] = [];

const INITIAL_DAILY_EXPENSES: DailyExpense[] = [];

const INITIAL_NOTIFICATIONS: NotificationLog[] = [];

const INITIAL_CALIBRATION: PrinterCalibration = {
  offset_x: 0,
  offset_y: 0
};

// Main DataStore wrapper class to synchronize with LocalStorage
class DataStore {
  private auditKey = 'audit_logs';
  private recycleKey = 'recycle_bin';

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
    clearAttendanceInCloud();
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
    // Kirim per baris ke cloud (bebas tabrakan antar perangkat, dengan antrean offline)
    pushAttendanceToCloud(newAttendance);
    return newAttendance;
  };
}

export const dataStore = new DataStore();
