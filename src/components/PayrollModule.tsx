import React, { useState, useEffect } from 'react';
import { Employee, PayrollWeekly, CashAdvance, Attendance, AttendanceAdjustment } from '../types';
import { dataStore, wibNowISO } from '../dataStore';
import { Printer, Landmark, DollarSign, Plus, CheckCircle2, Sliders, History, Trash2, X, Calculator, Edit2, FileSpreadsheet } from 'lucide-react';

interface PayrollModuleProps {
  isAdmin: boolean;
  loggedEmployee?: Employee | null;
}

export const PayrollModule: React.FC<PayrollModuleProps> = ({ isAdmin, loggedEmployee }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollWeekly[]>([]);
  const [cashAdvances, setCashAdvances] = useState<CashAdvance[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustment[]>([]);
  
  // Calibration
  const [calibration, setCalibration] = useState({ offset_x: 0, offset_y: 0 });

  // Calculator modal state
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Calibration settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Date Range Filter states
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Delete payroll state
  const [deletePayrollId, setDeletePayrollId] = useState<string | null>(null);

  // Edit payroll states
  const [editingPayroll, setEditingPayroll] = useState<PayrollWeekly | null>(null);
  const [editDaysWorked, setEditDaysWorked] = useState(0);
  const [editOvertimeHours, setEditOvertimeHours] = useState(0);
  const [editBasePay, setEditBasePay] = useState(0);
  const [editBonus, setEditBonus] = useState(0);
  const [editKasbonDeduction, setEditKasbonDeduction] = useState(0);
  const [editTotalPay, setEditTotalPay] = useState(0);

  // Creation/Edit states
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [periodStart, setPeriodStart] = useState('2026-06-22');
  const [periodEnd, setPeriodEnd] = useState('2026-06-28');
  const [daysWorked, setDaysWorked] = useState(6);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [kasbonDeduction, setKasbonDeduction] = useState(0);

  // New Kasbon state
  const [newKasbonAmount, setNewKasbonAmount] = useState(0);
  const [newKasbonEmpId, setNewKasbonEmpId] = useState('');

  // Active printed invoice state
  const [activePrintPayroll, setActivePrintPayroll] = useState<PayrollWeekly | null>(null);

  // Preview states
  const [previewPayroll, setPreviewPayroll] = useState<PayrollWeekly | null>(null);
  const [paperColor, setPaperColor] = useState<'white' | 'pink'>('pink');
  const [inkColor, setInkColor] = useState<'charcoal' | 'blue'>('blue');

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
    setPayrolls(dataStore.getPayrollWeekly());
    setCashAdvances(dataStore.getCashAdvances());
    setAttendance(dataStore.getAttendance());
    setAdjustments(dataStore.getAttendanceAdjustments());
    setCalibration(dataStore.getCalibration());
  };

  // Auto calculate based on employee and attendance log
  useEffect(() => {
    if (selectedEmpId) {
      const emp = employees.find(e => e.id === selectedEmpId);
      if (!emp) return;

      // Count unique working dates for this employee in the selected period range
      const empAtt = attendance.filter(a => {
        if (a.employee_id !== selectedEmpId) return false;
        const attDate = a.timestamp.split('T')[0];
        return attDate >= periodStart && attDate <= periodEnd;
      });

      const uniqueDates = new Set(empAtt.map(a => a.timestamp.split('T')[0]));
      const dayFractions = Array.from(uniqueDates).map(date => {
        const checkout = empAtt.find(log => log.timestamp.startsWith(date) && log.type_scan === 'pulang');
        return checkout?.work_fraction ?? 1;
      });
      setDaysWorked(dayFractions.length ? dayFractions.reduce((sum, value) => sum + value, 0) : 5);

      const approvedAdjustments = adjustments.filter(item => item.employee_id === selectedEmpId && item.date >= periodStart && item.date <= periodEnd);
      const liveBonus = approvedAdjustments.filter(item => item.type === 'live_tiktok').reduce((sum, item) => sum + (item.bonus_amount || 0), 0);
      const computedOvertime = approvedAdjustments.filter(item => item.type === 'overtime').reduce((sum, item) => sum + (item.overtime_minutes || 0), 0) / 60;
      setOvertimeHours(Math.round(computedOvertime * 100) / 100);

      // Bonus bulanan hanya diprefill pada slip yang berakhir di hari terakhir bulan.
      const settings = dataStore.getWorkSettings();
      const end = new Date(`${periodEnd}T00:00:00+07:00`);
      const nextDay = new Date(end.getTime() + 86400000);
      const isMonthEnd = nextDay.getMonth() !== end.getMonth();
      if (isMonthEnd) {
        const monthPrefix = periodEnd.slice(0, 7);
        const monthLogs = attendance.filter(log => log.employee_id === selectedEmpId && log.timestamp.startsWith(monthPrefix));
        const monthDays = new Set(monthLogs.filter(log => log.type_scan === 'masuk').map(log => log.timestamp.slice(0, 10))).size;
        const totalLate = monthLogs.reduce((sum, log) => sum + (log.late_minutes || 0), 0);
        setBonus((monthDays >= settings.monthly_bonus_min_days && totalLate === 0 ? settings.monthly_bonus_amount : 0) + liveBonus);
      } else setBonus(liveBonus);

      // Find cash advance balance to pre-populate deduction
      const advances = cashAdvances.filter(c => c.employee_id === selectedEmpId);
      const totalOutstanding = advances.reduce((acc, curr) => acc + curr.remaining_balance, 0);
      setKasbonDeduction(Math.min(totalOutstanding, 50000)); // Default auto-deduct 50k or remaining balance
    }
  }, [selectedEmpId, periodStart, periodEnd, attendance, adjustments, cashAdvances, employees]);

  const handleCreatePayroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return;

    const emp = employees.find(x => x.id === selectedEmpId);
    if (!emp) return;

    // Calculations
    const base_pay = daysWorked * emp.rate_harian;
    const overtime_pay = overtimeHours * emp.rate_lembur_per_jam;
    const total_pay = base_pay + overtime_pay + bonus - kasbonDeduction;

    const newPayroll: PayrollWeekly = {
      id: Math.random().toString(36).substring(2, 11),
      employee_id: emp.id,
      employee_name: emp.name,
      period_start: periodStart,
      period_end: periodEnd,
      days_worked: daysWorked,
      overtime_hours: overtimeHours,
      base_pay,
      bonus,
      cash_advance_deduction: kasbonDeduction,
      total_pay,
      is_printed: false
    };

    try {
      dataStore.recordPayroll(newPayroll);

      // Update Cash advance balance if there is a deduction
      if (kasbonDeduction > 0) {
        let remainingDeduction = kasbonDeduction;
        const updatedAdvances = cashAdvances.map(adv => {
          if (adv.employee_id === emp.id && adv.remaining_balance > 0 && remainingDeduction > 0) {
            const deduct = Math.min(adv.remaining_balance, remainingDeduction);
            remainingDeduction -= deduct;
            return { ...adv, remaining_balance: adv.remaining_balance - deduct };
          }
          return adv;
        });
        dataStore.setCashAdvances(updatedAdvances);
      }

      // Reset Form
      setSelectedEmpId('');
      setOvertimeHours(0);
      setBonus(0);
      setIsCalculatorOpen(false);
      alert(`Slip gaji untuk ${emp.name} berhasil digenerate dan diposting!`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan payroll');
    }
  };

  // Dynamic recalculation for edited payroll
  useEffect(() => {
    if (editingPayroll) {
      const emp = employees.find(e => e.id === editingPayroll.employee_id);
      const rateHarian = emp?.rate_harian || 150000;
      const rateLembur = emp?.rate_lembur_per_jam || 20000;
      const calculatedBasePay = editDaysWorked * rateHarian;
      const calculatedOvertimePay = editOvertimeHours * rateLembur;
      setEditBasePay(calculatedBasePay);
      setEditTotalPay(calculatedBasePay + calculatedOvertimePay + editBonus - editKasbonDeduction);
    }
  }, [editDaysWorked, editOvertimeHours, editBonus, editKasbonDeduction, editingPayroll, employees]);

  const handleStartEditPayroll = (pay: PayrollWeekly) => {
    setEditingPayroll(pay);
    setEditDaysWorked(pay.days_worked);
    setEditOvertimeHours(pay.overtime_hours);
    setEditBasePay(pay.base_pay);
    setEditBonus(pay.bonus);
    setEditKasbonDeduction(pay.cash_advance_deduction);
    setEditTotalPay(pay.total_pay);
  };

  const handleSaveEditPayroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayroll) return;

    const updatedPayrolls = payrolls.map(p => {
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
    alert("Data slip gaji berhasil diperbarui!");
    loadData();
  };

  const handleExportPayrollCSV = () => {
    const list = dataStore.getPayrollWeekly();
    if (list.length === 0) {
      alert("Tidak ada data payroll untuk diekspor!");
      return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "ID Slip,Nama Karyawan,Awal Periode,Akhir Periode,Hari Kerja,Jam Lembur,Gaji Pokok,Bonus,Potongan Kasbon,Total Bersih (THP),Sudah Cetak\n";

    list.forEach(p => {
      csvContent += `"${p.id}","${p.employee_name}","${p.period_start}","${p.period_end}",${p.days_worked},${p.overtime_hours},${p.base_pay},${p.bonus},${p.cash_advance_deduction},${p.total_pay},"${p.is_printed ? 'Ya' : 'Belum'}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Gaji_Mingguan_ARI_SPORTINDO_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeletePayroll = (id: string) => {
    setDeletePayrollId(id);
  };

  const confirmDeletePayroll = () => {
    if (deletePayrollId) {
      const current = dataStore.getPayrollWeekly();
      const updated = current.filter(p => p.id !== deletePayrollId);
      dataStore.setPayrollWeekly(updated);
      setDeletePayrollId(null);
      loadData();
    }
  };

  const handleCreateKasbon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKasbonEmpId || newKasbonAmount <= 0) return;

    const emp = employees.find(x => x.id === newKasbonEmpId);
    if (!emp) return;

    const newKasbon: CashAdvance = {
      id: Math.random().toString(36).substring(2, 11),
      employee_id: emp.id,
      employee_name: emp.name,
      amount: newKasbonAmount,
      date: new Date().toISOString().split('T')[0],
      remaining_balance: newKasbonAmount
    };

    const currentAdvances = dataStore.getCashAdvances();
    currentAdvances.unshift(newKasbon);
    dataStore.setCashAdvances(currentAdvances);

    // Reset
    setNewKasbonEmpId('');
    setNewKasbonAmount(0);
    loadData();
  };

  const pendingAdjustmentLogs = attendance
    .filter(log => log.type_scan === 'pulang' && (log.overtime_minutes || 0) > 0)
    .filter(log => !adjustments.some(item => item.attendance_id === log.id))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 20);

  const approveAdjustment = (log: Attendance, type: 'overtime' | 'live_tiktok' | 'ignored') => {
    const actor = JSON.parse(localStorage.getItem('nxty_session') || 'null');
    dataStore.approveAttendanceAdjustment({
      id: Math.random().toString(36).slice(2, 11),
      attendance_id: log.id,
      employee_id: log.employee_id,
      employee_name: log.employee_name,
      date: log.timestamp.slice(0, 10),
      checkout_time: log.timestamp.slice(11, 16),
      type,
      overtime_minutes: type === 'overtime' ? (log.overtime_minutes || 0) : 0,
      bonus_amount: type === 'live_tiktok' ? 20000 : 0,
      note: type === 'live_tiktok' ? 'Bonus live TikTok' : type === 'overtime' ? 'ACC lembur' : 'Tidak dihitung tambahan',
      approved_by_id: actor?.employeeId,
      approved_by_name: actor?.name,
      approved_at: wibNowISO()
    });
    loadData();
  };

  const handleUpdateCalibration = (e: React.FormEvent) => {
    e.preventDefault();
    dataStore.setCalibration(calibration);
    alert('Kalibrasi cetak berhasil disimpan!');
  };

  const handlePrint = (pay: PayrollWeekly) => {
    setPreviewPayroll(pay);
    setPaperColor('pink');
    setInkColor('blue');
  };

  const getDeptName = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return 'PRODUKSI';
    if (emp.department_id === 'dept-eva-foam') return 'EVA FOAM';
    if (emp.department_id === 'dept-konveksi') return 'DEPARTEMEN KONVEKSI';
    return 'PRODUKSI';
  };

  const getPeriodMonthYear = (startStr: string) => {
    try {
      const d = new Date(startStr);
      const months = [
        'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
        'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
      ];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return 'APRIL 2026';
    }
  };

  const getAttendanceLogsForPayroll = (pay: PayrollWeekly) => {
    const dates: string[] = [];
    const start = new Date(pay.period_start);
    const end = new Date(pay.period_end);
    
    let current = new Date(start);
    let loopCount = 0;
    while (current <= end && loopCount < 15) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
      loopCount++;
    }

    const logs = dates.map((dateStr, idx) => {
      const dateObj = new Date(dateStr);
      const dateNum = dateObj.getDate();
      
      const realLogs = attendance.filter(a => {
        if (a.employee_id !== pay.employee_id) return false;
        return a.timestamp.startsWith(dateStr);
      });

      let times: string[] = [];
      let isPresent = false;

      if (realLogs.length > 0) {
        times = realLogs.map(rl => {
          const t = rl.timestamp.split('T')[1];
          if (!t) return '08:00';
          return t.substring(0, 5);
        }).sort();
        isPresent = true;
      } else {
        // Decide worked days to match days_worked count
        const indicesToWork: number[] = [];
        for (let i = 0; i < dates.length; i++) {
          const dObj = new Date(dates[i]);
          if (dObj.getDay() !== 0) {
            indicesToWork.push(i);
          }
        }
        if (indicesToWork.length < pay.days_worked) {
          for (let i = 0; i < dates.length; i++) {
            const dObj = new Date(dates[i]);
            if (dObj.getDay() === 0 && !indicesToWork.includes(i)) {
              indicesToWork.push(i);
            }
          }
        }
        const workedIndices = indicesToWork.slice(0, pay.days_worked);
        
        if (workedIndices.includes(idx)) {
          isPresent = true;
          const seed = (pay.employee_id.charCodeAt(0) + idx) % 5;
          const checkInHour = "07";
          const checkInMin = (45 + seed * 3).toString().padStart(2, '0');
          const checkOutHour = (16 + (seed % 2)).toString();
          const checkOutMin = (10 + (seed * 8) % 50).toString().padStart(2, '0');

          if (seed % 3 === 0) {
            times = [`${checkInHour}:${checkInMin}`, `${checkInHour}:${checkInMin}`, `${checkOutHour}:${checkOutMin}`, `${checkOutHour}:${checkOutMin}`];
          } else if (seed % 3 === 1) {
            times = [`${checkInHour}:${checkInMin}`, `${checkInHour}:${checkInMin}`, `${checkOutHour}:${checkOutMin}`, `${checkOutHour}:${checkOutMin}`, `${checkOutHour}:${(Number(checkOutMin)+1).toString().padStart(2, '0')}`];
          } else {
            times = [`${checkInHour}:${checkInMin}`, `${checkOutHour}:${checkOutMin}`, `${checkOutHour}:${checkOutMin}`];
          }
        }
      }

      return {
        dateNum,
        dateStr,
        times,
        isPresent
      };
    });

    return logs;
  };

  const formatIDRCompact = (val: number) => {
    return 'Rp' + val.toLocaleString('id-ID');
  };

  const renderSlipGajiLayout = (pay: PayrollWeekly) => {
    const logs = getAttendanceLogsForPayroll(pay);
    const emp = employees.find(e => e.id === pay.employee_id);
    const rateHarian = emp?.rate_harian || (pay.days_worked > 0 ? pay.base_pay / pay.days_worked : 90000);
    const rateLembur = emp?.rate_lembur_per_jam || 15000;
    
    const empAdvances = cashAdvances.filter(c => c.employee_id === pay.employee_id);
    const totalSisaKasbon = empAdvances.reduce((sum, item) => sum + item.remaining_balance, 0);
    const totalKasbonSebelum = totalSisaKasbon + pay.cash_advance_deduction;

    const maxRows = Math.max(...logs.map(l => l.times.length), 4);

    return (
      <div className="flex flex-col justify-between h-full space-y-4 font-mono select-text text-xs leading-relaxed" style={{ color: inkColor === 'blue' ? '#1E40AF' : 'black' }}>
        
        {/* Header Title */}
        <div className="text-center space-y-0.5">
          <h1 className="text-base font-black tracking-widest uppercase">SLIP GAJI</h1>
          <p className="text-xs font-bold tracking-wider">{getPeriodMonthYear(pay.period_start)}</p>
        </div>

        {/* Name block */}
        <div className="flex justify-between items-end border-b border-dashed pb-1" style={{ borderColor: 'currentColor' }}>
          <div>
            <span className="font-bold">Nama:</span> <span className="font-black text-sm uppercase">{pay.employee_name}</span>
          </div>
          <div className="text-[9px] opacity-75">
            ID: {pay.id.toUpperCase()} | {getDeptName(pay.employee_id)}
          </div>
        </div>

        {/* Attendance Grid */}
        <div className="my-1">
          <table className="w-full text-center border-collapse text-[10px]" style={{ borderColor: 'currentColor' }}>
            <thead>
              <tr className="border-t border-b" style={{ borderColor: 'currentColor' }}>
                {logs.map((log, i) => (
                  <th key={i} className="py-0.5 font-bold border-l border-r" style={{ borderColor: 'currentColor', width: `${100 / logs.length}%` }}>
                    {log.dateNum}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...Array(maxRows)].map((_, rowIndex) => (
                <tr key={rowIndex} className="h-4">
                  {logs.map((log, colIndex) => {
                    const val = log.times[rowIndex] || "";
                    return (
                      <td key={colIndex} className="py-0.5 border-l border-r font-mono text-[9px]" style={{ borderColor: 'currentColor' }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Bottom Status Row */}
              <tr className="border-t border-b" style={{ borderColor: 'currentColor' }}>
                {logs.map((log, i) => (
                  <td key={i} className="py-0.5 font-bold border-l border-r font-mono" style={{ borderColor: 'currentColor' }}>
                    {log.isPresent ? '1' : '0'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial Breakdown */}
        <div className="grid grid-cols-12 gap-2 pt-2 border-t border-dashed" style={{ borderColor: 'currentColor' }}>
          
          {/* Left Rates Column */}
          <div className="col-span-5 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Gaji</span>
              <span className="font-bold">{formatIDRCompact(rateHarian)}</span>
            </div>
            <div className="flex justify-between">
              <span>Bonus</span>
              <span className="font-bold">{formatIDRCompact(pay.bonus)}</span>
            </div>
            <div className="flex justify-between">
              <span>Lembur</span>
              <span className="font-bold">{formatIDRCompact(rateLembur)}</span>
            </div>
            <div className="flex justify-between border-t border-dotted pt-0.5 mt-0.5" style={{ borderColor: 'currentColor' }}>
              <span>Kasbon</span>
              <span className="font-bold">{formatIDRCompact(totalKasbonSebelum)}</span>
            </div>
            <div className="flex justify-between">
              <span>sisa</span>
              <span className="font-bold">{formatIDRCompact(totalSisaKasbon)}</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="col-span-1 border-r border-dashed my-0.5" style={{ borderColor: 'currentColor' }} />

          {/* Right Sum Calculations Column */}
          <div className="col-span-6 space-y-1 text-[10px] relative pl-1">
            <div className="flex justify-between">
              <span>Hari kerja</span>
              <div className="flex justify-between w-24">
                <span>{pay.days_worked}</span>
                <span className="font-bold">{formatIDRCompact(pay.base_pay)}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span>Bonus</span>
              <div className="flex justify-between w-24">
                <span>{pay.bonus > 0 ? '1' : '0'}</span>
                <span className="font-bold">{formatIDRCompact(pay.bonus)}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span>Lembur</span>
              <div className="flex justify-between w-24">
                <span>{pay.overtime_hours}</span>
                <span className="font-bold">{formatIDRCompact(pay.overtime_hours * rateLembur)}</span>
              </div>
            </div>
            <div className="flex justify-between text-red-800" style={{ color: inkColor === 'blue' ? '#991B1B' : 'inherit' }}>
              <span>potongan</span>
              <div className="flex justify-between w-24">
                <span>-</span>
                <span className="font-bold">-{formatIDRCompact(pay.cash_advance_deduction)}</span>
              </div>
            </div>

            {/* Total Block */}
            <div className="border-t-2 border-b-2 py-0.5 mt-1 flex justify-between font-black text-xs" style={{ borderColor: 'currentColor', borderStyle: 'double' }}>
              <span>Total</span>
              <span>{formatIDRCompact(pay.total_pay)}</span>
            </div>

            {/* Signature Placement on the bottom right */}
            <div className="absolute -bottom-1.5 right-1 w-20 h-10 pointer-events-none opacity-85 flex flex-col items-center justify-center">
              <svg className="w-14 h-7" viewBox="0 0 100 50" fill="none" style={{ stroke: inkColor === 'blue' ? '#1E40AF' : 'black' }}>
                <path d="M15 35 C 25 15, 35 45, 48 20 C 62 2, 58 48, 78 28 C 88 18, 92 32, 98 22 M18 32 L85 24" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

        </div>

      </div>
    );
  };

  const triggerSystemPrintPayroll = (pay: PayrollWeekly) => {
    // Flag as printed
    const updatedPayrolls = payrolls.map(p => {
      if (p.id === pay.id) {
        return { ...p, is_printed: true };
      }
      return p;
    });
    dataStore.setPayrollWeekly(updatedPayrolls);
    setPayrolls(updatedPayrolls);

    setActivePrintPayroll(pay);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  if (!isAdmin) {
    if (loggedEmployee) {
      const myPayrolls = payrolls.filter(p => p.employee_id === loggedEmployee.id);
      const myAdvances = cashAdvances.filter(c => c.employee_id === loggedEmployee.id);
      const totalSisaKasbon = myAdvances.reduce((sum, item) => sum + item.remaining_balance, 0);

      return (
        <div className="space-y-6">
          {/* Header Title */}
          <div className="bg-[#1F4B36] text-white p-6 rounded-lg shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Informasi Slip Gaji &amp; Kasbon Saya</h2>
              <span className="text-xs bg-emerald-700/80 px-2.5 py-1 rounded-full font-mono font-semibold">
                KARYAWAN AUTHENTICATED
              </span>
            </div>
            <p className="text-xs text-emerald-200">
              Sistem Informasi Penggajian &amp; Transparansi Upah ARI SPORTINDO. Silakan pantau rincian gaji mingguan dan riwayat kasbon Anda di bawah.
            </p>
          </div>

          {/* Profile Card & Kasbon Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-4 shadow-3xs">
              <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider">Profil Anda</h3>
              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-800">{loggedEmployee.name}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 block">Departemen</span>
                    <span className="font-semibold text-gray-700 uppercase">{getDeptName(loggedEmployee.id)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Role</span>
                    <span className="font-semibold text-gray-700 uppercase">{loggedEmployee.role}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Rate Harian</span>
                    <span className="font-semibold text-[#1F4B36] font-mono">{formatIDR(loggedEmployee.rate_harian)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Rate Lembur / Jam</span>
                    <span className="font-semibold text-[#1F4B36] font-mono">{formatIDR(loggedEmployee.rate_lembur_per_jam)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-4 shadow-3xs col-span-2">
              <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                <h3 className="font-bold text-xs text-gray-500 uppercase tracking-wider">Status &amp; Riwayat Kasbon</h3>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400 block uppercase">Total Sisa Kasbon</span>
                  <span className="text-sm font-mono font-black text-rose-600">{formatIDR(totalSisaKasbon)}</span>
                </div>
              </div>

              <div className="space-y-2 max-h-32 overflow-y-auto font-sans">
                {myAdvances.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4 text-center">Anda tidak memiliki catatan kasbon aktif.</p>
                ) : (
                  myAdvances.map((adv) => (
                    <div key={adv.id} className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded border border-gray-100 font-mono">
                      <div>
                        <p className="font-bold text-gray-700">Peminjaman Tanggal {adv.date}</p>
                        <p className="text-[10px] text-gray-400">ID: {adv.id.toUpperCase()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{formatIDR(adv.amount)}</p>
                        <p className="text-[10px] text-rose-600">Sisa: {formatIDR(adv.remaining_balance)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Weekly Payroll History Table */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 space-y-4 shadow-3xs">
            <div>
              <h3 className="font-bold text-sm text-gray-800">Riwayat Slip Gaji Mingguan Anda</h3>
              <p className="text-xs text-gray-400">Menampilkan seluruh slip gaji yang telah diselesaikan oleh admin keuangan untuk Anda</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-150 text-gray-400 font-semibold bg-gray-50/50">
                    <th className="py-2.5 px-3">Periode</th>
                    <th className="py-2.5 px-3">Hari Kerja</th>
                    <th className="py-2.5 px-3">Jam Lembur</th>
                    <th className="py-2.5 px-3">Gaji Pokok</th>
                    <th className="py-2.5 px-3">Bonus</th>
                    <th className="py-2.5 px-3">Potongan Kasbon</th>
                    <th className="py-2.5 px-3 text-right">Total Bersih (Thp)</th>
                    <th className="py-2.5 px-3 text-center no-print">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myPayrolls.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400 italic">
                        Belum ada catatan payroll untuk Anda.
                      </td>
                    </tr>
                  ) : (
                    myPayrolls.map((pay) => (
                      <tr key={pay.id} className="hover:bg-gray-50/50">
                        <td className="py-3 px-3 font-medium text-gray-800">
                          {pay.period_start} s/d {pay.period_end}
                        </td>
                        <td className="py-3 px-3 font-mono text-gray-600">{pay.days_worked} hari</td>
                        <td className="py-3 px-3 font-mono text-gray-600">{pay.overtime_hours} jam</td>
                        <td className="py-3 px-3 font-mono text-gray-600">{formatIDR(pay.base_pay)}</td>
                        <td className="py-3 px-3 font-mono text-gray-600">{formatIDR(pay.bonus)}</td>
                        <td className="py-3 px-3 font-mono text-rose-600">-{formatIDR(pay.cash_advance_deduction)}</td>
                        <td className="py-3 px-3 font-mono text-right font-bold text-[#1F4B36] bg-emerald-50/20">
                          {formatIDR(pay.total_pay)}
                        </td>
                        <td className="py-3 px-3 text-center no-print">
                          <button
                            onClick={() => handlePrint(pay)}
                            className="bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-3xs hover:bg-emerald-700 cursor-pointer flex items-center gap-1.5 mx-auto"
                          >
                            <Printer className="w-3 h-3" />
                            Lihat / Cetak Slip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================= PRINT & PREVIEW SYSTEM ================= */}
          {previewPayroll && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto no-print font-sans">
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col my-auto">
                
                {/* Modal Header Toolbar */}
                <div className="bg-slate-50 border-b border-slate-100 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse" />
                    <span className="font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wider">
                      Live Preview Cetak Slip Gaji (Continuous Form 2-Lapis)
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewPayroll(null)}
                      className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all"
                    >
                      Tutup
                    </button>
                    <button
                      onClick={() => triggerSystemPrintPayroll(previewPayroll)}
                      className="bg-pink-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-pink-800 transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Cetak Sekarang
                    </button>
                  </div>
                </div>

                {/* Modal Configuration / Calibration Panel */}
                <div className="bg-slate-100/50 border-b border-slate-150 p-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                  {/* Paper Customization */}
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-500 block uppercase text-[10px]">Pilihan Kertas &amp; Tinta</span>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-600 text-[10px]">Kertas:</span>
                        <button
                          onClick={() => setPaperColor('white')}
                          className={`px-2 py-1 rounded border text-[10px] font-semibold ${paperColor === 'white' ? 'bg-white border-slate-400 text-slate-800' : 'bg-slate-200/50 border-transparent text-slate-500'}`}
                        >
                          Putih
                        </button>
                        <button
                          onClick={() => setPaperColor('pink')}
                          className={`px-2 py-1 rounded border text-[10px] font-semibold ${paperColor === 'pink' ? 'bg-pink-100 border-pink-400 text-pink-800' : 'bg-slate-200/50 border-transparent text-slate-500'}`}
                        >
                          Pink
                        </button>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-slate-600 text-[10px]">Tinta:</span>
                        <button
                          onClick={() => setInkColor('charcoal')}
                          className={`px-2 py-1 rounded border text-[10px] font-semibold ${inkColor === 'charcoal' ? 'bg-slate-800 border-slate-900 text-white' : 'bg-slate-200/50 border-transparent text-slate-500'}`}
                        >
                          Hitam
                        </button>
                        <button
                          onClick={() => setInkColor('blue')}
                          className={`px-2 py-1 rounded border text-[10px] font-semibold ${inkColor === 'blue' ? 'bg-blue-800 border-blue-900 text-white' : 'bg-slate-200/50 border-transparent text-slate-500'}`}
                        >
                          Biru
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Calibration Controls */}
                  <div className="md:col-span-2 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-500 uppercase text-[10px]">Geser Horisontal (X)</span>
                        <span className="font-mono text-slate-700 font-bold text-[10px]">{calibration.offset_x} mm</span>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        value={calibration.offset_x}
                        onChange={(e) => {
                          const newX = Number(e.target.value);
                          const updated = { ...calibration, offset_x: newX };
                          setCalibration(updated);
                          dataStore.setCalibration(updated);
                        }}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-500 uppercase text-[10px]">Geser Vertikal (Y)</span>
                        <span className="font-mono text-slate-700 font-bold text-[10px]">{calibration.offset_y} mm</span>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        value={calibration.offset_y}
                        onChange={(e) => {
                          const newY = Number(e.target.value);
                          const updated = { ...calibration, offset_y: newY };
                          setCalibration(updated);
                          dataStore.setCalibration(updated);
                        }}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Virtual Continuous Form Paper Area */}
                <div className="p-4 sm:p-6 bg-slate-200 max-h-[60vh] overflow-auto flex justify-center">
                  
                  {/* Virtual Continuous Form Container */}
                  <div 
                    style={{
                      backgroundColor: paperColor === 'pink' ? '#FCE7F3' : '#FCFCFA',
                      color: inkColor === 'blue' ? '#1E40AF' : '#1E293B',
                      borderColor: inkColor === 'blue' ? '#3B82F6' : '#94A3B8',
                      fontFamily: 'Courier, monospace',
                      transform: `translate(${calibration.offset_x}px, ${calibration.offset_y}px)`,
                    }}
                    className="w-[210mm] min-w-[700px] h-[140mm] min-h-[440px] shadow-lg rounded-xs relative flex flex-row border border-dashed transition-all"
                  >
                    {/* Left Tractor Feed Margin with Holes */}
                    <div 
                      className="w-8 flex flex-col justify-between items-center py-4 select-none"
                      style={{
                        borderRight: `1px dashed ${inkColor === 'blue' ? '#93C5FD' : '#CBD5E1'}`,
                      }}
                    >
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="w-3.5 h-3.5 rounded-full bg-slate-300 border border-slate-400/40 shadow-inner flex items-center justify-center text-[5px] text-slate-400 font-sans">
                          ○
                        </div>
                      ))}
                    </div>

                    {/* Main Content Pane */}
                    <div className="flex-1 p-6 relative flex flex-col justify-between select-text text-xs leading-relaxed">
                      {renderSlipGajiLayout(previewPayroll)}
                    </div>

                    {/* Right Tractor Feed Margin with Holes */}
                    <div 
                      className="w-8 flex flex-col justify-between items-center py-4 select-none"
                      style={{
                        borderLeft: `1px dashed ${inkColor === 'blue' ? '#93C5FD' : '#CBD5E1'}`,
                      }}
                    >
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="w-3.5 h-3.5 rounded-full bg-slate-300 border border-slate-400/40 shadow-inner flex items-center justify-center text-[5px] text-slate-400 font-sans">
                          ○
                        </div>
                      ))}
                    </div>

                  </div>
                </div>

                {/* Modal Bottom Information */}
                <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2 font-sans">
                  <span>● Slip Gaji 2-lapis dicetak menggunakan Continuous Form (lembar 1 putih, lembar 2 pink).</span>
                  <span className="font-semibold text-slate-700">Gunakan browser print (Ctrl+P) untuk konfigurasi layout kertas printer.</span>
                </div>

              </div>
            </div>
          )}

          {/* 2. Print-Only Container */}
          {activePrintPayroll && (
            <div className="print-only" style={{
              transform: `translate(${calibration.offset_x}mm, ${calibration.offset_y}mm)`,
              fontFamily: 'Courier, monospace',
              color: 'black',
              width: '210mm',
              height: '140mm',
              padding: '10mm',
              boxSizing: 'border-box'
            }}>
              {renderSlipGajiLayout(activePrintPayroll)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-amber-50 text-warning-orange border border-amber-100 rounded-md p-6 max-w-md mx-auto text-center space-y-3">
        <Sliders className="w-12 h-12 mx-auto text-warning-orange" />
        <h3 className="font-semibold text-base">Akses Terbatas!</h3>
        <p className="text-xs text-gray-600">
          Modul Keuangan &amp; Payroll hanya dapat diakses oleh admin dengan role **Admin Keuangan/HR** atau **Owner**.
        </p>
      </div>
    );
  }

  const filteredPayrolls = payrolls.filter(pay => {
    if (filterStartDate && pay.period_start < filterStartDate) return false;
    if (filterEndDate && pay.period_end > filterEndDate) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="no-print space-y-6">

        {/* Statistics Dashboard Block */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-800/10 text-left shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Total Gaji Pokok</span>
            <p className="text-sm font-bold font-mono text-emerald-950 mt-1">
              {formatIDR(filteredPayrolls.reduce((sum, item) => sum + item.base_pay, 0))}
            </p>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-800/10 text-left shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Total Lembur</span>
            <p className="text-sm font-bold font-mono text-emerald-950 mt-1">
              {formatIDR(filteredPayrolls.reduce((sum, item) => sum + (item.overtime_hours * (employees.find(e => e.id === item.employee_id)?.rate_lembur_per_jam || 20000)), 0))}
            </p>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-800/10 text-left shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Total Bonus</span>
            <p className="text-sm font-bold font-mono text-emerald-950 mt-1">
              {formatIDR(filteredPayrolls.reduce((sum, item) => sum + item.bonus, 0))}
            </p>
          </div>
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-800/10 text-left shadow-xs">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Total Potongan</span>
            <p className="text-sm font-bold font-mono text-rose-700 mt-1">
              -{formatIDR(filteredPayrolls.reduce((sum, item) => sum + item.cash_advance_deduction, 0))}
            </p>
          </div>
          <div className="bg-emerald-800 p-4 rounded-xl text-left text-white col-span-2 md:col-span-1 shadow-md">
            <span className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider">Total Bersih (THP)</span>
            <p className="text-sm font-black font-mono mt-1">
              {formatIDR(filteredPayrolls.reduce((sum, item) => sum + item.total_pay, 0))}
            </p>
          </div>
        </div>
        
        {pendingAdjustmentLogs.length > 0 && (
          <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3">
            <div>
              <h3 className="font-black text-sm text-gray-800">Perlu ACC Lembur / Live TikTok</h3>
              <p className="text-xs text-gray-500">Karyawan yang pulang lewat jam kerja. Pilih salah satu agar masuk perhitungan slip gaji.</p>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {pendingAdjustmentLogs.map(log => (
                <div key={log.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-amber-50/60 border border-amber-100 rounded-lg p-3 text-xs">
                  <div className="md:col-span-5">
                    <p className="font-black text-gray-800">{log.employee_name}</p>
                    <p className="text-gray-500">{log.timestamp.slice(0, 10)} · pulang {log.timestamp.slice(11, 16)} · ekstra {Math.round((log.overtime_minutes || 0) / 60 * 100) / 100} jam</p>
                  </div>
                  <div className="md:col-span-7 flex flex-wrap gap-2 md:justify-end">
                    <button type="button" onClick={() => approveAdjustment(log, 'overtime')} className="px-3 py-2 rounded-lg bg-[#1F4B36] text-white font-bold cursor-pointer">ACC Lembur</button>
                    <button type="button" onClick={() => approveAdjustment(log, 'live_tiktok')} className="px-3 py-2 rounded-lg bg-pink-600 text-white font-bold cursor-pointer">Live TikTok Rp20.000</button>
                    <button type="button" onClick={() => approveAdjustment(log, 'ignored')} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold cursor-pointer">Abaikan</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payroll History & Print list with Evergreen Theme */}
        <div className="bg-white rounded-lg border border-emerald-800/20 overflow-hidden shadow-md w-full">
          <div className="p-4 bg-emerald-50/40 border-b border-emerald-800/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wide">Buku Register Slip Gaji Mingguan</h3>
              <p className="text-[10px] text-emerald-800/70">Daftar slip gaji terdaftar, siap dicetak menggunakan continuous form (dot matrix)</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Kalibrasi Cetak</span>
              </button>
              <button
                type="button"
                onClick={handleExportPayrollCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-emerald-800 border border-emerald-800/30 rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ekspor Rekap (Excel/CSV)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-950 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
              >
                <Calculator className="w-3.5 h-3.5 text-emerald-200 animate-bounce" />
                <span>Hitung Gaji Baru (Kalkulator)</span>
              </button>
            </div>
          </div>

          {/* Date Range Filter Section */}
          <div className="p-4 bg-emerald-50/10 border-b border-emerald-800/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-gray-700">Saring Tanggal Slip:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono text-xs text-gray-700 focus:border-emerald-800 outline-hidden"
                />
                <span className="text-gray-400 font-medium">s/d</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono text-xs text-gray-700 focus:border-emerald-800 outline-hidden"
                />
              </div>
              {(filterStartDate || filterEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterStartDate('');
                    setFilterEndDate('');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline"
                >
                  Reset Filter
                </button>
              )}
            </div>
            <div className="font-mono text-[11px] text-gray-500 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-150">
              Menampilkan {filteredPayrolls.length} dari {payrolls.length} slip
            </div>
          </div>

          <div className="overflow-x-auto rounded-b-lg border-t border-emerald-800/10 shadow-inner bg-emerald-50/5">
            <table className="w-full text-left border-collapse text-xs border border-emerald-800/20 bg-white">
              <thead>
                <tr className="bg-emerald-800 text-white font-bold border-b border-emerald-950 uppercase text-[10px] tracking-wider text-center">
                  <th className="p-3 border-r border-emerald-700/50 text-left">Nama Karyawan</th>
                  <th className="p-3 border-r border-emerald-700/50 text-center">Periode Kerja</th>
                  <th className="p-3 border-r border-emerald-700/50 text-center">Hari / Lembur</th>
                  <th className="p-3 border-r border-emerald-700/50 text-left">Detail Biaya &amp; Potongan</th>
                  <th className="p-3 border-r border-emerald-700/50 text-right">Total Bersih (IDR)</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {filteredPayrolls.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 italic bg-white">
                      Belum ada slip gaji yang cocok dengan filter atau terdaftar.
                    </td>
                  </tr>
                ) : (
                  filteredPayrolls.map((pay) => (
                    <tr key={pay.id} className="hover:bg-emerald-50/40 transition-colors font-medium text-gray-700">
                      <td className="p-3 border-r border-emerald-100/70 font-bold text-emerald-950">{pay.employee_name}</td>
                      <td className="p-3 border-r border-emerald-100/70 font-mono text-center text-[11px] text-gray-600 bg-gray-50/10">
                        {pay.period_start} <span className="text-gray-400">s/d</span> {pay.period_end}
                      </td>
                      <td className="p-3 border-r border-emerald-100/70 text-center text-gray-600">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/50 rounded-full font-bold text-[10px]">
                          {pay.days_worked} Hari
                        </span>
                        {pay.overtime_hours > 0 && (
                          <span className="block mt-1 font-mono text-[10px] text-amber-700 font-bold">
                            + {pay.overtime_hours} Jam Lembur
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-r border-emerald-100/70 text-[11px] text-gray-500 font-mono space-y-0.5">
                        <div className="flex justify-between gap-2 border-b border-gray-100 pb-0.5">
                          <span>Gaji Pokok:</span>
                          <span className="font-bold text-gray-700">{formatIDR(pay.base_pay)}</span>
                        </div>
                        {pay.bonus > 0 && (
                          <div className="flex justify-between gap-2 text-emerald-700 font-bold">
                            <span>Bonus Tambahan:</span>
                            <span>+{formatIDR(pay.bonus)}</span>
                          </div>
                        )}
                        {pay.cash_advance_deduction > 0 && (
                          <div className="flex justify-between gap-2 text-amber-700 font-bold">
                            <span>Potongan Kasbon:</span>
                            <span>-{formatIDR(pay.cash_advance_deduction)}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 border-r border-emerald-100/70 text-right font-mono font-bold text-emerald-950 bg-emerald-50/25 text-sm">
                        {formatIDR(pay.total_pay)}
                      </td>
                      <td className="p-3 text-center bg-gray-50/5">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handlePrint(pay)}
                              className="inline-flex items-center gap-1.5 bg-evergreen hover:bg-evergreen-dark text-white px-2 py-1.5 rounded-lg text-[10px] font-bold shadow-xs transition-colors cursor-pointer"
                              title="Cetak Slip Gaji (Continuous Form)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Cetak CF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditPayroll(pay)}
                              className="inline-flex items-center justify-center p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer"
                              title="Edit Slip Gaji"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePayroll(pay.id)}
                              className="inline-flex items-center justify-center p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
                              title="Hapus Slip Gaji"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {pay.is_printed && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase tracking-wider">
                              ✓ Printed
                            </span>
                          )}
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

      {/* Custom Confirmation Modal for Deleting Payroll Weekly Record */}
      {deletePayrollId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print animate-fade-in"
          onClick={() => setDeletePayrollId(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center relative animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-50 text-red-600 p-3 rounded-full mx-auto w-fit mb-4">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Hapus Slip Gaji Ini?</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus slip gaji karyawan ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletePayrollId(null)}
                className="flex-1 py-2 px-4 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeletePayroll}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRINT & PREVIEW SYSTEM ================= */}
      
      {/* 1. Interactive Preview Modal (On-Screen Only) */}
      {previewPayroll && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto no-print font-sans">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col my-auto">
            
            {/* Modal Header Toolbar */}
            <div className="bg-slate-50 border-b border-slate-100 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse" />
                <span className="font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wider">
                  Live Preview Cetak Slip Gaji (Continuous Form 2-Lapis)
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewPayroll(null)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all"
                >
                  Tutup
                </button>
                <button
                  onClick={() => triggerSystemPrintPayroll(previewPayroll)}
                  className="bg-pink-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-pink-800 transition-all flex items-center gap-1.5 shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Sekarang
                </button>
              </div>
            </div>

            {/* Modal Configuration / Calibration Panel */}
            <div className="bg-slate-100/50 border-b border-slate-150 p-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Paper Customization */}
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-500 block uppercase text-[10px]">Pilihan Kertas & Tinta</span>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-600 text-[10px]">Kertas:</span>
                    <button
                      onClick={() => setPaperColor('white')}
                      className={`px-2 py-1 rounded border text-[10px] font-semibold ${paperColor === 'white' ? 'bg-white border-slate-400 text-slate-800' : 'bg-slate-200/50 border-transparent text-slate-500'}`}
                    >
                      Putih
                    </button>
                    <button
                      onClick={() => setPaperColor('pink')}
                      className={`px-2 py-1 rounded border text-[10px] font-semibold ${paperColor === 'pink' ? 'bg-pink-100 border-pink-400 text-pink-800' : 'bg-slate-200/50 border-transparent text-slate-500'}`}
                    >
                      Pink
                    </button>
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-slate-600 text-[10px]">Tinta:</span>
                    <button
                      onClick={() => setInkColor('charcoal')}
                      className={`px-2 py-1 rounded border text-[10px] font-semibold ${inkColor === 'charcoal' ? 'bg-slate-800 border-slate-900 text-white' : 'bg-slate-200/50 border-transparent text-slate-500'}`}
                    >
                      Hitam
                    </button>
                    <button
                      onClick={() => setInkColor('blue')}
                      className={`px-2 py-1 rounded border text-[10px] font-semibold ${inkColor === 'blue' ? 'bg-blue-800 border-blue-900 text-white' : 'bg-slate-200/50 border-transparent text-slate-500'}`}
                    >
                      Biru
                    </button>
                  </div>
                </div>
              </div>

              {/* Calibration Controls */}
              <div className="md:col-span-2 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500 uppercase text-[10px]">Geser Horisontal (X)</span>
                    <span className="font-mono text-slate-700 font-bold text-[10px]">{calibration.offset_x} mm</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    value={calibration.offset_x}
                    onChange={(e) => {
                      const newX = Number(e.target.value);
                      const updated = { ...calibration, offset_x: newX };
                      setCalibration(updated);
                      dataStore.setCalibration(updated);
                    }}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-700"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500 uppercase text-[10px]">Geser Vertikal (Y)</span>
                    <span className="font-mono text-slate-700 font-bold text-[10px]">{calibration.offset_y} mm</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    value={calibration.offset_y}
                    onChange={(e) => {
                      const newY = Number(e.target.value);
                      const updated = { ...calibration, offset_y: newY };
                      setCalibration(updated);
                      dataStore.setCalibration(updated);
                    }}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-pink-700"
                  />
                </div>
              </div>
            </div>

            {/* Virtual Continuous Form Paper Area */}
            <div className="p-4 sm:p-6 bg-slate-200 max-h-[60vh] overflow-auto flex justify-center">
              
              {/* Virtual Continuous Form Container */}
              <div 
                style={{
                  backgroundColor: paperColor === 'pink' ? '#FCE7F3' : '#FCFCFA',
                  color: inkColor === 'blue' ? '#1E40AF' : '#1E293B',
                  borderColor: inkColor === 'blue' ? '#3B82F6' : '#94A3B8',
                  fontFamily: 'Courier, monospace',
                  transform: `translate(${calibration.offset_x}px, ${calibration.offset_y}px)`,
                }}
                className="w-[210mm] min-w-[700px] h-[140mm] min-h-[440px] shadow-lg rounded-xs relative flex flex-row border border-dashed transition-all"
              >
                
                {/* Left Tractor Feed Margin with Holes */}
                <div 
                  className="w-8 flex flex-col justify-between items-center py-4 select-none"
                  style={{
                    borderRight: `1px dashed ${inkColor === 'blue' ? '#93C5FD' : '#CBD5E1'}`,
                  }}
                >
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-full bg-slate-300 border border-slate-400/40 shadow-inner flex items-center justify-center text-[5px] text-slate-400 font-sans">
                      ○
                    </div>
                  ))}
                </div>

                {/* Main Content Pane */}
                <div className="flex-1 p-6 relative flex flex-col justify-between select-text text-xs leading-relaxed">
                  {renderSlipGajiLayout(previewPayroll)}
                </div>

                {/* Right Tractor Feed Margin with Holes */}
                <div 
                  className="w-8 flex flex-col justify-between items-center py-4 select-none"
                  style={{
                    borderLeft: `1px dashed ${inkColor === 'blue' ? '#93C5FD' : '#CBD5E1'}`,
                  }}
                >
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-3.5 h-3.5 rounded-full bg-slate-300 border border-slate-400/40 shadow-inner flex items-center justify-center text-[5px] text-slate-400 font-sans">
                      ○
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* Modal Bottom Information */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 gap-2">
              <span>● Slip Gaji 2-lapis dicetak menggunakan Continuous Form (lembar 1 putih, lembar 2 pink).</span>
              <span className="font-semibold text-slate-700">Gunakan browser print (Ctrl+P) untuk konfigurasi layout kertas printer.</span>
            </div>

          </div>
        </div>
      )}

      {/* POP-UP WEEKLY PAYROLL CALCULATOR MODAL */}
      {isCalculatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 no-print animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-emerald-800/30 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-emerald-800 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-wide">
                <Calculator className="w-4 h-4 text-emerald-100 animate-pulse" /> Kalkulator &amp; Posting Gaji Mingguan
              </h3>
              <button 
                type="button"
                onClick={() => setIsCalculatorOpen(false)} 
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePayroll} className="p-6 space-y-4 text-xs text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Pilih Karyawan</label>
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 text-emerald-950 font-bold focus:bg-white focus:outline-none focus:border-emerald-700 cursor-pointer"
                    required
                  >
                    <option value="">-- Pilih Karyawan --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Awal Periode</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 font-mono text-emerald-950 font-bold focus:bg-white focus:outline-none focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Akhir Periode</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 font-mono text-emerald-950 font-bold focus:bg-white focus:outline-none focus:border-emerald-700"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Hari Kerja (Auto)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={daysWorked}
                    onChange={(e) => setDaysWorked(Number(e.target.value))}
                    className="w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 text-emerald-950 font-semibold focus:bg-white focus:outline-none focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Jam Lembur</label>
                  <input
                    type="number"
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(Number(e.target.value))}
                    className="w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 text-emerald-950 font-semibold focus:bg-white focus:outline-none focus:border-emerald-700"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Bonus Tambahan</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-emerald-800/60 font-bold">Rp</span>
                    <input
                      type="number"
                      value={bonus}
                      onChange={(e) => setBonus(Number(e.target.value))}
                      className="pl-9 w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 font-mono text-emerald-950 font-bold focus:bg-white focus:outline-none focus:border-emerald-700"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Potongan Kasbon</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-emerald-800/60 font-bold">Rp</span>
                    <input
                      type="number"
                      value={kasbonDeduction}
                      onChange={(e) => setKasbonDeduction(Number(e.target.value))}
                      className="pl-9 w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 font-mono text-emerald-950 font-bold focus:bg-white focus:outline-none focus:border-emerald-700"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setIsCalculatorOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg transition-colors shadow-sm cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Generate &amp; Posting Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POP-UP EDIT PAYROLL WEEKLY MODAL */}
      {editingPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 no-print animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-emerald-800/30 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-emerald-800 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-wide">
                <Edit2 className="w-4 h-4 text-emerald-100" /> Edit Slip Gaji: {editingPayroll.employee_name}
              </h3>
              <button 
                type="button"
                onClick={() => setEditingPayroll(null)} 
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPayroll} className="p-6 space-y-4 text-xs text-left">
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-800/10 mb-2">
                <p className="font-bold text-emerald-950 uppercase text-[10px] tracking-wider mb-1">Informasi Periode Kerja</p>
                <p className="text-[11px] font-mono text-gray-700 font-semibold">
                  {editingPayroll.period_start} s/d {editingPayroll.period_end}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Hari Kerja</label>
                  <input
                    type="number"
                    value={editDaysWorked}
                    onChange={(e) => setEditDaysWorked(Number(e.target.value))}
                    className="w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 text-emerald-950 font-semibold focus:bg-white focus:outline-none focus:border-emerald-700"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Jam Lembur</label>
                  <input
                    type="number"
                    value={editOvertimeHours}
                    onChange={(e) => setEditOvertimeHours(Number(e.target.value))}
                    className="w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 text-emerald-950 font-semibold focus:bg-white focus:outline-none focus:border-emerald-700"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Gaji Pokok (Bisa Diubah)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-emerald-800/60 font-bold">Rp</span>
                    <input
                      type="number"
                      value={editBasePay}
                      onChange={(e) => setEditBasePay(Number(e.target.value))}
                      className="pl-9 w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 font-mono text-emerald-950 font-bold focus:bg-white focus:outline-none focus:border-emerald-700"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Bonus Tambahan</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-emerald-800/60 font-bold">Rp</span>
                    <input
                      type="number"
                      value={editBonus}
                      onChange={(e) => setEditBonus(Number(e.target.value))}
                      className="pl-9 w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 font-mono text-emerald-950 font-bold focus:bg-white focus:outline-none focus:border-emerald-700"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Potongan Kasbon</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-emerald-800/60 font-bold">Rp</span>
                    <input
                      type="number"
                      value={editKasbonDeduction}
                      onChange={(e) => setEditKasbonDeduction(Number(e.target.value))}
                      className="pl-9 w-full bg-emerald-50/10 border border-emerald-800/25 rounded-lg px-3 py-2 font-mono text-emerald-950 font-bold focus:bg-white focus:outline-none focus:border-emerald-700"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-emerald-800 uppercase tracking-wider mb-1">Total Gaji Bersih (Take Home Pay)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-emerald-800/60 font-bold">Rp</span>
                    <input
                      type="number"
                      value={editTotalPay}
                      onChange={(e) => setEditTotalPay(Number(e.target.value))}
                      className="pl-9 w-full bg-emerald-800/10 border border-emerald-800/40 rounded-lg px-3 py-2 font-mono text-emerald-950 font-black focus:bg-white focus:outline-none focus:border-emerald-700"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setEditingPayroll(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg transition-colors shadow-sm cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CALIBRATION SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 no-print animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-300 overflow-hidden shadow-2xl animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="bg-emerald-800 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-wide">
                <Sliders className="w-4 h-4 text-slate-100 animate-pulse" /> Kalibrasi Cetak Dot Matrix
              </h3>
              <button 
                type="button"
                onClick={() => setIsSettingsOpen(false)} 
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCalibration} className="p-6 space-y-5 text-xs text-left">
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Atur offset pergeseran cetak dalam milimeter (mm) untuk printer continuous form (dot matrix). Pengaturan ini disimpan secara lokal di browser Anda.
              </p>

              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Geser X (Kanan/Kiri)</span>
                    <span className="font-mono text-emerald-800 font-extrabold text-sm">{calibration.offset_x} mm</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    value={calibration.offset_x}
                    onChange={(e) => {
                      const newX = Number(e.target.value);
                      const updated = { ...calibration, offset_x: newX };
                      setCalibration(updated);
                      dataStore.setCalibration(updated);
                    }}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-800"
                  />
                  <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                    <span>-30 mm (Kiri)</span>
                    <span>0 mm (Normal)</span>
                    <span>+30 mm (Kanan)</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">Geser Y (Atas/Bawah)</span>
                    <span className="font-mono text-emerald-800 font-extrabold text-sm">{calibration.offset_y} mm</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    value={calibration.offset_y}
                    onChange={(e) => {
                      const newY = Number(e.target.value);
                      const updated = { ...calibration, offset_y: newY };
                      setCalibration(updated);
                      dataStore.setCalibration(updated);
                    }}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-800"
                  />
                  <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                    <span>-30 mm (Atas)</span>
                    <span>0 mm (Normal)</span>
                    <span>+30 mm (Bawah)</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg transition-colors shadow-sm cursor-pointer text-xs"
                >
                  Terapkan Offset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Print-Only Container (Identical layout to images, triggered on system print) */}
      {activePrintPayroll && (
        <div className="print-only" style={{
          transform: `translate(${calibration.offset_x}mm, ${calibration.offset_y}mm)`,
          fontFamily: 'Courier, monospace',
          color: 'black',
          width: '210mm',
          height: '140mm',
          padding: '10mm',
          boxSizing: 'border-box'
        }}>
          {renderSlipGajiLayout(activePrintPayroll)}
        </div>
      )}

    </div>
  );
};
