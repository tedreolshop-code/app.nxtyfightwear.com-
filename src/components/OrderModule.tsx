import React, { useState, useEffect } from 'react';
import { Order, OrderItem, Product, ProductionJob, Employee } from '../types';
import { dataStore } from '../dataStore';
import { ShoppingBag, Plus, User, Phone, CheckCircle2, Trash2, ArrowRight, PackageCheck, Truck } from 'lucide-react';

export const OrderModule: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState('');
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
  };

  const handleAddItem = () => {
    if (!currentProductId) return;
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

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert('Pilih minimal satu produk untuk dipesan!');
      return;
    }

    const orderNumber = `ORD/${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${(orders.length + 1).toString().padStart(3, '0')}`;
    const total = selectedItems.reduce((acc, curr) => acc + curr.subtotal, 0);

    const newOrder: Order = {
      id: `ord-${Date.now().toString().slice(-4)}`,
      order_number: orderNumber,
      customer_name: customerName,
      customer_phone: customerPhone,
      source,
      marketplace_name: source === 'online' ? marketplaceName : undefined,
      date: new Date().toISOString().split('T')[0],
      items: selectedItems,
      total,
      status: 'pending',
      notes
    };

    // Update orders list
    const updatedOrders = [newOrder, ...orders];
    dataStore.setOrders(updatedOrders);

    // Reset Form
    setCustomerName('');
    setCustomerPhone('');
    setSource('offline');
    setNotes('');
    setSelectedItems([]);
    setShowAddForm(false);
    
    alert(`Order ${orderNumber} berhasil dicatat! Anda dapat meneruskannya ke proses produksi sekarang.`);
    loadData();
  };

  const handleSendToProduction = (order: Order) => {
    // Fase 1: cek kecukupan bahan baku SEMUA item (belum memotong apa pun)
    const allShortages = dataStore.checkMaterialsForOrder(
      order.items.map(i => ({ product_id: i.product_id, product_name: i.product_name, qty: i.qty }))
    );
    if (allShortages.length > 0) {
      alert(
        `Order ${order.order_number} TIDAK bisa masuk produksi.\n\nBahan baku kurang:\n- ${allShortages.join('\n- ')}\n\nBuat PO pembelian bahan terlebih dahulu.`
      );
      return;
    }

    // Fase 2: potong stok bahan baku per item sesuai resep
    for (const item of order.items) {
      dataStore.consumeMaterialsForProduction(
        item.product_id,
        item.product_name,
        item.qty,
        `Produksi ${order.order_number} - ${item.product_name}`
      );
    }

    // Generate ProductionJobs for each product in this order
    const currentJobs = dataStore.getProductionJobs();

    order.items.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) return;

      const deptId = product.department_id as 'dept-eva-foam' | 'dept-konveksi';
      
      // Tahapan per departemen (diakhiri Cek Kualitas & Packing sebelum masuk gudang produk jadi)
      const stagesList = deptId === 'dept-eva-foam'
        ? ['Campur Bahan', 'Cetak', 'Potong', 'Finishing', 'Cek Kualitas', 'Packing']
        : ['Potong', 'Sablon', 'Jahit', 'Finishing', 'Cek Kualitas', 'Packing'];

      const stageProgress = stagesList.map((stg, index) => ({
        stage: stg,
        status: (index === 0 ? 'ongoing' : 'pending') as 'pending' | 'ongoing' | 'completed',
        notes: index === 0 ? `Dimulai otomatis dari order ${order.order_number}` : undefined
      }));

      const newJob: ProductionJob = {
        id: `job-${Math.random().toString(36).substring(2, 7)}`,
        order_id: order.id,
        order_number: order.order_number,
        product_id: item.product_id,
        product_name: item.product_name,
        variant: item.variant,
        qty: item.qty,
        department_id: deptId,
        stages: stageProgress,
        current_stage: stagesList[0],
        status: 'ongoing',
        created_at: new Date().toISOString()
      };

      currentJobs.unshift(newJob);
    });

    dataStore.setProductionJobs(currentJobs);

    // Update order status to "production"
    const updatedOrders = orders.map(o => {
      if (o.id === order.id) {
        return { ...o, status: 'production' as const };
      }
      return o;
    });
    dataStore.setOrders(updatedOrders);

    alert(`Order ${order.order_number} berhasil dikirim ke antrean Produksi!`);
    loadData();
  };

  const handleCancelOrder = (orderId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'cancelled' as const };
      }
      return o;
    });
    dataStore.setOrders(updatedOrders);
    alert('Pesanan telah dibatalkan.');
    loadData();
  };

  const handleCompleteOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Barang terkirim ke pembeli: potong stok produk jadi dari gudang
    order.items.forEach(item => {
      dataStore.adjustProductStock(item.product_id, -item.qty, `Terjual - Order ${order.order_number}`);
    });

    const updatedOrders = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'completed' as const };
      }
      return o;
    });
    dataStore.setOrders(updatedOrders);
    alert('Pesanan Selesai! Stok produk jadi di gudang otomatis berkurang.');
    loadData();
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
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded font-semibold border border-blue-200 animate-pulse">Di Produksi</span>;
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

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#1F4B36]" />
            Manajemen Order & Pesanan
          </h1>
          <p className="text-xs text-gray-400">Kelola pesanan pelanggan dari kanal online (Shopee/Tokopedia) maupun pesanan langsung / offline</p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-[#1F4B36] hover:bg-[#163826] text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Order Baru
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-xs space-y-4">
          <h3 className="font-semibold text-sm text-gray-800 flex items-center gap-1">
            <Plus className="w-4 h-4 text-[#1F4B36]" /> Catat Order Pelanggan Baru
          </h3>

          <form onSubmit={handleCreateOrder} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nama Pelanggan</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="pl-9 w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs"
                    placeholder="Nama lengkap..."
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">No. WhatsApp / Telepon</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="pl-9 w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs"
                    placeholder="Contoh: 081234567890"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sumber Order</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-xs"
                  >
                    <option value="offline">Offline / Custom</option>
                    <option value="online">Online Store</option>
                  </select>
                </div>

                {source === 'online' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">E-Commerce</label>
                    <select
                      value={marketplaceName}
                      onChange={(e) => setMarketplaceName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-xs"
                    >
                      <option value="Shopee">Shopee</option>
                      <option value="Tokopedia">Tokopedia</option>
                      <option value="TikTok Shop">TikTok Shop</option>
                      <option value="Instagram/WA">Instagram/WA</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Catatan Pesanan / Spesifikasi</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-xs"
                  rows={2}
                  placeholder="Instruksi tambahan, ukuran, warna..."
                />
              </div>
            </div>

            <div className="md:col-span-8 border-l border-gray-100 md:pl-6 space-y-4">
              <div className="bg-gray-50/50 p-4 rounded border border-gray-100 space-y-3">
                <span className="text-xs font-bold text-gray-700 block">Pilih Produk & Kuantitas</span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-7">
                    <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-1">Pilih Produk Jadi</label>
                    <select
                      value={currentProductId}
                      onChange={(e) => setCurrentProductId(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs"
                    >
                      <option value="">-- Pilih --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.variant}) - {formatIDR(p.harga_jual)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={currentQty}
                      onChange={(e) => setCurrentQty(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full bg-[#1F4B36] hover:bg-[#163826] text-white text-xs font-semibold py-2 rounded flex items-center justify-center gap-1"
                    >
                      Tambahkan
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List Table */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-700 block">Rincian Barang Belanjaan:</span>
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
                            <td className="p-2 text-right font-mono text-[#1F4B36] font-bold">{formatIDR(item.subtotal)}</td>
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
                {selectedItems.length > 0 && (
                  <div className="text-right text-xs font-bold text-gray-800 space-y-2 pt-2">
                    <div>Total Belanja: <span className="text-lg font-black text-[#1F4B36] font-mono ml-1">{formatIDR(selectedItems.reduce((acc, curr) => acc + curr.subtotal, 0))}</span></div>
                    <button
                      type="submit"
                      className="bg-[#1F4B36] hover:bg-[#163826] text-white text-xs font-bold px-4 py-2 rounded shadow-sm"
                    >
                      Simpan Orderan
                    </button>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Orders List */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-xs">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">Daftar Semua Pesanan Aktif</span>
          <span className="text-[10px] text-gray-400 font-mono">Total: {orders.length} Orderan</span>
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
                <th className="p-3 text-center">Aksi Pelacakan</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-400 italic">Belum ada data pesanan tercatat.</td>
                </tr>
              ) : (
                orders.map((ord) => (
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
                    <td className="p-3 text-right font-mono font-bold text-gray-800">{formatIDR(ord.total)}</td>
                    <td className="p-3 text-center">{getStatusBadge(ord.status)}</td>
                    <td className="p-3 text-center space-y-1">{getShippingBadge(ord)}{ord.tracking_number && <p className="text-[10px] font-mono text-gray-500">{ord.tracking_number}</p>}</td>
                    <td className="p-3 text-center space-y-1">
                      <button onClick={() => openOrderPanel(ord)} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 mx-auto">
                        <PackageCheck className="w-3 h-3" /> Packing / Resi
                      </button>
                      {ord.status === 'pending' && (
                        <button
                          onClick={() => handleSendToProduction(ord)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 mx-auto shadow-xs"
                        >
                          Kirim ke Produksi <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {ord.status === 'production' && (
                        <div className="space-y-1">
                          <div className="text-[9px] text-gray-400 font-semibold animate-pulse">Sedang dikerjakan...</div>
                          <button
                            onClick={() => handleCompleteOrder(ord.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 rounded block w-full shadow-xs"
                          >
                            Tandai Selesai / Kirim
                          </button>
                        </div>
                      )}

                      {ord.status === 'completed' && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Selesai Dikirim
                        </span>
                      )}

                      {ord.status === 'pending' && (
                        <button
                          onClick={() => handleCancelOrder(ord.id)}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-semibold underline block w-full"
                        >
                          Batalkan Order
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedOrderId === ord.id && (
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      <td colSpan={9} className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                            <div><h4 className="font-black text-xs text-gray-800 flex items-center gap-1"><PackageCheck className="w-4 h-4 text-[#1F4B36]" /> Tugas Packing</h4><p className="text-[10px] text-gray-400">Assign ke karyawan, nanti muncul di Daftar Kerjaan.</p></div>
                            <select value={packingEmployeeId} onChange={event => setPackingEmployeeId(event.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs">
                              <option value="">Pilih karyawan packing</option>
                              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                            </select>
                            {ord.packing_employee_name && <p className="text-xs text-gray-500">PIC sekarang: <b>{ord.packing_employee_name}</b></p>}
                            <button onClick={() => handleAssignPacking(ord)} className="w-full bg-[#1F4B36] text-white rounded-lg py-2 text-xs font-bold cursor-pointer">Kirim Tugas Packing</button>
                          </div>
                          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                            <div><h4 className="font-black text-xs text-gray-800 flex items-center gap-1"><Truck className="w-4 h-4 text-[#1F4B36]" /> Resi Pengiriman</h4><p className="text-[10px] text-gray-400">Isi setelah paket siap/kirim.</p></div>
                            <div className="grid grid-cols-2 gap-2">
                              <input value={shipExpedition} onChange={event => setShipExpedition(event.target.value)} placeholder="Ekspedisi" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                              <input value={shipTracking} onChange={event => setShipTracking(event.target.value)} placeholder="Nomor resi" className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono" />
                            </div>
                            <input type="file" accept="image/*" onChange={event => handleProofFile(event.target.files?.[0])} className="w-full text-xs file:mr-2 file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:rounded file:text-xs file:font-bold" />
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
    </div>
  );
};
