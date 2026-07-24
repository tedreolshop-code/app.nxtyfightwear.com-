import React, { useState, useEffect } from 'react';
import { Order, OrderItem, Product, Employee } from '../types';
import { dataStore } from '../dataStore';
import { ShoppingBag, Plus, User, Phone, CheckCircle2, Trash2, PackageCheck, Truck, Printer, X } from 'lucide-react';

export const OrderModule: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Mode edit: id order pending yang sedang diedit (null = form tambah baru)
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState('');

  // Filter & pencarian daftar pesanan ('active' = semua kecuali dibatalkan)
  const [filterStatus, setFilterStatus] = useState<'active' | 'all' | Order['status']>('active');
  const [orderSearch, setOrderSearch] = useState('');
  const [packingEmployeeId, setPackingEmployeeId] = useState('');
  const [shipExpedition, setShipExpedition] = useState('');
  const [shipTracking, setShipTracking] = useState('');
  const [shipProof, setShipProof] = useState('');

  // New Order Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [source, setSource] = useState<'online' | 'offline'>('offline');
  const [marketplaceName, setMarketplaceName] = useState('Shopee');
  const [notes, setNotes] = useState('');

  // Selected items for new order
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [currentProductId, setCurrentProductId] = useState('');
  const [currentQty, setCurrentQty] = useState(1);
  const [shippingFee, setShippingFee] = useState(0);
  const [discount, setDiscount] = useState(0);

  // Nota yang sedang dicetak (dirender di container .print-only)
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  // Offset kalibrasi printer (mm) — disimpan bersama slip gaji karena printernya sama
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
    setOrders(dataStore.getOrders());
    setProducts(dataStore.getProducts());
    setEmployees(dataStore.getEmployees().filter(employee => employee.status_aktif));
    setCalibration(dataStore.getCalibration());
  };

  const updateCalibration = (patch: Partial<{ offset_x: number; offset_y: number }>) => {
    const updated = { ...calibration, ...patch };
    setCalibration(updated);
    dataStore.setCalibration(updated);
  };

  const handleAddItem = () => {
    if (!currentProductId) return;
    if (currentQty < 1) { alert('Qty harus minimal 1!'); return; }
    const prod = products.find(p => p.id === currentProductId);
    if (!prod) return;

    // Check if item already exists
    const existingIndex = selectedItems.findIndex(item => item.product_id === currentProductId);
    if (existingIndex > -1) {
      const updated = [...selectedItems];
      updated[existingIndex].qty += currentQty;
      updated[existingIndex].subtotal = updated[existingIndex].qty * updated[existingIndex].price;
      setSelectedItems(updated);
    } else {
      const newItem: OrderItem = {
        id: Math.random().toString(36).substring(2, 9),
        product_id: prod.id,
        product_name: prod.name,
        variant: prod.variant,
        qty: currentQty,
        price: prod.harga_jual,
        subtotal: prod.harga_jual * currentQty
      };
      setSelectedItems([...selectedItems, newItem]);
    }
    setCurrentProductId('');
    setCurrentQty(1);
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  const resetOrderForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setSource('offline');
    setMarketplaceName('Shopee');
    setNotes('');
    setSelectedItems([]);
    setCurrentProductId('');
    setCurrentQty(1);
    setShippingFee(0);
    setDiscount(0);
    setEditOrderId(null);
    setIsModalOpen(false);
  };

  // Edit hanya untuk order pending — setelah selesai, stok gudang sudah terpotong
  const startEditOrder = (order: Order) => {
    if (order.status !== 'pending') {
      alert('Hanya order berstatus Pending yang bisa diedit.');
      return;
    }
    setEditOrderId(order.id);
    setCustomerName(order.customer_name);
    setCustomerPhone(order.customer_phone || '');
    setSource(order.source);
    setMarketplaceName(order.marketplace_name || 'Shopee');
    setNotes(order.notes || '');
    setSelectedItems(order.items.map(item => ({ ...item })));
    setShippingFee(order.shipping_fee || 0);
    setDiscount(order.discount || 0);
    setIsModalOpen(true);
  };

  // Nomor order: lanjutkan urutan tertinggi bulan berjalan agar tidak duplikat saat ada order yang dihapus
  const generateOrderNumber = () => {
    const now = new Date();
    const prefix = `ORD/${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/`;
    const maxSeq = orders.reduce((max, o) => {
      if (!o.order_number.startsWith(prefix)) return max;
      const seq = parseInt(o.order_number.slice(prefix.length), 10);
      return Number.isFinite(seq) && seq > max ? seq : max;
    }, 0);
    return `${prefix}${(maxSeq + 1).toString().padStart(3, '0')}`;
  };

  const itemsSubtotal = selectedItems.reduce((acc, curr) => acc + curr.subtotal, 0);
  const cleanDiscount = Math.min(Math.max(0, discount || 0), itemsSubtotal);
  const cleanShippingFee = Math.max(0, shippingFee || 0);
  const formTotal = itemsSubtotal - cleanDiscount + cleanShippingFee;

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert('Pilih minimal satu produk untuk dipesan!');
      return;
    }

    if (editOrderId) {
      const currentOrders = dataStore.getOrders();
      const existing = currentOrders.find(o => o.id === editOrderId);
      if (!existing || existing.status !== 'pending') {
        alert('Order ini sudah tidak bisa diedit (status berubah).');
        resetOrderForm();
        loadData();
        return;
      }
      const updatedOrders = currentOrders.map(o => o.id === editOrderId ? {
        ...o,
        customer_name: customerName,
        customer_phone: customerPhone,
        source,
        marketplace_name: source === 'online' ? marketplaceName : undefined,
        items: selectedItems,
        shipping_fee: cleanShippingFee,
        discount: cleanDiscount,
        total: formTotal,
        notes
      } : o);
      dataStore.setOrders(updatedOrders);
      alert(`Perubahan order ${existing.order_number} berhasil disimpan.`);
    } else {
      const orderNumber = generateOrderNumber();
      const newOrder: Order = {
        id: `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        order_number: orderNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        source,
        marketplace_name: source === 'online' ? marketplaceName : undefined,
        date: new Date().toISOString().split('T')[0],
        items: selectedItems,
        shipping_fee: cleanShippingFee,
        discount: cleanDiscount,
        total: formTotal,
        status: 'pending',
        notes
      };
      dataStore.setOrders([newOrder, ...dataStore.getOrders()]);
      alert(`Order ${orderNumber} berhasil dicatat! Selesaikan order untuk memotong stok gudang.`);
    }

    resetOrderForm();
    loadData();
  };

  const handleCancelOrder = (orderId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
    const updatedOrders = dataStore.getOrders().map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'cancelled' as const };
      }
      return o;
    });
    dataStore.setOrders(updatedOrders);
    alert('Pesanan telah dibatalkan.');
    loadData();
  };

  // Hapus permanen hanya untuk order yang belum menyentuh stok (pending) atau sudah dibatalkan
  const handleDeleteOrder = (order: Order) => {
    if (order.status !== 'pending' && order.status !== 'cancelled') {
      alert('Hanya order Pending atau Dibatalkan yang boleh dihapus, agar jejak stok tetap utuh.');
      return;
    }
    if (!window.confirm(`Hapus PERMANEN order ${order.order_number} (${order.customer_name})?\n\nTindakan ini tidak bisa dibatalkan.`)) return;
    dataStore.setOrders(dataStore.getOrders().filter(o => o.id !== order.id));
    alert(`Order ${order.order_number} telah dihapus.`);
    loadData();
  };

  // Selesaikan order: cek dulu kecukupan stok produk jadi, lalu potong stok gudang.
  // Order non-marketplace SELALU ambil dari stok gudang, tidak lewat produksi.
  const handleCompleteOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const currentProducts = dataStore.getProducts();
    const shortages = order.items
      .filter(item => (currentProducts.find(p => p.id === item.product_id)?.stock ?? 0) < item.qty)
      .map(item => `${item.product_name} (${item.variant}): butuh ${item.qty}, stok gudang ${currentProducts.find(p => p.id === item.product_id)?.stock ?? 0}`);
    if (shortages.length > 0) {
      alert(`Order ${order.order_number} belum bisa diselesaikan.\n\nStok gudang kurang:\n- ${shortages.join('\n- ')}\n\nTambah stok produk jadi di menu Gudang terlebih dahulu.`);
      return;
    }

    if (!window.confirm(`Selesaikan order ${order.order_number}?\n\nStok produk jadi di gudang akan langsung dipotong dan tidak bisa di-undo.`)) return;

    order.items.forEach(item => {
      dataStore.adjustProductStock(item.product_id, -item.qty, `Terjual - Order ${order.order_number}`);
    });

    const updatedOrders = dataStore.getOrders().map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'completed' as const };
      }
      return o;
    });
    dataStore.setOrders(updatedOrders);
    alert('Pesanan Selesai! Stok produk jadi di gudang otomatis berkurang.');
    loadData();
  };

  const handlePrintNota = (order: Order) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const openOrderPanel = (order: Order) => {
    setExpandedOrderId(expandedOrderId === order.id ? '' : order.id);
    setPackingEmployeeId(order.packing_employee_id || '');
    setShipExpedition(order.shipping_expedition || '');
    setShipTracking(order.tracking_number || '');
    setShipProof(order.shipping_proof_url || '');
  };

  const handleAssignPacking = (order: Order) => {
    if (!packingEmployeeId) return alert('Pilih karyawan packing terlebih dahulu.');
    if (!dataStore.assignPackingTask(order.id, packingEmployeeId)) return alert('Gagal membuat tugas packing.');
    alert('Tugas packing berhasil dikirim ke Daftar Kerjaan karyawan.');
    loadData();
  };

  const handleProofFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setShipProof(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleSaveShipping = (order: Order) => {
    if (!shipExpedition.trim() || !shipTracking.trim()) return alert('Ekspedisi dan nomor resi wajib diisi.');
    dataStore.updateOrderShipping(order.id, {
      shipping_expedition: shipExpedition.trim(),
      tracking_number: shipTracking.trim(),
      shipping_date: new Date().toISOString().slice(0, 10),
      shipping_proof_url: shipProof || undefined,
      shipping_status: 'dikirim'
    });
    alert('Resi pengiriman berhasil disimpan.');
    loadData();
  };

  const getSourceBadge = (order: Order) => {
    if (order.source === 'offline') {
      return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded font-semibold font-mono border">Offline / Custom</span>;
    }
    return (
      <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-[10px] rounded font-semibold font-mono border border-sky-200">
        Online ({order.marketplace_name})
      </span>
    );
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded font-semibold border border-amber-200">Pending</span>;
      case 'production':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded font-semibold border border-blue-200">Di Produksi</span>;
      case 'completed':
        return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded font-semibold border border-emerald-200">Selesai</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] rounded font-semibold border border-rose-200">Dibatalkan</span>;
    }
  };

  const getShippingBadge = (order: Order) => {
    const status = order.shipping_status || 'belum_dikirim';
    const className = status === 'dikirim' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : status === 'siap_dikirim' ? 'bg-sky-100 text-sky-800 border-sky-200' : 'bg-gray-100 text-gray-600 border-gray-200';
    const label = status === 'dikirim' ? 'Dikirim' : status === 'siap_dikirim' ? 'Siap Kirim' : 'Belum Kirim';
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${className}`}>{label}</span>;
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatIDRCompact = (val: number) => 'Rp' + val.toLocaleString('id-ID');

  // Layout nota cetak — gaya continuous form monospace, meniru slip gaji di menu Gaji
  const renderNotaLayout = (order: Order) => {
    const brand = dataStore.getBrandSettings();
    const subtotal = order.items.reduce((acc, curr) => acc + curr.subtotal, 0);
    return (
      <div className="flex flex-col h-full font-mono select-text text-xs leading-relaxed" style={{ color: 'black' }}>
        {/* Header */}
        <div className="text-center space-y-0.5 border-b-2 pb-2" style={{ borderColor: 'currentColor', borderStyle: 'double' }}>
          <h1 className="text-base font-black tracking-widest uppercase">{brand.company_name}</h1>
          {brand.tagline && <p className="text-[10px]">{brand.tagline}</p>}
          <p className="text-xs font-bold tracking-wider uppercase">Nota Penjualan</p>
        </div>

        {/* Info order & pelanggan */}
        <div className="flex justify-between items-start border-b border-dashed py-2 text-[11px]" style={{ borderColor: 'currentColor' }}>
          <div>
            <p><span className="font-bold">No. Order :</span> {order.order_number}</p>
            <p><span className="font-bold">Tanggal &nbsp; :</span> {order.date}</p>
          </div>
          <div className="text-right">
            <p className="font-black uppercase">{order.customer_name}</p>
            {order.customer_phone && <p>{order.customer_phone}</p>}
          </div>
        </div>

        {/* Tabel barang */}
        <table className="w-full border-collapse text-[10px] my-2">
          <thead>
            <tr className="border-t border-b" style={{ borderColor: 'currentColor' }}>
              <th className="py-1 text-left font-bold">Barang</th>
              <th className="py-1 text-center font-bold">Qty</th>
              <th className="py-1 text-right font-bold">Harga</th>
              <th className="py-1 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map(item => (
              <tr key={item.id}>
                <td className="py-0.5">{item.product_name} ({item.variant})</td>
                <td className="py-0.5 text-center">{item.qty}</td>
                <td className="py-0.5 text-right">{formatIDRCompact(item.price)}</td>
                <td className="py-0.5 text-right font-bold">{formatIDRCompact(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Ringkasan total */}
        <div className="ml-auto w-56 space-y-1 text-[11px] border-t border-dashed pt-1" style={{ borderColor: 'currentColor' }}>
          <div className="flex justify-between"><span>Subtotal</span><span className="font-bold">{formatIDRCompact(subtotal)}</span></div>
          {(order.discount ?? 0) > 0 && (
            <div className="flex justify-between"><span>Diskon</span><span className="font-bold">-{formatIDRCompact(order.discount!)}</span></div>
          )}
          {(order.shipping_fee ?? 0) > 0 && (
            <div className="flex justify-between"><span>Ongkir</span><span className="font-bold">+{formatIDRCompact(order.shipping_fee!)}</span></div>
          )}
          <div className="border-t-2 border-b-2 py-0.5 flex justify-between font-black text-xs" style={{ borderColor: 'currentColor', borderStyle: 'double' }}>
            <span>TOTAL</span>
            <span>{formatIDRCompact(order.total)}</span>
          </div>
        </div>

        {/* Catatan & footer */}
        <div className="mt-auto pt-3 flex justify-between items-end text-[10px]">
          <div className="max-w-[60%]">
            {order.notes && <p className="italic">Catatan: {order.notes}</p>}
            <p className="mt-1">Terima kasih atas pembelian Anda.</p>
          </div>
          <div className="text-center w-32">
            <p>Hormat kami,</p>
            <div className="h-10" />
            <p className="border-t border-dotted pt-0.5" style={{ borderColor: 'currentColor' }}>( {brand.company_name} )</p>
          </div>
        </div>
      </div>
    );
  };

  const visibleOrders = orders.filter(ord => {
    if (filterStatus === 'active') {
      if (ord.status === 'cancelled') return false;
    } else if (filterStatus !== 'all' && ord.status !== filterStatus) {
      return false;
    }
    const q = orderSearch.trim().toLowerCase();
    if (q && !`${ord.order_number} ${ord.customer_name} ${ord.customer_phone}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[var(--color-evergreen)]" />
            Manajemen Order & Pesanan
          </h1>
          <p className="text-xs text-gray-400">Order langsung / non-marketplace — barang diambil dari stok gudang produk jadi</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[var(--color-evergreen)] hover:bg-[var(--color-evergreen-dark)] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Order Baru
        </button>
      </div>

      {/* MODAL: Form tambah/edit order (konsisten dengan modal Penjualan Marketplace) */}
      {isModalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetOrderForm}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`border-b pb-3 flex items-center justify-between gap-2 mb-4 ${editOrderId ? 'border-amber-100' : 'border-gray-50'}`}>
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-md ${editOrderId ? 'bg-amber-100 text-amber-600' : 'bg-emerald-50 text-emerald-700'}`}>
                  <Plus className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-sm text-gray-800">
                  {editOrderId ? `Edit Order ${orders.find(o => o.id === editOrderId)?.order_number || ''}` : 'Catat Order Pelanggan Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetOrderForm}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Nama Pelanggan</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="pl-9 w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs"
                      placeholder="Nama lengkap..."
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 font-semibold mb-1">No. WhatsApp / Telepon</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="pl-9 w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs"
                      placeholder="Contoh: 081234567890"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Sumber Order</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs"
                  >
                    <option value="offline">Offline / Custom</option>
                    <option value="online">Online Store</option>
                  </select>
                </div>
                {source === 'online' && (
                  <div>
                    <label className="block text-gray-500 font-semibold mb-1">E-Commerce</label>
                    <select
                      value={marketplaceName}
                      onChange={(e) => setMarketplaceName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs"
                    >
                      <option value="Shopee">Shopee</option>
                      <option value="Tokopedia">Tokopedia</option>
                      <option value="TikTok Shop">TikTok Shop</option>
                      <option value="Instagram/WA">Instagram/WA</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Pilih produk dari gudang */}
              <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-100 space-y-3">
                <span className="font-bold text-gray-700 block">Pilih Produk & Kuantitas (dari stok gudang)</span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-7">
                    <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-1">Produk Jadi</label>
                    <select
                      value={currentProductId}
                      onChange={(e) => setCurrentProductId(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-2 text-xs"
                    >
                      <option value="">-- Pilih --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.variant}) - {formatIDR(p.harga_jual)} · stok {p.stock}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={currentQty || ''}
                      onChange={(e) => setCurrentQty(Number(e.target.value))}
                      placeholder="Qty"
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-2 text-xs font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full bg-[var(--color-evergreen)] hover:bg-[var(--color-evergreen-dark)] text-white text-xs font-semibold py-2 rounded"
                    >
                      Tambahkan
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List Table */}
              <div className="border border-gray-200 rounded overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
                      <th className="p-2">Nama Barang</th>
                      <th className="p-2">Variant</th>
                      <th className="p-2 text-center">Qty</th>
                      <th className="p-2 text-right">Harga</th>
                      <th className="p-2 text-right">Subtotal</th>
                      <th className="p-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-400 italic">Belum ada barang dipilih</td>
                      </tr>
                    ) : (
                      selectedItems.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2 font-medium">{item.product_name}</td>
                          <td className="p-2">{item.variant}</td>
                          <td className="p-2 text-center font-mono font-bold">{item.qty} Pcs</td>
                          <td className="p-2 text-right font-mono">{formatIDR(item.price)}</td>
                          <td className="p-2 text-right font-mono text-[var(--color-evergreen)] font-bold">{formatIDR(item.subtotal)}</td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-rose-600 hover:text-rose-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Diskon & Ongkir */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-1">Diskon (IDR)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-xs font-mono">Rp</span>
                    <input
                      type="number"
                      min={0}
                      value={discount || ''}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      placeholder="0 jika tanpa diskon"
                      className="w-full bg-white border border-gray-200 rounded pl-8 pr-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-1">Ongkir / Biaya Kirim (IDR)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-xs font-mono">Rp</span>
                    <input
                      type="number"
                      min={0}
                      value={shippingFee || ''}
                      onChange={(e) => setShippingFee(Number(e.target.value))}
                      placeholder="0 jika gratis / ambil sendiri"
                      className="w-full bg-white border border-gray-200 rounded pl-8 pr-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-gray-500 font-semibold mb-1">Catatan Pesanan / Spesifikasi</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs"
                  rows={2}
                  placeholder="Instruksi tambahan, ukuran, warna..."
                />
              </div>

              {/* Rincian total */}
              <div className="bg-emerald-50/50 border border-emerald-800/10 rounded-lg p-3 text-right text-xs font-bold text-gray-800 space-y-1">
                <div className="text-gray-500 font-semibold">Subtotal Barang: <span className="font-mono ml-1">{formatIDR(itemsSubtotal)}</span></div>
                {cleanDiscount > 0 && (
                  <div className="text-rose-600 font-semibold">Diskon: <span className="font-mono ml-1">-{formatIDR(cleanDiscount)}</span></div>
                )}
                {cleanShippingFee > 0 && (
                  <div className="text-gray-500 font-semibold">Ongkir: <span className="font-mono ml-1">+{formatIDR(cleanShippingFee)}</span></div>
                )}
                <div>Total Tagihan: <span className="text-lg font-black text-[var(--color-evergreen)] font-mono ml-1">{formatIDR(formTotal)}</span></div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={resetOrderForm}
                  className="flex-1 py-2.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-[2] bg-[var(--color-evergreen)] hover:bg-[var(--color-evergreen-dark)] text-white text-xs font-bold py-2.5 rounded-lg shadow-sm"
                >
                  {editOrderId ? 'Simpan Perubahan Order' : 'Simpan Orderan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="no-print bg-white rounded-lg border border-gray-100 overflow-hidden shadow-xs">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-gray-700 block">Daftar Pesanan</span>
            <span className="text-[10px] text-gray-400 font-mono">Menampilkan {visibleOrders.length} dari {orders.length} orderan</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-2 py-1" title="Kalibrasi offset printer nota (mm). Setelan sama dengan slip gaji.">
              <Printer className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500">Offset X</span>
              <input
                type="number"
                value={calibration.offset_x}
                onChange={(e) => updateCalibration({ offset_x: Number(e.target.value) || 0 })}
                className="w-12 bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] font-mono text-center"
              />
              <span className="text-[10px] font-bold text-gray-500">Y</span>
              <input
                type="number"
                value={calibration.offset_y}
                onChange={(e) => updateCalibration({ offset_y: Number(e.target.value) || 0 })}
                className="w-12 bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] font-mono text-center"
              />
              <span className="text-[10px] text-gray-400">mm</span>
            </div>
            <input
              type="text"
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              placeholder="Cari no. order / pelanggan..."
              className="bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600 w-48"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
            >
              <option value="active">Aktif (tanpa dibatalkan)</option>
              <option value="pending">Pending</option>
              <option value="production">Di Produksi</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
              <option value="all">Semua Status</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-600 uppercase tracking-wider text-[10px]">
                <th className="p-3">No. Order</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Nama Pelanggan</th>
                <th className="p-3">Kanal/Sumber</th>
                <th className="p-3">Daftar Barang</th>
                <th className="p-3 text-right">Total Tagihan</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Kirim</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-400 italic">
                    {orders.length === 0 ? 'Belum ada data pesanan tercatat.' : 'Tidak ada pesanan yang cocok dengan pencarian / filter.'}
                  </td>
                </tr>
              ) : (
                visibleOrders.map((ord) => (
                  <React.Fragment key={ord.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50/55 align-top">
                    <td className="p-3 font-mono font-bold text-gray-800">{ord.order_number}</td>
                    <td className="p-3 font-mono text-gray-500 whitespace-nowrap">{ord.date}</td>
                    <td className="p-3">
                      <p className="font-bold text-gray-800">{ord.customer_name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{ord.customer_phone}</p>
                    </td>
                    <td className="p-3">{getSourceBadge(ord)}</td>
                    <td className="p-3 space-y-1">
                      {ord.items.map((item, i) => (
                        <div key={i} className="bg-gray-100/60 px-2 py-0.5 rounded text-[10px] text-gray-600 border border-gray-100 w-fit">
                          <span className="font-bold">{item.qty}x</span> {item.product_name} <span className="opacity-75">({item.variant})</span>
                        </div>
                      ))}
                      {ord.notes && (
                        <p className="text-[10px] text-gray-400 italic mt-1 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100 max-w-xs">
                          {ord.notes}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-gray-800">
                      {formatIDR(ord.total)}
                      {(ord.discount ?? 0) > 0 && (
                        <p className="text-[10px] text-rose-500 font-normal whitespace-nowrap">disc {formatIDR(ord.discount!)}</p>
                      )}
                      {(ord.shipping_fee ?? 0) > 0 && (
                        <p className="text-[10px] text-gray-400 font-normal whitespace-nowrap">incl. ongkir {formatIDR(ord.shipping_fee!)}</p>
                      )}
                    </td>
                    <td className="p-3 text-center">{getStatusBadge(ord.status)}</td>
                    <td className="p-3 text-center space-y-1">{getShippingBadge(ord)}{ord.tracking_number && <p className="text-[10px] font-mono text-gray-500">{ord.tracking_number}</p>}</td>
                    <td className="p-3 text-center space-y-1">
                      <button onClick={() => openOrderPanel(ord)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 mx-auto">
                        <PackageCheck className="w-3 h-3" /> Packing / Resi
                      </button>

                      {ord.status !== 'cancelled' && (
                        <button
                          onClick={() => handlePrintNota(ord)}
                          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 mx-auto"
                        >
                          <Printer className="w-3 h-3" /> Cetak Nota
                        </button>
                      )}

                      {/* Pending & legacy 'production': selesaikan dengan potong stok gudang */}
                      {(ord.status === 'pending' || ord.status === 'production') && (
                        <button
                          onClick={() => handleCompleteOrder(ord.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 rounded block w-full shadow-xs"
                        >
                          Selesaikan (Potong Stok Gudang)
                        </button>
                      )}

                      {ord.status === 'completed' && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Selesai Dikirim
                        </span>
                      )}

                      {ord.status === 'pending' && (
                        <>
                          <button
                            onClick={() => startEditOrder(ord)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-1 rounded block w-full"
                          >
                            Edit Order
                          </button>
                          <button
                            onClick={() => handleCancelOrder(ord.id)}
                            className="text-rose-600 hover:text-rose-800 text-[10px] font-semibold underline block w-full"
                          >
                            Batalkan Order
                          </button>
                        </>
                      )}
                      {(ord.status === 'pending' || ord.status === 'cancelled') && (
                        <button
                          onClick={() => handleDeleteOrder(ord)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-1 rounded flex items-center justify-center gap-1 w-full"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedOrderId === ord.id && (
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      <td colSpan={9} className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                            <div><h4 className="font-black text-xs text-gray-800 flex items-center gap-1"><PackageCheck className="w-4 h-4 text-[var(--color-evergreen)]" /> Tugas Packing</h4><p className="text-[10px] text-gray-400">Assign ke karyawan, nanti muncul di Daftar Kerjaan.</p></div>
                            <select value={packingEmployeeId} onChange={event => setPackingEmployeeId(event.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs">
                              <option value="">Pilih karyawan packing</option>
                              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                            </select>
                            {ord.packing_employee_name && <p className="text-xs text-gray-500">PIC sekarang: <b>{ord.packing_employee_name}</b></p>}
                            <button onClick={() => handleAssignPacking(ord)} className="w-full bg-[var(--color-evergreen)] text-white rounded-lg py-2 text-xs font-bold cursor-pointer">Kirim Tugas Packing</button>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                            <div><h4 className="font-black text-xs text-gray-800 flex items-center gap-1"><Truck className="w-4 h-4 text-[var(--color-evergreen)]" /> Resi Pengiriman</h4><p className="text-[10px] text-gray-400">Isi setelah paket siap/kirim.</p></div>
                            <div className="grid grid-cols-2 gap-2">
                              <input value={shipExpedition} onChange={event => setShipExpedition(event.target.value)} placeholder="Ekspedisi" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                              <input value={shipTracking} onChange={event => setShipTracking(event.target.value)} placeholder="Nomor resi" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono" />
                            </div>
                            <input type="file" accept="image/*" capture="environment" onChange={event => handleProofFile(event.target.files?.[0])} className="w-full text-xs file:mr-2 file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:rounded file:text-xs file:font-bold" />
                            {shipProof && <p className="text-[10px] text-emerald-700 font-bold">Bukti resi siap disimpan.</p>}
                            <button onClick={() => handleSaveShipping(ord)} className="w-full bg-emerald-700 text-white rounded-lg py-2 text-xs font-bold cursor-pointer">Simpan Resi</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Container cetak nota — hanya tampil saat print, format continuous form seperti slip gaji */}
      {printOrder && (
        <div className="print-only" style={{
          transform: `translate(${calibration.offset_x}mm, ${calibration.offset_y}mm)`,
          fontFamily: 'Courier, monospace',
          color: 'black',
          width: '210mm',
          height: '140mm',
          padding: '10mm',
          boxSizing: 'border-box'
        }}>
          {renderNotaLayout(printOrder)}
        </div>
      )}
    </div>
  );
};
