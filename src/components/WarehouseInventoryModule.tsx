import React, { useState, useEffect } from 'react';
import { Product, RawMaterial, StockMovement } from '../types';
import { dataStore, DEFAULT_PRODUCTION_STAGES, stagesForProduct } from '../dataStore';
import { StageListEditor } from './StageListEditor';
import { 
  Box, 
  History, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  AlertTriangle, 
  Database,
  Layers,
  Sparkles,
  RefreshCw,
  Archive,
  Wrench,
  Check
  ,PackagePlus
  ,ListOrdered
  ,X
} from 'lucide-react';

interface WarehouseInventoryModuleProps {
  userRole: string;
}

export const WarehouseInventoryModule: React.FC<WarehouseInventoryModuleProps> = ({ userRole }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  
  // Tab states: 'bahan' (Raw Materials) vs 'jadi' (Finished Goods) vs 'mutasi' (Stock Movements)
  const [activeTab, setActiveTab] = useState<'bahan' | 'jadi' | 'mutasi'>('bahan');
  
  // Department filter for Materials & Products
  const [selectedDept, setSelectedDept] = useState<'all' | 'eva' | 'konveksi'>('all');
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Stock Opname Form states
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState<'product' | 'material'>('material');
  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustDirection, setAdjustDirection] = useState<'in' | 'out'>('in');
  const [adjustRef, setAdjustRef] = useState('Hasil Stock Opname');

  // Form master item baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newItemType, setNewItemType] = useState<'material' | 'product'>('material');
  const [newItemId, setNewItemId] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('dept-eva-foam');
  const [newUnit, setNewUnit] = useState('Kg');
  const [newMinimumStock, setNewMinimumStock] = useState(0);
  const [newInitialStock, setNewInitialStock] = useState(0);
  const [newCategory, setNewCategory] = useState('Umum');
  const [newVariant, setNewVariant] = useState('Standar');
  const [newPrice, setNewPrice] = useState(0);
  const [newStages, setNewStages] = useState<string[]>([]);

  // Modal edit alur produksi produk yang sudah ada
  const [stageEditProduct, setStageEditProduct] = useState<Product | null>(null);
  const [stageEditList, setStageEditList] = useState<string[]>([]);

  // Load data helper
  const loadData = () => {
    setProducts(dataStore.getProducts());
    setRawMaterials(dataStore.getRawMaterials());
    setMovements(dataStore.getStockMovements());
  };

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener('nxty_storage_change', handleStorageChange);
    return () => window.removeEventListener('nxty_storage_change', handleStorageChange);
  }, []);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatDateExcel = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const date = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${date}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateStr;
    }
  };

  // Check if a material is Eva Foam or Konveksi
  const getMaterialDivision = (materialId: string) => {
    const material = rawMaterials.find(item => item.id === materialId);
    if (material?.department_id === 'dept-eva-foam') return 'Eva Foam';
    if (material?.department_id === 'dept-konveksi') return 'Konveksi';
    if (materialId.includes('foam')) {
      return 'Eva Foam';
    }
    return 'Konveksi';
  };

  const makeItemId = (type: 'material' | 'product', name: string) => {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || Date.now().toString();
    return `${type === 'material' ? 'mat' : 'prod'}-${slug}`;
  };

  const openCreateModal = () => {
    const type = activeTab === 'jadi' ? 'product' : 'material';
    setNewItemType(type);
    setNewItemId('');
    setNewItemName('');
    setNewDepartmentId(selectedDept === 'konveksi' ? 'dept-konveksi' : 'dept-eva-foam');
    setNewUnit('Kg');
    setNewMinimumStock(0);
    setNewInitialStock(0);
    setNewCategory('Umum');
    setNewVariant('Standar');
    setNewPrice(0);
    // Prefill alur produksi bawaan sesuai departemen terpilih
    const deptId = selectedDept === 'konveksi' ? 'dept-konveksi' : 'dept-eva-foam';
    setNewStages([...(DEFAULT_PRODUCTION_STAGES[deptId] || [])]);
    setShowCreateModal(true);
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    const id = (newItemId.trim() || makeItemId(newItemType, newItemName)).toLowerCase();
    if (!newItemName.trim()) return alert('Nama barang wajib diisi.');
    if (!/^[a-z0-9-]+$/.test(id)) return alert('ID hanya boleh berisi huruf kecil, angka, dan tanda minus.');
    if (newInitialStock < 0 || newMinimumStock < 0 || newPrice < 0) return alert('Nilai stok dan harga tidak boleh negatif.');

    const currentMovements = dataStore.getStockMovements();
    if (newItemType === 'material') {
      const current = dataStore.getRawMaterials();
      if (current.some(item => item.id === id)) return alert(`ID bahan "${id}" sudah digunakan.`);
      const material: RawMaterial = {
        id,
        name: newItemName.trim(),
        department_id: newDepartmentId,
        unit: newUnit.trim() || 'Unit',
        stock_minimum: newMinimumStock,
        current_stock: newInitialStock
      };
      dataStore.setRawMaterials([...current, material]);
      if (newInitialStock > 0) currentMovements.unshift({ id: `mov-${Math.random().toString(36).slice(2, 9)}`, type: 'bahan_masuk', item_id: id, item_name: material.name, amount: newInitialStock, reference: 'Stok awal master bahan baru', created_at: new Date().toISOString() });
    } else {
      const current = dataStore.getProducts();
      if (current.some(item => item.id === id)) return alert(`ID produk "${id}" sudah digunakan.`);
      if (newStages.length === 0) return alert('Tahapan produksi wajib diisi minimal satu tahap.');
      const product: Product = {
        id,
        department_id: newDepartmentId,
        name: newItemName.trim(),
        category: newCategory.trim() || 'Umum',
        variant: newVariant.trim() || 'Standar',
        harga_jual: newPrice,
        stock: newInitialStock,
        production_stages: newStages
      };
      dataStore.setProducts([...current, product]);
      if (newInitialStock > 0) currentMovements.unshift({ id: `mov-${Math.random().toString(36).slice(2, 9)}`, type: 'barang_jadi_masuk', item_id: id, item_name: `${product.name} (${product.variant})`, amount: newInitialStock, reference: 'Stok awal master produk baru', created_at: new Date().toISOString() });
    }
    if (newInitialStock > 0) dataStore.setStockMovements(currentMovements);
    setShowCreateModal(false);
    loadData();
    alert(`${newItemType === 'material' ? 'Bahan baku' : 'Barang jadi'} baru berhasil ditambahkan.`);
  };

  // Filter Materials
  const filteredMaterials = rawMaterials.filter(mat => {
    const matchesSearch = mat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const div = getMaterialDivision(mat.id);
    const matchesDept = 
      selectedDept === 'all' || 
      (selectedDept === 'eva' && div === 'Eva Foam') || 
      (selectedDept === 'konveksi' && div === 'Konveksi');
    return matchesSearch && matchesDept;
  });

  // Filter Finished Products
  const filteredProducts = products.filter(prod => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          prod.variant.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = 
      selectedDept === 'all' || 
      (selectedDept === 'eva' && prod.department_id === 'dept-eva-foam') || 
      (selectedDept === 'konveksi' && prod.department_id === 'dept-konveksi');
    return matchesSearch && matchesDept;
  });

  // Filter Movements
  const filteredMovements = movements.filter(mov => {
    const matchesSearch = mov.item_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          mov.reference.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Handle manual adjustment submission
  const handlePostAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItemId || adjustQty <= 0) {
      alert('Isi item dan jumlah dengan benar!');
      return;
    }

    const currentMovements = dataStore.getStockMovements();
    
    if (adjustType === 'product') {
      const currentProducts = dataStore.getProducts();
      const prod = currentProducts.find(p => p.id === adjustItemId);
      if (!prod) return;

      const type: 'barang_jadi_masuk' | 'barang_jadi_keluar' = adjustDirection === 'in' ? 'barang_jadi_masuk' : 'barang_jadi_keluar';
      const change = adjustDirection === 'in' ? adjustQty : -adjustQty;

      const updatedProducts = currentProducts.map(p => {
        if (p.id === adjustItemId) {
          return { ...p, stock: Math.max(0, p.stock + change) };
        }
        return p;
      });

      currentMovements.unshift({
        id: 'mov-' + Math.random().toString(36).substring(2, 9),
        type,
        item_id: prod.id,
        item_name: prod.name + ` (${prod.variant})`,
        amount: adjustQty,
        reference: adjustRef,
        created_at: new Date().toISOString()
      });

      dataStore.setProducts(updatedProducts);
    } else {
      const currentMaterials = dataStore.getRawMaterials();
      const mat = currentMaterials.find(m => m.id === adjustItemId);
      if (!mat) return;

      const type: 'bahan_masuk' | 'bahan_keluar' = adjustDirection === 'in' ? 'bahan_masuk' : 'bahan_keluar';
      const change = adjustDirection === 'in' ? adjustQty : -adjustQty;

      const updatedMaterials = currentMaterials.map(m => {
        if (m.id === adjustItemId) {
          return { ...m, current_stock: Math.max(0, m.current_stock + change) };
        }
        return m;
      });

      currentMovements.unshift({
        id: 'mov-' + Math.random().toString(36).substring(2, 9),
        type,
        item_id: mat.id,
        item_name: mat.name,
        amount: adjustQty,
        reference: adjustRef,
        created_at: new Date().toISOString()
      });

      dataStore.setRawMaterials(updatedMaterials);
    }

    dataStore.setStockMovements(currentMovements);
    
    // Reset form & reload
    setAdjustItemId('');
    setAdjustQty(0);
    setShowAdjustModal(false);
    alert('Penyesuaian stok manual (Opname) berhasil diposting!');
    loadData();
  };

  const isRestricted = !['owner', 'admin_gudang'].includes(userRole);

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-xl font-bold text-emerald-950 flex items-center gap-2">
            <Archive className="w-5.5 h-5.5 text-evergreen" />
            Sistem Gudang &amp; Inventaris Pabrik
          </h1>
          <p className="text-xs text-gray-400">Pusat kontrol inventaris bahan baku antardivisi, barang jadi hasil produksi, dan rekam audit mutasi stok.</p>
        </div>

        {!isRestricted && (
          <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openCreateModal} className="bg-[var(--color-evergreen)] hover:bg-[var(--color-evergreen-dark)] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer">
            <PackagePlus className="w-4 h-4" /> Tambah Barang Baru
          </button>
          <button
            onClick={() => {
              setAdjustItemId('');
              setAdjustQty(0);
              setAdjustRef('Hasil Stock Opname');
              setShowAdjustModal(true);
            }}
            className="bg-warning-orange hover:bg-warning-orange/90 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Stock Opname (Manual)
          </button>
          </div>
        )}
      </div>

      {/* QUICK STATUS BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Finished Goods */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="bg-evergreen text-white p-3 rounded-xl shadow-2xs">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-emerald-800 tracking-wider">Total Barang Jadi</p>
            <p className="text-lg font-black text-evergreen font-mono">
              {products.reduce((acc, p) => acc + p.stock, 0)} <span className="text-[10px] font-sans font-medium text-gray-500">Unit</span>
            </p>
            <p className="text-[9px] text-gray-400 font-sans mt-0.5">{products.length} Varian Produk</p>
          </div>
        </div>

        {/* Total Raw Materials */}
        <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="bg-amber-600 text-white p-3 rounded-xl shadow-2xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-amber-800 tracking-wider">Bahan Baku Terdaftar</p>
            <p className="text-lg font-black text-amber-950 font-mono">
              {rawMaterials.length} <span className="text-[10px] font-sans font-medium text-gray-500">Jenis</span>
            </p>
            <p className="text-[9px] text-amber-600 font-sans mt-0.5">
              {rawMaterials.filter(m => m.current_stock <= m.stock_minimum).length} jenis di bawah batas minimum!
            </p>
          </div>
        </div>

        {/* Alert Card */}
        <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-4 flex items-center gap-4">
          <div className="bg-rose-600 text-white p-3 rounded-xl shadow-2xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-rose-800 tracking-wider">Sinyal Kritis Stok</p>
            <p className="text-xs font-bold text-rose-950">
              {rawMaterials.filter(m => m.current_stock <= m.stock_minimum).length + products.filter(p => p.stock <= 15).length} Item Butuh Order/Produksi
            </p>
            <p className="text-[9px] text-gray-400 font-sans mt-0.5">Segera tindak lanjuti PO pembelian / perintah produksi.</p>
          </div>
        </div>
      </div>

      {/* FILTER & INTERACTIVE TAB BAR */}
      <div className="no-print bg-white rounded-2xl border border-gray-100 p-4 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 w-fit gap-1 shrink-0">
          <button
            onClick={() => { setActiveTab('bahan'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'bahan' 
                ? 'bg-evergreen text-white shadow-2xs' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            1. Inventaris Bahan Baku
          </button>
          <button
            onClick={() => { setActiveTab('jadi'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'jadi' 
                ? 'bg-evergreen text-white shadow-2xs' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            2. Barang Jadi (Gudang)
          </button>
          <button
            onClick={() => { setActiveTab('mutasi'); setSearchQuery(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'mutasi' 
                ? 'bg-evergreen text-white shadow-2xs' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            3. Log Mutasi Stok
          </button>
        </div>

        {/* Division Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeTab !== 'mutasi' && (
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 text-[10px] font-black shrink-0">
              <button
                onClick={() => setSelectedDept('all')}
                className={`px-2.5 py-1 rounded-md transition-all uppercase cursor-pointer ${selectedDept === 'all' ? 'bg-white text-evergreen font-bold shadow-3xs' : 'text-gray-500'}`}
              >
                Semua Divisi
              </button>
              <button
                onClick={() => setSelectedDept('eva')}
                className={`px-2.5 py-1 rounded-md transition-all uppercase cursor-pointer ${selectedDept === 'eva' ? 'bg-white text-evergreen font-bold shadow-3xs' : 'text-gray-500'}`}
              >
                Eva Foam
              </button>
              <button
                onClick={() => setSelectedDept('konveksi')}
                className={`px-2.5 py-1 rounded-md transition-all uppercase cursor-pointer ${selectedDept === 'konveksi' ? 'bg-white text-evergreen font-bold shadow-3xs' : 'text-gray-500'}`}
              >
                Konveksi
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'bahan' ? "Cari nama bahan baku..." : 
                activeTab === 'jadi' ? "Cari nama barang jadi..." : 
                "Cari mutasi barang/referensi..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-evergreen transition-all"
            />
          </div>
        </div>
      </div>

      {/* RENDER ACTIVE SCREEN */}
      
      {/* 1. INVENTARIS BAHAN BAKU */}
      {activeTab === 'bahan' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-3xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-sm text-emerald-950">Daftar Bahan Baku Pabrik</h2>
              <p className="text-[11px] text-gray-400">Monitoring sirkulasi stok bahan mentah per divisi produksi.</p>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-full font-bold font-mono">
              {filteredMaterials.length} Jenis Bahan
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] border border-evergreen/10">
              <thead>
                <tr className="bg-evergreen text-white font-bold uppercase tracking-wider text-[10px] text-center">
                  <th className="p-3 border-r border-white/10 w-12 text-center">No</th>
                  <th className="p-3 border-r border-white/10 text-left w-36">ID Bahan</th>
                  <th className="p-3 border-r border-white/10 text-left">Nama Bahan Baku</th>
                  <th className="p-3 border-r border-white/10 text-center w-36">Divisi Pengguna</th>
                  <th className="p-3 border-r border-white/10 text-center w-28">Satuan</th>
                  <th className="p-3 border-r border-white/10 text-right w-36">Batas Minimum</th>
                  <th className="p-3 border-r border-white/10 text-right w-40">Stok Berjalan</th>
                  <th className="p-3 text-center w-40">Status Keamanan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 font-mono bg-white">
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-gray-400 italic font-sans">
                      Tidak ditemukan kecocokan data bahan baku pabrik.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map((mat, index) => {
                    const div = getMaterialDivision(mat.id);
                    const isCritical = mat.current_stock <= mat.stock_minimum;
                    return (
                      <tr key={mat.id} className="hover:bg-emerald-50/15 border-b border-emerald-100/30 transition-colors">
                        <td className="p-3 text-center text-gray-500 border-r border-emerald-100/30 font-sans">{index + 1}</td>
                        <td className="p-3 text-gray-400 border-r border-emerald-100/30 font-semibold">{mat.id}</td>
                        <td className="p-3 font-bold text-gray-800 font-sans border-r border-emerald-100/30">{mat.name}</td>
                        <td className="p-3 text-center border-r border-emerald-100/30">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-sans ${
                            div === 'Eva Foam' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {div}
                          </span>
                        </td>
                        <td className="p-3 text-center text-gray-600 border-r border-emerald-100/30 font-sans">{mat.unit}</td>
                        <td className="p-3 text-right text-gray-500 border-r border-emerald-100/30">{mat.stock_minimum}</td>
                        <td className="p-3 text-right font-black border-r border-emerald-100/30 bg-emerald-50/10 text-emerald-950">
                          {mat.current_stock}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {isCritical ? (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-sans animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              Kritis / Reorder
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-sans">
                              <Check className="w-3 h-3" />
                              Aman
                            </span>
                          )}
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

      {/* 2. BARANG JADI (GUDANG) */}
      {activeTab === 'jadi' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-3xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-sm text-emerald-950">Inventaris Barang Jadi (Hasil Produksi)</h2>
              <p className="text-[11px] text-gray-400">Monitoring sisa stok produk yang siap dikirimkan kepada pemesan.</p>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-full font-bold font-mono">
              {filteredProducts.length} Varian Barang
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] border border-evergreen/10">
              <thead>
                <tr className="bg-evergreen text-white font-bold uppercase tracking-wider text-[10px] text-center">
                  <th className="p-3 border-r border-white/10 w-12 text-center">No</th>
                  <th className="p-3 border-r border-white/10 text-left w-36">ID Produk</th>
                  <th className="p-3 border-r border-white/10 text-left">Nama Produk</th>
                  <th className="p-3 border-r border-white/10 text-left w-48">Variant / Warna</th>
                  <th className="p-3 border-r border-white/10 text-center w-36">Divisi Produksi</th>
                  <th className="p-3 border-r border-white/10 text-right w-40">Harga Jual</th>
                  <th className="p-3 border-r border-white/10 text-right w-40">Stok Berjalan</th>
                  <th className="p-3 border-r border-white/10 text-center w-40">Status Keamanan</th>
                  <th className="p-3 text-center w-24">Alur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 font-mono bg-white">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-xs text-gray-400 italic font-sans">
                      Tidak ditemukan kecocokan data produk jadi di gudang.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod, index) => {
                    const isCritical = prod.stock <= 15;
                    return (
                      <tr key={prod.id} className="hover:bg-emerald-50/15 border-b border-emerald-100/30 transition-colors">
                        <td className="p-3 text-center text-gray-500 border-r border-emerald-100/30 font-sans">{index + 1}</td>
                        <td className="p-3 text-gray-400 border-r border-emerald-100/30 font-semibold">{prod.id}</td>
                        <td className="p-3 font-bold text-gray-800 font-sans border-r border-emerald-100/30">{prod.name}</td>
                        <td className="p-3 text-gray-700 font-sans border-r border-emerald-100/30 font-semibold">{prod.variant}</td>
                        <td className="p-3 text-center border-r border-emerald-100/30">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-sans ${
                            prod.department_id === 'dept-eva-foam' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {prod.department_id === 'dept-eva-foam' ? 'Eva Foam' : 'Konveksi'}
                          </span>
                        </td>
                        <td className="p-3 text-right text-gray-700 font-semibold border-r border-emerald-100/30">{formatIDR(prod.harga_jual)}</td>
                        <td className="p-3 text-right font-black border-r border-emerald-100/30 bg-emerald-50/10 text-emerald-950">
                          {prod.stock} Unit
                        </td>
                        <td className="p-3 text-center whitespace-nowrap border-r border-emerald-100/30">
                          {isCritical ? (
                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-850 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-sans animate-pulse">
                              <AlertTriangle className="w-3 h-3" />
                              Stok Menipis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-sans">
                              <Check className="w-3 h-3" />
                              Aman
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => { setStageEditProduct(prod); setStageEditList([...stagesForProduct(prod)]); }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 hover:bg-emerald-50 text-gray-600 rounded text-[9px] font-bold font-sans"
                            title={`Alur sekarang: ${stagesForProduct(prod).join(' \u2192 ')}`}
                          >
                            <ListOrdered className="w-3 h-3" />
                            {prod.production_stages?.length ? `${prod.production_stages.length} Tahap` : 'Bawaan'}
                          </button>
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

      {/* 3. LOG MUTASI STOK */}
      {activeTab === 'mutasi' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-3xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-sm text-emerald-950">Log Perputaran &amp; Mutasi Stok</h2>
              <p className="text-[11px] text-gray-400">Arsip rincian riwayat sirkulasi masuk-keluar bahan baku dan barang jadi.</p>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-full font-bold font-mono">
              {filteredMovements.length} Histori Mutasi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] border border-evergreen/10">
              <thead>
                <tr className="bg-evergreen text-white font-bold uppercase tracking-wider text-[10px] text-center">
                  <th className="p-3 border-r border-white/10 w-12 text-center">No</th>
                  <th className="p-3 border-r border-white/10 text-left w-48">Waktu Transaksi</th>
                  <th className="p-3 border-r border-white/10 text-left">Nama Barang / Bahan</th>
                  <th className="p-3 border-r border-white/10 text-center w-36">Kategori Mutasi</th>
                  <th className="p-3 border-r border-white/10 text-left w-56">Keterangan / Referensi</th>
                  <th className="p-3 text-right w-40">Jumlah Mutasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 font-mono bg-white">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-gray-400 italic font-sans">
                      Tidak ditemukan riwayat mutasi stok.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mov, index) => {
                    const isIncoming = mov.type.includes('masuk');
                    const isProduct = mov.type.includes('barang_jadi');
                    return (
                      <tr key={mov.id} className="hover:bg-emerald-50/15 border-b border-emerald-100/30 transition-colors">
                        <td className="p-3 text-center text-gray-500 border-r border-emerald-100/30 font-sans">{index + 1}</td>
                        <td className="p-3 text-gray-600 border-r border-emerald-100/30 font-mono text-emerald-950 font-bold bg-emerald-50/20 whitespace-nowrap">
                          {formatDateExcel(mov.created_at)}
                        </td>
                        <td className="p-3 font-bold text-gray-800 font-sans border-r border-emerald-100/30">{mov.item_name}</td>
                        <td className="p-3 text-center border-r border-emerald-100/30 font-sans">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            mov.type === 'bahan_masuk' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                            mov.type === 'bahan_keluar' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                            mov.type === 'barang_jadi_masuk' ? 'bg-teal-50 text-teal-850 border border-teal-200' :
                            'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {mov.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-gray-700 font-sans border-r border-emerald-100/30 truncate max-w-[200px]" title={mov.reference}>
                          {mov.reference}
                        </td>
                        <td className="p-3 text-right border-r border-emerald-100/30">
                          <div className="flex justify-end items-center gap-1 font-bold">
                            {isIncoming ? (
                              <span className="text-emerald-700 flex items-center">
                                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                                +{mov.amount}
                              </span>
                            ) : (
                              <span className="text-rose-700 flex items-center">
                                <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                                -{mov.amount}
                              </span>
                            )}
                            <span className="text-[9px] font-normal text-gray-400 uppercase font-sans">
                              {isProduct ? 'Unit' : 'Bahan'}
                            </span>
                          </div>
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

      {/* STOCK OPNAME MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4"><div><h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2"><PackagePlus className="w-4 h-4" /> Tambah Master Barang Baru</h3><p className="text-[10px] text-gray-400 mt-1">Barang baru akan tersedia untuk transaksi gudang dan dicatat pada audit log.</p></div><button type="button" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">✕</button></div>
            <form onSubmit={handleCreateItem} className="space-y-4">
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setNewItemType('material'); setNewItemId(''); }} className={`py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${newItemType === 'material' ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]' : 'border-gray-200 text-gray-600'}`}>Bahan Baku</button><button type="button" onClick={() => { setNewItemType('product'); setNewItemId(''); }} className={`py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${newItemType === 'product' ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]' : 'border-gray-200 text-gray-600'}`}>Barang Jadi</button></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Nama Barang</label><input value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-600" placeholder={newItemType === 'material' ? 'Contoh: Kain Parasut' : 'Contoh: Body Protector'} required /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">ID Barang <span className="normal-case font-normal text-gray-400">(opsional, otomatis jika kosong)</span></label><input value={newItemId} onChange={e => setNewItemId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-600" placeholder={makeItemId(newItemType, newItemName || 'nama-barang')} /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Divisi</label><select value={newDepartmentId} onChange={e => { setNewDepartmentId(e.target.value); if (newItemType === 'product') setNewStages([...(DEFAULT_PRODUCTION_STAGES[e.target.value] || [])]); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white"><option value="dept-eva-foam">Eva Foam</option><option value="dept-konveksi">Konveksi</option></select></div>
              {newItemType === 'material' ? <div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Satuan</label><input value={newUnit} onChange={e => setNewUnit(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" placeholder="Kg, Meter, Lembar" required /></div><div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Batas Minimum</label><input type="number" min="0" value={newMinimumStock || ''} onChange={e => setNewMinimumStock(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" /></div></div> : <><div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Kategori</label><input value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" /></div><div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Varian</label><input value={newVariant} onChange={e => setNewVariant(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" /></div></div><div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Harga Jual</label><input type="number" min="0" value={newPrice || ''} onChange={e => setNewPrice(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" /></div><div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Tahapan Produksi <span className="normal-case font-normal text-gray-400">(urutan cara produk ini dibuat)</span></label><StageListEditor stages={newStages} onChange={setNewStages} compact /></div></>}
              <div><label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Stok Awal</label><input type="number" min="0" value={newInitialStock || ''} onChange={e => setNewInitialStock(Number(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs" /><p className="text-[10px] text-gray-400 mt-1">Jika lebih dari nol, sistem otomatis membuat mutasi stok masuk.</p></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 cursor-pointer">Batal</button><button type="submit" className="flex-1 py-2.5 bg-[var(--color-evergreen)] text-white rounded-xl text-xs font-bold cursor-pointer">Simpan Barang Baru</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edit alur produksi produk existing */}
      {stageEditProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setStageEditProduct(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <ListOrdered className="w-4 h-4" /> Tahapan Produksi
                </h3>
                <p className="text-[10px] text-gray-400 mt-1">
                  {stageEditProduct.name} ({stageEditProduct.variant}) · {stageEditProduct.department_id === 'dept-eva-foam' ? 'Eva Foam' : 'Konveksi'}
                </p>
              </div>
              <button type="button" onClick={() => setStageEditProduct(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <StageListEditor stages={stageEditList} onChange={setStageEditList} />
              <p className="text-[10px] text-gray-400">
                Perubahan alur hanya berlaku untuk order baru — pekerjaan produksi yang sedang berjalan tetap memakai alur lamanya.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setStageEditList([...(DEFAULT_PRODUCTION_STAGES[stageEditProduct.department_id] || [])]); }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 cursor-pointer"
                >
                  Reset ke Bawaan Divisi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (stageEditList.length === 0) { alert('Tahapan produksi wajib diisi minimal satu tahap.'); return; }
                    const updated = dataStore.getProducts().map(p => p.id === stageEditProduct.id ? { ...p, production_stages: stageEditList } : p);
                    dataStore.setProducts(updated);
                    dataStore.logAudit('update', 'product', `Mengubah alur produksi ${stageEditProduct.name}: ${stageEditList.join(' → ')}`, stageEditProduct.id);
                    setStageEditProduct(null);
                    loadData();
                  }}
                  className="flex-1 py-2.5 bg-[var(--color-evergreen)] text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Simpan Alur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-warning-orange" />
                Post Formulir Stock Opname
              </h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handlePostAdjustment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Tipe Inventaris</label>
                  <select
                    value={adjustType}
                    onChange={(e) => { setAdjustType(e.target.value as any); setAdjustItemId(''); }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 font-sans focus:outline-none"
                  >
                    <option value="material">Bahan Baku</option>
                    <option value="product">Barang Jadi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Arah Koreksi</label>
                  <select
                    value={adjustDirection}
                    onChange={(e) => setAdjustDirection(e.target.value as any)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 font-sans focus:outline-none"
                  >
                    <option value="in">Penambahan (+)</option>
                    <option value="out">Pengurangan (-)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Pilih Barang / Bahan</label>
                <select
                  value={adjustItemId}
                  onChange={(e) => setAdjustItemId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Item --</option>
                  {adjustType === 'product' ? (
                    products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.variant}) [Aktif: {p.stock} Unit]</option>)
                  ) : (
                    rawMaterials.map(m => <option key={m.id} value={m.id}>{m.name} [Aktif: {m.current_stock} {m.unit}]</option>)
                  )}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Jumlah Unit</label>
                  <input
                    type="number"
                    min={1}
                    value={adjustQty || ''}
                    onChange={(e) => setAdjustQty(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 focus:outline-none"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Keterangan / Alasan Opname</label>
                  <input
                    type="text"
                    value={adjustRef}
                    onChange={(e) => setAdjustRef(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 font-sans focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-warning-orange hover:bg-warning-orange/90 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Posting Opname
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
