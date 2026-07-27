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
