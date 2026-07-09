import React, { useState, useEffect } from 'react';
import { Employee, Department, PayrollWeekly, CashAdvance, Attendance, UserRole } from '../types';
import { dataStore, hashPin } from '../dataStore';
import { QRCodeSVG } from 'qrcode.react';
import { Users, Plus, ShieldCheck, Key, Lock, LogIn, LogOut, Check, Save, DollarSign, X, Calendar, Clock, Printer, Trash2, History, Calculator, QrCode } from 'lucide-react';

interface EmployeeModuleProps {
  currentLoggedEmployee: Employee | null;
  onLoginEmployee: (emp: Employee | null) => void;
  allTabs: Array<{ id: string; label: string; roles?: string[] }>;
}

export const EmployeeModule: React.FC<EmployeeModuleProps> = ({ 
  currentLoggedEmployee, 
  onLoginEmployee,
  allTabs
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // Custom Banner Alert state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // New Employee Form State
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState<'karyawan' | 'leader'>('karyawan');
  const [rateHarian, setRateHarian] = useState(150000);
  const [rateLembur, setRateLembur] = useState(20000);
  const [defaultLiveTikTokBonus, setDefaultLiveTikTokBonus] = useState(20000);
  const [defaultAttendanceBonus, setDefaultAttendanceBonus] = useState(0);
  const [defaultWeeklyKasbonDeduction, setDefaultWeeklyKasbonDeduction] = useState(50000);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [allowedTabs, setAllowedTabs] = useState<string[]>(['attendance', 'production', 'warehouse']);
  const [accessRole, setAccessRole] = useState('');
  const [username, setUsername] = useState('');
  // Mode edit: id karyawan yang sedang diedit (null = form tambah baru)
  const [editEmpId, setEditEmpId] = useState<string | null>(null);
  const [statusAktif, setStatusAktif] = useState(true);

  const accessRoleOptions: Array<{ value: '' | UserRole; label: string; description: string }> = [
    { value: '', label: 'Karyawan', description: 'Menu kerja pribadi karyawan.' },
    { value: 'admin_penjualan', label: 'Admin Penjualan', description: 'Menu penjualan, pembelian, absensi, dan gaji.' },
    { value: 'admin_gudang', label: 'Gudang & Produksi', description: 'Menu gudang, produksi, absensi, dan gaji.' },
    { value: 'owner', label: 'Owner', description: 'Semua menu aplikasi.' },
  ];
  const menusForAccessRole = (value: string) => {
    const roleForMenus = value || 'karyawan';
    return allTabs.filter(tab => !tab.roles || tab.roles.includes(roleForMenus));
  };
  const defaultTabsForAccessRole = (value: string) => menusForAccessRole(value).map(menu => menu.id);
  const menusForEmployeeAccess = (value: string, tabs?: string[]) => {
    const baseMenus = menusForAccessRole(value);
    if (!tabs?.length) return baseMenus;
    return baseMenus.filter(menu => tabs.includes(menu.id));
  };
  const accessRoleLabel = (value?: string) => accessRoleOptions.find(option => option.value === (value || ''))?.label || 'Karyawan';
  const handleAccessRolePresetChange = (value: string) => {
    setAccessRole(value);
    setAllowedTabs(defaultTabsForAccessRole(value));
  };

  const openCreateEmployeeModal = () => {
    resetForm();
    setShowAddForm(true);
  };

  // Employee Simulation Login form states
  const [selectedLoginEmpId, setSelectedLoginEmpId] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [qrEmployee, setQrEmployee] = useState<Employee | null>(null);

  // Editing RLS State
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editingTabs, setEditingTabs] = useState<string[]>([]);

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener('nxty_storage_change', handleStorageChange);
    return () => window.removeEventListener('nxty_storage_change', handleStorageChange);
  }, []);

  const loadData = () => {
    setEmployees(dataStore.getEmployees());
    setDepartments(dataStore.getDepartments());
  };

  // Consolidated Profil & Gaji Modal States
  const [profileModalEmp, setProfileModalEmp] = useState<Employee | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'profile' | 'attendance' | 'payroll'>('payroll');
  
  // Date Helpers for default weekly payroll (Senin - Sabtu)
  const toDateInputValue = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekRange = () => {
    const today = new Date();
    const day = today.getDay();
    const daysUntilSaturday = (6 - day + 7) % 7;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysUntilSaturday);
    const monday = new Date(saturday);
    monday.setDate(saturday.getDate() - 5);
    
    return {
      start: toDateInputValue(monday),
      end: toDateInputValue(saturday)
    };
  };

  const [modalPeriodStart, setModalPeriodStart] = useState(getWeekRange().start);
  const [modalPeriodEnd, setModalPeriodEnd] = useState(getWeekRange().end);
  const [modalDaysWorked, setModalDaysWorked] = useState(6);
  const [modalOvertimeHours, setModalOvertimeHours] = useState(0);
  const [modalBasePay, setModalBasePay] = useState(0);
  const [modalOvertimePay, setModalOvertimePay] = useState(0);
  const [modalBonus, setModalBonus] = useState(0);
  const [modalKasbonDeduction, setModalKasbonDeduction] = useState(0);
  const [modalTotalPay, setModalTotalPay] = useState(0);
  const [modalOutstandingKasbon, setModalOutstandingKasbon] = useState(0);

  // Lists inside modal
  const [employeePayrolls, setEmployeePayrolls] = useState<PayrollWeekly[]>([]);
  const [employeeAttendance, setEmployeeAttendance] = useState<Attendance[]>([]);
  const [activePrintPayroll, setActivePrintPayroll] = useState<PayrollWeekly | null>(null);

  // Past payroll editing inside modal
  const [editingPayroll, setEditingPayroll] = useState<PayrollWeekly | null>(null);
  const [editDaysWorked, setEditDaysWorked] = useState(0);
  const [editOvertimeHours, setEditOvertimeHours] = useState(0);
  const [editBasePay, setEditBasePay] = useState(0);
  const [editBonus, setEditBonus] = useState(0);
  const [editKasbonDeduction, setEditKasbonDeduction] = useState(0);
  const [editTotalPay, setEditTotalPay] = useState(0);

  // Dynamic recalculation when manual inputs change in the generator form
  useEffect(() => {
    if (profileModalEmp) {
      const calculatedBasePay = modalDaysWorked * profileModalEmp.rate_harian;
      const calculatedOvertimePay = modalOvertimeHours * profileModalEmp.rate_lembur_per_jam;
      setModalBasePay(calculatedBasePay);
      setModalOvertimePay(calculatedOvertimePay);
      setModalTotalPay(calculatedBasePay + calculatedOvertimePay + modalBonus - modalKasbonDeduction);
    }
  }, [modalDaysWorked, modalOvertimeHours, modalBonus, modalKasbonDeduction, profileModalEmp]);

  // Dynamic recalculation when editing a past payroll record
  useEffect(() => {
    if (editingPayroll && profileModalEmp) {
      const calculatedBasePay = editDaysWorked * profileModalEmp.rate_harian;
      const calculatedOvertimePay = editOvertimeHours * profileModalEmp.rate_lembur_per_jam;
      setEditBasePay(calculatedBasePay);
      setEditTotalPay(calculatedBasePay + calculatedOvertimePay + editBonus - editKasbonDeduction);
    }
  }, [editDaysWorked, editOvertimeHours, editBonus, editKasbonDeduction, editingPayroll, profileModalEmp]);

  const refreshModalData = (emp: Employee) => {
    const pWeekly = dataStore.getPayrollWeekly().filter(p => p.employee_id === emp.id);
    const attList = dataStore.getAttendance().filter(a => a.employee_id === emp.id);
    const advances = dataStore.getCashAdvances().filter(c => c.employee_id === emp.id);
    const totalOutstanding = advances.reduce((sum, curr) => sum + curr.remaining_balance, 0);

    setEmployeePayrolls(pWeekly);
    setEmployeeAttendance(attList);
    setModalOutstandingKasbon(totalOutstanding);

    // Reset default inputs for new slip
    const weeklyRange = getWeekRange();
    setModalPeriodStart(weeklyRange.start);
    setModalPeriodEnd(weeklyRange.end);
    setModalDaysWorked(6);
    setModalOvertimeHours(0);
    setModalKasbonDeduction(Math.min(totalOutstanding, emp.default_weekly_cash_advance_deduction ?? 50000));
    setModalBonus(0);
  };

  const handleOpenProfileModal = (emp: Employee) => {
    setProfileModalEmp(emp);
    setActiveModalTab('payroll');
    refreshModalData(emp);
  };

  const handleAutoCalculateFromAttendance = () => {
    if (!profileModalEmp) return;

    const empId = profileModalEmp.id;

    // Filter all attendance scans of this employee between start and end date
    const scans = dataStore.getAttendance().filter(att => {
      if (att.employee_id !== empId) return false;
      const scanDate = att.timestamp.split('T')[0];
      return scanDate >= modalPeriodStart && scanDate <= modalPeriodEnd;
    });

    // 1. Calculate unique dates worked
    const uniqueDates = Array.from(new Set(scans.map(s => s.timestamp.split('T')[0])));
    const daysCount = uniqueDates.length
      ? uniqueDates.reduce((sum, date) => {
          const checkout = scans.find(scan => scan.timestamp.startsWith(date) && scan.type_scan === 'pulang');
          return sum + (checkout?.work_fraction ?? 1);
        }, 0)
      : 6;

    // Lembur tersimpan sudah dikurangi menit keterlambatan pada hari yang sama.
    const computedOvertimeHours = Math.round(scans.reduce((sum, scan) => sum + (scan.overtime_minutes || 0), 0) / 60 * 100) / 100;

    // 3. Outstanding Kasbon deduction prefill
    const advances = dataStore.getCashAdvances().filter(c => c.employee_id === empId);
    const totalOutstanding = advances.reduce((sum, curr) => sum + curr.remaining_balance, 0);
    const suggestedDeduction = Math.min(totalOutstanding, profileModalEmp.default_weekly_cash_advance_deduction ?? 50000);

    setModalDaysWorked(daysCount);
    setModalOvertimeHours(computedOvertimeHours);
    setModalKasbonDeduction(suggestedDeduction);
    setModalOutstandingKasbon(totalOutstanding);
    const settings = dataStore.getWorkSettings();
    const periodEndDate = new Date(`${modalPeriodEnd}T00:00:00+07:00`);
    const nextDay = new Date(periodEndDate.getTime() + 86400000);
    const isMonthEnd = nextDay.getMonth() !== periodEndDate.getMonth();
    const monthPrefix = modalPeriodEnd.slice(0, 7);
    const monthScans = dataStore.getAttendance().filter(scan => scan.employee_id === empId && scan.timestamp.startsWith(monthPrefix));
    const monthDays = new Set(monthScans.filter(scan => scan.type_scan === 'masuk').map(scan => scan.timestamp.slice(0, 10))).size;
    const totalLate = monthScans.reduce((sum, scan) => sum + (scan.late_minutes || 0), 0);
    const totalLateCompensation = monthScans.reduce((sum, scan) => sum + (scan.late_compensation_minutes || 0), 0);
    const netLate = Math.max(0, totalLate - totalLateCompensation);
    const defaultAttendanceBonus = profileModalEmp.default_attendance_bonus ?? settings.monthly_bonus_amount;
    const attendanceBonus = isMonthEnd
      ? (monthDays >= settings.monthly_bonus_min_days && netLate === 0 ? defaultAttendanceBonus : 0)
      : (daysCount >= 6 && netLate === 0 ? defaultAttendanceBonus : 0);
    setModalBonus(attendanceBonus);

    showNotification(`Sukses sinkronisasi data absensi! - Hari Kerja Terhitung: ${daysCount} Hari - Estimasi Jam Lembur: ${computedOvertimeHours} Jam`, 'success');
  };

  const handleSaveModalPayroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileModalEmp) return;
    const totalOutstandingKasbon = dataStore.getCashAdvances()
      .filter(advance => advance.employee_id === profileModalEmp.id)
      .reduce((sum, advance) => sum + advance.remaining_balance, 0);
    if (modalKasbonDeduction > totalOutstandingKasbon) {
      showNotification(`Potongan kasbon melebihi sisa kasbon ${profileModalEmp.name}. Sisa kasbon: ${formatIDR(totalOutstandingKasbon)}.`, 'error');
      return;
    }

    const newPayroll: PayrollWeekly = {
      id: Math.random().toString(36).substring(2, 11),
      employee_id: profileModalEmp.id,
      employee_name: profileModalEmp.name,
      period_start: modalPeriodStart,
      period_end: modalPeriodEnd,
      days_worked: modalDaysWorked,
      overtime_hours: modalOvertimeHours,
      base_pay: modalBasePay,
      bonus: modalBonus,
      cash_advance_deduction: modalKasbonDeduction,
      total_pay: modalTotalPay,
      is_printed: false
    };

    try {
      dataStore.recordPayroll(newPayroll);

      if (modalKasbonDeduction > 0) {
        dataStore.applyCashAdvancePayment({
          employee_id: profileModalEmp.id,
          amount: modalKasbonDeduction,
          type: 'deduction',
          date: modalPeriodEnd,
          note: `Potongan kasbon dari slip gaji ${modalPeriodStart} s/d ${modalPeriodEnd}`,
          payroll_id: newPayroll.id,
          created_by_id: currentLoggedEmployee?.id,
          created_by_name: currentLoggedEmployee?.name
        });
      }

      showNotification(`Slip gaji untuk ${profileModalEmp.name} berhasil disimpan!`, 'success');
      refreshModalData(profileModalEmp);
    } catch (err: any) {
      showNotification(err.message || 'Gagal menyimpan payroll', 'error');
    }
  };

  const handleStartEditModalPayroll = (pay: PayrollWeekly) => {
    setEditingPayroll(pay);
    setEditDaysWorked(pay.days_worked);
    setEditOvertimeHours(pay.overtime_hours);
    setEditBasePay(pay.base_pay);
    setEditBonus(pay.bonus);
    setEditKasbonDeduction(pay.cash_advance_deduction);
    setEditTotalPay(pay.total_pay);
  };

  const handleSaveEditModalPayroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayroll || !profileModalEmp) return;

    const allPayrolls = dataStore.getPayrollWeekly();
    const updatedPayrolls = allPayrolls.map(p => {
      if (p.id === editingPayroll.id) {
        return {
          ...p,
          days_worked: editDaysWorked,
          overtime_hours: editOvertimeHours,
          base_pay: editBasePay,
          bonus: editBonus,
          cash_advance_deduction: editKasbonDeduction,
          total_pay: editTotalPay
        };
      }
      return p;
    });

    dataStore.setPayrollWeekly(updatedPayrolls);
    setEditingPayroll(null);
    showNotification("Data slip gaji berhasil diperbarui!", "success");
    refreshModalData(profileModalEmp);
  };

  const handleDeleteModalPayroll = (payId: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus slip gaji ini?")) {
      const allPayrolls = dataStore.getPayrollWeekly();
      const updated = allPayrolls.filter(p => p.id !== payId);
      dataStore.setPayrollWeekly(updated);
      showNotification("Slip gaji berhasil dihapus!", "success");
      if (profileModalEmp) {
        refreshModalData(profileModalEmp);
      }
    }
  };

  const handlePrintModalPayroll = (pay: PayrollWeekly) => {
    setActivePrintPayroll(pay);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Ganti akses sistem karyawan (menu yang terbuka saat dia login) — langsung tersimpan
  const handleChangeAccessRole = (empId: string, accessRole: string) => {
    const updated = dataStore.getEmployees().map(e =>
      e.id === empId ? { ...e, access_role: (accessRole || undefined) as Employee['access_role'], allowed_tabs: defaultTabsForAccessRole(accessRole) } : e
    );
    dataStore.setEmployees(updated);
    loadData();
    showNotification('Akses sistem karyawan berhasil diperbarui.', 'success');
  };

  const resetForm = () => {
    setName('');
    setUsername('');
    setRole('karyawan');
    setRateHarian(150000);
    setRateLembur(20000);
    setDefaultLiveTikTokBonus(20000);
    setDefaultAttendanceBonus(0);
    setDefaultWeeklyKasbonDeduction(50000);
    setPhoneNumber('');
    setPin('');
    setAllowedTabs(defaultTabsForAccessRole(''));
    setAccessRole('');
    setStatusAktif(true);
    setEditEmpId(null);
    setShowAddForm(false);
  };

  // Buka form dalam mode edit dengan data karyawan terisi (PIN dikosongkan = tidak diganti)
  const startEditEmployee = (emp: Employee) => {
    setEditEmpId(emp.id);
    setName(emp.name);
    setUsername(emp.username || '');
    setDepartmentId(emp.department_id);
    setRole(emp.role);
    setRateHarian(emp.rate_harian);
    setRateLembur(emp.rate_lembur_per_jam);
    setDefaultLiveTikTokBonus(emp.default_live_tiktok_bonus ?? 20000);
    setDefaultAttendanceBonus(emp.default_attendance_bonus ?? 0);
    setDefaultWeeklyKasbonDeduction(emp.default_weekly_cash_advance_deduction ?? 50000);
    setPhoneNumber(emp.phone_number || '');
    setPin('');
    setAccessRole(emp.access_role || '');
    setAllowedTabs(emp.allowed_tabs?.length ? emp.allowed_tabs : defaultTabsForAccessRole(emp.access_role || ''));
    setStatusAktif(emp.status_aktif);
    setShowAddForm(true);
  };

  // Hapus permanen (riwayat absensi/payroll lama tetap tersimpan atas nama karyawan tsb)
  const handleDeleteEmployee = (emp: Employee) => {
    if (!window.confirm(`Hapus karyawan "${emp.name}" secara permanen?\n\nAkun login-nya langsung mati. Riwayat absensi & slip gaji lama tetap tersimpan.\n\nUntuk karyawan resign, lebih disarankan Edit lalu ubah status menjadi Nonaktif.`)) return;
    const updated = dataStore.getEmployees().filter(e => e.id !== emp.id);
    dataStore.setEmployees(updated);
    loadData();
    showNotification(`Karyawan ${emp.name} telah dihapus.`, 'info');
  };

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !departmentId || !username.trim() || (!editEmpId && !pin)) {
      showNotification('Nama, Username, Departemen' + (editEmpId ? '' : ', dan PIN') + ' wajib diisi!', 'error');
      return;
    }

    // Username wajib unik — dipakai untuk login (saat edit, kecualikan diri sendiri)
    const usernameTaken = employees.some(
      emp2 => emp2.id !== editEmpId && (emp2.username || '').toLowerCase() === username.trim().toLowerCase()
    );
    if (usernameTaken) {
      showNotification(`Username "${username}" sudah dipakai karyawan lain. Pilih yang lain.`, 'error');
      return;
    }

    if (editEmpId) {
      // Mode edit: perbarui data; PIN hanya diganti bila diisi
      const updated = dataStore.getEmployees().map(emp2 => {
        if (emp2.id !== editEmpId) return emp2;
        return {
          ...emp2,
          name,
          username: username.trim().toLowerCase(),
          department_id: departmentId,
          role,
          rate_harian: rateHarian,
          rate_lembur_per_jam: rateLembur,
          default_live_tiktok_bonus: defaultLiveTikTokBonus,
          default_attendance_bonus: defaultAttendanceBonus,
          default_weekly_cash_advance_deduction: defaultWeeklyKasbonDeduction,
          phone_number: phoneNumber,
          status_aktif: statusAktif,
          allowed_tabs: allowedTabs,
          access_role: (accessRole || undefined) as Employee['access_role'],
          ...(pin ? { pin: hashPin(pin), pin_hashed: true } : {})
        };
      });
      dataStore.setEmployees(updated);
      showNotification(`Data karyawan ${name} berhasil diperbarui!`, 'success');
    } else {
      const newEmp: Employee = {
        id: `emp-${Date.now().toString().slice(-4)}`,
        username: username.trim().toLowerCase(),
        name,
        department_id: departmentId,
        role,
        rate_harian: rateHarian,
        rate_lembur_per_jam: rateLembur,
        default_live_tiktok_bonus: defaultLiveTikTokBonus,
        default_attendance_bonus: defaultAttendanceBonus,
        default_weekly_cash_advance_deduction: defaultWeeklyKasbonDeduction,
        status_aktif: true,
        phone_number: phoneNumber,
        pin: hashPin(pin),
        pin_hashed: true,
        allowed_tabs: allowedTabs,
        access_role: (accessRole || undefined) as Employee['access_role']
      };
      dataStore.setEmployees([...employees, newEmp]);
      showNotification(`Karyawan ${name} berhasil ditambahkan!`, 'success');
    }

    resetForm();
    loadData();
  };

  const handleToggleTabPermission = (tabId: string, currentList: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (currentList.includes(tabId)) {
      setter(currentList.filter(id => id !== tabId));
    } else {
      setter([...currentList, tabId]);
    }
  };

  const handleSaveRLS = (empId: string) => {
    const updated = employees.map(emp => {
      if (emp.id === empId) {
        return { ...emp, allowed_tabs: editingTabs };
      }
      return emp;
    });
    dataStore.setEmployees(updated);
    setEditingEmpId(null);
    showNotification('Konfigurasi RLS (Row Level Security) berhasil disimpan!', 'success');
    loadData();
  };

  const startEditingRLS = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setEditingTabs(emp.allowed_tabs || ['attendance', 'production', 'warehouse']);
  };

  const handleSimulateLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const emp = employees.find(x => x.id === selectedLoginEmpId);
    if (!emp) {
      setLoginError('Karyawan tidak ditemukan.');
      return;
    }

    if (!dataStore.verifyEmployeePin(emp.id, loginPin)) {
      setLoginError('PIN yang Anda masukkan salah!');
      return;
    }

    onLoginEmployee(emp);
    setLoginPin('');
    showNotification(`Berhasil masuk! Anda sekarang menggunakan hak akses: ${emp.name} (${emp.role.toUpperCase()}). Menu Anda telah dibatasi sesuai kebijakan RLS.`, 'success');
  };

  const handleSimulateLogout = () => {
    onLoginEmployee(null);
    showNotification('Log out berhasil. Anda kembali ke mode Administrator/Owner.', 'info');
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Custom Banner Alert */}
      {notification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold animate-fade-in ${
          notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
          notification.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
          'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="font-bold text-gray-400 hover:text-gray-600 ml-4">✕</button>
        </div>
      )}

      {/* Simulation login box */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs">
        <div className="space-y-1 md:max-w-md">
          <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
            <Key className="w-4 h-4 text-emerald-700 animate-bounce" />
            Portal Akses & Login Karyawan (Simulasi PIN)
          </h4>
          <p className="text-xs text-emerald-800 leading-relaxed">
            Gunakan fitur ini untuk mensimulasikan login karyawan dengan PIN mereka. Sistem akan secara otomatis membatasi menu navigasi di sebelah kiri berdasarkan **Row Level Security (RLS)** yang telah diatur.
          </p>
        </div>

        {currentLoggedEmployee ? (
          <div className="bg-white px-5 py-3.5 rounded border border-emerald-300 flex items-center gap-4 shadow-sm w-full md:w-auto">
            <div>
              <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Sedang Logged In</p>
              <p className="text-sm font-bold text-gray-800">{currentLoggedEmployee.name}</p>
              <p className="text-[10px] text-gray-400 font-semibold font-mono">
                Role: {currentLoggedEmployee.role.toUpperCase()} &middot; Dept: {departments.find(d => d.id === currentLoggedEmployee.department_id)?.name || 'General'}
              </p>
            </div>
            <button
              onClick={handleSimulateLogout}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-1.5 rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Log Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSimulateLogin} className="flex flex-wrap items-end gap-2.5 w-full md:w-auto bg-white p-3 rounded-lg border border-emerald-100">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Karyawan</label>
              <select
                value={selectedLoginEmpId}
                onChange={(e) => setSelectedLoginEmpId(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-700"
                required
              >
                <option value="">-- Pilih Karyawan --</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">PIN Akses</label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 h-3 w-3 text-gray-400" />
                <input
                  type="password"
                  maxLength={4}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value)}
                  placeholder="PIN..."
                  className="pl-7 w-24 bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-xs font-mono tracking-widest text-center focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" /> Masuk Kerja
              </button>
            </div>
            {loginError && <p className="text-[10px] text-rose-600 block w-full text-center font-bold">{loginError}</p>}
          </form>
        )}
      </div>

      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--color-evergreen)]" />
            Manajemen Karyawan & Akses Menu
          </h1>
          <p className="text-xs text-gray-400">Atur data karyawan, tarif harian, PIN login, dan menu yang bisa dibuka.</p>
        </div>

        <button
          onClick={openCreateEmployeeModal}
          className="bg-[var(--color-evergreen)] hover:bg-[var(--color-evergreen-dark)] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah Karyawan Baru
        </button>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center no-print">
          <form onSubmit={handleCreateEmployee} className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-12 border-b border-gray-100 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5 uppercase tracking-wide">
              <Plus className="w-4 h-4 text-[var(--color-evergreen)]" /> {editEmpId ? `Edit Karyawan: ${name}` : 'Tambah Profil Karyawan Baru'}
            </h3>
            <div className="flex items-center gap-2">
              {editEmpId && (
                <>
                  <label className="text-xs font-semibold text-gray-600">Status:</label>
                  <select
                    value={statusAktif ? 'aktif' : 'nonaktif'}
                    onChange={(e) => setStatusAktif(e.target.value === 'aktif')}
                    className={`border rounded px-2 py-1 text-xs font-bold focus:outline-none cursor-pointer ${
                      statusAktif ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif (Resign)</option>
                  </select>
                </>
              )}
              <button type="button" onClick={resetForm} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Left Column: Categorized Input Fields */}
          <div className="md:col-span-6 space-y-5">
            {/* Section 1: Data Diri */}
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/80 space-y-3">
              <h4 className="text-[11px] font-black text-[var(--color-evergreen)] uppercase tracking-wider border-b border-gray-200/60 pb-1.5 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> 1. Data Diri Karyawan
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Karyawan</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20"
                      placeholder="Nama lengkap..."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Username Login</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                      className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-800 font-mono focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20"
                      placeholder="mis. budi"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Departemen</label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
                      required
                    >
                      <option value="">-- Pilih --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Role / Peran</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="karyawan">Karyawan Biasa</option>
                      <option value="leader">Leader Produksi</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Akses Sistem (Menu Saat Login)</label>
                    <select
                      value={accessRole}
                      onChange={(e) => handleAccessRolePresetChange(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600"
                    >
                      {accessRoleOptions.map(option => <option key={option.value || 'karyawan'} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">No Telepon/WA</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20"
                    placeholder="Contoh: 08123456789"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Detail Tarif Gaji */}
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/80 space-y-3">
              <h4 className="text-[11px] font-black text-[var(--color-evergreen)] uppercase tracking-wider border-b border-gray-200/60 pb-1.5 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> 2. Detail Tarif Gaji & Honor
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tarif Honor Harian</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[10px] text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      value={rateHarian}
                      onChange={(e) => setRateHarian(Number(e.target.value))}
                      className="pl-7 w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs font-mono text-gray-850 focus:outline-none focus:border-emerald-600"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Lembur Per-Jam</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[10px] text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      value={rateLembur}
                      onChange={(e) => setRateLembur(Number(e.target.value))}
                      className="pl-7 w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs font-mono text-gray-850 focus:outline-none focus:border-emerald-600"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Bonus Live TikTok Default</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[10px] text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={defaultLiveTikTokBonus}
                      onChange={(e) => setDefaultLiveTikTokBonus(Number(e.target.value))}
                      className="pl-7 w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs font-mono text-gray-850 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Bonus Kehadiran Mingguan</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[10px] text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={defaultAttendanceBonus}
                      onChange={(e) => setDefaultAttendanceBonus(Number(e.target.value))}
                      className="pl-7 w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs font-mono text-gray-850 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Potongan Kasbon Default per Minggu</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-[10px] text-gray-400 font-bold">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={defaultWeeklyKasbonDeduction}
                      onChange={(e) => setDefaultWeeklyKasbonDeduction(Number(e.target.value))}
                      className="pl-7 w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs font-mono text-gray-850 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Dipakai otomatis saat generate slip mingguan hari Sabtu, tetap dibatasi sisa kasbon aktif.</p>
                </div>
              </div>
            </div>

            {/* Section 3: Keamanan PIN */}
            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100/80 space-y-3">
              <h4 className="text-[11px] font-black text-[var(--color-evergreen)] uppercase tracking-wider border-b border-gray-200/60 pb-1.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> 3. Keamanan PIN Akses (Log-In)
              </h4>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">PIN Login Karyawan (4 Digit Angka)</label>
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs font-mono tracking-widest text-center text-gray-800 focus:outline-none focus:border-emerald-600"
                  placeholder={editEmpId ? 'Kosongkan bila tidak diganti' : '••••'}
                  required={!editEmpId}
                />
                <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                  {editEmpId
                    ? 'Isi hanya jika ingin mengganti PIN karyawan ini. Kosongkan untuk mempertahankan PIN lama.'
                    : 'PIN disimpan dengan aman untuk menjaga akses akun karyawan.'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: keterangan akses sistem */}
          <div className="md:col-span-6 border-l border-gray-100 md:pl-6 space-y-3">
            <div>
              <span className="text-xs font-bold text-gray-700 block">Tentang Akses Sistem</span>
              <p className="text-[10px] text-gray-400">Pilih preset akses, lalu centang menu yang boleh tampil saat karyawan login.</p>
            </div>

            <div className="bg-gray-50 p-4 rounded border border-gray-100 space-y-3 text-xs text-gray-600">
              <div>
                <p className="font-black text-gray-800">{accessRoleLabel(accessRole)}</p>
                <p className="text-[10px] text-gray-500">{accessRoleOptions.find(option => option.value === (accessRole as any))?.description || accessRoleOptions[0].description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {menusForAccessRole(accessRole).map(menu => (
                  <label key={menu.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer ${allowedTabs.includes(menu.id) ? 'bg-white border-emerald-200 text-emerald-900' : 'bg-white/60 border-gray-100 text-gray-500'}`}>
                    <input
                      type="checkbox"
                      checked={allowedTabs.includes(menu.id)}
                      onChange={() => handleToggleTabPermission(menu.id, allowedTabs, setAllowedTabs)}
                      className="accent-[var(--color-evergreen)]"
                    />
                    <span className="text-[11px] font-bold">{menu.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-200">Menu sensitif seperti Karyawan, Laporan, dan Audit tetap membutuhkan preset Owner. Login memakai <strong>username + PIN</strong>.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-4 py-2 rounded cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="bg-[var(--color-evergreen)] hover:bg-[var(--color-evergreen-dark)] text-white text-xs font-bold px-4 py-2 rounded shadow-sm cursor-pointer"
              >
                {editEmpId ? 'Simpan Perubahan' : 'Simpan Profil Karyawan'}
              </button>
            </div>
          </div>
          </form>
        </div>
      )}

      {/* Employees Table List */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-xs">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">Daftar Anggota Karyawan & Hak Akses Tab</span>
          <span className="text-[10px] text-gray-400 font-mono">Total Karyawan Aktif: {employees.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">
                <th className="p-3">Nama Karyawan</th>
                <th className="p-3">Departemen</th>
                <th className="p-3 text-center">Peran / Role</th>
                <th className="p-3 text-right">Tarif Honor Harian</th>
                <th className="p-3 text-right">Uang Lembur / Jam</th>
                <th className="p-3 text-center">PIN Login</th>
                <th className="p-3">Akses Sistem</th>
                <th className="p-3 text-center">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const isEditing = editingEmpId === emp.id;
                const deptObj = departments.find(d => d.id === emp.department_id);
                return (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-50 border border-emerald-100 flex items-center justify-center font-bold text-[var(--color-evergreen)] shrink-0">
                          {emp.photo_url ? <img src={emp.photo_url} alt={emp.name} className="w-full h-full object-cover" /> : emp.name[0]}
                        </div>
                        <div className="min-w-0">
                          <span className={`font-bold block truncate ${emp.status_aktif ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{emp.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">@{emp.username || '-'}</span>
                          {!emp.status_aktif && (
                            <span className="ml-1 text-[9px] bg-rose-50 text-rose-600 border border-rose-100 px-1 py-0.5 rounded font-bold uppercase">Resign</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-gray-100 border text-gray-700 rounded text-[10px] font-medium">
                        {deptObj ? deptObj.name : 'Umum / HQ'}
                      </span>
                    </td>
                    <td className="p-3 text-center capitalize">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        emp.role === 'leader' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-gray-700 font-bold">{formatIDR(emp.rate_harian)}</td>
                    <td className="p-3 text-right font-mono text-gray-500">{formatIDR(emp.rate_lembur_per_jam)}</td>
                    <td className="p-3 text-center font-mono font-semibold tracking-widest text-gray-400">••••</td>
                    <td className="p-3">
                      <select
                        value={emp.access_role || ''}
                        onChange={(e) => handleChangeAccessRole(emp.id, e.target.value)}
                        className="bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                      >
                        {accessRoleOptions.map(option => <option key={option.value || 'karyawan'} value={option.value}>{option.label}</option>)}
                      </select>
                      <p className="mt-1 text-[9px] text-gray-400">{menusForEmployeeAccess(emp.access_role || '', emp.allowed_tabs).length} menu aktif</p>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setQrEmployee(emp)}
                          className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <QrCode className="w-3 h-3" /> QR
                        </button>
                        <button
                          onClick={() => handleOpenProfileModal(emp)}
                          className="bg-[var(--color-evergreen)] hover:bg-[#122d20] text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        >
                          <DollarSign className="w-3 h-3 text-emerald-200" /> Profil &amp; Gaji
                        </button>
                        <button
                          onClick={() => startEditEmployee(emp)}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {qrEmployee && qrEmployee.attendance_qr_token && (
        <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center no-print">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center space-y-4 shadow-2xl">
            <div><h3 className="font-black text-gray-900">QR Absensi Karyawan</h3><p className="text-sm text-gray-600">{qrEmployee.name}</p><p className="text-xs text-gray-400">@{qrEmployee.username}</p></div>
            <div className="inline-flex bg-white border-8 border-white shadow-md"><QRCodeSVG value={`ARI-ATTENDANCE:${qrEmployee.attendance_qr_token}`} size={220} level="H" /></div>
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2">QR bersifat pribadi. Cetak dan berikan hanya kepada karyawan terkait. QR tidak menyimpan PIN.</p>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => window.print()} className="py-2.5 bg-[var(--color-evergreen)] text-white rounded-xl text-xs font-bold cursor-pointer"><Printer className="w-3.5 h-3.5 inline mr-1" /> Cetak</button><button type="button" onClick={() => setQrEmployee(null)} className="py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer">Tutup</button></div>
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* CONSOLIDATED PROFIL & GAJI MODAL */}
      {/* ============================================== */}
      {profileModalEmp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
            
            {/* Modal Header */}
            <div className="bg-[var(--color-evergreen)] text-white p-5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black tracking-wide uppercase">{profileModalEmp.name}</h3>
                  <span className="px-2 py-0.5 bg-white/20 text-white rounded text-[10px] font-bold uppercase tracking-wider">
                    {profileModalEmp.role}
                  </span>
                </div>
                <p className="text-xs text-emerald-100 font-medium">
                  Departemen: {departments.find(d => d.id === profileModalEmp.department_id)?.name || 'Umum'} &middot; Sisa Kasbon: <span className="font-bold underline">{formatIDR(modalOutstandingKasbon)}</span>
                </p>
              </div>
              <button 
                onClick={() => setProfileModalEmp(null)}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="bg-gray-50 border-b border-gray-200 px-5 flex gap-4">
              <button
                type="button"
                onClick={() => { setActiveModalTab('payroll'); setEditingPayroll(null); }}
                className={`py-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'payroll' 
                    ? 'border-[var(--color-evergreen)] text-[var(--color-evergreen)]' 
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <DollarSign className="w-4 h-4" /> Manajemen Gaji &amp; Slip
              </button>
              <button
                type="button"
                onClick={() => { setActiveModalTab('attendance'); setEditingPayroll(null); }}
                className={`py-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'attendance' 
                    ? 'border-[var(--color-evergreen)] text-[var(--color-evergreen)]' 
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Clock className="w-4 h-4" /> Riwayat Kehadiran ({employeeAttendance.length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveModalTab('profile'); setEditingPayroll(null); }}
                className={`py-3.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'profile' 
                    ? 'border-[var(--color-evergreen)] text-[var(--color-evergreen)]' 
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Users className="w-4 h-4" /> Informasi Profil &amp; Tarif
              </button>
            </div>

            {/* Modal Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: PROFILE DETAILS */}
              {activeModalTab === 'profile' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-4">
                      <h4 className="text-xs font-black text-[var(--color-evergreen)] uppercase tracking-wider border-b pb-2">Data Kepegawaian</h4>
                      <div className="space-y-2.5 text-xs text-gray-600">
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Nama Lengkap</span>
                          <span className="font-bold text-gray-800">{profileModalEmp.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">No Telepon / WA</span>
                          <span className="font-mono text-gray-800">{profileModalEmp.phone_number || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">MOCK PIN Login</span>
                          <span className="font-mono font-bold text-gray-400 tracking-widest text-sm">••••</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-4">
                      <h4 className="text-xs font-black text-[var(--color-evergreen)] uppercase tracking-wider border-b pb-2">Komponen Tarif Honor</h4>
                      <div className="space-y-2.5 text-xs text-gray-600">
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Tarif Honor Harian</span>
                          <span className="font-mono font-bold text-gray-800 text-sm">{formatIDR(profileModalEmp.rate_harian)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Lembur Per Jam</span>
                          <span className="font-mono font-bold text-gray-800 text-sm">{formatIDR(profileModalEmp.rate_lembur_per_jam)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Bonus Live TikTok Default</span>
                          <span className="font-mono font-bold text-gray-800 text-sm">{formatIDR(profileModalEmp.default_live_tiktok_bonus ?? 20000)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Bonus Kehadiran Mingguan</span>
                          <span className="font-mono font-bold text-gray-800 text-sm">{formatIDR(profileModalEmp.default_attendance_bonus ?? 0)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Potongan Kasbon Mingguan</span>
                          <span className="font-mono font-bold text-gray-800 text-sm">{formatIDR(profileModalEmp.default_weekly_cash_advance_deduction ?? 50000)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-4">
                      <h4 className="text-xs font-black text-[var(--color-evergreen)] uppercase tracking-wider border-b pb-2">Akses Menu</h4>
                      <div className="space-y-1 text-xs">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-wider mb-1">{accessRoleLabel(profileModalEmp.access_role)} dapat membuka</span>
                        <div className="flex flex-wrap gap-1">
                          {menusForEmployeeAccess(profileModalEmp.access_role || '', profileModalEmp.allowed_tabs).map(menu => (
                            <span key={menu.id} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-md text-[10px] font-bold">
                              {menu.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ATTENDANCE HISTORY */}
              {activeModalTab === 'attendance' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">Log Check-In &amp; Check-Out Absensi</h4>
                      <p className="text-[10px] text-gray-400">Menampilkan seluruh riwayat scan mesin absensi karyawan.</p>
                    </div>
                    <span className="bg-[var(--color-evergreen)]/10 text-[var(--color-evergreen)] text-[10px] font-bold px-3 py-1 rounded-full font-mono">
                      Total Kehadiran: {employeeAttendance.length} Records
                    </span>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="p-3">Waktu Log Scan</th>
                          <th className="p-3">Hari</th>
                          <th className="p-3">Jenis Scan</th>
                          <th className="p-3">Detail Tambahan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeAttendance.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-gray-400 italic font-mono">
                              Belum ada riwayat absensi untuk karyawan ini.
                            </td>
                          </tr>
                        ) : (
                          employeeAttendance.map((att, idx) => {
                            const dateObj = new Date(att.timestamp);
                            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                            const dayName = dayNames[dateObj.getDay()];
                            return (
                              <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="p-3 font-mono font-medium text-gray-700">
                                  {att.timestamp.replace('T', ' ').substring(0, 19)}
                                </td>
                                <td className="p-3 font-bold text-gray-600">{dayName}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    att.type === 'masuk' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {att.type}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-400 font-mono text-[10px]">
                                  Lat/Lng: {att.latitude?.toFixed(4)}, {att.longitude?.toFixed(4)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: PAYROLL & SLIP MANAGEMENT */}
              {activeModalTab === 'payroll' && (
                <div className="space-y-8 animate-fadeIn">
                  
                  {/* GENERATOR / CALCULATOR FORM BLOCK */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-[var(--color-evergreen)] flex items-center gap-1.5">
                          <Calculator className="w-4 h-4" /> Generator Gaji &amp; Slip Baru
                        </h4>
                        <p className="text-[10px] text-gray-400">Pilih rentang tanggal untuk menghitung honor harian &amp; lembur otomatis dari data absensi.</p>
                      </div>

                      {/* Period dates & auto fetch */}
                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs font-mono shadow-xs">
                          <input 
                            type="date" 
                            value={modalPeriodStart} 
                            onChange={(e) => setModalPeriodStart(e.target.value)} 
                            className="bg-transparent border-none text-xs text-gray-700 focus:ring-0" 
                          />
                          <span className="text-gray-400 text-[10px] font-bold">s/d</span>
                          <input 
                            type="date" 
                            value={modalPeriodEnd} 
                            onChange={(e) => setModalPeriodEnd(e.target.value)} 
                            className="bg-transparent border-none text-xs text-gray-700 focus:ring-0" 
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAutoCalculateFromAttendance}
                          className="bg-[var(--color-evergreen)] hover:bg-[#122d20] text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                        >
                          <Clock className="w-3.5 h-3.5" /> Ambil Data Absensi &amp; Hitung
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleSaveModalPayroll} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Jumlah Hari Kerja</label>
                          <input 
                            type="number" 
                            step="0.5"
                            value={modalDaysWorked} 
                            onChange={(e) => setModalDaysWorked(Number(e.target.value))}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-800 w-full"
                            min={0}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Jumlah Jam Lembur</label>
                          <input 
                            type="number" 
                            step="0.1"
                            value={modalOvertimeHours} 
                            onChange={(e) => setModalOvertimeHours(Number(e.target.value))}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-800 w-full"
                            min={0}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Bonus / Tunjangan (Rp)</label>
                          <input 
                            type="number" 
                            value={modalBonus} 
                            onChange={(e) => setModalBonus(Number(e.target.value))}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-800 w-full"
                            min={0}
                            required
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Potongan Kasbon</label>
                            <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-50 px-1 rounded">
                              Max: {formatIDR(modalOutstandingKasbon)}
                            </span>
                          </div>
                          <input 
                            type="number" 
                            value={modalKasbonDeduction} 
                            onChange={(e) => setModalKasbonDeduction(Math.min(modalOutstandingKasbon, Number(e.target.value)))}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-900 w-full"
                            min={0}
                            max={modalOutstandingKasbon}
                            required
                          />
                        </div>
                      </div>

                      {/* Display breakdown of the active calculation */}
                      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
                          <div>
                            Honor Pokok: <span className="font-bold text-gray-700 font-mono">{formatIDR(modalBasePay)}</span> <span className="text-[10px]">({modalDaysWorked} Hari &times; {formatIDR(profileModalEmp.rate_harian)})</span>
                          </div>
                          <div>
                            Uang Lembur: <span className="font-bold text-gray-700 font-mono">{formatIDR(modalOvertimePay)}</span> <span className="text-[10px]">({modalOvertimeHours} Jam &times; {formatIDR(profileModalEmp.rate_lembur_per_jam)})</span>
                          </div>
                          {modalBonus > 0 && (
                            <div>
                              Bonus: <span className="font-bold text-emerald-600 font-mono">+{formatIDR(modalBonus)}</span>
                            </div>
                          )}
                          {modalKasbonDeduction > 0 && (
                            <div>
                              Dipotong Kasbon: <span className="font-bold text-rose-600 font-mono">-{formatIDR(modalKasbonDeduction)}</span>
                            </div>
                          )}
                        </div>

                        {/* Large calculated total */}
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">TOTAL GAJI BERSIH (TAKE HOME PAY)</span>
                            <span className="text-lg font-black text-[var(--color-evergreen)] font-mono">{formatIDR(modalTotalPay)}</span>
                          </div>
                          <button
                            type="submit"
                            className="bg-[var(--color-evergreen)] hover:bg-[#122d20] text-white text-xs font-black px-5 py-3 rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                          >
                            <Save className="w-4 h-4 text-emerald-200" /> Simpan Slip Gaji
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* EDIT PAST PAYROLL SUB-FORM BLOCK */}
                  {editingPayroll && (
                    <div className="bg-amber-50 rounded-xl border-2 border-amber-300 p-5 space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                        <div>
                          <h4 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-amber-700 rotate-45" /> Edit Slip Gaji Tersimpan (ID: {editingPayroll.id})
                          </h4>
                          <p className="text-[10px] text-amber-700 font-semibold font-mono">Periode: {editingPayroll.period_start} s/d {editingPayroll.period_end}</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setEditingPayroll(null)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Batal Edit
                        </button>
                      </div>

                      <form onSubmit={handleSaveEditModalPayroll} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase tracking-wider">Jumlah Hari Kerja</label>
                            <input 
                              type="number" 
                              value={editDaysWorked} 
                              onChange={(e) => setEditDaysWorked(Number(e.target.value))}
                              className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-800 w-full"
                              min={0}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase tracking-wider">Jumlah Jam Lembur</label>
                            <input 
                              type="number" 
                              step="0.1"
                              value={editOvertimeHours} 
                              onChange={(e) => setEditOvertimeHours(Number(e.target.value))}
                              className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-800 w-full"
                              min={0}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase tracking-wider">Bonus / Tunjangan (Rp)</label>
                            <input 
                              type="number" 
                              value={editBonus} 
                              onChange={(e) => setEditBonus(Number(e.target.value))}
                              className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-gray-800 w-full"
                              min={0}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-amber-800 mb-1 uppercase tracking-wider">Potongan Kasbon (Rp)</label>
                            <input 
                              type="number" 
                              value={editKasbonDeduction} 
                              onChange={(e) => setEditKasbonDeduction(Number(e.target.value))}
                              className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-rose-900 w-full"
                              min={0}
                              required
                            />
                          </div>
                        </div>

                        {/* Edit calculation preview */}
                        <div className="bg-white rounded-lg border border-amber-200 p-4 flex flex-wrap items-center justify-between gap-4">
                          <div className="text-xs text-amber-900 space-y-0.5">
                            <div>
                              Honor Pokok Baru: <span className="font-bold font-mono">{formatIDR(editBasePay)}</span> <span className="text-[10px]">({editDaysWorked} Hari &times; {formatIDR(profileModalEmp.rate_harian)})</span>
                            </div>
                            <div>
                              Uang Lembur Baru: <span className="font-bold font-mono">{formatIDR(editOvertimeHours * profileModalEmp.rate_lembur_per_jam)}</span>
                            </div>
                            <div>
                              Total Take Home Pay Baru: <span className="font-black text-sm text-[var(--color-evergreen)] font-mono">{formatIDR(editTotalPay)}</span>
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm cursor-pointer"
                          >
                            Simpan Perubahan Slip Gaji
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* HISTORICAL PAYSLIPS TABLE BLOCK */}
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">Riwayat Slip Gaji Terbit</h4>
                      <p className="text-[10px] text-gray-400">Berikut adalah daftar slip gaji yang telah digenerate oleh admin untuk karyawan ini.</p>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            <th className="p-3">ID Slip</th>
                            <th className="p-3">Periode Gaji</th>
                            <th className="p-3 text-center font-mono">Kehadiran (Hari)</th>
                            <th className="p-3 text-center font-mono">Lembur (Jam)</th>
                            <th className="p-3 text-right">Potongan Kasbon</th>
                            <th className="p-3 text-right">Total Gaji Bersih</th>
                            <th className="p-3 text-center">Aksi Manajemen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeePayrolls.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-gray-400 italic font-mono">
                                Belum ada riwayat penerbitan gaji untuk karyawan ini. Gunakan kalkulator di atas untuk menerbitkan slip baru.
                              </td>
                            </tr>
                          ) : (
                            employeePayrolls.map((pay) => (
                              <tr key={pay.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                <td className="p-3 font-mono font-bold text-gray-400">
                                  #{pay.id.toUpperCase()}
                                </td>
                                <td className="p-3 font-bold text-gray-700">
                                  {pay.period_start} s/d {pay.period_end}
                                </td>
                                <td className="p-3 text-center font-mono font-semibold text-gray-600">
                                  {pay.days_worked} Hari
                                </td>
                                <td className="p-3 text-center font-mono text-gray-500">
                                  {pay.overtime_hours} Jam
                                </td>
                                <td className="p-3 text-right font-mono text-rose-600 font-medium">
                                  -{formatIDR(pay.cash_advance_deduction)}
                                </td>
                                <td className="p-3 text-right font-mono text-[var(--color-evergreen)] font-black text-sm">
                                  {formatIDR(pay.total_pay)}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditModalPayroll(pay)}
                                      className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[10px] px-2 py-1 rounded border border-amber-200 cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handlePrintModalPayroll(pay)}
                                      className="bg-emerald-50 hover:bg-emerald-100 text-[var(--color-evergreen)] font-bold text-[10px] px-2 py-1 rounded border border-emerald-200 flex items-center gap-0.5 cursor-pointer"
                                    >
                                      <Printer className="w-3 h-3" /> Cetak
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteModalPayroll(pay.id)}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] px-2 py-1 rounded border border-rose-200 cursor-pointer"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-100 p-4 flex justify-between items-center text-[10px] text-gray-400">
              <span>Sistem Manajemen Penggajian Terintegrasi &middot; Evergreen Theme</span>
              <button
                type="button"
                onClick={() => setProfileModalEmp(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Tutup Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* PRINT SLIP PREVIEW MODAL */}
      {/* ============================================== */}
      {activePrintPayroll && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 animate-fadeIn print:bg-white print:p-0">
          <div className="bg-white rounded-xl overflow-hidden shadow-2xl p-6 space-y-4 max-w-lg w-full print:shadow-none print:p-0">
            <div className="flex justify-between items-center border-b pb-2 print:hidden">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Printer className="w-4 h-4 text-[var(--color-evergreen)]" /> Pratinjau Slip Gaji Continuous Form
              </span>
              <button 
                type="button"
                onClick={() => setActivePrintPayroll(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center bg-gray-100 p-4 rounded-xl border print:bg-white print:border-none print:p-0">
              {(() => {
                const pay = activePrintPayroll;
                const emp = profileModalEmp || employees.find(e => e.id === pay.employee_id);
                const rateHarian = emp?.rate_harian || 150000;
                const rateLembur = emp?.rate_lembur_per_jam || 20000;
                const totalDeductions = pay.cash_advance_deduction;
                const totalGajiPokok = pay.days_worked * rateHarian;
                const totalGajiLembur = pay.overtime_hours * rateLembur;

                return (
                  <div className="p-8 font-mono text-xs select-text text-blue-800 leading-relaxed max-w-lg bg-[#FFFDF5] border border-dashed border-blue-300 rounded shadow-sm w-full">
                    <div className="text-center space-y-1 border-b border-dashed border-blue-400 pb-2 mb-2">
                      <h1 className="text-base font-black tracking-widest uppercase">SLIP GAJI KARYAWAN</h1>
                      <p className="text-xs font-bold tracking-wider">PERIODE: {pay.period_start} s/d {pay.period_end}</p>
                    </div>

                    <div className="flex justify-between items-end border-b border-dashed border-blue-300 pb-1 mb-3">
                      <div>
                        <span className="font-bold">Nama:</span> <span className="font-black text-sm uppercase">{pay.employee_name}</span>
                      </div>
                      <div className="text-[10px] opacity-75 font-mono">
                        ID SLIP: {pay.id.toUpperCase()}
                      </div>
                    </div>

                    <div className="space-y-2 border-b border-dashed border-blue-300 pb-3 mb-3">
                      <div className="flex justify-between">
                        <span>Hari Kerja:</span>
                        <span className="font-bold">{pay.days_worked} Hari &times; {formatIDR(rateHarian)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jam Lembur:</span>
                        <span className="font-bold">{pay.overtime_hours} Jam &times; {formatIDR(rateLembur)}</span>
                      </div>
                      <div className="flex justify-between text-blue-900">
                        <span>Honor Pokok Terhitung:</span>
                        <span className="font-bold">{formatIDR(totalGajiPokok)}</span>
                      </div>
                      <div className="flex justify-between text-blue-900">
                        <span>Lembur Terhitung:</span>
                        <span className="font-bold">{formatIDR(totalGajiLembur)}</span>
                      </div>
                      {pay.bonus > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Bonus / Tunjangan:</span>
                          <span className="font-bold">+{formatIDR(pay.bonus)}</span>
                        </div>
                      )}
                      {pay.cash_advance_deduction > 0 && (
                        <div className="flex justify-between text-rose-700">
                          <span>Potongan Kasbon:</span>
                          <span className="font-bold">-{formatIDR(pay.cash_advance_deduction)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center bg-blue-50/50 p-2.5 rounded border border-blue-200">
                      <span className="font-black text-blue-900 text-xs">TOTAL DITERIMA (TAKE HOME PAY):</span>
                      <span className="font-black text-blue-900 text-sm font-mono">{formatIDR(pay.total_pay)}</span>
                    </div>

                    <div className="mt-6 flex justify-between text-[10px] pt-4 border-t border-dotted border-blue-300">
                      <div className="text-center">
                        <p>Penerima,</p>
                        <div className="h-10"></div>
                        <p className="font-bold underline">{pay.employee_name}</p>
                      </div>
                      <div className="text-center">
                        <p>Bagian Keuangan,</p>
                        <div className="h-10"></div>
                        <p className="font-bold underline">Administrator</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-2 print:hidden">
              <button
                type="button"
                onClick={() => setActivePrintPayroll(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-[var(--color-evergreen)] hover:bg-[#122d20] text-white text-xs font-black px-4 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Cetak Slip Gaji
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
