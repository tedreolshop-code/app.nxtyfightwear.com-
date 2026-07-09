import React, { useState, useEffect } from 'react';
import { Customer, Invoice, DeliveryNote, Product, InvoiceItem } from '../types';
import { dataStore } from '../dataStore';
import { brandName, brandLegalName } from '../brand';
import { FileText, Truck, UserPlus, ShoppingCart, Printer, Search, CheckCircle, Clock } from 'lucide-react';

interface InvoiceModuleProps {
  isAdmin: boolean;
  userRole: string;
}

export const InvoiceModule: React.FC<InvoiceModuleProps> = ({ isAdmin, userRole }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // New Customer states
  const [newCustName, setNewCustName] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustContact, setNewCustContact] = useState('');
  const [showAddCust, setShowAddCust] = useState(false);

  // New Invoice states
  const [invoiceCustomerId, setInvoiceCustomerId] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<Array<{ product_id: string; qty: number; price: number }>>([]);
  const [invoiceDp, setInvoiceDp] = useState(0);
  const [invoiceTax, setInvoiceTax] = useState(11); // Default 11% PPN
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [expedition, setExpedition] = useState('Kurir internal');
  
  // Temporary current item selected state
  const [selectedProdId, setSelectedProdId] = useState('');
  const [itemQty, setItemQty] = useState(1);

  // Active print templates
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [printSJ, setPrintSJ] = useState<DeliveryNote | null>(null);

  // Preview templates
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewSJ, setPreviewSJ] = useState<DeliveryNote | null>(null);
  const [paperColor, setPaperColor] = useState<'white' | 'pink'>('white');
  const [inkColor, setInkColor] = useState<'charcoal' | 'blue'>('blue');

  // Calibration offsets
  const [calibration, setCalibration] = useState({ offset_x: 0, offset_y: 0 });

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener('nxty_storage_change', handleStorageChange);
    return () => window.removeEventListener('nxty_storage_change', handleStorageChange);
  }, []);

  const loadData = () => {
    setCustomers(dataStore.getCustomers());
    setInvoices(dataStore.getInvoices());
    setDeliveryNotes(dataStore.getDeliveryNotes());
    setProducts(dataStore.getProducts());
    setCalibration(dataStore.getCalibration());
  };

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName) return;

    const newCust: Customer = {
      id: `cust-${Math.random().toString(36).substring(2, 9)}`,
      name: newCustName,
      address: newCustAddress,
      contact: newCustContact
    };

    const currentCusts = dataStore.getCustomers();
    currentCusts.push(newCust);
    dataStore.setCustomers(currentCusts);

    setNewCustName('');
    setNewCustAddress('');
    setNewCustContact('');
    setShowAddCust(false);
    loadData();
  };

  const handleAddItemToInvoice = () => {
    if (!selectedProdId || itemQty <= 0) return;
    const prod = products.find(p => p.id === selectedProdId);
    if (!prod) return;

    // Check if item is already in list
    const existingIdx = invoiceItems.findIndex(i => i.product_id === selectedProdId);
    if (existingIdx !== -1) {
      const updated = [...invoiceItems];
      updated[existingIdx].qty += itemQty;
      setInvoiceItems(updated);
    } else {
      setInvoiceItems([...invoiceItems, { product_id: selectedProdId, qty: itemQty, price: prod.harga_jual }]);
    }

    setSelectedProdId('');
    setItemQty(1);
  };

  const handleRemoveItemFromInvoice = (idx: number) => {
    const updated = [...invoiceItems];
    updated.splice(idx, 1);
    setInvoiceItems(updated);
  };

  const handlePostInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceCustomerId || invoiceItems.length === 0) {
      alert('Pilih pelanggan dan tambahkan minimal 1 jenis barang!');
      return;
    }

    const cust = customers.find(c => c.id === invoiceCustomerId);
    if (!cust) return;

    // Build final items array for submission
    const finalItems: InvoiceItem[] = invoiceItems.map(item => {
      const p = products.find(prod => prod.id === item.product_id)!;
      return {
        id: Math.random().toString(36).substring(2, 9),
        product_id: item.product_id,
        product_name: p.name,
        variant: p.variant,
        qty: item.qty,
        price: item.price,
        subtotal: item.qty * item.price
      };
    });

    const subtotal = finalItems.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = Math.round(subtotal * (invoiceTax / 100));

    // Submit invoice (this will automatically deduct stock and record stock movements)
    const newInv = dataStore.recordSale({
      customer_id: cust.id,
      customer_name: cust.name,
      date: new Date().toISOString().split('T')[0],
      due_date: invoiceDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      items: finalItems,
      dp: invoiceDp,
      tax: taxAmount,
      payment_status: 'belum_lunas'
    });

    // Create delivery note matching this invoice
    const newDeliveryNotes = dataStore.getDeliveryNotes();
    const newSJ: DeliveryNote = {
      id: `sj-${Math.random().toString(36).substring(2, 9)}`,
      customer_id: cust.id,
      customer_name: cust.name,
      delivery_number: `SJ/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${(newDeliveryNotes.length + 1).toString().padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      expedition,
      items: finalItems.map(f => ({
        product_id: f.product_id,
        product_name: f.product_name,
        variant: f.variant,
        qty: f.qty
      })),
      status: 'dikirim'
    };

    newDeliveryNotes.unshift(newSJ);
    dataStore.setDeliveryNotes(newDeliveryNotes);

    // Reset wizard
    setInvoiceCustomerId('');
    setInvoiceItems([]);
    setInvoiceDp(0);
    setInvoiceTax(11);
    setInvoiceDueDate('');
    setExpedition('Kurir internal');
    alert(`Berhasil menerbitkan Invoice ${newInv.invoice_number} dan Surat Jalan ${newSJ.delivery_number}. Stok barang jadi otomatis terpotong!`);
    loadData();
  };

  const handleToggleInvoiceStatus = (id: string) => {
    const updatedInvs = invoices.map(inv => {
      if (inv.id === id) {
        return { ...inv, payment_status: inv.payment_status === 'lunas' ? 'belum_lunas' : 'lunas' as const };
      }
      return inv;
    });
    dataStore.setInvoices(updatedInvs);
    loadData();
  };

  const handleToggleSJStatus = (id: string) => {
    const updatedSJs = deliveryNotes.map(sj => {
      if (sj.id === id) {
        return { ...sj, status: sj.status === 'dikirim' ? 'diterima' : 'dikirim' as const };
      }
      return sj;
    });
    dataStore.setDeliveryNotes(updatedSJs);
    loadData();
  };

  const handlePrintInvoice = (inv: Invoice) => {
    setPreviewInvoice(inv);
    setPreviewSJ(null);
    setPaperColor('white');
    setInkColor('charcoal');
  };

  const handlePrintSJ = (sj: DeliveryNote) => {
    setPreviewSJ(sj);
    setPreviewInvoice(null);
    setPaperColor('white');
    setInkColor('charcoal');
  };

  const triggerSystemPrintInvoice = (inv: Invoice) => {
    setPrintInvoice(inv);
    setPrintSJ(null);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const triggerSystemPrintSJ = (sj: DeliveryNote) => {
    setPrintSJ(sj);
    setPrintInvoice(null);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const canEditInvoice = userRole === 'owner' || userRole === 'admin_keuangan_hr';

  return (
    <div className="space-y-6">
      
      {/* 1. Header with Actions */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 font-sans">Penjualan, Invoice & Surat Jalan</h1>
          <p className="text-xs text-gray-400">Penerbitan surat jalan, penagihan piutang customer, dan kalibrasi cetak dot matrix</p>
        </div>

        {canEditInvoice && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddCust(!showAddCust)}
              className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-200 transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Customer Baru
            </button>
          </div>
        )}
      </div>

      {/* 2. Customer Form (Collapsible) */}
      {showAddCust && (
        <div className="no-print bg-gray-50 border border-gray-100 p-4 rounded-lg">
          <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Tambah Pelanggan Baru</h3>
          <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Nama Customer / Dojo</label>
              <input
                type="text"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="Dojo Garuda"
                className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-xs focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Alamat Lengkap</label>
              <input
                type="text"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                placeholder="Jl. Raya No. 4"
                className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Kontak / Telepon</label>
              <input
                type="text"
                value={newCustContact}
                onChange={(e) => setNewCustContact(e.target.value)}
                placeholder="08123xxx"
                className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-xs focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-evergreen text-white text-xs font-semibold py-2 rounded hover:bg-opacity-95"
            >
              Simpan Customer
            </button>
          </form>
        </div>
      )}

      {/* 3. Main Operational Screens */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Draft Invoice (Wizards) */}
        {canEditInvoice ? (
          <div className="lg:col-span-5 bg-white rounded-lg border border-gray-100 p-6 space-y-4">
            <div className="border-b border-gray-50 pb-3 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-evergreen" />
              <h3 className="font-semibold text-sm text-gray-800">Draft Invoice Baru</h3>
            </div>

            <form onSubmit={handlePostInvoice} className="space-y-4">
              {/* Select Customer */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Pelanggan</label>
                <select
                  value={invoiceCustomerId}
                  onChange={(e) => setInvoiceCustomerId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Customer --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Add item rows */}
              <div className="bg-gray-50 p-3 rounded border border-gray-100 space-y-3">
                <span className="text-[10px] font-bold text-gray-500 block uppercase">Pilih Barang Jual</span>
                
                <div className="flex gap-2">
                  <select
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded px-2 py-1.5 text-xs"
                  >
                    <option value="">-- Pilih Barang --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.variant}) - {formatIDR(p.harga_jual)} [Stok: {p.stock}]</option>
                    ))}
                  </select>
                  
                  <input
                    type="number"
                    min={1}
                    value={itemQty || ''}
                    onChange={(e) => setItemQty(Number(e.target.value))}
                    className="w-16 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-center"
                  />

                  <button
                    type="button"
                    onClick={handleAddItemToInvoice}
                    className="bg-evergreen text-white text-xs px-3 rounded font-semibold"
                  >
                    +
                  </button>
                </div>

                {/* Added items list */}
                {invoiceItems.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-200">
                    {invoiceItems.map((item, idx) => {
                      const p = products.find(prod => prod.id === item.product_id)!;
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs p-1.5 bg-white rounded border border-gray-100 font-medium">
                          <span className="text-gray-700">{p.name} <span className="text-gray-400">x{item.qty}</span></span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-600">{formatIDR(item.qty * item.price)}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromInvoice(idx)}
                              className="text-rose-500 hover:text-rose-700 font-bold px-1"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Financial Summary Specs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Down Payment (DP)</label>
                  <input
                    type="number"
                    value={invoiceDp || ''}
                    onChange={(e) => setInvoiceDp(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">PPN (%)</label>
                  <input
                    type="number"
                    value={invoiceTax || ''}
                    onChange={(e) => setInvoiceTax(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Jatuh Tempo</label>
                  <input
                    type="date"
                    value={invoiceDueDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Ekspedisi Surat Jalan</label>
                  <input
                    type="text"
                    value={expedition}
                    onChange={(e) => setExpedition(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-post-invoice"
                className="w-full bg-evergreen text-white py-2 rounded font-semibold text-xs hover:bg-opacity-95 shadow flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                Terbitkan Invoice & Kirim Barang
              </button>
            </form>
          </div>
        ) : (
          <div className="lg:col-span-5 bg-amber-50 text-warning-orange border border-amber-100 rounded-lg p-6 text-center space-y-3">
            <ShoppingCart className="w-12 h-12 mx-auto text-warning-orange opacity-75" />
            <h3 className="font-semibold text-base">Hanya Bisa Mengamati</h3>
            <p className="text-xs text-gray-600">
              Role Anda saat ini tidak memiliki otorisasi untuk membuat invoice atau mendaftarkan penjualan.
            </p>
          </div>
        )}

        {/* RIGHT COLUMN: Active List */}
        <div className="lg:col-span-7 space-y-6">
          {/* List of Invoices */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-gray-800">Daftar Invoice</h3>
              <p className="text-xs text-gray-400">Total invoice aktif dalam sistem penagihan {brandName()}</p>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {invoices.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">Belum ada invoice diterbitkan.</p>
              ) : (
                invoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between items-start text-xs p-3.5 bg-gray-50 rounded border border-gray-100">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{inv.invoice_number}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          inv.payment_status === 'lunas' ? 'bg-evergreen-tint text-evergreen-dark' : 'bg-warning-bg text-warning-orange'
                        }`}>
                          {inv.payment_status}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-700">{inv.customer_name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">Tanggal: {inv.date} | Jatuh Tempo: {inv.due_date}</p>
                      <div className="text-[10px] text-gray-500">
                        Items: {inv.items.map(i => `${i.product_name} x${i.qty}`).join(', ')}
                      </div>
                    </div>

                    <div className="text-right space-y-2">
                      <p className="font-mono font-bold text-evergreen">{formatIDR(inv.total)}</p>
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handlePrintInvoice(inv)}
                          className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded px-2 py-1 text-[10px] font-semibold flex items-center gap-1"
                        >
                          <Printer className="w-2.5 h-2.5" />
                          Invoice
                        </button>
                        {canEditInvoice && (
                          <button
                            onClick={() => handleToggleInvoiceStatus(inv.id)}
                            className="bg-evergreen text-white rounded px-2 py-1 text-[10px] font-semibold"
                          >
                            Set {inv.payment_status === 'lunas' ? 'Unpaid' : 'Lunas'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* List of Delivery Notes */}
          <div className="bg-white rounded-lg border border-gray-100 p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-gray-800">Surat Jalan (SJ)</h3>
              <p className="text-xs text-gray-400">Surat pengiriman barang dari gudang logistik</p>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {deliveryNotes.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-6">Belum ada surat jalan.</p>
              ) : (
                deliveryNotes.map((sj) => (
                  <div key={sj.id} className="flex justify-between items-center text-xs p-3.5 bg-gray-50 rounded border border-gray-100">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{sj.delivery_number}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          sj.status === 'diterima' ? 'bg-evergreen-tint text-evergreen-dark' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {sj.status}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-700">{sj.customer_name}</p>
                      <p className="text-[10px] text-gray-400">Ekspedisi: {sj.expedition} | {sj.date}</p>
                    </div>

                    <div className="flex gap-1.5 items-center">
                      <button
                        onClick={() => handlePrintSJ(sj)}
                        className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded px-2 py-1 text-[10px] font-semibold flex items-center gap-1"
                      >
                        <Printer className="w-2.5 h-2.5" />
                        Print SJ
                      </button>
                      {(userRole === 'owner' || userRole === 'admin_gudang' || userRole === 'admin_keuangan_hr') && (
                        <button
                          onClick={() => handleToggleSJStatus(sj.id)}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded px-2 py-1 text-[10px] font-semibold"
                        >
                          Status
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ================= PRINT & PREVIEW SYSTEM ================= */}
      
      {/* 1. Interactive Preview Modal (On-Screen Only) */}
      {(previewInvoice || previewSJ) && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto no-print font-sans">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col my-auto">
            
            {/* Modal Header Toolbar */}
            <div className="bg-slate-50 border-b border-slate-100 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="font-bold text-xs sm:text-sm text-slate-800 uppercase tracking-wider">
                  Live Preview Cetak Dot Matrix (Continuous Form)
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPreviewInvoice(null); setPreviewSJ(null); }}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    if (previewInvoice) triggerSystemPrintInvoice(previewInvoice);
                    if (previewSJ) triggerSystemPrintSJ(previewSJ);
                  }}
                  className="bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-800 transition-all flex items-center gap-1.5 shadow-md"
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
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
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
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
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
                  
                  {previewInvoice && (
                    <div className="space-y-4">
                      {/* INVOICE DESIGN */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h1 className="text-xl font-black tracking-widest" style={{ color: inkColor === 'blue' ? '#1E3A8A' : '#0F172A' }}>INVOICE</h1>
                          <div className="mt-2 text-[11px] leading-tight space-y-0.5">
                            <p className="font-semibold text-[10px] opacity-75">Kepada Yth.</p>
                            <p className="font-bold text-sm">{previewInvoice.customer_name}</p>
                            <p className="opacity-80">
                              {customers.find(c => c.name === previewInvoice.customer_name || c.id === previewInvoice.customer_id)?.address || "Bandung, Jawa Barat"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <h2 className="text-base font-black tracking-wider" style={{ color: inkColor === 'blue' ? '#1E3A8A' : '#0F172A' }}>{brandName()}</h2>
                          <div className="mt-2 text-[11px] leading-tight space-y-1">
                            <p className="font-mono">No Invoice : <span className="font-bold">{previewInvoice.invoice_number}</span></p>
                            <p className="font-mono">Tanggal    : {previewInvoice.date}</p>
                          </div>
                        </div>
                      </div>

                      {/* Items Grid */}
                      <div className="mt-4">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="border-t border-b border-dashed" style={{ borderColor: 'currentColor' }}>
                              <th className="text-left py-1.5 w-8">No</th>
                              <th className="text-left py-1.5">Jenis Barang</th>
                              <th className="text-center py-1.5 w-24">Jumlah Barang</th>
                              <th className="text-right py-1.5 w-28">Harga</th>
                              <th className="text-right py-1.5 w-28">Jumlah</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewInvoice.items.map((item, idx) => (
                              <tr key={idx} className="align-top">
                                <td className="py-1.5">{idx + 1}</td>
                                <td className="py-1.5 font-bold">
                                  {item.product_name} <span className="text-[10px] font-normal italic opacity-85">({item.variant})</span>
                                </td>
                                <td className="text-center py-1.5">{item.qty}</td>
                                <td className="text-right py-1.5 font-mono">{formatIDR(item.price)}</td>
                                <td className="text-right py-1.5 font-mono">{formatIDR(item.subtotal)}</td>
                              </tr>
                            ))}
                            {/* Filler Empty Rows to mimic dot matrix space height */}
                            {previewInvoice.items.length < 3 && (
                              [...Array(3 - previewInvoice.items.length)].map((_, i) => (
                                <tr key={i} className="h-6">
                                  <td colSpan={5}></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer Totals / Notes */}
                      <div className="grid grid-cols-12 gap-4 border-t border-dashed pt-3" style={{ borderColor: 'currentColor' }}>
                        {/* Note & Bank Details */}
                        <div className="col-span-7 text-[10px] leading-relaxed pr-2 space-y-1">
                          <p className="font-semibold italic">Note: Pengajuan return/komplain max 3 hari dari barang di terima.</p>
                          <p>Pembayaran cash atau transfer ke rekening bank:</p>
                          <p className="font-bold font-mono">BCA 5150233021 A/N ARI OKTAVIANTO</p>
                          <div className="pt-2 flex items-center gap-1">
                            <span className="text-[9px] uppercase tracking-wider font-semibold">Status Bayar:</span>
                            <span className={`px-1 rounded text-[9px] font-bold ${previewInvoice.payment_status === 'lunas' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                              {previewInvoice.payment_status.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* Calculations Column */}
                        <div className="col-span-5 text-[11px] space-y-1">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span className="font-mono">{formatIDR(previewInvoice.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Down Payment</span>
                            <span className="font-mono">{previewInvoice.dp > 0 ? `-${formatIDR(previewInvoice.dp)}` : 'Rp 0'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Pajak (PPN)</span>
                            <span className="font-mono">{previewInvoice.tax > 0 ? `+${formatIDR(previewInvoice.tax)}` : 'Rp 0'}</span>
                          </div>
                          <div className="flex justify-between border-t border-double pt-1 font-bold text-xs" style={{ borderColor: 'currentColor' }}>
                            <span>TOTAL</span>
                            <span className="font-mono">{formatIDR(previewInvoice.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Signatures Row */}
                      <div className="grid grid-cols-2 gap-4 text-center text-[10px] pt-4 mt-auto">
                        <div className="relative">
                          <p className="font-bold">{brandName()}</p>
                          <div className="h-10 flex items-center justify-center">
                            {/* SVG Ballpoint Signature */}
                            <svg className="w-20 h-8 opacity-90" viewBox="0 0 100 50" fill="none" style={{ stroke: inkColor === 'blue' ? '#1E40AF' : '#1E293B' }}>
                              <path d="M10 25 C 20 5, 30 35, 45 15 C 60 -5, 55 45, 75 25 C 85 15, 90 30, 95 20 M12 28 L88 20" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <p className="font-mono opacity-80">( ARI OKTAVIANTO )</p>
                        </div>
                        <div>
                          <p>Diterima oleh,</p>
                          <div className="h-10 flex items-center justify-center">
                            {/* Empty space or recipient signature placeholder */}
                            <svg className="w-20 h-8 opacity-50" viewBox="0 0 100 50" fill="none" style={{ stroke: inkColor === 'blue' ? '#3B82F6' : '#94A3B8' }}>
                              <path d="M15 35 Q 35 15 55 35 T 85 20" strokeWidth="1" strokeDasharray="3 3"/>
                            </svg>
                          </div>
                          <p className="opacity-80">( ......................... )</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {previewSJ && (
                    <div className="space-y-4">
                      {/* SURAT JALAN DESIGN */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h1 className="text-lg font-black tracking-widest" style={{ color: inkColor === 'blue' ? '#1E3A8A' : '#0F172A' }}>{brandName()}</h1>
                          <div className="mt-2 text-[11px] leading-tight space-y-0.5">
                            <p className="font-semibold text-[10px] opacity-75">Kepada Yth.</p>
                            <p className="font-bold text-sm">{previewSJ.customer_name}</p>
                            <p className="opacity-80 text-[10px]">
                              {customers.find(c => c.name === previewSJ.customer_name || c.id === previewSJ.customer_id)?.address || "Bandung, Jawa Barat"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <h2 className="text-base font-black tracking-widest" style={{ color: inkColor === 'blue' ? '#1E3A8A' : '#0F172A' }}>SURAT JALAN</h2>
                          <div className="mt-2 text-[11px] leading-tight space-y-1">
                            <p className="font-mono">No Surat Jalan : <span className="font-bold">{previewSJ.delivery_number}</span></p>
                            <p className="font-mono">Tanggal        : {previewSJ.date}</p>
                            <p className="font-mono">Expedisi       : <span className="font-bold">{previewSJ.expedition}</span></p>
                          </div>
                        </div>
                      </div>

                      {/* Items Grid */}
                      <div className="mt-4">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="border-t border-b border-dashed" style={{ borderColor: 'currentColor' }}>
                              <th className="text-left py-1.5 w-8">No</th>
                              <th className="text-left py-1.5">Jenis Barang</th>
                              <th className="text-center py-1.5 w-32">Jumlah</th>
                              <th className="text-left py-1.5">Keterangan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewSJ.items.map((item, idx) => (
                              <tr key={idx} className="align-top border-b border-dotted" style={{ borderColor: inkColor === 'blue' ? '#93C5FD' : '#E2E8F0' }}>
                                <td className="py-2">{idx + 1}</td>
                                <td className="py-2 font-bold">{item.product_name} ({item.variant})</td>
                                <td className="text-center py-2 font-mono text-xs">{item.qty} unit</td>
                                <td className="py-2 text-[10px] italic text-slate-500">QC Passed</td>
                              </tr>
                            ))}
                            {/* Filler Empty Rows to mimic dot matrix height */}
                            {previewSJ.items.length < 3 && (
                              [...Array(3 - previewSJ.items.length)].map((_, i) => (
                                <tr key={i} className="h-8">
                                  <td colSpan={4}></td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Note bottom */}
                      <div className="text-[9px] leading-relaxed opacity-75 border-t border-dashed pt-2" style={{ borderColor: 'currentColor' }}>
                        * Catatan: Barang telah diperiksa di bagian Logistik {brandName()} dan dipastikan dalam kondisi prima (QC Passed). Mohon kembalikan lembar kedua bertandatangan kepada pihak kurir/expedisi.
                      </div>

                      {/* Signatures Row */}
                      <div className="grid grid-cols-3 gap-4 text-center text-[10px] pt-4 mt-auto">
                        <div>
                          <p>Penerima,</p>
                          <div className="h-10 flex items-center justify-center">
                            <svg className="w-20 h-8 opacity-30" viewBox="0 0 100 50" fill="none" style={{ stroke: 'currentColor' }}>
                              <path d="M20 35 Q 40 15 60 35 T 80 20" strokeWidth="1" strokeDasharray="3 3"/>
                            </svg>
                          </div>
                          <p className="opacity-80">( ......................... )</p>
                        </div>

                        <div>
                          <p>Gudang,</p>
                          <div className="h-10 flex items-center justify-center">
                            <svg className="w-16 h-8 opacity-75" viewBox="0 0 100 50" fill="none" style={{ stroke: 'currentColor' }}>
                              <path d="M15 25 Q 35 5 55 45 T 85 25" strokeWidth="1"/>
                            </svg>
                          </div>
                          <p className="opacity-80">( Bag. Logistik )</p>
                        </div>

                        <div>
                          <p>Admin,</p>
                          <div className="h-10 flex items-center justify-center">
                            <svg className="w-20 h-8 opacity-90" viewBox="0 0 100 50" fill="none" style={{ stroke: 'currentColor' }}>
                              <path d="M10 20 C 30 0, 40 40, 60 20 C 70 10, 80 30, 90 15" strokeWidth="1"/>
                            </svg>
                          </div>
                          <p className="font-mono opacity-80">{brandName()}</p>
                        </div>
                      </div>
                    </div>
                  )}

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
              <span>● Desain printer continuous-form disesuaikan dengan contoh fisik dot-matrix.</span>
              <span className="font-semibold text-slate-700">Gunakan browser print (Ctrl+P) untuk konfigurasi layout kertas printer.</span>
            </div>

          </div>
        </div>
      )}

      {/* 2. Print-Only Container (Identical layout to images, triggered on system print) */}
      {printInvoice && (
        <div className="print-only" style={{
          transform: `translate(${calibration.offset_x}mm, ${calibration.offset_y}mm)`,
          fontFamily: 'Courier, monospace',
          color: 'black',
          width: '210mm',
          height: '140mm',
          padding: '10mm',
          boxSizing: 'border-box'
        }}>
          <div className="flex flex-col justify-between h-full space-y-4">
            
            {/* INVOICE DESIGN */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold tracking-widest">INVOICE</h1>
                <div className="mt-2 text-[11px] leading-tight space-y-0.5">
                  <p className="font-bold">Kepada Yth.</p>
                  <p className="font-bold text-sm">{printInvoice.customer_name}</p>
                  <p>
                    {customers.find(c => c.name === printInvoice.customer_name || c.id === printInvoice.customer_id)?.address || "Bandung, Jawa Barat"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <h2 className="text-base font-bold tracking-wider">{brandName()}</h2>
                <div className="mt-2 text-[11px] leading-tight space-y-1">
                  <p>No Invoice : <span className="font-bold">{printInvoice.invoice_number}</span></p>
                  <p>Tanggal    : {printInvoice.date}</p>
                </div>
              </div>
            </div>

            {/* Items Grid */}
            <div className="mt-2 flex-1">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-t border-b border-dashed border-black">
                    <th className="text-left py-1 w-8">No</th>
                    <th className="text-left py-1">Jenis Barang</th>
                    <th className="text-center py-1 w-24">Jumlah Barang</th>
                    <th className="text-right py-1 w-28">Harga</th>
                    <th className="text-right py-1 w-28">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {printInvoice.items.map((item, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="py-1">{idx + 1}</td>
                      <td className="py-1 font-bold">
                        {item.product_name} <span className="text-[10px] font-normal italic">({item.variant})</span>
                      </td>
                      <td className="text-center py-1">{item.qty}</td>
                      <td className="text-right py-1">{formatIDR(item.price)}</td>
                      <td className="text-right py-1">{formatIDR(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Totals / Notes */}
            <div className="grid grid-cols-12 gap-4 border-t border-dashed border-black pt-2">
              {/* Note & Bank Details */}
              <div className="col-span-7 text-[10px] leading-tight space-y-0.5">
                <p className="font-bold italic">Note: Pengajuan return/komplain max 3 hari dari barang di terima.</p>
                <p>Pembayaran cash atau transfer ke rekening bank:</p>
                <p className="font-bold">BCA 5150233021 A/N ARI OKTAVIANTO</p>
              </div>

              {/* Calculations Column */}
              <div className="col-span-5 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatIDR(printInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Down Payment</span>
                  <span>{printInvoice.dp > 0 ? `-${formatIDR(printInvoice.dp)}` : 'Rp 0'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pajak (PPN)</span>
                  <span>{printInvoice.tax > 0 ? `+${formatIDR(printInvoice.tax)}` : 'Rp 0'}</span>
                </div>
                <div className="flex justify-between border-t border-double border-black pt-1 font-bold">
                  <span>TOTAL</span>
                  <span>{formatIDR(printInvoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Signatures Row */}
            <div className="grid grid-cols-2 gap-4 text-center text-[10px] pt-2">
              <div>
                <p className="font-bold">{brandName()}</p>
                <div className="h-10 flex items-center justify-center">
                  <svg className="w-16 h-8" viewBox="0 0 100 50" fill="none" stroke="black">
                    <path d="M10 25 C 20 5, 30 35, 45 15 C 60 -5, 55 45, 75 25 C 85 15, 90 30, 95 20 M12 28 L88 20" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p>( ARI OKTAVIANTO )</p>
              </div>
              <div>
                <p>Diterima oleh,</p>
                <div className="h-10" />
                <p>( ......................... )</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {printSJ && (
        <div className="print-only" style={{
          transform: `translate(${calibration.offset_x}mm, ${calibration.offset_y}mm)`,
          fontFamily: 'Courier, monospace',
          color: 'black',
          width: '210mm',
          height: '140mm',
          padding: '10mm',
          boxSizing: 'border-box'
        }}>
          <div className="flex flex-col justify-between h-full space-y-4">
            
            {/* SURAT JALAN DESIGN */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-lg font-bold tracking-widest">{brandName()}</h1>
                <div className="mt-2 text-[11px] leading-tight space-y-0.5">
                  <p className="font-bold">Kepada Yth.</p>
                  <p className="font-bold text-sm">{printSJ.customer_name}</p>
                  <p>
                    {customers.find(c => c.name === printSJ.customer_name || c.id === printSJ.customer_id)?.address || "Bandung, Jawa Barat"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <h2 className="text-base font-bold tracking-widest">SURAT JALAN</h2>
                <div className="mt-2 text-[11px] leading-tight space-y-1">
                  <p>No Surat Jalan : <span className="font-bold">{printSJ.delivery_number}</span></p>
                  <p>Tanggal        : {printSJ.date}</p>
                  <p>Expedisi       : <span className="font-bold">{printSJ.expedition}</span></p>
                </div>
              </div>
            </div>

            {/* Items Grid */}
            <div className="mt-2 flex-1">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-t border-b border-dashed border-black">
                    <th className="text-left py-1 w-8">No</th>
                    <th className="text-left py-1">Jenis Barang</th>
                    <th className="text-center py-1 w-32">Jumlah</th>
                    <th className="text-left py-1">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {printSJ.items.map((item, idx) => (
                    <tr key={idx} className="align-top border-b border-dotted border-black">
                      <td className="py-2">{idx + 1}</td>
                      <td className="py-2 font-bold">{item.product_name} ({item.variant})</td>
                      <td className="text-center py-2">{item.qty} unit</td>
                      <td className="py-2 italic text-gray-500">QC Passed</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Note bottom */}
            <div className="text-[9px] leading-tight opacity-75 border-t border-dashed border-black pt-1">
              * Catatan: Barang telah diperiksa di bagian Logistik {brandName()} dan dipastikan dalam kondisi prima (QC Passed). Mohon kembalikan lembar kedua bertandatangan kepada pihak kurir/expedisi.
            </div>

            {/* Signatures Row */}
            <div className="grid grid-cols-3 gap-4 text-center text-[10px] pt-2">
              <div>
                <p>Penerima,</p>
                <div className="h-10" />
                <p>( ......................... )</p>
              </div>

              <div>
                <p>Gudang,</p>
                <div className="h-10 flex items-center justify-center">
                  <svg className="w-12 h-8" viewBox="0 0 100 50" fill="none" stroke="black">
                    <path d="M15 25 Q 35 5 55 45 T 85 25" strokeWidth="1"/>
                  </svg>
                </div>
                <p>( Bag. Logistik )</p>
              </div>

              <div>
                <p>Admin,</p>
                <div className="h-10 flex items-center justify-center">
                  <svg className="w-16 h-8" viewBox="0 0 100 50" fill="none" stroke="black">
                    <path d="M10 20 C 30 0, 40 40, 60 20 C 70 10, 80 30, 90 15" strokeWidth="1"/>
                  </svg>
                </div>
                <p>{brandName()}</p>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
