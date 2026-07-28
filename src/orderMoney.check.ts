// Self-check hitungan uang order non-marketplace. Jalankan: npx tsx src/orderMoney.check.ts
import assert from 'node:assert/strict';
import { orderRemaining, orderPaymentStatus, orderRevenue } from './types';

// total = subtotal - diskon + ongkir. Contoh: 500rb - 50rb + 20rb = 470rb
const order = { total: 470_000, dp: 100_000, shipping_fee: 20_000 };

assert.equal(orderRemaining(order), 370_000);
assert.equal(orderPaymentStatus(order), 'dp');
// Ongkir bukan pendapatan penjualan
assert.equal(orderRevenue(order), 450_000);

// Belum bayar
assert.equal(orderRemaining({ total: 470_000 }), 470_000);
assert.equal(orderPaymentStatus({ total: 470_000 }), 'belum_bayar');
assert.equal(orderPaymentStatus({ total: 470_000, dp: 0 }), 'belum_bayar');

// Lunas, termasuk bila DP kelebihan bayar — sisa tidak boleh minus
assert.equal(orderPaymentStatus({ total: 470_000, dp: 470_000 }), 'lunas');
assert.equal(orderRemaining({ total: 470_000, dp: 500_000 }), 0);
assert.equal(orderPaymentStatus({ total: 470_000, dp: 500_000 }), 'lunas');

// Tanpa ongkir, pendapatan sama dengan total
assert.equal(orderRevenue({ total: 450_000 }), 450_000);

console.log('OK: hitungan DP, sisa tagihan, dan pendapatan tanpa ongkir');

// === Pembayaran bertahap (hutang & piutang) ===
import { paidAmountOf, remainingOf, paymentStateOf, purchaseRemaining, purchasePaymentState } from './types';

// Order lama hanya punya satu angka dp; tetap terbaca
assert.equal(paidAmountOf({ dp: 100_000 }), 100_000);
// Begitu ada daftar pembayaran, daftarnya yang dipakai (dp tidak dijumlah dua kali)
assert.equal(paidAmountOf({ dp: 100_000, payments: [{ id: '1', date: '2026-07-01', amount: 100_000 }] }), 100_000);
assert.equal(paidAmountOf({
  payments: [
    { id: '1', date: '2026-07-01', amount: 100_000 },
    { id: '2', date: '2026-07-10', amount: 50_000 },
  ],
}), 150_000);
assert.equal(paidAmountOf({}), 0);

assert.equal(remainingOf(470_000, 150_000), 320_000);
assert.equal(remainingOf(470_000, 500_000), 0); // kelebihan bayar tidak jadi minus

assert.equal(paymentStateOf(470_000, 0), 'belum_bayar');
assert.equal(paymentStateOf(470_000, 150_000), 'sebagian');
assert.equal(paymentStateOf(470_000, 470_000), 'lunas');
assert.equal(paymentStateOf(470_000, 600_000), 'lunas');

// Sisa tagihan order ikut daftar pembayaran, bukan hanya dp
assert.equal(orderRemaining({ total: 470_000, payments: [{ id: '1', date: '2026-07-01', amount: 400_000 }] }), 70_000);
assert.equal(orderPaymentStatus({ total: 470_000, payments: [{ id: '1', date: '2026-07-01', amount: 470_000 }] }), 'lunas');

// Hutang ke supplier
const po = { total_price: 1_000_000, payments: [{ id: '1', date: '2026-07-05', amount: 300_000 }] };
assert.equal(purchaseRemaining(po), 700_000);
assert.equal(purchasePaymentState(po), 'sebagian');
assert.equal(purchasePaymentState({ total_price: 1_000_000 }), 'belum_bayar');
assert.equal(purchaseRemaining({ total_price: 1_000_000, payments: [{ id: '1', date: '2026-07-05', amount: 1_000_000 }] }), 0);

console.log('OK: pembayaran bertahap hutang & piutang');
