// Self-check konsistensi kasbon saat slip gaji dihapus / diedit.
// Jalankan: npx tsx src/kasbonRefund.check.ts
import assert from 'node:assert/strict';

// Stub browser API yang dipakai dataStore (localStorage + event window) supaya
// skrip bisa jalan di Node — dataStore sendiri tidak menyentuh DOM lain.
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => (mem.has(key) ? mem.get(key) : null),
  setItem: (key: string, value: string) => { mem.set(key, String(value)); },
  removeItem: (key: string) => { mem.delete(key); }
};
(globalThis as any).window = { dispatchEvent: () => true };

const { dataStore } = await import('./dataStore');
import type { CashAdvance, CashAdvanceTransaction, PayrollWeekly } from './types';

// ===== Fixture =====
const advance = (over: Partial<CashAdvance> = {}): CashAdvance => ({
  id: 'adv1', employee_id: 'emp-ude', employee_name: 'Ude', amount: 100000,
  remaining_balance: 60000, date: '2026-09-01', ...over
});
const slip = (over: Partial<PayrollWeekly>): PayrollWeekly => ({
  id: 'p1', employee_id: 'emp-ude', employee_name: 'Ude', period_start: '2026-09-05',
  period_end: '2026-09-11', days_worked: 6, overtime_hours: 0, base_pay: 900000,
  bonus: 0, cash_advance_deduction: 40000, total_pay: 860000, is_printed: false,
  payment_status: 'unpaid', ...over
});
const deductionTx = (payrollId: string, amount: number): CashAdvanceTransaction => ({
  id: `tx-${payrollId}-${amount}`, cash_advance_id: 'adv1', employee_id: 'emp-ude',
  employee_name: 'Ude', type: 'deduction', amount, date: '2026-09-11',
  note: `Potongan kasbon dari slip ${payrollId}`, payroll_id: payrollId,
  created_at: '2026-09-11T18:00:00.000+07:00'
});
// Fixture harus self-consistent: remaining_balance = amount − total potongan
// yang tercatat (begitulah perilaku applyCashAdvancePayment di aplikasi asli).
// Cap defensif di refund (room = amount − remaining) melindungi invarian
// "saldo ≤ nominal" pada data korup — fixture yang masuk akal tidak akan
// pernah menyentuhnya.
const resetFixtures = (
  payrollOverrides: Partial<PayrollWeekly>,
  txs: CashAdvanceTransaction[],
  advanceRemaining = 100000 - txs.filter(t => t.type === 'deduction').reduce((s, t) => s + t.amount, 0)
) => {
  dataStore.setCashAdvances([advance({ remaining_balance: advanceRemaining })]);
  dataStore.setPayrollWeekly([slip(payrollOverrides)]);
  dataStore.setCashAdvanceTransactions(txs);
};
const saldo = () => dataStore.getCashAdvances()[0].remaining_balance;
const adjustmentsOf = (payrollId: string) =>
  dataStore.getCashAdvanceTransactions().filter(t => t.payroll_id === payrollId && t.type === 'adjustment');

// ===== 1. Hapus slip → potongan kasbon kembali penuh =====
{
  resetFixtures({ id: 'p1', cash_advance_deduction: 40000 }, [deductionTx('p1', 40000)]);
  const { refunded } = dataStore.deletePayroll('p1');
  assert.equal(refunded, 40000, 'refund harus sebesar potongan yang tercatat');
  assert.equal(saldo(), 100000, 'saldo harus kembali penuh (60000 + 40000)');
  assert.equal(dataStore.getPayrollWeekly().length, 0, 'slip harus hilang');
  const refunds = adjustmentsOf('p1');
  assert.equal(refunds.length, 1, 'transaksi pengembalian harus tercatat');
  assert.equal(refunds[0].amount, 40000);
  console.log('OK: hapus slip — potongan kasbon kembali penuh + tercatat sebagai adjustment');
}

// ===== 2. Hapus slip lama tanpa transaksi ter-link → tidak mengembalikan apa pun =====
{
  // Slip era lama (pra-transaksi kasbon): angka potongan di slip tidak pernah
  // tercatat di ledger kasbon — mengembalikannya = menggembungkan saldo dari uang
  // yang tidak pernah dipotong. Refund harus 0.
  resetFixtures({ id: 'p2', cash_advance_deduction: 50000 }, []);
  const saldoSebelum = saldo();
  const { refunded } = dataStore.deletePayroll('p2');
  assert.equal(refunded, 0, 'slip tanpa jejak transaksi tidak boleh mengembalikan kasbon');
  assert.equal(saldo(), saldoSebelum, 'saldo tidak boleh berubah');
  assert.equal(adjustmentsOf('p2').length, 0);
  console.log('OK: hapus slip tanpa jejak transaksi — saldo tidak berubah');
}

// ===== 3. Hapus ulang → error jelas =====
{
  resetFixtures({ id: 'p3' }, [deductionTx('p3', 40000)]);
  dataStore.deletePayroll('p3');
  assert.throws(() => dataStore.deletePayroll('p3'), /tidak ditemukan/i);
  assert.equal(saldo(), 100000, 'saldo tidak boleh dobel-refund');
  console.log('OK: hapus ulang slip — ditolak, saldo tidak dobel kembali');
}

// ===== 4. Edit slip: potongan diturunkan → selisihnya kembali =====
{
  resetFixtures({ id: 'p4', cash_advance_deduction: 50000 }, [deductionTx('p4', 50000)]);
  const updated = dataStore.updatePayroll('p4', { cash_advance_deduction: 30000, total_pay: 870000 });
  assert.equal(updated.cash_advance_deduction, 30000);
  assert.equal(saldo(), 70000, 'saldo 50000 + 20000 selisih');
  assert.equal(adjustmentsOf('p4').reduce((s, t) => s + t.amount, 0), 20000, 'adjustment 20000 tercatat');
  console.log('OK: edit turunkan potongan 50000 → 30000 — selisih 20000 kembali ke saldo');
}

// ===== 5. Edit slip: potongan dinaikkan → selisihnya dipotong =====
{
  resetFixtures({ id: 'p5', cash_advance_deduction: 30000 }, [deductionTx('p5', 30000)]);
  const updated = dataStore.updatePayroll('p5', { cash_advance_deduction: 50000, total_pay: 850000 });
  assert.equal(updated.cash_advance_deduction, 50000);
  assert.equal(saldo(), 50000, 'saldo 70000 - 20000 selisih');
  const extra = dataStore.getCashAdvanceTransactions()
    .filter(t => t.payroll_id === 'p5' && t.type === 'deduction');
  assert.equal(extra.reduce((s, t) => s + t.amount, 0), 50000, 'deduction ter-link total 50000');
  console.log('OK: edit naikkan potongan 30000 → 50000 — selisih 20000 dipotong');
}

// ===== 6. Edit melebihi sisa kasbon → ditolak, slip & saldo utuh =====
{
  resetFixtures({ id: 'p6', cash_advance_deduction: 30000 }, [deductionTx('p6', 30000)]);
  assert.throws(
    () => dataStore.updatePayroll('p6', { cash_advance_deduction: 999000 }),
    /melebihi sisa kasbon/i,
    'guard harus menolak sebelum applyCashAdvancePayment memotong sebagian'
  );
  assert.equal(saldo(), 70000, 'saldo tidak boleh berubah saat edit ditolak');
  assert.equal(dataStore.getPayrollWeekly()[0].cash_advance_deduction, 30000, 'slip tidak jadi diubah');
  console.log('OK: edit potongan melebihi sisa — ditolak, slip dan saldo utuh');
}

// ===== 7. Refund neto: edit turun lalu hapus → tidak dobel kembali =====
{
  // Potongan 50000, diedit turun ke 20000 (refund 30000), lalu slip dihapus:
  // refund hapus hanya boleh mengembalikan SISA NETO (20000), bukan 50000 lagi.
  resetFixtures({ id: 'p7', cash_advance_deduction: 50000 }, [deductionTx('p7', 50000)]);
  dataStore.updatePayroll('p7', { cash_advance_deduction: 20000, total_pay: 880000 });
  assert.equal(saldo(), 80000, 'setelah edit turun: 50000 + 30000');
  const { refunded } = dataStore.deletePayroll('p7');
  assert.equal(refunded, 20000, 'hapus hanya mengembalikan neto 20000');
  assert.equal(saldo(), 100000, 'saldo penuh tepat sekali, tidak lebih');
  console.log('OK: refund neto — edit turun lalu hapus tidak dobel mengembalikan');
}

// ===== 8. Kasbon terpotong dari dua kasbon → refund ke sumber masing-masing =====
{
  dataStore.setCashAdvances([
    advance({ id: 'advA', remaining_balance: 0, date: '2026-08-01' }),
    advance({ id: 'advB', remaining_balance: 0, date: '2026-08-15' })
  ]);
  dataStore.setPayrollWeekly([slip({ id: 'p8', cash_advance_deduction: 70000 })]);
  dataStore.setCashAdvanceTransactions([
    { ...deductionTx('p8', 40000), cash_advance_id: 'advA' },
    { ...deductionTx('p8', 30000), cash_advance_id: 'advB' }
  ]);
  const { refunded } = dataStore.deletePayroll('p8');
  assert.equal(refunded, 70000);
  const byId = new Map(dataStore.getCashAdvances().map(a => [a.id, a.remaining_balance]));
  assert.equal(byId.get('advA'), 40000, 'advA menerima kembali persis yang dipotong darinya');
  assert.equal(byId.get('advB'), 30000, 'advB menerima kembali persis yang dipotong darinya');
  console.log('OK: potongan lintas dua kasbon — refund kembali ke sumber masing-masing');
}

// ===== 9. Kasbon lunas penuh + room penuh: refund tidak melebihi nominal =====
{
  // Kasbon 100000 sudah dilunasi manual (saldo 0). Slip lama masih menuntut
  // potongan 40000 → refund masuk 40000, saldo jadi 40000 (≤ nominal), bukan 140000.
  dataStore.setCashAdvances([advance({ remaining_balance: 0 })]);
  dataStore.setPayrollWeekly([slip({ id: 'p9', cash_advance_deduction: 40000 })]);
  dataStore.setCashAdvanceTransactions([deductionTx('p9', 40000)]);
  const { refunded } = dataStore.deletePayroll('p9');
  assert.equal(refunded, 40000);
  assert.equal(saldo(), 40000, 'saldo tidak boleh melebihi nominal kasbon');
  console.log('OK: kasbon lunas + refund — saldo kembali tanpa melampaui nominal');
}

// ===== 10. Dua transaksi potongan dari kasbon yang sama, total melebihi ruang =====
{
  // Kasbon 100000 sudah dibayar manual 80000 (saldo 20000, ruang 80000).
  // Slip pernah memotong darinya 50000 + 50000 (total 100000) — refund tidak
  // boleh melampaui ruang: hanya 80000 yang kembali, saldo pas di nominal.
  dataStore.setCashAdvances([advance({ remaining_balance: 20000 })]);
  dataStore.setPayrollWeekly([slip({ id: 'p10', cash_advance_deduction: 100000 })]);
  dataStore.setCashAdvanceTransactions([deductionTx('p10', 50000), { ...deductionTx('p10', 50000) }]);
  // (id transaksi kedua dibuat unik di bawah agar tidak menabrak id pertama)
  const txs = dataStore.getCashAdvanceTransactions();
  txs[0].id = 'tx-p10-a'; txs[1].id = 'tx-p10-b';
  dataStore.setCashAdvanceTransactions(txs);
  const { refunded } = dataStore.deletePayroll('p10');
  assert.equal(refunded, 80000, 'refund terpotong di batas ruang');
  assert.equal(saldo(), 100000, 'saldo pas di nominal, tidak melampauinya');
  console.log('OK: dua potongan satu kasbon melebihi ruang — refund dibatasi di nominal');
}

// ===== 11. Restore slip dari recycle bin → kasbon dipotong ulang, idempoten =====
{
  // Hapus slip (kasbon kembali), restore dari recycle bin (kasbon dipotong lagi
  // sebesar potongan slip, maksimal sisa saldo), hapus LAGI (neto deduction −
  // adjustment tidak dobel). Simulasi recycle bin: captureChanges membuat entri
  // 'payroll_weekly:<id>' di nxty_recycle_bin — kita pakai persis entri itu.
  resetFixtures({ id: 'p11', cash_advance_deduction: 40000 }, [deductionTx('p11', 40000)]);
  dataStore.deletePayroll('p11');
  assert.equal(saldo(), 100000, 'setelah hapus: saldo penuh');
  const recycleEntry = dataStore.getRecycleBin().find(e => e.id === 'payroll_weekly:p11');
  assert.ok(recycleEntry, 'slip terhapus harus masuk recycle bin');
  dataStore.restoreRecycleEntry('payroll_weekly:p11');
  assert.equal(dataStore.getPayrollWeekly().length, 1, 'slip kembali aktif');
  assert.equal(saldo(), 60000, 'kasbon dipotong ulang sebesar potongan slip');
  // Hapus ulang: neto deduction(80000: 40000 awal + 40000 restore) − adjustment
  // (40000 refund pertama) = 40000 → saldo kembali ke 100000, bukan 140000.
  const { refunded } = dataStore.deletePayroll('p11');
  assert.equal(refunded, 40000, 'hapus ulang hanya mengembalikan neto');
  assert.equal(saldo(), 100000, 'tidak dobel setelah siklus hapus-restore-hapus');
  console.log('OK: restore dari recycle bin — kasbon dipotong ulang & siklus tetap idempoten');
}

console.log('\nSemua check konsistensi kasbon (hapus/edit slip) LULUS.');
