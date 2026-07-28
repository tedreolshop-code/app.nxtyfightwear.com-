import React, { useState, useEffect } from 'react';
import { Order, OrderItem, Product, Employee, orderRemaining, orderPaymentStatus, divisionLabel, paidAmountOf } from '../types';
import { DivisionFilter } from './DivisionFilter';
import { PaymentLedger, LedgerRow } from './PaymentLedger';
import { dataStore, wibTodayStr } from '../dataStore';
import { ShoppingBag, Plus, User, Phone, CheckCircle2, Trash2, PackageCheck, Truck, Printer, X, Pencil, Ban, RotateCcw } from 'lucide-react';

// Tombol aksi ikon 24x24 — dipakai berulang di kolom Aksi
const iconBtn = 'w-6 h-6 flex items-center justify-center rounded border cursor-pointer';
const iconBtnPlain = `${iconBtn} border-gray-200 bg-white hover:bg-gray-50 text-gray-700`;

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
  const [orderDivFilter, setOrderDivFilter] = useState('');
  // Sub-tab: daftar pesanan vs buku piutang pelanggan
  const [orderView, setOrderView] = useState<'pesanan' | 'piutang'>('pesanan');
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
  const [dp, setDp] = useState(0);
  // Pre-order: barang belum ada, dijanjikan siap pada readyDate
  const [isPreorder, setIsPreorder] = useState(false);
  const [readyDate, setReadyDate] = useState('');

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
    // Urutkan abjad (nama lalu varian) biar gampang dicari di dropdown order
    setProducts([...dataStore.getProducts()].sort((a, b) =>
      `${a.name} ${a.variant}`.localeCompare(`${b.name} ${b.variant}`, 'id', { sensitivity: 'base', numeric: true })));
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
        department_id: prod.department_id, // snapshot: dipakai laporan per divisi
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
    setDp(0);
    setIsPreorder(false);
    setReadyDate('');
    setEditOrderId(null);
    setIsModalOpen(false);
  };

  // Edit hanya untuk order yang stok gudangnya belum dipotong (Pending / Pre-Order)
  const isEditableStatus = (status: Order['status']) => status === 'pending' || status === 'preorder';

  const startEditOrder = (order: Order) => {
    if (!isEditableStatus(order.status)) {
      alert('Hanya order berstatus Pending atau Pre-Order yang bisa diedit.');
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
    setDp(order.dp || 0);
    setIsPreorder(order.status === 'preorder');
    setReadyDate(order.ready_date || '');
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
  // DP tidak boleh melebihi tagihan; kalau sama dengan tagihan berarti lunas di muka
  const cleanDp = Math.min(Math.max(0, dp || 0), formTotal);
  const formRemaining = formTotal - cleanDp;

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert('Pilih minimal satu produk untuk dipesan!');
      return;
    }
    if (isPreorder && !readyDate) {
      alert('Order pre-order wajib punya tanggal janji barang siap.');
      return;
    }

    if (editOrderId) {
      const currentOrders = dataStore.getOrders();
      const existing = currentOrders.find(o => o.id === editOrderId);
      if (!existing || !isEditableStatus(existing.status)) {
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
        dp: cleanDp,
        // Pindah Pre-Order <-> Pending boleh saat edit; stok belum dipotong di dua status itu
        status: (isPreorder ? 'preorder' : 'pending') as Order['status'],
        ready_date: isPreorder ? readyDate : undefined,
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
        dp: cleanDp,
        status: isPreorder ? 'preorder' : 'pending',
        ready_date: isPreorder ? readyDate : undefined,
        notes
      };
      dataStore.setOrders([newOrder, ...dataStore.getOrders()]);
      alert(isPreorder
        ? `Pre-order ${orderNumber} tercatat, dijanjikan siap ${readyDate}. Stok gudang baru dipotong saat order diselesaikan.`
        : `Order ${orderNumber} berhasil dicatat! Selesaikan order untuk memotong stok gudang.`);
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

  // Status awal saat order dibuka kembali: pre-order kalau memang ada janji barang siap
  const reopenStatusFor = (order: Order): Order['status'] => (order.ready_date ? 'preorder' : 'pending');

  /**
   * Batalkan penyelesaian order: stok gudang yang tadi dipotong dikembalikan,
   * status kembali ke Pending/Pre-Order sehingga bisa diedit atau dihapus lagi.
   */
  const handleReopenOrder = (order: Order) => {
    if (order.status !== 'completed') return;
    const itemList = order.items.map(item => `${item.qty}x ${item.product_name} (${item.variant})`).join('\n- ');
    if (!window.confirm(`Batalkan penyelesaian order ${order.order_number}?\n\nStok gudang akan dikembalikan:\n- ${itemList}\n\nStatus kembali menjadi ${order.ready_date ? 'Pre-Order' : 'Pending'} dan order bisa diedit atau dihapus lagi.`)) return;

    order.items.forEach(item => {
      dataStore.adjustProductStock(item.product_id, item.qty, `Batal selesai - Order ${order.order_number}`);
    });
    dataStore.setOrders(dataStore.getOrders().map(o =>
      o.id === order.id ? { ...o, status: reopenStatusFor(order) } : o));
    alert(`Penyelesaian order ${order.order_number} dibatalkan. Stok gudang sudah dikembalikan.`);
    loadData();
  };

  /** Aktifkan kembali order yang dibatalkan. Stok tidak tersentuh saat pembatalan, jadi tidak ada koreksi stok. */
  const handleReactivateOrder = (order: Order) => {
    if (order.status !== 'cancelled') return;
    if (!window.confirm(`Aktifkan kembali order ${order.order_number}?\n\nStatus menjadi ${order.ready_date ? 'Pre-Order' : 'Pending'}. Stok gudang baru dipotong saat order diselesaikan.`)) return;
    dataStore.setOrders(dataStore.getOrders().map(o =>
      o.id === order.id ? { ...o, status: reopenStatusFor(order) } : o));
    alert(`Order ${order.order_number} aktif kembali.`);
    loadData();
  };

  // Hapus permanen hanya untuk order yang belum menyentuh stok (pending/pre-order) atau sudah dibatalkan
  const handleDeleteOrder = (order: Order) => {
    if (!isEditableStatus(order.status) && order.status !== 'cancelled') {
      alert('Order yang sudah Selesai tidak bisa langsung dihapus. Klik "Batalkan Penyelesaian" dulu agar stok gudang dikembalikan.');
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
      const prefix = order.status === 'preorder'
        ? `Pre-order ${order.order_number} belum bisa diselesaikan — barangnya belum tersedia.`
        : `Order ${order.order_number} belum bisa diselesaikan.`;
      alert(`${prefix}\n\nStok gudang kurang:\n- ${shortages.join('\n- ')}\n\nTambah stok produk jadi di menu Gudang terlebih dahulu.`);
      return;
    }

    // Sisa tagihan diingatkan, tapi tidak memblokir: barang boleh keluar dulu bila itu keputusan owner
    const remaining = orderRemaining(order);
    const paymentNote = remaining > 0
      ? `\n\nPerhatian: sisa tagihan belum lunas ${formatIDR(remaining)} (DP ${formatIDR(order.dp || 0)} dari ${formatIDR(order.total)}).`
      : '';
    if (!window.confirm(`Selesaikan order ${order.order_number}?\n\nStok produk jadi di gudang akan langsung dipotong dan tidak bisa di-undo.${paymentNote}`)) return;

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
      return <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[9px] rounded font-bold font-mono border border-gray-200">OFFLINE</span>;
    }
    return (
      <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 text-[9px] rounded font-bold font-mono border border-sky-200 uppercase">
        {order.marketplace_name}
      </span>
    );
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'preorder':
        return <span className="px-2 py-0.5 bg-violet-100 text-violet-800 text-[10px] rounded font-semibold border border-violet-200">Pre-Order</span>;
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

  const getPaymentBadge = (order: Order) => {
    const status = orderPaymentStatus(order);
    if (status === 'lunas') {
      return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded font-semibold border border-emerald-200">Lunas</span>;
    }
    if (status === 'dp') {
      return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded font-semibold border border-amber-200">DP</span>;
    }
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded font-semibold border border-gray-200">Belum Bayar</span>;
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
            {order.status === 'preorder' && (
              <p className="font-bold">PRE-ORDER · siap {order.ready_date || '-'}</p>
            )}
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
          {(order.dp ?? 0) > 0 && (
            <>
              <div className="flex justify-between"><span>DP Dibayar</span><span className="font-bold">-{formatIDRCompact(order.dp!)}</span></div>
              <div className="flex justify-between font-black">
                <span>{orderRemaining(order) > 0 ? 'SISA TAGIHAN' : 'LUNAS'}</span>
                <span>{formatIDRCompact(orderRemaining(order))}</span>
              </div>
            </>
          )}
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

  // Buku piutang: turunan dari order yang belum lunas. Order dibatalkan tidak ditagih.
  const piutangRows: LedgerRow[] = orders
    .filter(ord => ord.status !== 'cancelled')
    .map(ord => ({
      id: ord.id,
      ref: ord.order_number,
      party: ord.customer_name,
      date: ord.date,
      dueDate: ord.due_date,
      // Satu order bisa berisi barang dua divisi
      departmentIds: Array.from(new Set(ord.items.map(item => item.department_id).filter(Boolean))) as string[],
      total: ord.total,
      paid: paidAmountOf(ord),
      payments: ord.payments || [],
    }));
  const piutangOutstanding = piutangRows.reduce((sum, row) => sum + Math.max(0, row.total - row.paid), 0);

  const visibleOrders = orders.filter(ord => {
    if (filterStatus === 'active') {
      if (ord.status === 'cancelled') return false;
    } else if (filterStatus !== 'all' && ord.status !== filterStatus) {
      return false;
    }
    const q = orderSearch.trim().toLowerCase();
    if (q && !`${ord.order_number} ${ord.customer_name} ${ord.customer_phone}`.toLowerCase().includes(q)) return false;
    // Satu order bisa berisi barang dari dua divisi, jadi cukup salah satu barang cocok
    if (orderDivFilter && !ord.items.some(item => (item.department_id || '') === orderDivFilter)) return false;
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
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

              {/* Ketersediaan barang: ready = potong stok saat diselesaikan, pre-order = barang belum ada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-500 font-semibold mb-1">Ketersediaan Barang</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsPreorder(false); setReadyDate(''); }}
                      className={`py-2 rounded border text-xs font-bold cursor-pointer ${
                        !isPreorder ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]' : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      Barang Ready
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPreorder(true)}
                      className={`py-2 rounded border text-xs font-bold cursor-pointer ${
                        isPreorder ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-200 text-gray-600'
                      }`}
                    >
                      Pre-Order
                    </button>
                  </div>
                </div>
                {isPreorder && (
                  <div>
                    <label className="block text-gray-500 font-semibold mb-1">Janji Barang Siap</label>
                    <input
                      type="date"
                      value={readyDate}
                      onChange={(e) => setReadyDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs"
                      required
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Stok gudang baru dipotong saat order diselesaikan.</p>
                  </div>
                )}
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
                    <tr className="bg-evergreen text-white font-bold uppercase tracking-wider text-[10px]">
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
                        <tr key={item.id} className="border-b border-emerald-200 hover:bg-gray-50">
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

              {/* Diskon, Ongkir & DP */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div>
                  <label className="block text-[10px] text-gray-400 font-semibold uppercase mb-1">DP / Uang Muka (IDR)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-xs font-mono">Rp</span>
                    <input
                      type="number"
                      min={0}
                      value={dp || ''}
                      onChange={(e) => setDp(Number(e.target.value))}
                      placeholder="0 jika belum bayar"
                      className="w-full bg-white border border-gray-200 rounded pl-8 pr-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Isi sama dengan total bila langsung lunas.</p>
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
                {cleanDp > 0 && (
                  <>
                    <div className="text-gray-500 font-semibold">DP Dibayar: <span className="font-mono ml-1">{formatIDR(cleanDp)}</span></div>
                    <div className={formRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                      {formRemaining > 0
                        ? <>Sisa Tagihan: <span className="font-mono ml-1">{formatIDR(formRemaining)}</span></>
                        : 'Lunas'}
                    </div>
                  </>
                )}
                {cleanShippingFee > 0 && (
                  <p className="text-[10px] font-normal text-gray-400">Ongkir tidak dihitung sebagai pendapatan penjualan.</p>
                )}
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

      {/* Sub-tab: daftar pesanan vs piutang pelanggan */}
      <div className="no-print bg-white p-1 rounded-xl border border-gray-200 inline-flex gap-1">
        <button
          onClick={() => setOrderView('pesanan')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${
            orderView === 'pesanan' ? 'bg-[var(--color-evergreen)] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Daftar Pesanan
        </button>
        <button
          onClick={() => setOrderView('piutang')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-1.5 ${
            orderView === 'piutang' ? 'bg-[var(--color-evergreen)] text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Piutang Pelanggan
          {piutangOutstanding > 0 && (
            <span className={`text-[10px] font-mono px-1.5 rounded-full ${
              orderView === 'piutang' ? 'bg-white/20' : 'bg-amber-100 text-amber-800'
            }`}>
              {formatIDR(piutangOutstanding)}
            </span>
          )}
        </button>
      </div>

      {orderView === 'piutang' && (
        <PaymentLedger
          title="Piutang Pelanggan"
          subtitle="Turunan dari order yang belum lunas — DP dan cicilan dicatat di sini, angkanya selalu sama dengan ordernya."
          partyLabel="Pelanggan"
          rows={piutangRows}
          todayStr={wibTodayStr()}
          onPay={(id, amount, date, note) => {
            if (!dataStore.addOrderPayment(id, amount, date, note)) return alert('Pembayaran gagal dicatat.');
            loadData();
          }}
        />
      )}

      {/* Orders List */}
      <div className={`no-print bg-white rounded-lg border border-gray-200 overflow-hidden shadow-xs ${orderView === 'piutang' ? 'hidden' : ''}`}>
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-gray-700 block">Daftar Pesanan</span>
            <span className="text-[10px] text-gray-400 font-mono">Menampilkan {visibleOrders.length} dari {orders.length} orderan</span>
            <span className="text-[10px] text-gray-400 block">Status diubah lewat tombol di kolom <b>Aksi</b> paling kanan: Selesaikan, Batalkan, atau Batalkan Penyelesaian.</span>
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
            <DivisionFilter value={orderDivFilter} onChange={setOrderDivFilter} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
            >
              <option value="active">Aktif (tanpa dibatalkan)</option>
              <option value="preorder">Pre-Order</option>
              <option value="pending">Pending</option>
              <option value="production">Di Produksi</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Dibatalkan</option>
              <option value="all">Semua Status</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Gaya tabel disamakan dengan Penjualan Marketplace: header evergreen, garis emerald, body mono */}
          <table className="w-full table-fixed text-left border-collapse text-[11px] border-2 border-evergreen/60 [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-2 [&_td]:overflow-hidden">
            <thead>
              <tr className="bg-evergreen border-b border-evergreen-dark text-white font-bold uppercase tracking-wider text-[10px] text-center">
                <th className="border-r border-white/30 text-left w-[120px]">No. Order</th>
                <th className="border-r border-white/30 text-left w-[76px]">Tanggal</th>
                <th className="border-r border-white/30 text-left w-[150px]">Pelanggan</th>
                <th className="border-r border-white/30 text-left">Daftar Barang</th>
                <th className="border-r border-white/30 text-right w-[124px]">Total Tagihan</th>
                <th className="border-r border-white/30 text-center w-[108px]">Bayar</th>
                <th className="border-r border-white/30 text-center w-[92px]">Status</th>
                <th className="border-r border-white/30 text-center w-[92px]">Kirim</th>
                <th className="text-center w-[112px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="font-mono bg-white [&_td]:border-r [&_td]:border-emerald-300 [&_td:last-child]:border-r-0">
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-gray-400 italic">
                    {orders.length === 0 ? 'Belum ada data pesanan tercatat.' : 'Tidak ada pesanan yang cocok dengan pencarian / filter.'}
                  </td>
                </tr>
              ) : (
                visibleOrders.map((ord) => (
                  <React.Fragment key={ord.id}>
                  <tr className="border-t border-emerald-200 hover:bg-emerald-50/15 transition-colors align-top">
                    <td className="font-mono font-bold text-gray-800">{ord.order_number}</td>
                    <td className="font-mono text-gray-500 whitespace-nowrap">{ord.date}</td>
                    <td>
                      <p className="font-bold text-gray-800 font-sans">{ord.customer_name}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{ord.customer_phone}</p>
                      <div className="mt-1">{getSourceBadge(ord)}</div>
                    </td>
                    <td className="space-y-1">
                      {ord.items.map((item, i) => (
                        <div key={i} className="bg-gray-100/60 px-2 py-0.5 rounded text-[10px] text-gray-600 border border-gray-100 w-fit flex items-center gap-1.5">
                          <span><span className="font-bold">{item.qty}x</span> {item.product_name} <span className="opacity-75">({item.variant})</span></span>
                          {item.department_id && (
                            <span className={`px-1 rounded text-[8px] font-bold uppercase ${
                              item.department_id === 'dept-eva-foam' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                            }`}>{divisionLabel(item.department_id)}</span>
                          )}
                        </div>
                      ))}
                      {ord.notes && (
                        <p className="text-[10px] text-gray-400 italic mt-1 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-100 max-w-xs">
                          {ord.notes}
                        </p>
                      )}
                    </td>
                    <td className="text-right font-mono font-bold text-gray-800">
                      {formatIDR(ord.total)}
                      {(ord.discount ?? 0) > 0 && (
                        <p className="text-[10px] text-rose-500 font-normal whitespace-nowrap">-{formatIDR(ord.discount!)} disc</p>
                      )}
                      {(ord.shipping_fee ?? 0) > 0 && (
                        <p className="text-[10px] text-gray-400 font-normal whitespace-nowrap">+{formatIDR(ord.shipping_fee!)} ongkir</p>
                      )}
                    </td>
                    <td className="text-center space-y-1">
                      {getPaymentBadge(ord)}
                      {orderPaymentStatus(ord) === 'dp' && (
                        <p className="text-[10px] font-mono text-gray-500 whitespace-nowrap">
                          bayar {formatIDR(ord.dp!)}<br />sisa {formatIDR(orderRemaining(ord))}
                        </p>
                      )}
                    </td>
                    <td className="text-center space-y-1">
                      {getStatusBadge(ord.status)}
                      {ord.status === 'preorder' && ord.ready_date && (
                        <p className="text-[10px] font-mono text-violet-700">siap {ord.ready_date}</p>
                      )}
                    </td>
                    <td className="text-center space-y-1">{getShippingBadge(ord)}{ord.tracking_number && <p className="text-[10px] font-mono text-gray-500">{ord.tracking_number}</p>}</td>
                    {/* Aksi dipadatkan jadi ikon; label tetap ada di tooltip biar kolom nggak melebar */}
                    <td className="text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        <button onClick={() => openOrderPanel(ord)} title="Packing / Resi" className={iconBtnPlain}>
                          <PackageCheck className="w-3.5 h-3.5" />
                        </button>

                        {ord.status !== 'cancelled' && (
                          <button onClick={() => handlePrintNota(ord)} title="Cetak Nota" className={iconBtnPlain}>
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Pre-order, pending & legacy 'production': selesaikan dengan potong stok gudang */}
                        {(ord.status === 'pending' || ord.status === 'preorder' || ord.status === 'production') && (
                          <button
                            onClick={() => handleCompleteOrder(ord.id)}
                            title="Selesaikan (potong stok gudang)"
                            className={`${iconBtn} bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {ord.status === 'completed' && (
                          <button
                            onClick={() => handleReopenOrder(ord)}
                            title="Batalkan penyelesaian — stok gudang dikembalikan supaya order bisa diedit/dihapus"
                            className={`${iconBtn} bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {ord.status === 'cancelled' && (
                          <button onClick={() => handleReactivateOrder(ord)} title="Aktifkan kembali" className={iconBtnPlain}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isEditableStatus(ord.status) && (
                          <>
                            <button
                              onClick={() => startEditOrder(ord)}
                              title="Edit order"
                              className={`${iconBtn} bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCancelOrder(ord.id)}
                              title="Batalkan order"
                              className={`${iconBtn} border-gray-200 bg-white text-rose-600 hover:bg-rose-50`}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}

                        {(isEditableStatus(ord.status) || ord.status === 'cancelled') && (
                          <button
                            onClick={() => handleDeleteOrder(ord)}
                            title="Hapus order"
                            className={`${iconBtn} bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedOrderId === ord.id && (
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      <td colSpan={9} className="p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                            <div><h4 className="font-black text-xs text-gray-800 flex items-center gap-1"><PackageCheck className="w-4 h-4 text-[var(--color-evergreen)]" /> Tugas Packing</h4><p className="text-[10px] text-gray-400">Assign ke karyawan, nanti muncul di Daftar Kerjaan.</p></div>
                            <select value={packingEmployeeId} onChange={event => setPackingEmployeeId(event.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs">
                              <option value="">Pilih karyawan packing</option>
                              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
                            </select>
                            {ord.packing_employee_name && <p className="text-xs text-gray-500">PIC sekarang: <b>{ord.packing_employee_name}</b></p>}
                            <button onClick={() => handleAssignPacking(ord)} className="w-full bg-[var(--color-evergreen)] text-white rounded-lg py-2 text-xs font-bold cursor-pointer">Kirim Tugas Packing</button>
                          </div>
                          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
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
