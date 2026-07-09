export interface Department {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export type EmployeeRole = 'karyawan' | 'leader';

export interface Employee {
  id: string;
  username?: string; // Username login (unik, huruf kecil); diisi otomatis dari nama bila kosong
  name: string;
  department_id: string;
  role: EmployeeRole;
  rate_harian: number;
  rate_lembur_per_jam: number;
  default_live_tiktok_bonus?: number;
  default_attendance_bonus?: number;
  default_weekly_cash_advance_deduction?: number;
  status_aktif: boolean;
  phone_number: string;
  pin: string; // Stored securely (can be simulated hash)
  pin_hashed?: boolean; // Flags that PIN is stored as simulated SHA-256
  allowed_tabs?: string[]; // Custom tabs this employee is allowed to see (Row Level Security / RLS)
  access_role?: UserRole; // Akses sistem karyawan ini (owner/admin/gudang); kosong = karyawan biasa
  photo_url?: string; // Foto profil (data URL kecil, diunggah dari halaman Profil Saya)
  attendance_qr_token?: string; // Token acak untuk kartu QR absensi; bukan PIN atau data pribadi
}

export type AttendanceWorkStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'cuti' | 'alpha' | 'lembur' | 'pulang_cepat';

export interface Shift {
  id: string;
  name: string;
  start_time: string; // "HH:MM" e.g., "08:00"
  end_time: string;   // "HH:MM" e.g., "17:00"
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  type: 'izin' | 'sakit' | 'cuti';
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Product {
  id: string;
  department_id: string;
  name: string;
  category: string;
  variant: string;
  harga_jual: number;
  stock: number;
  // Urutan tahapan produksi khusus produk ini; kosong = pakai alur bawaan departemen
  production_stages?: string[];
}

export interface RawMaterial {
  id: string;
  name: string;
  department_id?: string;
  unit: string;
  stock_minimum: number;
  current_stock: number;
}

export type MovementType = 'bahan_masuk' | 'bahan_keluar' | 'barang_jadi_masuk' | 'barang_jadi_keluar';

export interface StockMovement {
  id: string;
  type: MovementType;
  item_id: string; // can be raw_material_id or product_id
  item_name: string;
  amount: number;
  reference: string; // e.g. "Produksi #123", "Penjualan #456", "Pembelian Bahan"
  created_at: string;
}

export interface ProductionLog {
  id: string;
  department_id: string;
  product_id: string;
  product_name: string;
  qty_produced: number;
  materials_used: Array<{
    material_id: string;
    material_name: string;
    qty: number;
  }>;
  date: string;
}

export type AttendanceType = 'masuk' | 'pulang';
export type AttendanceStatus = 'normal' | 'anomaly';

export interface Attendance {
  id: string;
  employee_id: string;
  employee_name: string;
  timestamp: string;
  type_scan: AttendanceType;
  latitude: number;
  longitude: number;
  distance_meters: number;
  selfie_url: string;
  device_token: string;
  is_mock_location_flag: boolean;
  status: AttendanceStatus;
  note?: string;
  verification_method?: 'gps_self' | 'admin_qr';
  assisted_by_id?: string;
  assisted_by_name?: string;
  assistance_reason?: string;
  late_minutes?: number;
  late_compensation_minutes?: number;
  worked_minutes?: number;
  work_fraction?: 0.5 | 1;
  overtime_minutes?: number;
}

// Identitas brand/perusahaan — dapat diubah owner di menu Pengaturan (white label)
export interface BrandSettings {
  company_name: string;      // Nama brand, tampil di header, laporan, QR, dsb.
  legal_name: string;        // Nama badan hukum untuk slip gaji ("PT ...")
  tagline: string;           // Subjudul di bawah nama brand
  logo_data_url: string;     // Logo (data URL base64); '' = tampilkan nama saja
  primary_color: string;     // Warna utama tema, format hex (mis. #1F4B36)
}

export interface WorkSettings {
  start_time: string;
  end_time: string;
  timezone: 'Asia/Jakarta';
  half_day_max_hours: number;
  attendance_radius_meters: number;
  monthly_bonus_amount: number;
  monthly_bonus_min_days: number;
  location_qr_token: string;
  // Cara hasil kerja berpindah antar karyawan produksi:
  // assign = wajib tunjuk penerima; queue = selalu lepas ke antrean (ambil sendiri);
  // hybrid = karyawan memilih salah satu saat serah terima
  production_handoff_mode?: 'assign' | 'queue' | 'hybrid';
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor_id?: string;
  actor_name: string;
  actor_role: UserRole | 'system';
  action: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete';
  entity_type: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface RecycleEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  label: string;
  data: Record<string, unknown>;
  deleted_at: string;
  deleted_by_id?: string;
  deleted_by_name: string;
  reason: string;
  expires_at: string;
}

export interface CashAdvance {
  id: string;
  employee_id: string;
  employee_name: string;
  amount: number;
  date: string;
  remaining_balance: number;
}

export type CashAdvanceTransactionType = 'create' | 'topup' | 'deduction' | 'payment' | 'adjustment';

export interface CashAdvanceTransaction {
  id: string;
  cash_advance_id: string;
  employee_id: string;
  employee_name: string;
  type: CashAdvanceTransactionType;
  amount: number;
  date: string;
  note?: string;
  payroll_id?: string;
  created_at: string;
  created_by_id?: string;
  created_by_name?: string;
}

export interface PayrollWeekly {
  id: string;
  employee_id: string;
  employee_name: string;
  period_start: string;
  period_end: string;
  days_worked: number;
  overtime_hours: number;
  base_pay: number;
  bonus: number;
  cash_advance_deduction: number;
  total_pay: number;
  is_printed: boolean;
}

export type AttendanceAdjustmentType = 'late_compensation' | 'overtime' | 'live_tiktok' | 'ignored';

export interface AttendanceAdjustment {
  id: string;
  attendance_id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  checkout_time: string;
  type: AttendanceAdjustmentType;
  late_compensation_minutes?: number;
  overtime_minutes?: number;
  bonus_amount?: number;
  note?: string;
  approved_by_id?: string;
  approved_by_name?: string;
  approved_at: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  contact: string;
}

export interface InvoiceItem {
  id: string;
  product_id: string;
  product_name: string;
  variant: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface Invoice {
  id: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  date: string;
  due_date: string;
  items: InvoiceItem[];
  subtotal: number;
  dp: number;
  tax: number;
  total: number;
  payment_status: 'lunas' | 'belum_lunas';
}

export interface DeliveryNote {
  id: string;
  customer_id: string;
  customer_name: string;
  delivery_number: string;
  date: string;
  expedition: string;
  items: Array<{
    product_id: string;
    product_name: string;
    variant: string;
    qty: number;
  }>;
  status: 'dikirim' | 'diterima';
}

export interface Return {
  id: string;
  invoice_id: string;
  invoice_number: string;
  date: string;
  reason: string;
  product_id: string;
  product_name: string;
  qty: number;
}

export interface MarketplaceSale {
  id: string;
  channel: 'tokopedia' | 'tiktok' | 'shopee';
  date: string;
  order_count: number;
  revenue: number;
  admin_name: string;
}

export interface MarketplaceItemSale {
  id: string;
  product_id?: string; // Link opsional ke produk gudang; jika terisi, stok produk jadi dipotong otomatis
  date: string;
  order_number: string;
  marketplace_ref: string; // e.g., Tokopedia, Shopee, TikTok Shop, etc.
  description: string;
  qty: number;
  price: number;
  subtotal: number;
  admin_fee: number; // Biaya potongan admin marketplace
  total: number; // Subtotal - admin_fee
  admin_staff: string; // Staf penginput
}

export interface PurchaseOrderItem {
  id: string;
  description: string;
  qty: number;
  price: number;
  subtotal: number;
  material_id?: string; // Link opsional ke inventory bahan baku
}

export interface Purchase {
  id: string;
  po_number: string; // e.g. "08/TA/14/26"
  supplier: string; // e.g. "Toko anyar"
  date: string; // Tanggal transaksi
  items: PurchaseOrderItem[];
  total_price: number; // Total harga PO
  status: 'pending' | 'completed' | 'cancelled';
  admin_staff?: string;
}

export interface DailyExpense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number; // Ini adalah total/subtotal
  admin_name: string;
  qty?: number;
  price?: number;
}

export interface NotificationLog {
  id: string;
  type: 'attendance_anomaly' | 'low_stock' | 'due_invoice' | 'new_return';
  message: string;
  target_role: string;
  is_read: boolean;
  created_at: string;
}

export interface PrinterCalibration {
  offset_x: number;
  offset_y: number;
}

export type UserRole =
  | 'owner' 
  | 'admin_penjualan' 
  | 'admin_produksi' 
  | 'admin_gudang' 
  | 'admin_keuangan' 
  | 'admin_hrd'
  | 'karyawan'
  | 'admin_eva_foam' 
  | 'admin_konveksi' 
  | 'admin_marketplace' 
  | 'admin_keuangan_hr';

export interface ProductionStageProgress {
  stage: string; // e.g. "Formulation", "Molding", "Cutting", "Sablon", "Jahit", "Finishing"
  status: 'pending' | 'ongoing' | 'completed';
  updated_at?: string;
  updated_by?: string;
  notes?: string;
}

export interface ProductionJob {
  id: string;
  order_id?: string;
  order_number?: string;
  product_id: string;
  product_name: string;
  variant: string;
  qty: number;
  department_id: 'dept-eva-foam' | 'dept-konveksi';
  stages: ProductionStageProgress[];
  current_stage: string; // The stage currently in progress/completed last
  status: 'pending' | 'ongoing' | 'completed';
  notes?: string;
  created_at: string;
  materials_planned?: Array<{
    material_id: string;
    material_name: string;
    qty: number;
    unit: string;
  }>;
  outputs?: Array<{
    product_id: string;
    product_name: string;
    variant: string;
    target_qty: number;
    good_qty: number;
    reject_qty: number;
  }>;
  assigned_employees?: Array<{
    employee_id: string;
    employee_name: string;
  }>;
}

export interface RejectedGood {
  id: string;
  production_job_id?: string;
  product_id: string;
  product_name: string;
  variant?: string;
  qty: number;
  reason: string;
  status: 'disimpan' | 'diperbaiki' | 'dibuang' | 'dijual_murah';
  created_at: string;
  created_by_id?: string;
  created_by_name?: string;
}

export interface ProductionTaskLog {
  id: string;
  production_job_id: string;
  production_label: string;
  employee_id: string;
  employee_name: string;
  date: string;
  stage_name: string;
  task_name: string;
  qty_done: number;
  qty_rejected: number;
  notes?: string;
  created_at: string;
}

export interface PackingTask {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  employee_id: string;
  employee_name: string;
  items: OrderItem[];
  status: 'assigned' | 'completed';
  notes?: string;
  completed_note?: string;
  created_at: string;
  completed_at?: string;
}

export interface ProductionHandoff {
  id: string;
  job_id: string;
  order_number?: string;
  product_name: string;
  from_stage: string;
  to_stage: string;
  from_department_id: string;
  to_department_id: string;
  from_employee_id: string;
  from_employee_name: string;
  to_employee_id?: string;
  to_employee_name?: string;
  qty_sent: number;
  qty_rejected: number;
  qty_received?: number;
  status: 'pending' | 'accepted' | 'disputed';
  notes?: string;
  dispute_note?: string;
  created_at: string;
  received_at?: string;
  received_by_id?: string;
  received_by_name?: string;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  variant: string;
  qty: number;
  price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  source: 'online' | 'offline'; // online (Shopee/Tokopedia/TikTok) or offline (Direct/Custom)
  marketplace_name?: string; // Shopee, Tokopedia, TikTok Shop, etc.
  date: string;
  items: OrderItem[];
  shipping_fee?: number; // Ongkir untuk order langsung/non-marketplace (masuk ke total)
  total: number;
  status: 'pending' | 'production' | 'completed' | 'cancelled';
  notes?: string;
  shipping_expedition?: string;
  tracking_number?: string;
  shipping_date?: string;
  shipping_proof_url?: string;
  shipping_status?: 'belum_dikirim' | 'siap_dikirim' | 'dikirim' | 'diterima';
  packing_employee_id?: string;
  packing_employee_name?: string;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  department_id: string; // e.g. dept-eva-foam, dept-konveksi, atau general
  department_name: string;
  purchase_date: string;
  cost: number;
  status: 'baik' | 'diservis' | 'rusak';
  notes?: string;
}
