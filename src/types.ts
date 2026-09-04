/**
 * Kode divisi untuk nomor induk: huruf/angka saja, huruf besar, tanpa spasi.
 * Kata "DEPARTEMEN" dibuang supaya 'Departemen Konveksi' -> 'KONVEKSI' dan
 * 'Eva Foam' -> 'EVAFOAM', sesuai format yang dipakai perusahaan.
 */
export const departmentCode = (name?: string): string =>
  (name || '')
    .toUpperCase()
    .replace(/DEPARTEMEN/g, '')
    .replace(/[^A-Z0-9]/g, '') || 'UMUM';

/** Awalan perusahaan pada nomor induk. */
export const EMPLOYEE_NUMBER_PREFIX = 'AR';

/**
 * Nomor induk berikutnya untuk satu divisi, mis. 'AR-KONVEKSI-026'.
 *
 * Urut PER DIVISI, dan nomor bekas karyawan yang keluar TIDAK dipakai ulang:
 * selalu satu di atas nomor tertinggi yang pernah terbit di divisi itu — termasuk
 * milik karyawan non-aktif — supaya satu nomor tidak pernah menunjuk dua orang.
 */
export const nextEmployeeNumber = (
  employees: Array<{ employee_number?: string }>,
  departmentName: string | undefined,
  digits = 3
): string => {
  const prefix = `${EMPLOYEE_NUMBER_PREFIX}-${departmentCode(departmentName)}-`;
  const tertinggi = employees.reduce((max, e) => {
    const nomor = e.employee_number || '';
    if (!nomor.startsWith(prefix)) return max;
    const angka = Number(nomor.slice(prefix.length));
    return Number.isFinite(angka) ? Math.max(max, angka) : max;
  }, 0);
  return `${prefix}${String(tertinggi + 1).padStart(digits, '0')}`;
};

export interface Department {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export type EmployeeRole = 'karyawan' | 'leader';

export type EmploymentStatus = 'training' | 'karyawan';

export const EMPLOYMENT_STATUSES: Array<{ id: EmploymentStatus; label: string }> = [
  { id: 'training', label: 'Training' },
  { id: 'karyawan', label: 'Karyawan' },
];

/** Status kepegawaian efektif; data lama tanpa status dianggap sudah karyawan. */
export const employmentStatusOf = (employee?: { employment_status?: EmploymentStatus }): EmploymentStatus =>
  employee?.employment_status || 'karyawan';

/**
 * Jumlah hari kerja dalam satu bulan 'YYYY-MM' (Minggu libur, sama seperti penilaian
 * bonus kehadiran). Dipakai untuk menghitung sisa hari kerja bulan berjalan.
 */
/**
 * Ubah rupiah jadi kalimat terbilang untuk slip gaji, mis. 910000 -> "sembilan ratus
 * sepuluh ribu rupiah". Nilai negatif diberi awalan "minus".
 */
export const terbilang = (nilai: number): string => {
  const angka = Math.round(Math.abs(nilai));
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const eja = (n: number): string => {
    if (n < 12) return satuan[n];
    if (n < 20) return `${eja(n - 10)} belas`;
    if (n < 100) return `${eja(Math.floor(n / 10))} puluh ${eja(n % 10)}`.trim();
    if (n < 200) return `seratus ${eja(n - 100)}`.trim();
    if (n < 1000) return `${eja(Math.floor(n / 100))} ratus ${eja(n % 100)}`.trim();
    if (n < 2000) return `seribu ${eja(n - 1000)}`.trim();
    if (n < 1000000) return `${eja(Math.floor(n / 1000))} ribu ${eja(n % 1000)}`.trim();
    if (n < 1000000000) return `${eja(Math.floor(n / 1000000))} juta ${eja(n % 1000000)}`.trim();
    return `${eja(Math.floor(n / 1000000000))} miliar ${eja(n % 1000000000)}`.trim();
  };
  const kata = angka === 0 ? 'nol' : eja(angka).replace(/\s+/g, ' ').trim();
  return `${nilai < 0 ? 'minus ' : ''}${kata} rupiah`;
};

/** Tanggal terakhir bulan dari tanggal "YYYY-MM-DD", mis. "2026-08-22" -> "2026-08-31". */
export const lastDayOfMonth = (date: string): string => {
  const [year, mon] = date.split('-').map(Number);
  return `${date.slice(0, 7)}-${String(new Date(year, mon, 0).getDate()).padStart(2, '0')}`;
};

export const workingDaysInMonth = (month: string, effectiveFrom?: string): number => {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    if (new Date(`${dateStr}T00:00:00Z`).getUTCDay() === 0) continue; // Minggu libur
    if (effectiveFrom && dateStr < effectiveFrom) continue; // absensi belum dipakai
    count++;
  }
  return count;
};

/** Bonus kehadiran bulanan hanya hak karyawan, bukan yang masih training. */
export const isEligibleForAttendanceBonus = (employee?: { employment_status?: EmploymentStatus }): boolean =>
  employmentStatusOf(employee) === 'karyawan';

export interface Employee {
  id: string;
  username?: string; // Username login (unik, huruf kecil); diisi otomatis dari nama bila kosong
  name: string;
  department_id: string;
  role: EmployeeRole;
  rate_harian: number;
  rate_lembur_per_jam: number;
  default_live_tiktok_bonus?: number;
  // Tarif bonus kehadiran PER HARI layak (bukan per bulan). Saldo bulanan = hari layak x tarif.
  default_attendance_bonus?: number;
  default_weekly_cash_advance_deduction?: number;
  status_aktif: boolean;
  // Status kepegawaian. Kosong dianggap 'karyawan' agar data lama tidak berubah haknya.
  employment_status?: EmploymentStatus;
  phone_number: string;
  pin: string; // Stored securely (can be simulated hash)
  pin_hashed?: boolean; // Flags that PIN is stored as simulated SHA-256
  allowed_tabs?: string[]; // Custom tabs this employee is allowed to see (Row Level Security / RLS)
  access_role?: UserRole; // Akses sistem karyawan ini (owner/admin/gudang); kosong = karyawan biasa
  photo_url?: string; // Foto profil (data URL kecil, diunggah dari halaman Profil Saya)
  attendance_qr_token?: string; // Token acak untuk kartu QR absensi; bukan PIN atau data pribadi
  // Nomor induk karyawan, mis. 'AR-KONVEKSI-001'. TIDAK ikut berubah saat pindah
  // divisi: nomor induk adalah pegangan seumur kerja, divisi punya kolomnya sendiri.
  employee_number?: string;
  // Tanggal mulai bekerja 'YYYY-MM-DD'. Kehadiran sebelum tanggal ini tidak dinilai,
  // supaya karyawan baru tidak tercatat mangkir pada hari sebelum dia masuk.
  join_date?: string;
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

export const DIVISIONS = [
  { id: 'dept-eva-foam', label: 'Eva Foam' },
  { id: 'dept-konveksi', label: 'Konveksi' },
] as const;

export type DivisionId = typeof DIVISIONS[number]['id'];

/**
 * Label divisi sebuah transaksi/barang. department_id kosong berarti tidak dimiliki
 * satu divisi: untuk bahan baku artinya dipakai keduanya ("Umum"), untuk pengeluaran
 * artinya biaya bersama ("Bersama") yang pembagiannya diurus di laporan.
 */
export const divisionLabel = (department_id?: string, sharedLabel = 'Umum'): string =>
  DIVISIONS.find(d => d.id === department_id)?.label || sharedLabel;

/** Label divisi pemakai bahan baku. Bahan tanpa department_id dipakai kedua divisi. */
export const materialDivisionLabel = (material?: { department_id?: string }): 'Eva Foam' | 'Konveksi' | 'Umum' =>
  divisionLabel(material?.department_id) as 'Eva Foam' | 'Konveksi' | 'Umum';

export type MovementType = 'bahan_masuk' | 'bahan_keluar' | 'barang_jadi_masuk' | 'barang_jadi_keluar';

export interface StockMovement {
  id: string;
  department_id?: string; // Snapshot divisi item saat mutasi terjadi
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

// Slip bonus kehadiran bulanan — diterbitkan tiap tanggal 1 untuk bulan sebelumnya.
// Bulan GUGUR tetap dicatat (amount 0 + alasan) sebagai bukti riwayat.
export interface AttendanceBonusPayout {
  id: string;
  employee_id: string;
  employee_name: string;
  month: string; // 'YYYY-MM' bulan yang dinilai
  amount: number; // 0 bila gugur
  status: 'cair' | 'gugur';
  reason?: string; // alasan gugur (dari data absensi)
  working_days: number;
  present_days: number;
  late_minutes_net: number;
  half_days: number;
  issued_at: string;
  issued_by?: string;
  payment_status: 'paid' | 'unpaid';
  paid_at?: string;
}

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
  // Wajib diisi bila scan pulang antara full_day_from dan end_time (pulang cepat tetap dibayar penuh)
  early_leave_reason?: string;
  overtime_minutes?: number;
  // Pengajuan opsional yang dikirim karyawan saat scan PULANG. Hanya berupa
  // permintaan + alasan — nilai final (menit / nominal) ditetapkan admin saat ACC
  // di menu "Perlu Review". Tidak memengaruhi gaji sampai disetujui.
  overtime_request?: { reason: string; requested_at: string };
  live_tiktok_request?: { reason: string; requested_at: string };
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
  // Scan pulang sebelum half_day_start = 0 hari (perlu koreksi manual).
  // half_day_start s/d sebelum full_day_from = 0,5 hari. full_day_from ke atas = 1 hari,
  // tapi bila masih sebelum end_time wajib disertai alasan.
  half_day_start: string;
  full_day_from: string;
  attendance_radius_meters: number;
  // Tarif bonus kehadiran per hari bawaan, dipakai bila karyawan belum punya tarif sendiri.
  // Namanya masih 'monthly' karena kunci penyimpanannya sudah dipakai data lama.
  monthly_bonus_amount: number;
  location_qr_token: string;
  // Tanggal (YYYY-MM-DD) sejak absensi benar-benar dipakai. Hari kerja sebelum tanggal
  // ini tidak dinilai untuk bonus, supaya masa sebelum sistem dipakai tidak terhitung
  // sebagai tidak hadir. Kosong = nilai semua hari seperti sebelumnya.
  attendance_effective_from?: string;
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
  payment_status: 'unpaid' | 'paid';
  paid_at?: string;
}

export type AttendanceAdjustmentType = 'late_compensation' | 'overtime' | 'live_tiktok' | 'ignored';

/**
 * Catatan SATU percobaan scan yang GAGAL. Scan berhasil sudah punya jejaknya
 * sendiri di tabel absensi; tanpa ini kegagalan tidak meninggalkan bekas sama
 * sekali, sehingga keluhan "tidak bisa absen" mustahil ditelusuri.
 */
export interface AttendanceFailure {
  id: string;
  employee_id: string;
  employee_name: string;
  timestamp: string;
  type_scan?: AttendanceType;
  /** Tahap kegagalan: dipakai mengelompokkan sebab, bukan sekadar pesan bebas. */
  stage: 'pilih_karyawan' | 'qr_lokasi' | 'pin' | 'alasan_pulang_cepat' | 'gps' | 'ditolak_aturan';
  reason: string;
  device_token?: string;
  /** Diisi bila GPS sempat terbaca — menolong menilai keluhan radius. */
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
}

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
  // 'rejected' = pengajuan karyawan ditolak admin (tidak ikut gaji). Kosong/'approved'
  // = disetujui, agar data lama tetap terbaca sebagai disetujui.
  status?: 'approved' | 'rejected';
  rejection_reason?: string;
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

// Status order marketplace. Data lama tanpa status dianggap 'terkirim'
// agar angka laporan historis tidak berubah.
export type MarketplaceSaleStatus = 'diproses' | 'terkirim' | 'cancel' | 'retur';

export interface MarketplaceItemSale {
  id: string;
  department_id?: string; // Divisi pemilik omzet; diambil dari produk saat diposting
  product_id?: string; // Link opsional ke produk gudang; jika terisi, stok produk jadi dipotong otomatis
  status?: MarketplaceSaleStatus;
  retur_to_stock?: boolean; // khusus status retur: barang layak jual dikembalikan ke stok?
  date: string;
  created_at?: string; // Waktu input WIB; data lama tidak punya, fallback ke date
  order_number: string;
  marketplace_ref: string; // e.g., Tokopedia, Shopee, TikTok Shop, etc.
  description: string;
  qty: number;
  price: number;
  subtotal: number;
  admin_fee: number; // Biaya potongan admin marketplace
  total: number; // Subtotal - admin_fee
  admin_staff: string; // Staf penginput
  shipping_proof_url?: string; // Bukti foto pengiriman, sama untuk semua item satu order_number
  shipping_proof_uploaded_at?: string;
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
  department_id?: string; // Divisi yang memakai belanja ini; kosong = bersama
  po_number: string; // e.g. "08/TA/14/26"
  supplier: string; // e.g. "Toko anyar"
  date: string; // Tanggal transaksi
  items: PurchaseOrderItem[];
  total_price: number; // Total harga PO
  status: 'pending' | 'completed' | 'cancelled'; // status BARANG, bukan pembayaran
  admin_staff?: string;
  payment_method?: 'tunai' | 'hutang'; // tunai = dibayar saat PO dibuat
  due_date?: string; // Jatuh tempo bila hutang
  payments?: PaymentEntry[]; // Riwayat pembayaran ke supplier
}

/** Sisa hutang ke supplier untuk satu PO. */
export const purchaseRemaining = (purchase: Pick<Purchase, 'total_price' | 'payments'>): number =>
  remainingOf(purchase.total_price, paidAmountOf(purchase));

/** Status pelunasan PO ke supplier. */
export const purchasePaymentState = (purchase: Pick<Purchase, 'total_price' | 'payments'>): PaymentState =>
  paymentStateOf(purchase.total_price, paidAmountOf(purchase));

export interface DailyExpense {
  id: string;
  department_id?: string; // Divisi yang menanggung biaya; kosong = biaya bersama
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
  // Rencana penugasan per tahap (opsional, informasi saja): nama tahap -> id karyawan.
  // Tidak membatasi siapa boleh lapor kerja di Daftar Kerjaan.
  stage_employees?: Record<string, string[]>;
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
  photo_url?: string;
  photo_uploaded_at?: string;
  photo_uploaded_by?: string;
}

export interface ProductionHandoff {
  id: string;
  job_id: string;
  order_number?: string;
  product_name: string;
  // Varian/ukuran barang. Tanpa ini penerima hanya melihat nama produk saat ACC,
  // padahal satu produk bisa punya beberapa ukuran/warna yang berbeda.
  variant?: string;
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
  department_id?: string; // Snapshot divisi produk saat order dibuat
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
  discount?: number; // Potongan harga (dikurangkan dari subtotal sebelum ongkir)
  total: number; // Tagihan ke pelanggan: subtotal - diskon + ongkir
  dp?: number; // Uang muka data lama; dipertahankan agar order lama tetap terbaca
  payments?: PaymentEntry[]; // Riwayat pembayaran bertahap (DP, cicilan, pelunasan)
  due_date?: string; // Jatuh tempo pelunasan piutang
  ready_date?: string; // Tanggal janji barang siap, khusus order preorder
  // preorder = barang belum tersedia, sudah dijanjikan ke pelanggan
  status: 'preorder' | 'pending' | 'production' | 'completed' | 'cancelled';
  notes?: string;
  shipping_expedition?: string;
  tracking_number?: string;
  shipping_date?: string;
  shipping_proof_url?: string;
  shipping_status?: 'belum_dikirim' | 'siap_dikirim' | 'dikirim' | 'diterima';
  packing_employee_id?: string;
  packing_employee_name?: string;
}

/** Satu kali pembayaran (DP, cicilan, atau pelunasan). */
export interface PaymentEntry {
  id: string;
  date: string;
  amount: number;
  note?: string;
  recorded_by?: string;
}

export type PaymentState = 'belum_bayar' | 'sebagian' | 'lunas';

/**
 * Jumlah yang sudah dibayar. Data order lama hanya punya satu angka `dp`, jadi dipakai
 * sebagai penopang bila daftar pembayaran belum ada.
 */
export const paidAmountOf = (entity: { payments?: PaymentEntry[]; dp?: number }): number =>
  entity.payments?.length
    ? entity.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
    : (entity.dp || 0);

/** Sisa tagihan; tidak pernah negatif walau terjadi kelebihan bayar. */
export const remainingOf = (total: number, paid: number): number => Math.max(0, total - paid);

export const paymentStateOf = (total: number, paid: number): PaymentState => {
  if (paid <= 0) return 'belum_bayar';
  return paid >= total ? 'lunas' : 'sebagian';
};

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  belum_bayar: 'Belum Bayar',
  sebagian: 'Sebagian',
  lunas: 'Lunas',
};

/** Sisa tagihan order setelah pembayaran yang tercatat. */
export const orderRemaining = (order: Pick<Order, 'total' | 'dp' | 'payments'>): number =>
  remainingOf(order.total, paidAmountOf(order));

/** Status bayar order: belum bayar / dibayar sebagian (DP) / lunas. */
export const orderPaymentStatus = (order: Pick<Order, 'total' | 'dp' | 'payments'>): 'belum_bayar' | 'dp' | 'lunas' => {
  const state = paymentStateOf(order.total, paidAmountOf(order));
  return state === 'sebagian' ? 'dp' : state;
};

/**
 * Nilai penjualan sebuah order. Ongkir dikeluarkan karena itu uang titipan
 * untuk ekspedisi, bukan pendapatan penjualan.
 */
export const orderRevenue = (order: Pick<Order, 'total' | 'shipping_fee'>): number =>
  order.total - (order.shipping_fee || 0);

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

export const clockMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Metrik satu scan pulang (durasi kerja, porsi hari, pengganti telat, lembur).
 * Dipakai scan normal DAN koreksi admin — supaya keduanya tidak pernah beda rumus.
 *
 * Lembur hanya dihitung bila karyawan mengajukan (centang pengajuan di scan pulang):
 * mulai dari end_time (jam pulang normal) sampai jam scan, telat pagi ditutup dulu,
 * dibulatkan ke atas per jam. Tanpa pengajuan tidak ada lembur otomatis.
 */
export const checkoutMetrics = (
  checkIn: Attendance,
  checkoutTimestamp: string,
  settings: WorkSettings,
  overtimeRequested = false
): Partial<Attendance> => {
  const clock = checkoutTimestamp.slice(11, 16);
  const workedMinutes = Math.max(0, Math.round((new Date(checkoutTimestamp).getTime() - new Date(checkIn.timestamp).getTime()) / 60000));
  const lateMinutes = checkIn.late_minutes ?? Math.max(0, clockMinutes(checkIn.timestamp.slice(11, 16)) - clockMinutes(settings.start_time));
  const pastEndMinutes = Math.max(0, clockMinutes(clock) - clockMinutes(settings.end_time));
  const lateCompensationMinutes = overtimeRequested ? Math.min(lateMinutes, pastEndMinutes) : 0;
  const overtimeMinutesAfterLate = overtimeRequested ? Math.max(0, pastEndMinutes - lateCompensationMinutes) : 0;
  const overtimeHours = overtimeMinutesAfterLate > 0 ? Math.ceil(overtimeMinutesAfterLate / 60) : 0; // dibulatkan ke atas per jam
  return {
    worked_minutes: workedMinutes,
    work_fraction: clock < settings.full_day_from ? 0.5 : 1,
    late_compensation_minutes: lateCompensationMinutes,
    overtime_minutes: overtimeHours * 60,
  };
};
