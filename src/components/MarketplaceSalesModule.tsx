import React, { useState, useEffect } from 'react';
import { MarketplaceSale, MarketplaceItemSale, Product } from '../types';
import { dataStore } from '../dataStore';
import { 
  ShoppingBag, 
  TrendingUp, 
  Plus, 
  Calendar, 
  DollarSign, 
  ListFilter, 
  Download, 
  Search, 
  Trash2, 
  Edit,
  X,
  Tag, 
  Percent, 
  User, 
  Info,
  Layers,
  ArrowUpDown,
  ShoppingBasket,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';

export const MarketplaceSalesModule: React.FC = () => {
  // Tabs: 'item_sales' (the requested detailed log) or 'daily_rekap' (the original summary channel)
  const [activeTab, setActiveTab] = useState<'item_sales' | 'daily_rekap'>('item_sales');

  // Load from dataStore
  const [dailySales, setDailySales] = useState<MarketplaceSale[]>([]);
  const [itemSales, setItemSales] = useState<MarketplaceItemSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Filtering states for Detailed Item Sales
  const [startDate, setStartDate] = useState<string>('2026-05-01'); // Match MEI 2026 in user picture
  const [endDate, setEndDate] = useState<string>('2026-07-31');
  const [filterMarketplace, setFilterMarketplace] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  // Input states for NEW DETAILED SALE
  const [inputDate, setInputDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [marketplaceRef, setMarketplaceRef] = useState<string>('Tokopedia');
  const [customMarketplaceRef, setCustomMarketplaceRef] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState<number>(0);
  const [adminFee, setAdminFee] = useState<number>(0);
  const [staffName, setStaffName] = useState<string>('Admin Online Siska');

  // Old Daily Rekap States
  const [dailyChannel, setDailyChannel] = useState<'tokopedia' | 'tiktok' | 'shopee'>('tokopedia');
  const [dailyOrderCount, setDailyOrderCount] = useState<number>(0);
  const [dailyRevenue, setDailyRevenue] = useState<number>(0);
  const [dailyFilterChannel, setDailyFilterChannel] = useState<string>('all');

  // Suggest fee check
  const [autoCalculateFee, setAutoCalculateFee] = useState<boolean>(true);
  const [feePercentage, setFeePercentage] = useState<number>(5); // Default estimated 5% fee

  // Editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingDailyId, setEditingDailyId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Confirmation state for deleting item sales
  const [deleteDetailedItemId, setDeleteDetailedItemId] = useState<string | null>(null);
  // Confirmation state for deleting daily rekap
  const [deleteDailySaleId, setDeleteDailySaleId] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
    const handleStorageChange = () => {
      loadAllData();
    };
    window.addEventListener('nxty_storage_change', handleStorageChange);
    return () => window.removeEventListener('nxty_storage_change', handleStorageChange);
  }, []);

  const loadAllData = () => {
    setDailySales(dataStore.getMarketplaceSales());
    setItemSales(dataStore.getMarketplaceItemSales());
    setProducts(dataStore.getProducts());
  };

  // When selected product changes, auto fill price and customDescription
  useEffect(() => {
    if (selectedProductId) {
      if (selectedProductId === 'custom') {
        // user selected custom, don't change price automatically
      } else {
        const prod = products.find(p => p.id === selectedProductId);
        if (prod) {
          setCustomDescription(prod.name + (prod.variant ? ` - ${prod.variant}` : ''));
          setPrice(prod.harga_jual);
        }
      }
    }
  }, [selectedProductId, products]);

  // When Qty, Price, or fee settings change, auto-calculate fee
  useEffect(() => {
    if (autoCalculateFee && price > 0 && qty > 0) {
      const subtotal = qty * price;
      const calculatedFee = Math.round(subtotal * (feePercentage / 100));
      setAdminFee(calculatedFee);
    }
  }, [qty, price, autoCalculateFee, feePercentage]);

  // Handler for Detailed Item Sale Submission
  const handleAddDetailedSale = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalDescription = selectedProductId === 'custom' || !selectedProductId
      ? customDescription.trim()
      : (products.find(p => p.id === selectedProductId)?.name || customDescription.trim());

    if (!finalDescription) {
      alert('Mohon masukkan deskripsi produk/barang!');
      return;
    }

    if (qty <= 0) {
      alert('QTY harus lebih dari 0!');
      return;
    }

    const calculatedSubtotal = qty * price;
    const finalTotal = calculatedSubtotal - adminFee;

    // Produk gudang yang terhubung (kosong bila deskripsi manual/custom)
    const linkedProductId = selectedProductId && selectedProductId !== 'custom' ? selectedProductId : undefined;

    const updatedItemSales = dataStore.getMarketplaceItemSales();

    if (editingItemId) {
      // Edit Mode — kembalikan stok lama dulu, lalu potong sesuai input baru
      const oldItem = updatedItemSales.find(item => item.id === editingItemId);
      if (oldItem?.product_id) {
        dataStore.adjustProductStock(oldItem.product_id, oldItem.qty, `Koreksi edit penjualan ${oldItem.order_number}`);
      }
      if (linkedProductId) {
        dataStore.adjustProductStock(linkedProductId, -qty, `Terjual - ${marketplaceRef} ${orderNumber.trim() || editingItemId}`);
      }

      const updated = updatedItemSales.map(item => {
        if (item.id === editingItemId) {
          return {
            ...item,
            product_id: linkedProductId,
            date: inputDate,
            order_number: orderNumber.trim() || item.order_number,
            marketplace_ref: marketplaceRef === 'Custom' ? customMarketplaceRef.trim() || 'Other' : marketplaceRef,
            description: finalDescription,
            qty,
            price,
            subtotal: calculatedSubtotal,
            admin_fee: adminFee,
            total: finalTotal,
            admin_staff: staffName
          };
        }
        return item;
      });
      dataStore.setMarketplaceItemSales(updated);
      setItemSales(updated);
      setEditingItemId(null);
      alert('Detail penjualan produk berhasil diperbarui!');
    } else {
      // Create Mode — potong stok produk jadi bila produk gudang dipilih
      if (linkedProductId) {
        dataStore.adjustProductStock(linkedProductId, -qty, `Terjual - ${marketplaceRef} ${orderNumber.trim() || 'baru'}`);
      }
      const newDetailedSale: MarketplaceItemSale = {
        id: Math.random().toString(36).substring(2, 11),
        product_id: linkedProductId,
        date: inputDate,
        order_number: orderNumber.trim() || 'NP-' + Math.floor(100000 + Math.random() * 900000),
        marketplace_ref: marketplaceRef === 'Custom' ? customMarketplaceRef.trim() || 'Other' : marketplaceRef,
        description: finalDescription,
        qty,
        price,
        subtotal: calculatedSubtotal,
        admin_fee: adminFee,
        total: finalTotal,
        admin_staff: staffName
      };
      updatedItemSales.unshift(newDetailedSale);
      dataStore.setMarketplaceItemSales(updatedItemSales);
      setItemSales(updatedItemSales);
      alert('Detail penjualan produk berhasil dicatatkan!');
    }

    // Reset inputs but preserve date & admin name for speed typing!
    setOrderNumber('');
    setSelectedProductId('');
    setCustomDescription('');
    setQty(1);
    setPrice(0);
    setAdminFee(0);
  };

  const handleStartEditItem = (item: MarketplaceItemSale) => {
    setEditingItemId(item.id);
    setInputDate(item.date);
    setOrderNumber(item.order_number);
    
    const knownMarketplaces = ['Tokopedia', 'Shopee', 'TikTok Shop', 'Lazada'];
    if (knownMarketplaces.includes(item.marketplace_ref)) {
      setMarketplaceRef(item.marketplace_ref);
      setCustomMarketplaceRef('');
    } else {
      setMarketplaceRef('Custom');
      setCustomMarketplaceRef(item.marketplace_ref);
    }

    // Find matching product (utamakan tautan product_id yang tersimpan)
    const matchingProduct = (item.product_id && products.find(p => p.id === item.product_id))
      || products.find(p => p.name === item.description || (p.name + (p.variant ? ` - ${p.variant}` : '')) === item.description);
    if (matchingProduct) {
      setSelectedProductId(matchingProduct.id);
      setCustomDescription('');
    } else {
      setSelectedProductId('custom');
      setCustomDescription(item.description);
    }

    setQty(item.qty);
    setPrice(item.price);
    setAutoCalculateFee(false); // keep historical fee values
    setAdminFee(item.admin_fee);
    setStaffName(item.admin_staff);
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    setOrderNumber('');
    setSelectedProductId('');
    setCustomDescription('');
    setQty(1);
    setPrice(0);
    setAdminFee(0);
  };

  // Handler for Original Daily Summary Submission
  const handleAddDailySummary = (e: React.FormEvent) => {
    e.preventDefault();
    if (dailyOrderCount <= 0 || dailyRevenue <= 0) return;

    const currentDailySales = dataStore.getMarketplaceSales();

    if (editingDailyId) {
      // Edit Mode
      const updated = currentDailySales.map(sale => {
        if (sale.id === editingDailyId) {
          return {
            ...sale,
            channel: dailyChannel,
            order_count: dailyOrderCount,
            revenue: dailyRevenue,
            admin_name: staffName
          };
        }
        return sale;
      });
      dataStore.setMarketplaceSales(updated);
      setDailySales(updated);
      setEditingDailyId(null);
      alert('Rekap penjualan harian berhasil diperbarui!');
    } else {
      // Create Mode
      const newDailySale: MarketplaceSale = {
        id: Math.random().toString(36).substring(2, 9),
        channel: dailyChannel,
        date: new Date().toISOString().split('T')[0],
        order_count: dailyOrderCount,
        revenue: dailyRevenue,
        admin_name: staffName
      };
      currentDailySales.unshift(newDailySale);
      dataStore.setMarketplaceSales(currentDailySales);
      setDailySales(currentDailySales);
      alert('Rekap penjualan harian berhasil diposting!');
    }

    setDailyOrderCount(0);
    setDailyRevenue(0);
  };

  const handleStartEditDaily = (sale: MarketplaceSale) => {
    setEditingDailyId(sale.id);
    setDailyChannel(sale.channel);
    setDailyOrderCount(sale.order_count);
    setDailyRevenue(sale.revenue);
    setStaffName(sale.admin_name);
  };

  const handleCancelEditDaily = () => {
    setEditingDailyId(null);
    setDailyOrderCount(0);
    setDailyRevenue(0);
  };

  // Delete Detailed Sale Entry
  const handleDeleteDetailedSale = (id: string) => {
    setDeleteDetailedItemId(id);
  };

  const confirmDeleteDetailedSale = () => {
    if (deleteDetailedItemId) {
      const current = dataStore.getMarketplaceItemSales();
      // Kembalikan stok produk jadi bila penjualan ini terhubung ke produk gudang
      const target = current.find(sale => sale.id === deleteDetailedItemId);
      if (target?.product_id) {
        dataStore.adjustProductStock(target.product_id, target.qty, `Hapus penjualan ${target.order_number}`);
      }
      const updated = current.filter(sale => sale.id !== deleteDetailedItemId);
      dataStore.setMarketplaceItemSales(updated);
      setItemSales(updated);
      setDeleteDetailedItemId(null);
    }
  };

  // Delete Daily Summary Entry
  const handleDeleteDailySale = (id: string) => {
    setDeleteDailySaleId(id);
  };

  const confirmDeleteDailySale = () => {
    if (deleteDailySaleId) {
      const current = dataStore.getMarketplaceSales();
      const updated = current.filter(sale => sale.id !== deleteDailySaleId);
      dataStore.setMarketplaceSales(updated);
      setDailySales(updated);
      setDeleteDailySaleId(null);
    }
  };

  // Formatter for Currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatDateExcel = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // FILTERING LOGIC for Detailed Sales
  const filteredItemSales = itemSales.filter(item => {
    // Date filter
    const itemDate = item.date;
    const isWithinDate = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
    
    // Marketplace channel filter
    const isMarketplaceMatch = filterMarketplace === 'all' || 
      item.marketplace_ref.toLowerCase() === filterMarketplace.toLowerCase();

    // Text search filter
    const matchesSearch = !searchQuery ? true : (
      item.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.admin_staff.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return isWithinDate && isMarketplaceMatch && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    } else {
      return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    }
  });

  // STATS COMPUTATION for Detailed Sales Tab
  const totalItemQty = filteredItemSales.reduce((acc, curr) => acc + curr.qty, 0);
  const totalItemSubtotal = filteredItemSales.reduce((acc, curr) => acc + curr.subtotal, 0);
  const totalItemAdminFee = filteredItemSales.reduce((acc, curr) => acc + curr.admin_fee, 0);
  const totalItemNetOmset = filteredItemSales.reduce((acc, curr) => acc + curr.total, 0);

  // Compute Item-specific statistics
  const itemPopularityMap: { [key: string]: { qty: number; revenue: number } } = {};
  filteredItemSales.forEach(sale => {
    const desc = sale.description;
    if (!itemPopularityMap[desc]) {
      itemPopularityMap[desc] = { qty: 0, revenue: 0 };
    }
    itemPopularityMap[desc].qty += sale.qty;
    itemPopularityMap[desc].revenue += sale.total;
  });

  const sortedPopularItems = Object.entries(itemPopularityMap)
    .map(([name, stat]) => ({ name, ...stat }))
    .sort((a, b) => b.qty - a.qty);

  const topSellingItemName = sortedPopularItems[0]?.name || '-';
  const topSellingItemQty = sortedPopularItems[0]?.qty || 0;

  // EXPORT TO EXCEL (CSV implementation)
  const handleExportToExcel = () => {
    if (filteredItemSales.length === 0) {
      alert('Tidak ada data penjualan untuk diexport!');
      return;
    }

    // Creating identical column list as the Excel picture:
    // TGL | No | No pesenan | Ref | Deskripsi | QTY | Harga | Subtotal | Biaya | Total
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel compatibility with Indonesian character accents
    csvContent += 'ARI SPORTINDO\n';
    csvContent += 'Laporan Penjualan Barang - Marketplace\n';
    csvContent += `Periode Filter: ${startDate || 'Semua'} s/d ${endDate || 'Semua'}\n\n`;
    csvContent += 'TGL,No,No pesenan,Ref,Deskripsi,QTY,Harga,Subtotal,Biaya,Total,Input Oleh\n';

    filteredItemSales.forEach((item, index) => {
      // Escape commas in description to avoid CSV breaking
      const cleanDesc = item.description.replace(/"/g, '""');
      const row = [
        item.date,
        index + 1,
        `="${item.order_number}"`, // Forces Excel to treat order number as string (no scientific notation)
        item.marketplace_ref,
        `"${cleanDesc}"`,
        item.qty,
        item.price,
        item.subtotal,
        item.admin_fee > 0 ? `-${item.admin_fee}` : '0',
        item.total,
        `"${item.admin_staff}"`
      ].join(',');
      csvContent += row + '\n';
    });

    // Append Summary Row
    csvContent += `\n,,,TOTAL TERJUAL,,${totalItemQty},,,${totalItemAdminFee > 0 ? `-${totalItemAdminFee}` : '0'},${totalItemNetOmset},\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Penjualan_Marketplace_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Brand Banner / Title bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-50 text-evergreen rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Manajemen Penjualan Marketplace</h1>
              <p className="text-xs text-gray-500">
                Pencatatan rincian order, potongan biaya admin, dan pelaporan omset terintegrasi
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg self-start md:self-center border border-gray-200">
          <button
            onClick={() => setActiveTab('item_sales')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'item_sales'
                ? 'bg-white text-evergreen shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Detail Penjualan Barang
          </button>
          <button
            onClick={() => setActiveTab('daily_rekap')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'daily_rekap'
                ? 'bg-white text-evergreen shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Rekap Omset Harian
          </button>
        </div>
      </div>

      {activeTab === 'item_sales' ? (
        // ================== DETAILED ITEM SALES TAB ==================
        <div className="space-y-6">
          
          {/* Top Dashboard Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* CARD 1: Total Qty Sold */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <ShoppingBasket className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">Total Terjual</span>
                <p className="text-2xl font-black text-gray-800 font-mono">{totalItemQty} <span className="text-xs font-normal text-gray-400">Pcs</span></p>
                <span className="text-[10px] text-blue-500 font-semibold block">Dari {filteredItemSales.length} baris order</span>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-5 text-blue-600 pointer-events-none">
                <ShoppingBasket className="w-24 h-24" />
              </div>
            </div>

            {/* CARD 2: Top Selling Item */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                <Tag className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">Item Terlaris</span>
                <p className="text-sm font-black text-gray-800 truncate" title={topSellingItemName}>
                  {topSellingItemName}
                </p>
                <span className="text-[10px] text-indigo-500 font-semibold block font-mono">
                  Terjual: {topSellingItemQty} Pcs ({sortedPopularItems.length} produk unik)
                </span>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-5 text-indigo-600 pointer-events-none">
                <Tag className="w-24 h-24" />
              </div>
            </div>

            {/* CARD 3: Admin Marketplace Fees */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <Percent className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider block">Biaya Potongan Admin</span>
                <p className="text-xl font-bold text-amber-600 font-mono">-{formatIDR(totalItemAdminFee)}</p>
                <span className="text-[10px] text-amber-500 font-semibold block">
                  Est. {totalItemSubtotal > 0 ? ((totalItemAdminFee / totalItemSubtotal) * 100).toFixed(1) : 0}% dari subtotal bruto
                </span>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-5 text-amber-600 pointer-events-none">
                <Percent className="w-24 h-24" />
              </div>
            </div>

            {/* CARD 4: Total Omset Net */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-4 relative overflow-hidden bg-gradient-to-br from-white to-emerald-50">
              <div className="p-3 bg-emerald-500 text-white rounded-lg shadow-sm">
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-gray-500 font-black uppercase tracking-wider block">Total Omset Bersih</span>
                <p className="text-2xl font-black text-evergreen font-mono">{formatIDR(totalItemNetOmset)}</p>
                <span className="text-[10px] text-emerald-600 font-bold block">
                  Kotor: {formatIDR(totalItemSubtotal)}
                </span>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-10 text-evergreen pointer-events-none">
                <DollarSign className="w-24 h-24" />
              </div>
            </div>

          </div>

          {/* MAIN GRID: Input & List */}
          <div className="space-y-4">
            
            {/* BUTTON TO OPEN MODAL */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-evergreen text-white rounded-lg text-xs font-bold shadow-sm hover:bg-opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Penjualan
            </button>

            {/* MODAL SECTION: Entry Form */}
            {isModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsModalOpen(false)}>
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className={`border-b pb-3 flex items-center justify-between gap-2 ${editingItemId ? 'border-amber-100 bg-amber-50/50 -mx-6 -mt-6 p-6 rounded-t-2xl mb-4' : 'border-gray-50 mb-4'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-md ${editingItemId ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                        {editingItemId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-gray-800">
                          {editingItemId ? 'Edit Rincian Item' : 'Catat Rincian Item Terjual'}
                        </h3>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setIsModalOpen(false); handleCancelEditItem(); }}
                      className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={(e) => { handleAddDetailedSale(e); setIsModalOpen(false); }} className="space-y-4 text-xs">
                    {/* ... (Form Fields) */}
                    {/* Date Input */}
                    <div>
                      <label className="block text-gray-500 font-semibold mb-1">Tanggal Transaksi (TGL)</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="date"
                          value={inputDate}
                          onChange={(e) => setInputDate(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded pl-9 pr-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-evergreen"
                          required
                        />
                      </div>
                    </div>

                    {/* Order Number & Marketplace Channel */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-500 font-semibold mb-1">No Pesenan (Order ID)</label>
                        <input
                          type="text"
                          value={orderNumber}
                          onChange={(e) => setOrderNumber(e.target.value)}
                          placeholder="Contoh: 58377612..."
                          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-mono text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-evergreen"
                        />
                      </div>

                      <div>
                        <label className="block text-gray-500 font-semibold mb-1">Ref (Marketplace)</label>
                        <select
                          value={marketplaceRef}
                          onChange={(e) => setMarketplaceRef(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 font-semibold focus:outline-none focus:ring-1 focus:ring-evergreen"
                        >
                          <option value="Tokopedia">Tokopedia</option>
                          <option value="Shopee">Shopee</option>
                          <option value="TikTok Shop">TikTok Shop</option>
                          <option value="Lazada">Lazada</option>
                          <option value="Custom">Lainnya...</option>
                        </select>
                      </div>
                    </div>

                    {/* Custom Marketplace input if Custom is selected */}
                    {marketplaceRef === 'Custom' && (
                      <div>
                        <label className="block text-gray-500 font-semibold mb-1">Nama Marketplace Lain</label>
                        <input
                          type="text"
                          value={customMarketplaceRef}
                          onChange={(e) => setCustomMarketplaceRef(e.target.value)}
                          placeholder="Misal: Bukalapak, Website, Whatsapp"
                          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-evergreen"
                          required
                        />
                      </div>
                    )}

                    {/* Product Selector with Autocomplete */}
                    <div>
                      <label className="block text-gray-500 font-semibold mb-1">Pilih Produk (Autofill)</label>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 font-semibold mb-1.5 focus:outline-none focus:ring-1 focus:ring-evergreen"
                      >
                        <option value="">-- Ketik Deskripsi Custom / Pilih Produk --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.variant ? `(${p.variant})` : ''} - {formatIDR(p.harga_jual)}
                          </option>
                        ))}
                        <option value="custom">Tulis Custom / Tidak di List</option>
                      </select>

                      {/* Deskripsi custom input */}
                      {(!selectedProductId || selectedProductId === 'custom') && (
                        <div className="space-y-1">
                          <label className="block text-[10px] text-gray-400 font-bold uppercase">Deskripsi Item</label>
                          <input
                            type="text"
                            value={customDescription}
                            onChange={(e) => setCustomDescription(e.target.value)}
                            placeholder="Ketik deskripsi produk di sini..."
                            className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-evergreen"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* QTY & Price per Item */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-500 font-semibold mb-1">QTY Terjual</label>
                        <input
                          type="number"
                          min={1}
                          value={qty || ''}
                          onChange={(e) => setQty(Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-evergreen"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-gray-500 font-semibold mb-1">Harga Satuan (IDR)</label>
                        <input
                          type="number"
                          min={0}
                          value={price || ''}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-evergreen"
                          required
                        />
                      </div>
                    </div>

                    {/* Admin Fee helper and input */}
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Percent className="w-3 h-3 text-amber-500" /> Auto Hitung Potongan Admin
                        </span>
                        <input
                          type="checkbox"
                          checked={autoCalculateFee}
                          onChange={(e) => setAutoCalculateFee(e.target.checked)}
                          className="rounded text-evergreen focus:ring-evergreen"
                        />
                      </div>

                      {autoCalculateFee ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400">Tarif Fee:</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={feePercentage}
                            onChange={(e) => setFeePercentage(Number(e.target.value))}
                            className="w-16 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-center font-mono font-bold text-gray-700"
                          />
                          <span className="text-[11px] text-gray-400">% dari subtotal</span>
                        </div>
                      ) : null}

                      <div>
                        <label className="block text-[10px] text-gray-400 font-bold uppercase mb-0.5">Biaya Potongan Admin (IDR)</label>
                        <input
                          type="number"
                          min={0}
                          value={adminFee || ''}
                          onChange={(e) => setAdminFee(Number(e.target.value))}
                          className="w-full bg-white border border-gray-200 rounded px-3 py-1.5 text-xs font-bold font-mono text-amber-600 focus:outline-none focus:ring-1 focus:ring-evergreen"
                          placeholder="Contoh: 25000"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="w-full bg-evergreen text-white font-bold py-2.5 rounded shadow-sm text-xs transition-colors hover:bg-opacity-90 flex items-center justify-center gap-1.5"
                    >
                      {editingItemId ? 'Simpan Perubahan' : 'Simpan & Posting Detail'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* RIGHT SECTION: Detailed Logs Grid with search & sorting & export */}
            <div className="space-y-4">
              
              {/* FILTERING CONTROLS */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50 pb-2">
                  <h4 className="font-bold text-xs text-gray-700 flex items-center gap-1.5">
                    <ListFilter className="w-3.5 h-3.5 text-evergreen" />
                    Pencarian & Shortir Hari Tanggal
                  </h4>
                  
                  {/* Export button */}
                  <button
                    onClick={handleExportToExcel}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-all shadow-sm"
                    title="Export ke Excel (Format .CSV)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Export ke Excel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Start Date */}
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">Mulai TGL</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-1 focus:ring-evergreen"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">Sampai TGL</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-1 focus:ring-evergreen"
                    />
                  </div>

                  {/* Marketplace Ref */}
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">Marketplace</label>
                    <select
                      value={filterMarketplace}
                      onChange={(e) => setFilterMarketplace(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-1 focus:ring-evergreen"
                    >
                      <option value="all">Semua Channel</option>
                      <option value="tokopedia">Tokopedia</option>
                      <option value="shopee">Shopee</option>
                      <option value="tiktok shop">TikTok Shop</option>
                      <option value="lazada">Lazada</option>
                    </select>
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold mb-1 uppercase">Urutan</label>
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-xs font-semibold text-gray-600 focus:outline-none focus:ring-1 focus:ring-evergreen"
                      >
                        <option value="newest">Terbaru (Newest)</option>
                        <option value="oldest">Terlama (Oldest)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Text Search Row */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan No Pesenan, Deskripsi Item, atau Staf Admin..."
                    className="w-full bg-gray-50 border border-gray-200 rounded pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-evergreen"
                  />
                </div>
              </div>

              {/* DATA TABLE (Layout like their Excel Picture) */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-gray-800">Laporan Penjualan Barang</h3>
                    <p className="text-[10px] text-gray-400">Total {filteredItemSales.length} data ditemukan berdasarkan filter</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] border border-evergreen/15">
                    <thead>
                      <tr className="bg-evergreen border-b border-evergreen-dark text-white font-bold uppercase tracking-wider text-[10px] text-center">
                        <th className="p-3 border-r border-white/10 w-24">TGL</th>
                        <th className="p-3 border-r border-white/10 w-10">No</th>
                        <th className="p-3 border-r border-white/10 text-left">No pesenan</th>
                        <th className="p-3 border-r border-white/10 text-left">Ref</th>
                        <th className="p-3 border-r border-white/10 text-left">Deskripsi</th>
                        <th className="p-3 border-r border-white/10 text-center w-12">QTY</th>
                        <th className="p-3 border-r border-white/10 text-right w-24">Harga</th>
                        <th className="p-3 border-r border-white/10 text-right w-28">Subtotal</th>
                        <th className="p-3 border-r border-white/10 text-right w-24">Biaya</th>
                        <th className="p-3 border-r border-white/10 text-right font-black w-28">Total</th>
                        <th className="p-3 text-center w-16">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 font-mono bg-white">
                      {filteredItemSales.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-xs text-gray-400 italic font-sans">
                            Tidak ada rincian data penjualan yang sesuai filter.
                          </td>
                        </tr>
                      ) : (
                        filteredItemSales.map((item, index) => (
                          <tr key={item.id} className="hover:bg-emerald-50/15 border-b border-emerald-100/30 transition-colors">
                            <td className="p-3 text-center border-r border-emerald-100/70 font-mono text-emerald-950 font-bold bg-emerald-50/30 whitespace-nowrap align-middle">
                              {formatDateExcel(item.date)}
                            </td>
                            <td className="p-3 text-center text-gray-500 border-r border-emerald-100/50">{index + 1}</td>
                            <td className="p-3 font-bold text-gray-800 select-all truncate max-w-[120px] border-r border-emerald-100/50" title={item.order_number}>
                              {item.order_number}
                            </td>
                            <td className="p-3 border-r border-emerald-100/50">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-sans ${
                                item.marketplace_ref.toLowerCase() === 'tokopedia' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                item.marketplace_ref.toLowerCase() === 'shopee' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                item.marketplace_ref.toLowerCase() === 'tiktok shop' ? 'bg-pink-100 text-pink-800 border border-pink-200' :
                                'bg-gray-100 text-gray-800 border border-gray-200'
                              }`}>
                                {item.marketplace_ref}
                              </span>
                            </td>
                            <td className="p-3 text-gray-900 font-bold font-sans truncate max-w-[160px] border-r border-emerald-100/50" title={item.description}>
                              {item.description}
                            </td>
                            <td className="p-3 text-center font-bold text-gray-950 border-r border-emerald-100/50">{item.qty}</td>
                            <td className="p-3 text-right text-gray-700 border-r border-emerald-100/50 font-semibold">{formatIDR(item.price)}</td>
                            <td className="p-3 text-right text-gray-700 border-r border-emerald-100/50 font-semibold">{formatIDR(item.subtotal)}</td>
                            <td className="p-3 text-right text-red-600 font-bold border-r border-emerald-100/50">
                              {item.admin_fee > 0 ? `-${formatIDR(item.admin_fee)}` : 'Rp0'}
                            </td>
                            <td className="p-3 text-right font-black text-evergreen border-r border-emerald-100/50 text-[12px]">{formatIDR(item.total)}</td>
                            <td className="p-3 text-center whitespace-nowrap flex items-center justify-center gap-1.5 bg-white/30">
                              <button
                                onClick={() => handleStartEditItem(item)}
                                className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                                title="Edit catatan"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDetailedSale(item.id)}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                title="Hapus catatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    
                    {/* Bottom Table Summary Row */}
                    {filteredItemSales.length > 0 && (
                      <tfoot className="bg-emerald-50/15 border-t border-emerald-800/20 font-semibold font-sans text-xs">
                        <tr className="text-emerald-950 font-bold">
                          <td colSpan={5} className="p-3 text-right uppercase tracking-wider border-r border-emerald-100/50 font-black">TOTAL FILTERED:</td>
                          <td className="p-3 text-center font-bold font-mono text-gray-900 border-r border-emerald-100/50">{totalItemQty} Pcs</td>
                          <td className="p-3 border-r border-emerald-100/50" />
                          <td className="p-3 text-right font-mono border-r border-emerald-100/50 text-gray-800 font-bold">{formatIDR(totalItemSubtotal)}</td>
                          <td className="p-3 text-right font-mono text-red-600 border-r border-emerald-100/50 font-bold">-{formatIDR(totalItemAdminFee)}</td>
                          <td className="p-3 text-right font-mono text-evergreen font-black text-sm border-r border-emerald-100/50">{formatIDR(totalItemNetOmset)}</td>
                          <td className="p-3" />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Important tips box */}
                <div className="p-4 bg-emerald-50 border-t border-gray-100 flex items-start gap-2.5 text-xs text-emerald-800">
                  <Info className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <span className="font-bold">Informasi Penting & Tips Keuangan:</span>
                    <p className="leading-relaxed opacity-90 text-[11px]">
                      Biaya potongan admin merupakan faktor terbesar yang memakan margin keuntungan marketplace. Selalu monitor efektivitas kampanye diskon dan pastikan "Net Omset" mencukupi untuk menutupi biaya modal (COGS) produksi yang tertera di dashboard owner.
                    </p>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>
      ) : (
        // ================== ORIGINAL DAILY REKAP TAB ==================
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: Input Form */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
                <div className={`border-b pb-3 flex items-center justify-between gap-1.5 ${editingDailyId ? 'border-amber-100 bg-amber-50/50 -mx-6 -mt-6 p-6 rounded-t-xl mb-4' : 'border-gray-50'}`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`p-1 rounded-md ${editingDailyId ? 'bg-amber-100 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      {editingDailyId ? <Edit className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4 text-evergreen" />}
                    </span>
                    <div>
                      <h3 className="font-semibold text-sm text-gray-800">
                        {editingDailyId ? 'Edit Rekap Omset' : 'Catat Rekap Omset Harian'}
                      </h3>
                    </div>
                  </div>
                  {editingDailyId && (
                    <button
                      type="button"
                      onClick={handleCancelEditDaily}
                      className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
                      title="Batal Edit"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <form onSubmit={handleAddDailySummary} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Pilih Channel Marketplace</label>
                    <select
                      value={dailyChannel}
                      onChange={(e) => setDailyChannel(e.target.value as any)}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-2 text-xs text-gray-700 font-semibold"
                      required
                    >
                      <option value="tokopedia">Tokopedia</option>
                      <option value="shopee">Shopee</option>
                      <option value="tiktok">TikTok Shop</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Jumlah Order Terkirim (Paket)</label>
                    <input
                      type="number"
                      min={1}
                      value={dailyOrderCount || ''}
                      onChange={(e) => setDailyOrderCount(Number(e.target.value))}
                      placeholder="Misal: 15"
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs font-mono font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Total Omset Bersih (IDR)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 text-xs font-mono">Rp</span>
                      <input
                        type="number"
                        min={1}
                        value={dailyRevenue || ''}
                        onChange={(e) => setDailyRevenue(Number(e.target.value))}
                        placeholder="Misal: 2500000"
                        className="w-full bg-gray-50 border border-gray-200 rounded pl-8 pr-3 py-1.5 text-xs font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Staf Penginput</label>
                    <input
                      type="text"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-xs text-gray-400 font-semibold"
                      disabled
                    />
                  </div>

                  <div className="flex gap-2">
                    {editingDailyId && (
                      <button
                        type="button"
                        onClick={handleCancelEditDaily}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2 rounded text-xs transition-colors flex items-center justify-center gap-1"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      className={`flex-[2] text-white py-2 rounded font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                        editingDailyId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-evergreen hover:bg-opacity-95 shadow w-full'
                      }`}
                    >
                      {editingDailyId ? <Edit className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {editingDailyId ? 'Simpan Perubahan' : 'Posting Rekap Omset Harian'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* RIGHT COLUMN: Daily Summary Logs */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Quick stats mini-grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Total Penjualan Rekap</span>
                  <p className="text-lg font-bold text-evergreen font-mono mt-1">
                    {formatIDR(dailySales.filter(s => dailyFilterChannel === 'all' || s.channel === dailyFilterChannel).reduce((acc, curr) => acc + curr.revenue, 0))}
                  </p>
                </div>
                
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Volume Paket Order</span>
                  <p className="text-lg font-bold text-gray-800 font-mono mt-1">
                    {dailySales.filter(s => dailyFilterChannel === 'all' || s.channel === dailyFilterChannel).reduce((acc, curr) => acc + curr.order_count, 0)} Paket
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-gray-800">Riwayat Rekap Omset Harian</h3>
                    <p className="text-xs text-gray-400">Log order harian rekap marketplace disortir dari terbaru</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <ListFilter className="w-3.5 h-3.5 text-gray-400" />
                    <select
                      value={dailyFilterChannel}
                      onChange={(e) => setDailyFilterChannel(e.target.value)}
                      className="bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-[11px] font-semibold text-gray-600"
                    >
                      <option value="all">Semua Channel</option>
                      <option value="tokopedia">Tokopedia</option>
                      <option value="shopee">Shopee</option>
                      <option value="tiktok">TikTok Shop</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto">
                  {dailySales.filter(s => dailyFilterChannel === 'all' || s.channel === dailyFilterChannel).length === 0 ? (
                    <p className="text-xs text-gray-400 italic text-center py-8">Belum ada catatan penjualan untuk filter ini.</p>
                  ) : (
                    dailySales
                      .filter(s => dailyFilterChannel === 'all' || s.channel === dailyFilterChannel)
                      .map((sale) => (
                        <div key={sale.id} className="flex justify-between items-center text-xs p-3 bg-gray-50 rounded border border-gray-100">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                sale.channel === 'tokopedia' ? 'bg-emerald-100 text-emerald-800' :
                                sale.channel === 'shopee' ? 'bg-orange-100 text-orange-800' : 'bg-pink-100 text-pink-800'
                              }`}>
                                {sale.channel}
                              </span>
                              <span className="font-mono text-emerald-900 font-bold bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-emerald-700" /> {formatDateExcel(sale.date)}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400">Diinput oleh: {sale.admin_name}</p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right space-y-0.5">
                              <p className="font-mono font-bold text-evergreen">{formatIDR(sale.revenue)}</p>
                              <p className="text-[10px] text-gray-500 font-semibold">{sale.order_count} Paket Order</p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleStartEditDaily(sale)}
                                className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDailySale(sale.id)}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Detailed Item Sale */}
      {deleteDetailedItemId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" 
          onClick={() => setDeleteDetailedItemId(null)}
          id="delete-detailed-item-modal"
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-50 text-red-600 p-3 rounded-full mx-auto w-fit mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Hapus Data Penjualan?</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus data penjualan barang ini dari laporan? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteDetailedItemId(null)}
                className="flex-1 py-2 px-4 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteDetailedSale}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Daily Summary Sale */}
      {deleteDailySaleId && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" 
          onClick={() => setDeleteDailySaleId(null)}
          id="delete-daily-sale-modal"
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-red-50 text-red-600 p-3 rounded-full mx-auto w-fit mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Hapus Rekap Omset?</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              Apakah Anda yakin ingin menghapus rekap omset harian ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteDailySaleId(null)}
                className="flex-1 py-2 px-4 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteDailySale}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
