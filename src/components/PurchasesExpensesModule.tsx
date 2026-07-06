import React, { useState, useEffect } from 'react';
import { Purchase, PurchaseOrderItem, DailyExpense, RawMaterial } from '../types';
import { dataStore } from '../dataStore';
import { 
  ShoppingCart, 
  Plus, 
  Calendar, 
  DollarSign, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  Download, 
  TrendingDown, 
  ArrowUpDown, 
  User, 
  FileSpreadsheet,
  Tag,
  Printer,
  FileText,
  CheckCircle2,
  Copy,
  AlertCircle,
  Clock,
  Eye,
  Info,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export const PurchasesExpensesModule: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);

  // PO Form states
  const [poSupplier, setPoSupplier] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [poStatus, setPoStatus] = useState<'pending' | 'completed' | 'cancelled'>('completed');
  const [poStaff, setPoStaff] = useState('Admin Keuangan');
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  // PO Item Drafting states
  const [draftItems, setDraftItems] = useState<Omit<PurchaseOrderItem, 'id' | 'subtotal'>[]>([]);
  const [itemMaterialId, setItemMaterialId] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemPrice, setItemPrice] = useState<number>(0);

  // Selected PO for Master-Detail Invoice View
  const [selectedPoId, setSelectedPoId] = useState<string>('');

  // Expense states
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseCategory, setExpenseCategory] = useState('Lain-lain / Overhead');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseQty, setExpenseQty] = useState<number>(1);
  const [expensePrice, setExpensePrice] = useState<number>(0);
  const [expenseStaff, setExpenseStaff] = useState('Admin Keuangan');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // General Filter & Search states
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'purchase' | 'expense' } | null>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'purchases'>('purchases');
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [poViewMode, setPoViewMode] = useState<'spreadsheet' | 'interactive'>('spreadsheet');
  
  // Search & Filter
  const [poSearch, setPoSearch] = useState('');
  const [poSupplierFilter, setPoSupplierFilter] = useState('All');
  const [poMonthFilter, setPoMonthFilter] = useState('All');
  const [poSortOrder, setPoSortOrder] = useState<'asc' | 'desc'>('desc');

  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('All');
  const [expenseMonthFilter, setExpenseMonthFilter] = useState('All');
  const [expenseSortOrder, setExpenseSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener('nxty_storage_change', handleStorageChange);
    return () => window.removeEventListener('nxty_storage_change', handleStorageChange);
  }, []);

  useEffect(() => {
    if (editingPurchaseId) setIsPoModalOpen(true);
  }, [editingPurchaseId]);

  useEffect(() => {
    if (editingExpenseId) setIsExpenseModalOpen(true);
  }, [editingExpenseId]);

  const loadData = () => {
    const allPurchases = dataStore.getPurchases();
    setPurchases(allPurchases);
    setExpenses(dataStore.getDailyExpenses());
    setExpenseCategories(dataStore.getExpenseCategories());
    setRawMaterials(dataStore.getRawMaterials());

    if (allPurchases.length > 0 && !selectedPoId) {
      setSelectedPoId(allPurchases[0].id);
    }
  };

  // Auto-generate PO Number based on supplier name & date
  const handleAutoGeneratePONumber = () => {
    if (!poSupplier) {
      alert('Tentukan Nama Supplier terlebih dahulu untuk generate No. PO!');
      return;
    }
    const initials = poSupplier
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
    const dateObj = new Date(poDate);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear()).substring(2);
    const randomSeq = Math.floor(10 + Math.random() * 90); // 2 digit random sequence
    
    // Output matches: DD/INITIALS/SEQ/YY e.g. 08/TA/14/26
    setPoNumber(`${day}/${initials || 'PO'}/${randomSeq}/${year}`);
  };

  // Trigger when raw material is selected in item editor
  const handleMaterialChange = (id: string) => {
    setItemMaterialId(id);
    if (id === 'custom') {
      setItemDescription('');
    } else {
      const selectedMat = rawMaterials.find(m => m.id === id);
      if (selectedMat) {
        setItemDescription(selectedMat.name);
      }
    }
  };

  // Add item draft to PO
  const handleAddDraftItem = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!itemDescription.trim() || itemQty <= 0 || itemPrice <= 0) {
      alert('Isi deskripsi barang, jumlah qty, dan harga satuan dengan benar!');
      return;
    }

    setDraftItems(prev => [
      ...prev,
      {
        description: itemDescription.trim(),
        qty: itemQty,
        price: itemPrice,
        material_id: itemMaterialId && itemMaterialId !== 'custom' ? itemMaterialId : undefined
      }
    ]);

    // Reset item input
    setItemMaterialId('');
    setItemDescription('');
    setItemQty(1);
    setItemPrice(0);
  };

  // Remove draft item
  const handleRemoveDraftItem = (index: number) => {
    setDraftItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Adjust stock levels in dataStore for linked materials.
  // Stok hanya bergerak untuk PO berstatus 'completed' (barang sudah diterima gudang);
  // PO pending/cancelled tidak menyentuh stok.
  const adjustStockForPO = (po: Purchase, action: 'add' | 'remove') => {
    if (po.status !== 'completed') return;
    const currentMaterials = dataStore.getRawMaterials();
    const movements = dataStore.getStockMovements();
    let updatedMaterials = [...currentMaterials];
    let stockChanged = false;

    po.items.forEach(item => {
      if (item.material_id) {
        // Adding PO adds stock; removing PO subtracts stock
        const qtyToAdjust = action === 'add' ? item.qty : -item.qty;
        updatedMaterials = updatedMaterials.map(m => {
          if (m.id === item.material_id) {
            stockChanged = true;
            return { ...m, current_stock: Math.max(0, m.current_stock + qtyToAdjust) };
          }
          return m;
        });

        if (action === 'add') {
          movements.unshift({
            id: Math.random().toString(36).substring(2, 9),
            type: 'bahan_masuk',
            item_id: item.material_id,
            item_name: item.description,
            amount: item.qty,
            reference: `PO #${po.po_number} - Supplier: ${po.supplier}`,
            created_at: new Date().toISOString()
          });
        }
      }
    });

    if (stockChanged) {
      dataStore.setRawMaterials(updatedMaterials);
      dataStore.setStockMovements(movements);
      setRawMaterials(updatedMaterials);
    }
  };

  // Post the entire Purchase Order (Add / Edit)
  const handlePostPurchaseOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplier.trim() || draftItems.length === 0) {
      alert('Tentukan Supplier dan masukkan minimal 1 barang dalam PO ini!');
      return;
    }

    const finalPoNumber = poNumber.trim() || 'PO-' + Math.floor(1000 + Math.random() * 9000);
    const calculatedTotal = draftItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const currentPurchases = dataStore.getPurchases();

    if (editingPurchaseId) {
      // Find original to revert inventory stock
      const original = currentPurchases.find(p => p.id === editingPurchaseId);
      if (original) {
        adjustStockForPO(original, 'remove');
      }

      // Update purchase record
      const updatedPurchases = currentPurchases.map(p => {
        if (p.id === editingPurchaseId) {
          const updatedPo: Purchase = {
            ...p,
            supplier: poSupplier.trim(),
            po_number: finalPoNumber,
            date: poDate,
            status: poStatus,
            admin_staff: poStaff,
            total_price: calculatedTotal,
            items: draftItems.map(item => ({
              id: Math.random().toString(36).substring(2, 9),
              ...item,
              subtotal: item.qty * item.price
            }))
          };
          
          // Re-apply stock levels
          adjustStockForPO(updatedPo, 'add');
          return updatedPo;
        }
        return p;
      });

      dataStore.setPurchases(updatedPurchases);
      setPurchases(updatedPurchases);
      setEditingPurchaseId(null);
      alert('Purchase Order berhasil diperbarui! Stok inventory telah disesuaikan.');
    } else {
      // Create new Purchase Order
      const newPo: Purchase = {
        id: Math.random().toString(36).substring(2, 9),
        po_number: finalPoNumber,
        supplier: poSupplier.trim(),
        date: poDate,
        status: poStatus,
        admin_staff: poStaff,
        total_price: calculatedTotal,
        items: draftItems.map(item => ({
          id: Math.random().toString(36).substring(2, 9),
          ...item,
          subtotal: item.qty * item.price
        }))
      };

      currentPurchases.unshift(newPo);
      dataStore.setPurchases(currentPurchases);
      setPurchases(currentPurchases);
      setSelectedPoId(newPo.id);

      // Apply stock levels
      adjustStockForPO(newPo, 'add');
      alert(newPo.status === 'completed'
        ? 'Purchase Order berhasil diterbitkan! Barang diterima — stok gudang bertambah otomatis untuk bahan baku terlink.'
        : 'Purchase Order berhasil diterbitkan! Stok gudang akan bertambah otomatis saat status PO diubah menjadi Selesai/Diterima.');
    }

    // Reset Form Fields
    setPoSupplier('');
    setPoNumber('');
    setPoDate(new Date().toISOString().split('T')[0]);
    setDraftItems([]);
    loadData();
    setIsPoModalOpen(false);
  };

  const handleStartEditPurchase = (po: Purchase) => {
    setEditingPurchaseId(po.id);
    setActiveTab('purchases');
    setPoSupplier(po.supplier);
    setPoNumber(po.po_number);
    setPoDate(po.date);
    setPoStatus(po.status);
    setPoStaff(po.admin_staff || 'Admin Keuangan');
    setDraftItems(po.items.map(item => ({
      description: item.description,
      qty: item.qty,
      price: item.price,
      material_id: item.material_id
    })));
  };

  const handleCancelEditPurchase = () => {
    setEditingPurchaseId(null);
    setPoSupplier('');
    setPoNumber('');
    setPoDate(new Date().toISOString().split('T')[0]);
    setDraftItems([]);
  };

  const handleDeletePurchase = (id: string) => {
    const currentPurchases = dataStore.getPurchases();
    const poToDelete = currentPurchases.find(p => p.id === id);
    if (!poToDelete) return;

    // Revert inventory stocks
    adjustStockForPO(poToDelete, 'remove');
    
    const updated = currentPurchases.filter(p => p.id !== id);
    dataStore.setPurchases(updated);
    setPurchases(updated);
    
    if (selectedPoId === id && updated.length > 0) {
      setSelectedPoId(updated[0].id);
    }

    alert('Purchase Order berhasil dibatalkan & dihapus dari sistem!');
    loadData();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'purchase') handleDeletePurchase(deleteTarget.id);
    else handleDeleteExpense(deleteTarget.id);
    setDeleteTarget(null);
  };

  // Handle Expenses Actions
  const handlePostExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (expensePrice <= 0 || expenseQty <= 0 || !expenseDesc.trim() || !expenseCategory.trim()) {
      alert('Lengkapi kategori, nama pengeluaran, qty, dan harga dengan benar!');
      return;
    }

    const computedSubtotal = expenseQty * expensePrice;
    const currentExpenses = dataStore.getDailyExpenses();

    if (editingExpenseId) {
      const updated = currentExpenses.map(item => {
        if (item.id === editingExpenseId) {
          return {
            ...item,
            date: expenseDate,
            category: expenseCategory,
            description: expenseDesc.trim(),
            amount: computedSubtotal,
            qty: expenseQty,
            price: expensePrice,
            admin_name: expenseStaff
          };
        }
        return item;
      });
      dataStore.setDailyExpenses(updated);
      setEditingExpenseId(null);
      alert('Catatan pengeluaran harian berhasil diperbarui!');
    } else {
      const newExpense: DailyExpense = {
        id: Math.random().toString(36).substring(2, 9),
        date: expenseDate,
        category: expenseCategory,
        description: expenseDesc.trim(),
        amount: computedSubtotal,
        qty: expenseQty,
        price: expensePrice,
        admin_name: expenseStaff
      };
      currentExpenses.unshift(newExpense);
      dataStore.setDailyExpenses(currentExpenses);
      alert('Pengeluaran harian berhasil dicatatkan!');
    }

    setExpenseDesc('');
    setExpenseQty(1);
    setExpensePrice(0);
    loadData();
    setIsExpenseModalOpen(false);
  };

  const handleAddExpenseCategory = () => {
    const name = newCategoryName.trim().replace(/\s+/g, ' ');
    if (!name) return alert('Nama kategori wajib diisi.');
    const current = dataStore.getExpenseCategories();
    const existing = current.find(item => item.toLowerCase() === name.toLowerCase());
    if (existing) {
      setExpenseCategory(existing);
      setShowNewCategoryInput(false);
      setNewCategoryName('');
      return alert('Kategori tersebut sudah tersedia.');
    }
    const updated = [...current, name].sort((a, b) => a.localeCompare(b, 'id'));
    dataStore.setExpenseCategories(updated);
    dataStore.logAudit('create', 'expense_category', `Menambahkan kategori pengeluaran: ${name}`, name);
    setExpenseCategories(updated);
    setExpenseCategory(name);
    setShowNewCategoryInput(false);
    setNewCategoryName('');
  };

  const handleStartEditExpense = (e: DailyExpense) => {
    setEditingExpenseId(e.id);
    setActiveTab('expenses');
    setExpenseDate(e.date);
    setExpenseCategory(e.category);
    setExpenseDesc(e.description);
    setExpenseQty(e.qty || 1);
    setExpensePrice(e.price || e.amount);
    setExpenseStaff(e.admin_name);
  };

  const handleCancelEditExpense = () => {
    setEditingExpenseId(null);
    setExpenseDesc('');
    setExpenseQty(1);
    setExpensePrice(0);
  };

  const handleDeleteExpense = (id: string) => {
    const currentExpenses = dataStore.getDailyExpenses();
    const updated = currentExpenses.filter(e => e.id !== id);
    dataStore.setDailyExpenses(updated);
    alert('Catatan pengeluaran harian berhasil dihapus!');
    loadData();
  };

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

  const formatIndonesianMonth = (monthStr: string) => {
    if (!monthStr || monthStr === 'All') return 'Semua Bulan';
    const [year, month] = monthStr.split('-');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
  };

  // Dynamic PO Calculation & Filtering
  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.supplier.toLowerCase().includes(poSearch.toLowerCase()) || 
                          p.po_number.toLowerCase().includes(poSearch.toLowerCase()) ||
                          p.items.some(item => item.description.toLowerCase().includes(poSearch.toLowerCase()));
    const matchesSupplier = poSupplierFilter === 'All' || p.supplier === poSupplierFilter;
    const matchesMonth = poMonthFilter === 'All' || p.date.startsWith(poMonthFilter);
    return matchesSearch && matchesSupplier && matchesMonth;
  });

  const sortedPurchases = [...filteredPurchases].sort((a, b) => {
    return poSortOrder === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });

  // Flat spreadsheet mapping of POs with parent metadata for clean Excel rowspan merges
  interface SpreadsheetPOItemRow {
    poId: string;
    poNumber: string;
    supplier: string;
    date: string;
    status: string;
    adminStaff: string;
    totalPOPrice: number;
    itemIdx: number;
    itemId: string;
    itemDescription: string;
    itemQty: number;
    itemPrice: number;
    itemSubtotal: number;
  }

  const spreadsheetRows: SpreadsheetPOItemRow[] = [];
  sortedPurchases.forEach(po => {
    po.items.forEach((item, idx) => {
      spreadsheetRows.push({
        poId: po.id,
        poNumber: po.po_number,
        supplier: po.supplier,
        date: po.date,
        status: po.status,
        adminStaff: po.admin_staff || 'Admin',
        totalPOPrice: po.total_price,
        itemIdx: idx,
        itemId: item.id,
        itemDescription: item.description,
        itemQty: item.qty,
        itemPrice: item.price,
        itemSubtotal: item.subtotal
      });
    });
  });

  // Daily Expenses Calculation & Filtering
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description.toLowerCase().includes(expenseSearch.toLowerCase()) || 
                          e.category.toLowerCase().includes(expenseSearch.toLowerCase()) ||
                          e.admin_name.toLowerCase().includes(expenseSearch.toLowerCase());
    const matchesCategory = expenseCategoryFilter === 'All' || e.category === expenseCategoryFilter;
    const matchesMonth = expenseMonthFilter === 'All' || e.date.startsWith(expenseMonthFilter);
    return matchesSearch && matchesCategory && matchesMonth;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    return expenseSortOrder === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });

  // Group sorted expenses by date to replicate Excel merging
  interface ExpenseGroup {
    date: string;
    items: DailyExpense[];
    total: number;
  }

  const groupedExpensesList: ExpenseGroup[] = [];
  sortedExpenses.forEach(item => {
    let group = groupedExpensesList.find(g => g.date === item.date);
    if (!group) {
      group = { date: item.date, items: [], total: 0 };
      groupedExpensesList.push(group);
    }
    group.items.push(item);
    group.total += item.amount;
  });

  // Totals for KPIs
  const totalPurchaseCost = purchases.reduce((sum, p) => sum + p.total_price, 0);
  const totalExpenseCost = expenses.reduce((sum, e) => sum + e.amount, 0);
  const activeSelectedPo = purchases.find(p => p.id === selectedPoId) || purchases[0];

  // Gabungkan master kategori dengan kategori historis agar data impor/lama tetap dapat difilter dan diedit.
  const categoriesList = Array.from(new Set([...expenseCategories, ...expenses.map(item => item.category)]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'id'));

  const supplierList = Array.from(new Set(purchases.map(p => p.supplier))).sort();
  const availablePoMonths = Array.from(new Set(purchases.map(p => p.date.substring(0, 7)))).sort().reverse() as string[];
  const availableExpenseMonths = Array.from(new Set(expenses.map(e => e.date.substring(0, 7)))).sort().reverse() as string[];

  // Share / Copy PO Summary Text
  const handleCopyPoSummary = (po: Purchase) => {
    if (!po) return;
    const itemsText = po.items.map((item, idx) => `${idx + 1}. ${item.description} - Qty: ${item.qty} Pcs @ ${formatIDR(item.price)} = ${formatIDR(item.subtotal)}`).join('\n');
    const text = `PURCHASE ORDER ARI SPORTINDO\n---------------------------------\nNo PO: ${po.po_number}\nTanggal: ${formatDateExcel(po.date)}\nSupplier: ${po.supplier}\nStaf: ${po.admin_staff || 'Admin'}\nStatus: ${po.status.toUpperCase()}\n\nDetail Barang:\n${itemsText}\n---------------------------------\nTOTAL: ${formatIDR(po.total_price)}`;
    navigator.clipboard.writeText(text);
    alert('Detail Purchase Order disalin ke papan klip!');
  };

  // Export spreadsheet row to CSV
  const handleExportPoCSV = () => {
    const headers = ['NO', 'Tanggal', 'No PO', 'Supplier', 'Deskripsi Barang', 'QTY', 'Harga Satuan', 'Subtotal', 'Grand Total PO', 'Status', 'Staff'];
    const rows: string[][] = [];

    sortedPurchases.forEach((po) => {
      po.items.forEach((item, idx) => {
        rows.push([
          (idx + 1).toString(),
          formatDateExcel(po.date),
          po.po_number,
          po.supplier,
          item.description,
          item.qty.toString(),
          item.price.toString(),
          item.subtotal.toString(),
          idx === 0 ? po.total_price.toString() : '',
          po.status,
          po.admin_staff || 'Admin'
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PO_ARI_Sportindo_Spreadsheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* MODULE HEADER AND TAB SWITCHER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-800/20 pb-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 rounded-lg text-emerald-700 border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-black text-emerald-900 font-sans tracking-tight">PO & Pengeluaran Kas</h1>
              <p className="text-xs text-emerald-800/60">Pembelian barang/PO dengan template Excel dan pencatatan kas keluar operasional harian</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsPoModalOpen(true)}
              className="bg-emerald-800 hover:bg-emerald-950 text-white font-bold py-2 px-4 rounded-xl transition-all flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              Terbitkan PO Baru
            </button>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="bg-emerald-800 hover:bg-emerald-950 text-white font-bold py-2 px-4 rounded-xl transition-all flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              Catat Pengeluaran Baru
            </button>
          </div>
        </div>
        
        {/* TAB CONTROLLERS - EVERGREEN SHIFT */}
        <div className="flex bg-emerald-950/5 p-1 rounded-xl text-xs font-semibold self-start md:self-auto shadow-inner border border-emerald-800/10">
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'purchases' ? 'bg-emerald-800 text-white shadow-xs border border-emerald-950' : 'text-emerald-800/70 hover:text-emerald-950 hover:bg-emerald-50/40'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Purchase Orders (PO)
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'expenses' ? 'bg-emerald-800 text-white shadow-xs border border-emerald-950' : 'text-emerald-800/70 hover:text-emerald-950 hover:bg-emerald-50/40'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Pengeluaran Harian
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS (KPI BREAKDOWNS) - EVERGREEN LINES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-emerald-800/20 p-5 rounded-2xl shadow-xs hover:shadow-sm hover:border-emerald-800/45 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform"></div>
          <span className="text-[10px] text-emerald-800/60 font-bold uppercase tracking-wider block">Total Pembelian PO</span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-xl font-black text-emerald-800 font-mono tracking-tight">{formatIDR(totalPurchaseCost)}</span>
          </div>
          <p className="text-[10px] text-emerald-800/50 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" /> {purchases.length} Dokumen PO diterbitkan
          </p>
        </div>

        <div className="bg-white border border-emerald-800/20 p-5 rounded-2xl shadow-xs hover:shadow-sm hover:border-emerald-800/45 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full -mr-6 -mt-6 group-hover:scale-110 transition-transform"></div>
          <span className="text-[10px] text-emerald-800/60 font-bold uppercase tracking-wider block">Total Pengeluaran Kas</span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-xl font-black text-rose-700 font-mono tracking-tight">{formatIDR(totalExpenseCost)}</span>
          </div>
          <p className="text-[10px] text-emerald-800/50 mt-2 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-rose-500 inline" /> {expenses.length} Transaksi operasional tercatat
          </p>
        </div>

        <div className="bg-white border border-emerald-800/20 p-5 rounded-2xl shadow-xs hover:shadow-sm hover:border-emerald-800/45 transition-all relative overflow-hidden">
          <span className="text-[10px] text-emerald-800/60 font-bold uppercase tracking-wider block">Supplier Terbanyak PO</span>
          <div className="mt-2.5">
            {purchases.length > 0 ? (
              (() => {
                // Find top supplier
                const counts: Record<string, number> = {};
                purchases.forEach(p => { counts[p.supplier] = (counts[p.supplier] || 0) + p.total_price; });
                const topSupplier = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                return (
                  <div>
                    <span className="text-sm font-black text-emerald-950 truncate block">{topSupplier[0]}</span>
                    <span className="text-xs font-semibold text-emerald-700 font-mono">{formatIDR(topSupplier[1])}</span>
                  </div>
                );
              })()
            ) : (
              <span className="text-xs text-emerald-800/40 italic">Belum ada PO</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-emerald-800/20 p-5 rounded-2xl shadow-xs hover:shadow-sm hover:border-emerald-800/45 transition-all relative overflow-hidden">
          <span className="text-[10px] text-emerald-800/60 font-bold uppercase tracking-wider block">Status Berkas PO</span>
          <div className="flex items-center gap-3 mt-3">
            <div className="text-center">
              <span className="block text-xs font-black text-emerald-600 font-mono">
                {purchases.filter(p => p.status === 'completed').length}
              </span>
              <span className="text-[9px] text-emerald-800/50 font-semibold uppercase block">Selesai</span>
            </div>
            <div className="w-px h-6 bg-emerald-800/10"></div>
            <div className="text-center">
              <span className="block text-xs font-black text-amber-500 font-mono">
                {purchases.filter(p => p.status === 'pending').length}
              </span>
              <span className="text-[9px] text-emerald-800/50 font-semibold uppercase block">Pending</span>
            </div>
            <div className="w-px h-6 bg-emerald-800/10"></div>
            <div className="text-center">
              <span className="block text-xs font-black text-emerald-800/40 font-mono">
                {purchases.filter(p => p.status === 'cancelled').length}
              </span>
              <span className="text-[9px] text-emerald-800/50 font-semibold uppercase block">Batal</span>
            </div>
          </div>
        </div>
      </div>

        {/* CORE CONTENT */}
        <div className="space-y-6">
        
        {/* DATA VIEWER */}
        <div className="space-y-4">
          
          {/* PO MODAL */}
          {isPoModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={() => setIsPoModalOpen(false)}>
              <div className="bg-white rounded-2xl p-4 sm:p-6 w-full max-w-5xl max-h-[94vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-emerald-800/10 pb-3 flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-emerald-950">
                    {editingPurchaseId ? 'Edit Purchase Order' : 'Terbitkan PO Baru'}
                  </h3>
                  <button onClick={() => setIsPoModalOpen(false)} className="text-emerald-500 hover:text-emerald-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handlePostPurchaseOrder} className="text-xs">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start">
                  <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Nama Supplier / Vendor *</label>
                    <input
                      type="text"
                      value={poSupplier}
                      onChange={(e) => setPoSupplier(e.target.value)}
                      placeholder="Contoh: Toko anyar, PT Sumber Busaindo"
                      className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-3 py-2 focus:bg-white focus:border-emerald-700 focus:outline-none font-semibold text-emerald-950 transition-colors"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Tanggal Transaksi *</label>
                      <input
                        type="date"
                        value={poDate}
                        onChange={(e) => setPoDate(e.target.value)}
                        className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-3 py-1.5 focus:bg-white focus:border-emerald-700 focus:outline-none text-emerald-950 font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">No. PO (Kode Referensi)</label>
                      <input
                        type="text"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder="Contoh: 08/TA/14/26"
                        className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-3 py-1.5 focus:bg-white focus:border-emerald-700 focus:outline-none font-mono font-bold text-emerald-950 placeholder-emerald-800/30"
                      />
                    </div>
                  </div>

                  {/* ITEM DRAFT EDITOR BLOCK */}
                  <div className="bg-emerald-50/15 p-3.5 rounded-xl border border-emerald-800/20 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-emerald-800/20 pb-1.5">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5 text-emerald-700" /> Input Item PO
                      </span>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-emerald-800/60 uppercase mb-1">Link ke Inventory (Opsional)</label>
                      <select
                        value={itemMaterialId}
                        onChange={(e) => handleMaterialChange(e.target.value)}
                        className="w-full bg-white border border-emerald-800/25 rounded-md py-1.5 px-2 focus:outline-none focus:border-emerald-700 text-emerald-950 font-medium cursor-pointer"
                      >
                        <option value="">-- Tidak Terlink (Bukan Bahan Baku) --</option>
                        {rawMaterials.map(m => (
                          <option key={m.id} value={m.id}>{m.name} (Stok: {m.current_stock} {m.unit})</option>
                        ))}
                        <option value="custom">-- Tulis Nama Barang Kustom --</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-emerald-800/60 uppercase mb-1">Nama Barang / Deskripsi *</label>
                      <input
                        type="text"
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        placeholder="Contoh: Liverpool hitam, Condura, Benang rajut"
                        className="w-full bg-white border border-emerald-800/25 rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-700 text-emerald-950 font-semibold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[9px] font-bold text-emerald-800/60 uppercase mb-1">Qty (Jumlah)</label>
                        <input
                          type="number"
                          min={1}
                          value={itemQty || ''}
                          onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value, 10) || 0))}
                          className="w-full bg-white border border-emerald-800/25 rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-700 text-right font-mono font-bold text-emerald-950"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-emerald-800/60 uppercase mb-1">Harga Satuan (IDR)</label>
                        <input
                          type="number"
                          min={0}
                          value={itemPrice || ''}
                          onChange={(e) => setItemPrice(parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-white border border-emerald-800/25 rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-700 text-right font-mono font-bold text-emerald-800"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDraftItem}
                      className="w-full bg-emerald-800 hover:bg-emerald-950 text-white rounded-md py-1.5 font-bold transition-all text-[11px] flex items-center justify-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Sisipkan Barang ke Draft PO
                    </button>
                  </div>

                  </div>
                  <div className="space-y-4 lg:border-l lg:border-emerald-800/10 lg:pl-6">

                  {/* LIST OF DRAFTED PO ITEMS */}
                  <div className="space-y-2">
                    <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Daftar Item Draft PO ({draftItems.length})</span>
                    {draftItems.length === 0 ? (
                      <div className="text-center py-4 bg-emerald-50/5 border border-dashed border-emerald-800/20 rounded-xl text-emerald-800/50 italic">
                        Belum ada barang dimasukkan ke PO ini.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {draftItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-emerald-50/20 border border-emerald-100 p-2 rounded-lg text-[10px]">
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="font-bold text-emerald-950 block truncate">{item.description}</span>
                              <span className="text-emerald-800/60 font-mono">
                                {item.qty} Pcs x {formatIDR(item.price)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-800 font-mono">{formatIDR(item.qty * item.price)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftItem(idx)}
                                className="text-rose-600 hover:text-rose-800 p-0.5 rounded hover:bg-rose-50 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PO Header Metadata */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Status PO</label>
                      <select
                        value={poStatus}
                        onChange={(e) => setPoStatus(e.target.value as any)}
                        className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none text-emerald-950 font-bold cursor-pointer"
                      >
                        <option value="completed">Completed (Diterima)</option>
                        <option value="pending">Pending (Menunggu)</option>
                        <option value="cancelled">Cancelled (Batal)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Staf Pembuat PO</label>
                      <input
                        type="text"
                        value={poStaff}
                        onChange={(e) => setPoStaff(e.target.value)}
                        placeholder="Nama admin"
                        className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none text-emerald-950 font-semibold"
                        required
                      />
                    </div>
                  </div>

                  {/* PO Live Total sum */}
                  <div className="bg-emerald-950 text-emerald-50 rounded-xl p-3.5 flex justify-between items-center shadow-inner">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Total Biaya PO:</span>
                    <span className="font-mono font-black text-base text-white">
                      {formatIDR(draftItems.reduce((sum, item) => sum + (item.qty * item.price), 0))}
                    </span>
                  </div>

                  <button type="submit" className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-3 rounded-lg shadow-sm transition-all text-sm">
                    {editingPurchaseId ? 'Simpan Perubahan' : 'Posting & Terbitkan PO'}
                  </button>
                  </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EXPENSE MODAL */}
          {isExpenseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsExpenseModalOpen(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="border-b border-emerald-800/10 pb-3 flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-emerald-950">
                    {editingExpenseId ? 'Edit Catatan Pengeluaran' : 'Catat Kas Keluar'}
                  </h3>
                  <button onClick={() => setIsExpenseModalOpen(false)} className="text-emerald-500 hover:text-emerald-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handlePostExpense} className="grid grid-cols-2 gap-4 text-xs">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Tanggal</label>
                    <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-3 py-2 font-sans focus:bg-white focus:border-emerald-700 focus:outline-none font-semibold text-emerald-950" required />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Kategori</label>
                    <div className="flex gap-1.5"><select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} className="min-w-0 flex-1 bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-3 py-2 focus:bg-white focus:border-emerald-700 focus:outline-none font-semibold text-emerald-950 cursor-pointer" required>
                      {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select><button type="button" onClick={() => setShowNewCategoryInput(value => !value)} className="shrink-0 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-800/20 hover:bg-emerald-100 cursor-pointer" title="Tambah kategori baru"><Plus className="w-4 h-4" /></button></div>
                  </div>
                  {showNewCategoryInput && <div className="col-span-2 bg-emerald-50/30 border border-emerald-800/15 rounded-xl p-3"><label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Kategori Baru</label><div className="flex gap-2"><input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddExpenseCategory(); } }} placeholder="Contoh: ATK & Perlengkapan Kantor" className="min-w-0 flex-1 bg-white border border-emerald-800/25 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-700 font-semibold text-emerald-950" autoFocus /><button type="button" onClick={handleAddExpenseCategory} className="bg-emerald-800 text-white px-4 rounded-lg font-bold cursor-pointer">Tambah</button></div></div>}
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Nama Barang / Pengeluaran</label>
                    <input type="text" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} placeholder="Contoh: Galon air" className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-3 py-2 focus:bg-white focus:border-emerald-700 focus:outline-none font-semibold text-emerald-950" required />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Qty</label>
                    <input type="number" min={1} value={expenseQty || ''} onChange={(e) => setExpenseQty(Math.max(1, parseInt(e.target.value, 10) || 0))} className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-3 py-2 font-mono focus:bg-white focus:border-emerald-700 focus:outline-none text-right font-bold text-emerald-950" required />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Harga Satuan (IDR)</label>
                    <input type="number" min={0} value={expensePrice || ''} onChange={(e) => setExpensePrice(parseInt(e.target.value, 10) || 0)} className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-3 py-2 font-mono focus:bg-white focus:border-emerald-700 focus:outline-none text-right font-bold text-emerald-950" required />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Staf Penginput</label>
                    <input type="text" value={expenseStaff} onChange={(e) => setExpenseStaff(e.target.value)} placeholder="Nama admin" className="w-full bg-emerald-50/15 border border-emerald-800/25 rounded-lg px-3 py-2 focus:bg-white focus:border-emerald-700 focus:outline-none font-semibold text-emerald-950" required />
                  </div>
                  <button type="submit" className="col-span-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-3 rounded-lg shadow-sm transition-all text-sm">
                    {editingExpenseId ? 'Simpan Perubahan' : 'Posting Kas Keluar'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 1: PURCHASE ORDER VIEWER GRID */}
          {activeTab === 'purchases' && (
            <div className="space-y-4">
              
              {/* Controls Header (Toggle ViewMode, Excel Export, Filter Supplier, Search) */}
              <div className="bg-white rounded-2xl border border-emerald-800/20 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                
                {/* Search, Filter Supplier, Month */}
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  
                  {/* Search PO */}
                  <div className="relative flex-1 min-w-[150px] max-w-[220px]">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-emerald-700/50" />
                    <input
                      type="text"
                      placeholder="Cari PO, supplier, barang..."
                      value={poSearch}
                      onChange={(e) => setPoSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-full bg-emerald-50/15 border border-emerald-800/20 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-emerald-700 text-emerald-950 font-semibold transition-colors"
                    />
                  </div>

                  {/* Supplier filter */}
                  <select
                    value={poSupplierFilter}
                    onChange={(e) => setPoSupplierFilter(e.target.value)}
                    className="bg-emerald-50/15 border border-emerald-800/20 rounded-lg py-1.5 px-2.5 text-xs text-emerald-800/80 focus:outline-none focus:border-emerald-700 font-bold cursor-pointer"
                  >
                    <option value="All">Semua Supplier</option>
                    {supplierList.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>

                  {/* Month filter */}
                  <select
                    value={poMonthFilter}
                    onChange={(e) => setPoMonthFilter(e.target.value)}
                    className="bg-emerald-50/15 border border-emerald-800/20 rounded-lg py-1.5 px-2.5 text-xs text-emerald-800/80 focus:outline-none focus:border-emerald-700 font-bold cursor-pointer"
                  >
                    <option value="All">Semua Bulan</option>
                    {availablePoMonths.map(month => (
                      <option key={month} value={month}>{formatIndonesianMonth(month)}</option>
                    ))}
                  </select>

                  {/* Sort Order */}
                  <button
                    onClick={() => setPoSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-1.5 bg-emerald-50/15 border border-emerald-800/20 hover:bg-emerald-100/40 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-0.5"
                    title="Ubah Urutan"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* View Mode Toggle and Excel export */}
                <div className="flex items-center gap-2 self-start md:self-auto">
                  
                  {/* Mode Toggles */}
                  <div className="bg-emerald-950/5 p-0.5 rounded-lg flex text-xs font-bold border border-emerald-800/10">
                    <button
                      onClick={() => setPoViewMode('spreadsheet')}
                      className={`px-3 py-1.5 rounded-md flex items-center gap-1 transition-all ${
                        poViewMode === 'spreadsheet' ? 'bg-emerald-800 text-white shadow-xs border border-emerald-950' : 'text-emerald-800/70 hover:text-emerald-950'
                      }`}
                      title="Spreadsheet Excel Style"
                    >
                      <FileSpreadsheet className={`w-3.5 h-3.5 ${poViewMode === 'spreadsheet' ? 'text-emerald-100' : 'text-emerald-700'}`} />
                      Spreadsheet
                    </button>
                    <button
                      onClick={() => setPoViewMode('interactive')}
                      className={`px-3 py-1.5 rounded-md flex items-center gap-1 transition-all ${
                        poViewMode === 'interactive' ? 'bg-emerald-800 text-white shadow-xs border border-emerald-950' : 'text-emerald-800/70 hover:text-emerald-950'
                      }`}
                      title="Master-Detail Invoice Style"
                    >
                      <FileText className={`w-3.5 h-3.5 ${poViewMode === 'interactive' ? 'text-emerald-100' : 'text-emerald-700'}`} />
                      Detail Dokumen
                    </button>
                  </div>

                  {/* Export CSV - Beautiful Solid Evergreen Button */}
                  <button
                    onClick={handleExportPoCSV}
                    className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-colors border border-emerald-950 shadow-xs"
                    title="Download Excel PO"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>

              </div>

              {/* 1. SPREADSHEET VIEW MODE - REPLICATES EXCEL EXACTLY */}
              {poViewMode === 'spreadsheet' && (
                <div className="bg-white rounded-2xl border border-emerald-800/20 shadow-xs p-5 space-y-4">
                  
                  <div className="flex justify-between items-center bg-emerald-50/35 -mx-5 -mt-5 px-5 py-3 rounded-t-2xl border-b border-emerald-800/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider font-mono">
                        ARI SPORTINDO &bull; SPREADSHEET JUNI
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold bg-gray-200/60 px-2 py-0.5 rounded">
                      REKAP PO VENDOR
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-emerald-800/20 shadow-inner bg-emerald-50/5">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-emerald-800 text-white font-bold border-b border-emerald-950 uppercase text-[10px] tracking-wider text-center">
                          <th className="p-3 border-r border-emerald-700/50 w-10">NO</th>
                          <th className="p-3 border-r border-emerald-700/50 w-28">TANGGAL</th>
                          <th className="p-3 border-r border-emerald-700/50 w-28 text-left">NO PO</th>
                          <th className="p-3 border-r border-emerald-700/50 text-left">SUPPLIER</th>
                          <th className="p-3 border-r border-emerald-700/50 text-left">DESCRIPTION / BARANG</th>
                          <th className="p-3 border-r border-emerald-700/50 w-16 text-center">QTY</th>
                          <th className="p-3 border-r border-emerald-700/50 w-32 text-right">HARGA (SATUAN)</th>
                          <th className="p-3 border-r border-emerald-700/50 w-32 text-right">SUBTOTAL</th>
                          <th className="p-3 border-r border-emerald-700/50 w-36 text-right">TOTAL PO</th>
                          <th className="p-3 text-center w-24">AKSI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spreadsheetRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="p-10 text-center text-emerald-800/60 italic bg-emerald-50/10">
                              Tidak ada data Purchase Order terdaftar untuk filter ini.
                            </td>
                          </tr>
                        ) : (
                          spreadsheetRows.map((row, idx) => {
                            const parentPo = purchases.find(p => p.id === row.poId)!;
                            const itemsCount = parentPo ? parentPo.items.length : 1;
                            const isFirstItem = row.itemIdx === 0;

                            return (
                              <tr key={`po-item-${row.itemId}`} className="hover:bg-emerald-50/40 border-b border-emerald-100/70 transition-colors font-medium text-gray-700">
                                {/* NO */}
                                <td className="p-2.5 text-center border-r border-emerald-100/70 font-mono text-[10px] text-emerald-800/70 bg-emerald-50/20">
                                  {row.itemIdx + 1}
                                </td>
                                
                                {/* TANGGAL */}
                                {isFirstItem ? (
                                  <td 
                                    rowSpan={itemsCount} 
                                    className="p-2.5 text-center border-r border-emerald-100/70 font-mono text-emerald-900 text-[11px] bg-emerald-50/5 align-middle font-bold"
                                  >
                                    {formatDateExcel(row.date)}
                                  </td>
                                ) : null}

                                {/* NO PO */}
                                {isFirstItem ? (
                                  <td 
                                    rowSpan={itemsCount} 
                                    className="p-2.5 text-center border-r border-emerald-100/70 font-mono text-orange-900 font-black tracking-wider text-[11px] bg-amber-50/20 align-middle"
                                  >
                                    {row.poNumber}
                                  </td>
                                ) : null}

                                {/* SUPPLIER */}
                                {isFirstItem ? (
                                  <td 
                                    rowSpan={itemsCount} 
                                    className="p-2.5 border-r border-emerald-100/70 text-emerald-900 font-black text-[12px] bg-emerald-50/10 align-middle"
                                  >
                                    <div className="flex flex-col gap-1">
                                      <span className="hover:underline cursor-pointer font-black" onClick={() => { setSelectedPoId(row.poId); setPoViewMode('interactive'); }}>
                                        {row.supplier}
                                      </span>
                                      <span className="text-[9px] text-emerald-800/60 font-normal">Staff: {row.adminStaff}</span>
                                    </div>
                                  </td>
                                ) : null}

                                {/* DESCRIPTION */}
                                <td className="p-2.5 border-r border-emerald-100/70 font-semibold text-gray-900 max-w-xs truncate bg-white/20" title={row.itemDescription}>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                    {row.itemDescription}
                                  </span>
                                </td>

                                {/* QTY */}
                                <td className="p-2.5 text-center border-r border-emerald-100/70 font-mono font-bold text-gray-800 bg-white/20">
                                  {row.itemQty}
                                </td>

                                {/* HARGA */}
                                <td className="p-2.5 text-right border-r border-emerald-100/70 font-mono text-gray-600 bg-white/20">
                                  {formatIDR(row.itemPrice)}
                                </td>

                                {/* SUBTOTAL */}
                                <td className="p-2.5 text-right border-r border-emerald-100/70 font-mono font-bold text-emerald-950 bg-emerald-50/10">
                                  {formatIDR(row.itemSubtotal)}
                                </td>

                                {/* TOTAL PO */}
                                {isFirstItem ? (
                                  <td 
                                    rowSpan={itemsCount} 
                                    className="p-3 text-right font-black text-emerald-950 border-r border-emerald-200 align-middle font-mono bg-emerald-100/40 text-xs shadow-xs"
                                  >
                                    <div className="flex flex-col items-end justify-center">
                                      <span className="text-[9px] text-emerald-800/60 font-bold uppercase tracking-widest block mb-0.5">NET TOTAL</span>
                                      <span className="text-sm block">{formatIDR(row.totalPOPrice)}</span>
                                      <span className={`mt-1.5 px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-bold inline-block ${
                                        row.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                        row.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                                      }`}>
                                        {row.status}
                                      </span>
                                    </div>
                                  </td>
                                ) : null}

                                {/* ACTIONS */}
                                {isFirstItem ? (
                                  <td 
                                    rowSpan={itemsCount} 
                                    className="p-3 text-center align-middle bg-emerald-50/20 w-24"
                                  >
                                    <div className="flex flex-col gap-1.5 items-center justify-center">
                                      <button
                                        onClick={() => handleStartEditPurchase(parentPo)}
                                        className="w-full py-1 px-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[9px] flex items-center justify-center gap-0.5 transition-colors shadow-xs"
                                        title="Edit PO"
                                      >
                                        <Edit className="w-2.5 h-2.5" /> Edit
                                      </button>
                                      <button
                                        onClick={() => setDeleteTarget({ id: row.poId, type: 'purchase' })}
                                        className="w-full py-1 px-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded font-bold text-[9px] flex items-center justify-center gap-0.5 transition-colors shadow-xs"
                                        title="Batalkan & Hapus PO"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" /> Hapus
                                      </button>
                                      <button
                                        onClick={() => handleCopyPoSummary(parentPo)}
                                        className="w-full py-1 px-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold text-[9px] flex items-center justify-center gap-0.5 transition-colors shadow-xs"
                                        title="Copy Ringkasan PO"
                                      >
                                        <Copy className="w-2.5 h-2.5" /> Salin
                                      </button>
                                    </div>
                                  </td>
                                ) : null}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-emerald-50/10 rounded-xl p-4 border border-emerald-800/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="text-emerald-800 font-semibold">
                      Menampilkan <span className="text-emerald-800 font-black">{filteredPurchases.length}</span> Berkas Purchase Order
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-800/60 font-bold uppercase tracking-wider text-[10px]">Total Restock Terfilter:</span>
                      <span className="font-mono font-black text-base text-emerald-850">
                        {formatIDR(filteredPurchases.reduce((sum, p) => sum + p.total_price, 0))}
                      </span>
                    </div>
                  </div>

                </div>
              )}

              {/* 2. INTERACTIVE MASTER-DETAIL INVOICE VIEW MODE */}
              {poViewMode === 'interactive' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  
                  {/* Left mini list of POs */}
                  <div className="md:col-span-5 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {sortedPurchases.length === 0 ? (
                      <p className="text-xs text-emerald-800/40 italic text-center py-8 bg-emerald-50/5 rounded-xl border border-dashed border-emerald-800/20">
                        Tidak ada PO ditemukan.
                      </p>
                    ) : (
                      sortedPurchases.map(po => (
                        <div
                          key={po.id}
                          onClick={() => setSelectedPoId(po.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            selectedPoId === po.id 
                              ? 'border-emerald-600 bg-emerald-50/25 shadow-xs ring-1 ring-emerald-500' 
                              : 'border-emerald-800/15 bg-white hover:bg-emerald-50/15'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="font-mono font-black text-emerald-950 text-xs tracking-wider">
                              #{po.po_number}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              po.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                              po.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700/60 border border-emerald-100'
                            }`}>
                              {po.status}
                            </span>
                          </div>

                          <div className="text-[11px] text-emerald-900 font-bold flex justify-between items-center">
                            <span>{po.supplier}</span>
                            <span className="font-mono text-emerald-700 font-black">{formatIDR(po.total_price)}</span>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-800/10 text-[10px] text-emerald-800/50">
                            <span>{formatDateExcel(po.date)}</span>
                            <span>{po.items.length} Item</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Right: Beautiful Invoice Receipt View of Selected PO */}
                  <div className="md:col-span-7 bg-white rounded-2xl border border-emerald-800/20 p-6 shadow-sm space-y-6 flex flex-col justify-between">
                    
                    {activeSelectedPo ? (
                      <div id="printable-po-document" className="space-y-6">
                        
                        {/* Printable PO Header */}
                        <div className="flex justify-between items-start border-b border-emerald-800/15 pb-5">
                          <div className="space-y-1">
                            <span className="px-2.5 py-0.5 bg-emerald-950 text-emerald-200 text-[9px] tracking-widest font-black rounded-md block w-fit">
                              ARI SPORTINDO
                            </span>
                            <h2 className="text-base font-black text-gray-900 tracking-tight">PURCHASE ORDER</h2>
                            <p className="text-[10px] text-gray-400">Garment, Konveksi & Sablon Olahraga Profesional</p>
                          </div>
                          <div className="text-right font-mono text-[10px] space-y-0.5">
                            <p className="text-gray-400">NOMOR PO</p>
                            <p className="text-gray-900 font-black text-sm tracking-widest">#{activeSelectedPo.po_number}</p>
                            <p className="text-gray-400 mt-2">TANGGAL PO</p>
                            <p className="text-gray-900 font-bold">{formatDateExcel(activeSelectedPo.date)}</p>
                          </div>
                        </div>

                        {/* Supplier and Creator metadata block */}
                        <div className="grid grid-cols-2 gap-4 bg-emerald-50/15 rounded-xl p-4 border border-emerald-800/20 text-xs">
                          <div>
                            <span className="text-[9px] text-emerald-800/60 font-bold uppercase tracking-wider block mb-1">Dipesan Kepada (Vendor):</span>
                            <p className="font-black text-emerald-900 text-sm">{activeSelectedPo.supplier}</p>
                            <p className="text-[10px] text-emerald-800/50 mt-1">Status Pembelian: 
                              <span className="font-bold text-emerald-800 ml-1 capitalize">{activeSelectedPo.status}</span>
                            </p>
                          </div>
                          <div>
                            <span className="text-[9px] text-emerald-800/60 font-bold uppercase tracking-wider block mb-1">Dibuat Oleh (Admin):</span>
                            <p className="font-bold text-emerald-900">{activeSelectedPo.admin_staff || 'Admin Gudang ARI'}</p>
                            <p className="text-[10px] text-emerald-800/50 mt-1">Lokasi Penerimaan: 
                              <span className="font-bold text-emerald-800 ml-1">Gudang Utama</span>
                            </p>
                          </div>
                        </div>

                        {/* Items Table inside Invoice */}
                        <div className="rounded-xl border border-emerald-800/15 overflow-hidden shadow-xs text-xs">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-emerald-50 text-emerald-800 border-b border-emerald-800/15 font-bold uppercase text-[9px] tracking-wider">
                                <th className="p-3 text-center w-10">NO</th>
                                <th className="p-3">DESKRIPSI BARANG</th>
                                <th className="p-3 text-center w-12">QTY</th>
                                <th className="p-3 text-right w-28">HARGA</th>
                                <th className="p-3 text-right w-28">SUBTOTAL</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-800/10">
                              {activeSelectedPo.items.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-emerald-50/10 transition-colors">
                                  <td className="p-3 text-center font-mono text-emerald-700/60">{idx + 1}</td>
                                  <td className="p-3 font-bold text-emerald-950">{item.description}</td>
                                  <td className="p-3 text-center font-mono font-bold text-emerald-800">{item.qty}</td>
                                  <td className="p-3 text-right font-mono text-emerald-800/70">{formatIDR(item.price)}</td>
                                  <td className="p-3 text-right font-mono font-black text-emerald-900">{formatIDR(item.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Invoice Footer Total and Signatures */}
                        <div className="space-y-6">
                          
                          {/* Cost Breakdowns */}
                          <div className="flex justify-between items-center bg-emerald-50 border border-emerald-800/20 rounded-xl p-4">
                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Grand Total PO:</span>
                            <span className="text-lg font-black font-mono text-emerald-950">{formatIDR(activeSelectedPo.total_price)}</span>
                          </div>

                          {/* Approval Signatures block matching professional sheets */}
                          <div className="grid grid-cols-2 gap-4 text-center text-[10px] pt-4">
                            <div>
                              <p className="text-emerald-800/60 uppercase tracking-wider mb-12">Disiapkan Oleh,</p>
                              <div className="w-28 h-px bg-emerald-800/20 mx-auto mb-1"></div>
                              <p className="font-bold text-emerald-950">{activeSelectedPo.admin_staff || 'Staff Keuangan'}</p>
                              <p className="text-[8px] text-emerald-800/50">Admin Staff</p>
                            </div>
                            <div>
                              <p className="text-emerald-800/60 uppercase tracking-wider mb-12">Disetujui Oleh,</p>
                              <div className="w-28 h-px bg-emerald-800/20 mx-auto mb-1"></div>
                              <p className="font-bold text-emerald-950">ARI SPORTINDO</p>
                              <p className="text-[8px] text-emerald-800/50">Direktur / Owner</p>
                            </div>
                          </div>

                        </div>

                        {/* Action controllers for PO */}
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-emerald-800/10 no-print">
                          <button
                            onClick={() => handleCopyPoSummary(activeSelectedPo)}
                            className="py-1.5 px-3 bg-emerald-50/40 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs flex items-center gap-1 transition-all border border-emerald-800/20"
                            title="Salin ringkasan ke papan klip"
                          >
                            <Copy className="w-3.5 h-3.5" /> Salin Ringkasan
                          </button>
                          
                          <button
                            onClick={() => window.print()}
                            className="py-1.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all border border-emerald-950 shadow-xs"
                          >
                            <Printer className="w-3.5 h-3.5" /> Cetak PO
                          </button>

                          <button
                            onClick={() => handleStartEditPurchase(activeSelectedPo)}
                            className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-xs"
                          >
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>

                          <button
                            onClick={() => setDeleteTarget({ id: activeSelectedPo.id, type: 'purchase' })}
                            className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        </div>

                      </div>
                    ) : (
                      <div className="text-center py-20 text-emerald-800/40 italic">
                        Pilih salah satu Purchase Order di sebelah kiri untuk melihat rincian dokumen lengkap.
                      </div>
                    )}

                  </div>

                </div>
              )}

            </div>
          )}

          {/* TAB 2: OPERATIONAL EXPENSES LIST */}
          {activeTab === 'expenses' && (
            <div className="bg-white rounded-2xl border border-emerald-800/20 p-5 shadow-xs space-y-4">
              
              {/* Controls (Search, Filters, CSV download) */}
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[160px]">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-emerald-700/50" />
                    <input
                      type="text"
                      placeholder="Cari deskripsi, kategori, admin..."
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-full bg-emerald-50/15 border border-emerald-800/20 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-emerald-700 text-emerald-950 font-semibold"
                    />
                  </div>

                  {/* Category Filter */}
                  <select
                    value={expenseCategoryFilter}
                    onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                    className="bg-emerald-50/15 border border-emerald-800/20 rounded-lg py-1.5 px-2.5 text-xs text-emerald-800/80 focus:outline-none focus:border-emerald-700 font-bold cursor-pointer"
                  >
                    <option value="All">Semua Kategori</option>
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {/* Month filter */}
                  <select
                    value={expenseMonthFilter}
                    onChange={(e) => setExpenseMonthFilter(e.target.value)}
                    className="bg-emerald-50/15 border border-emerald-800/20 rounded-lg py-1.5 px-2.5 text-xs text-emerald-800/80 focus:outline-none focus:border-emerald-700 font-bold cursor-pointer"
                  >
                    <option value="All">Semua Bulan</option>
                    {availableExpenseMonths.map(month => (
                      <option key={month} value={month}>{formatIndonesianMonth(month)}</option>
                    ))}
                  </select>

                  {/* Date Sort Order Toggle */}
                  <button
                    onClick={() => setExpenseSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-1.5 bg-emerald-50/15 border border-emerald-800/20 hover:bg-emerald-100/40 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    title="Ubah Urutan"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{expenseSortOrder === 'desc' ? 'Terbaru' : 'Terlama'}</span>
                  </button>
                </div>

                {/* CSV Download - Upgraded to beautiful Solid Evergreen button */}
                <button
                  onClick={handleExportPoCSV} // standard csv download helper
                  className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors border border-emerald-950 self-start md:self-auto shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel CSV
                </button>
              </div>

              {/* EXCEL MERGED-DAY DESIGN FOR DAILY EXPENSES */}
              <div className="overflow-x-auto rounded-xl border border-emerald-800/20 shadow-inner">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-emerald-900 text-white font-bold border-b border-emerald-950 uppercase text-[9px] tracking-wider text-center">
                      <th className="p-3 border-r border-emerald-800/20 w-24">Tanggal</th>
                      <th className="p-3 border-r border-emerald-800/20 text-left">Nama Barang / Pengeluaran</th>
                      <th className="p-3 border-r border-emerald-800/20 text-left">Kategori</th>
                      <th className="p-3 border-r border-emerald-800/20 w-12">Qty</th>
                      <th className="p-3 border-r border-emerald-800/20 w-28 text-right">Harga</th>
                      <th className="p-3 border-r border-emerald-800/20 w-28 text-right">Subtotal</th>
                      <th className="p-3 border-r border-emerald-800/20 w-32 text-right bg-emerald-950/30">Total Harian</th>
                      <th className="p-3 border-r border-emerald-800/20 w-24 text-center">Admin</th>
                      <th className="p-3 text-center w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedExpensesList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-emerald-800/40 italic bg-emerald-50/5">
                          Tidak ada catatan pengeluaran harian yang ditemukan.
                        </td>
                      </tr>
                    ) : (
                      groupedExpensesList.map((group) => {
                        return group.items.map((item, idx) => {
                          const isFirst = idx === 0;
                          return (
                            <tr key={item.id} className="hover:bg-emerald-50/10 border-b border-emerald-800/10 transition-colors">
                              {/* Tanggal - Merged visually if same day like excel */}
                              {isFirst ? (
                                <td 
                                  rowSpan={group.items.length} 
                                  className="p-3 text-center font-bold text-emerald-950 bg-emerald-50/30 border-r border-emerald-800/20 align-middle whitespace-nowrap font-mono"
                                >
                                  <div className="flex flex-col items-center">
                                    <span className="text-[11px] block">{formatDateExcel(group.date)}</span>
                                    <span className="text-[9px] text-emerald-700/60 font-semibold block capitalize">
                                      {new Date(group.date).toLocaleDateString('id-ID', { weekday: 'short' })}
                                    </span>
                                  </div>
                                </td>
                              ) : null}

                              {/* Nama Barang */}
                              <td className="p-2.5 font-bold text-emerald-950 border-r border-emerald-800/15 max-w-xs truncate" title={item.description}>
                                {item.description}
                              </td>

                              {/* Kategori */}
                              <td className="p-2.5 border-r border-emerald-800/15 text-emerald-800/80 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1">
                                  <Tag className="w-2.5 h-2.5 text-emerald-700/50" />
                                  {item.category}
                                </span>
                              </td>

                              {/* Qty */}
                              <td className="p-2.5 text-center border-r border-emerald-800/15 font-mono font-bold text-emerald-900">
                                {item.qty || 1}
                              </td>

                              {/* Harga Satuan */}
                              <td className="p-2.5 text-right border-r border-emerald-800/15 font-mono text-emerald-800/60">
                                {formatIDR(item.price || item.amount)}
                              </td>

                              {/* Subtotal */}
                              <td className="p-2.5 text-right border-r border-emerald-800/15 font-mono font-black text-emerald-950 bg-emerald-50/5">
                                {formatIDR(item.amount)}
                              </td>

                              {/* Total Harian - Merged visually exactly like spreadsheet */}
                              {isFirst ? (
                                <td 
                                  rowSpan={group.items.length} 
                                  className="p-3 text-right font-black text-emerald-900 bg-emerald-50/20 border-r border-emerald-800/20 align-middle font-mono whitespace-nowrap text-xs shadow-inner"
                                >
                                  {formatIDR(group.total)}
                                </td>
                              ) : null}

                              {/* Staff */}
                              <td className="p-2.5 border-r border-emerald-800/15 text-emerald-800/70 text-center whitespace-nowrap truncate max-w-[80px]" title={item.admin_name}>
                                {item.admin_name}
                              </td>

                              {/* Actions */}
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleStartEditExpense(item)}
                                    className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                    title="Edit Pengeluaran"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget({ id: item.id, type: 'expense' })}
                                    className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                                    title="Hapus"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Grid Statistics Footer */}
              <div className="bg-emerald-50/10 rounded-xl p-4 border border-emerald-800/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="text-emerald-800 font-semibold">
                  Menampilkan <span className="font-bold text-emerald-950">{filteredExpenses.length}</span> item pengeluaran
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-800/60 font-bold uppercase tracking-wider text-[10px]">Total Terfilter:</span>
                  <span className="font-mono font-black text-base text-emerald-850">
                    {formatIDR(filteredExpenses.reduce((sum, e) => sum + e.amount, 0))}
                  </span>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-emerald-950">Konfirmasi Hapus</h3>
            <p className="text-sm text-emerald-800/80">Apakah Anda yakin ingin menghapus data ini? Aksi ini tidak dapat dibatalkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 bg-emerald-50 text-emerald-800 font-bold rounded-lg hover:bg-emerald-100">Tidak</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
