import React, { useState, useEffect } from 'react';
import { Product, RawMaterial, StockMovement, ProductionLog, ProductionJob, Employee, RejectedGood, ProductionTaskLog, PackingTask } from '../types';
import { ProductionHandoffPanel } from './ProductionHandoffPanel';
import { dataStore, RECIPES, wibNowISO, wibTodayStr, stagesForProduct, DEFAULT_PRODUCTION_STAGES } from '../dataStore';
import { brandName, brandLegalName } from '../brand';
import { StageListEditor } from './StageListEditor';
import TabButton from './TabButton';
import {
  Box,
  Hammer,
  History,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  Clipboard,
  ArrowRight,
  Search,
  Filter,
  AlertTriangle,
  User,
  Calendar,
  ChevronRight,
  X,
  FileText,
  Check,
  Loader2,
  AlertCircle,
  ListOrdered,
  Settings,
  Camera,
  Trash2
} from 'lucide-react';
import { uploadPackingPhoto, deletePackingPhoto, canDeletePhoto } from '../packingPhoto';
import { isCloudEnabled } from '../cloudSync';

interface ProductionInventoryModuleProps {
  userRole: string;
  currentEmployee?: Employee | null;
}

type ProductionDepartmentId = ProductionJob['department_id'];

const PRODUCTION_DEPARTMENTS: Array<{ id: ProductionDepartmentId; label: string }> = [
  { id: 'dept-eva-foam', label: 'Eva Foam' },
  { id: 'dept-konveksi', label: 'Konveksi' },
];

const DEFAULT_STAGES_BY_DEPARTMENT: Record<ProductionDepartmentId, string> = {
  'dept-eva-foam': 'Potong Bahan\nPress / Lem\nFinishing\nCek Kualitas\nPacking',
  'dept-konveksi': 'Potong\nSablon\nJahit\nFinishing\nCek Kualitas\nPacking',
};

export const ProductionInventoryModule: React.FC<ProductionInventoryModuleProps> = ({ userRole, currentEmployee }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [productionJobs, setProductionJobs] = useState<ProductionJob[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rejectedGoods, setRejectedGoods] = useState<RejectedGood[]>([]);
  const [taskLogs, setTaskLogs] = useState<ProductionTaskLog[]>([]);
  const [packingTasks, setPackingTasks] = useState<PackingTask[]>([]);
  
  // Navigation dibuat mengikuti urutan kerja admin produksi.
  const [subTab, setSubTab] = useState<'order' | 'tracker' | 'finalize' | 'history' | 'packing-docs' | 'settings'>('order');
  const [historyView, setHistoryView] = useState<'materials' | 'products' | 'reject' | 'movements'>('materials');
  const [manualStep, setManualStep] = useState<1 | 2 | 3>(1);

  // Pengaturan Alur Produksi — pindahan dari menu Gudang, atur tahapan kerja per produk barang jadi
  const [stageEditProduct, setStageEditProduct] = useState<Product | null>(null);
  const [stageEditList, setStageEditList] = useState<string[]>([]);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');

  // Interactive Helper States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'ongoing' | 'kendala' | 'terlambat' | 'completed_today'>('all');
  const [selectedJob, setSelectedJob] = useState<ProductionJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Note inputs for modal
  const [modalNote, setModalNote] = useState('');

  // Production input states
  const [manualDepartmentId, setManualDepartmentId] = useState<ProductionDepartmentId | ''>('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productionQty, setProductionQty] = useState(1);
  const [customMaterials, setCustomMaterials] = useState<Array<{ material_id: string; qty: number }>>([]);
  const [manualOutputs, setManualOutputs] = useState<Array<{ product_id: string; target_qty: number }>>([{ product_id: '', target_qty: 1 }]);
  const [manualMaterials, setManualMaterials] = useState<Array<{ material_id: string; qty: number }>>([{ material_id: '', qty: 1 }]);
  const [manualStages, setManualStages] = useState('Potong\nJahit\nCek Kualitas\nPacking');
  const [manualEmployeeIds, setManualEmployeeIds] = useState<string[]>([]);
  const [manualNotes, setManualNotes] = useState('');
  const [finalJobId, setFinalJobId] = useState('');
  const [finalOutputs, setFinalOutputs] = useState<Array<{ product_id: string; good_qty: number; reject_qty: number; reject_reason: string }>>([]);
  const [taskJobId, setTaskJobId] = useState('');
  const [openedEmployeeJobId, setOpenedEmployeeJobId] = useState('');
  const [openedPackingTaskId, setOpenedPackingTaskId] = useState('');
  const [packingPhoto, setPackingPhoto] = useState<File | null>(null);
  const [uploadingPackingPhoto, setUploadingPackingPhoto] = useState(false);
  const [taskStage, setTaskStage] = useState('');
  const [taskName, setTaskName] = useState('');
  const [taskQtyDone, setTaskQtyDone] = useState(0);
  const [taskQtyRejected, setTaskQtyRejected] = useState(0);
  const [taskNotes, setTaskNotes] = useState('');

  // Stock Adjustment states
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustType, setAdjustType] = useState<'product' | 'material'>('product');
  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustDirection, setAdjustDirection] = useState<'in' | 'out'>('in');
  const [adjustRef, setAdjustRef] = useState('Stock Opname manual');

  // Resep produksi terpusat di dataStore (dipakai juga oleh OrderModule saat kirim ke produksi)

  useEffect(() => {
    loadData();
    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener('nxty_storage_change', handleStorageChange);
    return () => window.removeEventListener('nxty_storage_change', handleStorageChange);
  }, []);

  const loadData = () => {
    setProducts(dataStore.getProducts());
    setRawMaterials(dataStore.getRawMaterials());
    setMovements(dataStore.getStockMovements());
    setProductionLogs(dataStore.getProductionLogs());
    setProductionJobs(dataStore.getProductionJobs());
    setEmployees(dataStore.getEmployees().filter(employee => employee.status_aktif));
    setRejectedGoods(dataStore.getRejectedGoods());
    setTaskLogs(dataStore.getProductionTaskLogs());
    setPackingTasks(dataStore.getPackingTasks());
  };

  // Data lokal instan — tanpa jeda loading buatan
  const triggerLoading = () => {
    setIsLoading(false);
  };

  // Helper to check if raw materials are sufficient for a job
  const checkMaterialSufficiency = (job: ProductionJob): { sufficient: boolean; details: Array<{ name: string; required: number; available: number }> } => {
    const recipe = RECIPES[job.product_id];
    if (!recipe) return { sufficient: true, details: [] };
    
    const details = recipe.map(item => {
      const mat = rawMaterials.find(rm => rm.id === item.material_id);
      const required = item.qtyPerUnit * job.qty;
      const available = mat ? mat.current_stock : 0;
      return {
        name: mat ? mat.name : 'Bahan Tidak Diketahui',
        required,
        available
      };
    });

    const sufficient = details.every(d => d.available >= d.required);
    return { sufficient, details };
  };

  // Helper for computing Deadline (7 days from created_at)
  const getJobDeadlineStr = (job: ProductionJob) => {
    const createdDate = new Date(job.created_at || Date.now());
    const deadlineDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    return deadlineDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isJobOverdue = (job: ProductionJob) => {
    if (job.status === 'completed') return false;
    const createdDate = new Date(job.created_at || Date.now());
    const deadlineDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    return deadlineDate.getTime() < Date.now();
  };

  // Helper to check for Kendala (Issues)
  const hasKendala = (job: ProductionJob) => {
    const noteText = (job.notes || '').toLowerCase();
    const stagesNoteText = job.stages.map(s => s.notes || '').join(' ').toLowerCase();
    return noteText.includes('kendala') || 
           noteText.includes('macet') || 
           noteText.includes('rusak') || 
           noteText.includes('masalah') || 
           noteText.includes('terhambat') ||
           stagesNoteText.includes('kendala') ||
           stagesNoteText.includes('macet') ||
           stagesNoteText.includes('rusak') ||
           stagesNoteText.includes('masalah') ||
           stagesNoteText.includes('terhambat');
  };

  // Helper to check for Completed Today
  const isCompletedToday = (job: ProductionJob) => {
    if (job.status !== 'completed') return false;
    const lastStage = job.stages[job.stages.length - 1];
    if (!lastStage || !lastStage.updated_at) return false;
    const completedDate = new Date(lastStage.updated_at).toDateString();
    const todayDate = new Date().toDateString();
    return completedDate === todayDate;
  };

  // Filter products based on user department role
  const getFilteredProducts = () => {
    if (userRole === 'admin_eva_foam') {
      return products.filter(p => p.department_id === 'dept-eva-foam');
    }
    if (userRole === 'admin_konveksi') {
      return products.filter(p => p.department_id === 'dept-konveksi');
    }
    return products; // General warehouse or owner sees all
  };

  const lockedManualDepartment: ProductionDepartmentId | '' =
    userRole === 'admin_eva_foam'
      ? 'dept-eva-foam'
      : userRole === 'admin_konveksi'
        ? 'dept-konveksi'
        : '';

  const setManualDepartment = (departmentId: ProductionDepartmentId) => {
    setManualDepartmentId(departmentId);
    setManualOutputs([{ product_id: '', target_qty: 1 }]);
    setManualEmployeeIds([]);
    setManualStages(DEFAULT_STAGES_BY_DEPARTMENT[departmentId]);
  };

  useEffect(() => {
    if (lockedManualDepartment && manualDepartmentId !== lockedManualDepartment) {
      setManualDepartment(lockedManualDepartment);
    }
  }, [lockedManualDepartment, manualDepartmentId]);

  const manualDepartment = PRODUCTION_DEPARTMENTS.find(department => department.id === manualDepartmentId);
  const manualProducts = manualDepartmentId
    ? getFilteredProducts().filter(product => product.department_id === manualDepartmentId)
    : [];
  const manualAssignableEmployees = manualDepartmentId
    ? employees.filter(employee => employee.department_id === manualDepartmentId)
    : [];
  const manualFilteredMaterials = manualDepartmentId
    ? rawMaterials.filter(material => !material.department_id || material.department_id === manualDepartmentId)
    : rawMaterials;

  // Auto populate ingredients when a product is selected
  useEffect(() => {
    if (selectedProductId) {
      const recipe = RECIPES[selectedProductId];
      if (recipe) {
        const custom = recipe.map(item => ({
          material_id: item.material_id,
          qty: item.qtyPerUnit * productionQty
        }));
        setCustomMaterials(custom);
      } else {
        setCustomMaterials([]);
      }
    } else {
      setCustomMaterials([]);
    }
  }, [selectedProductId, productionQty]);

  const handlePostProduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || productionQty <= 0) return;

    // Call dataStore transactional logging
    const success = dataStore.recordProduction(
      userRole === 'admin_eva_foam' ? 'dept-eva-foam' : 'dept-konveksi',
      selectedProductId,
      productionQty,
      customMaterials
    );

    if (success) {
      setSelectedProductId('');
      setProductionQty(1);
      alert('Produksi sukses dicatat! Bahan baku berkurang & stok barang jadi otomatis bertambah.');
      loadData();
      triggerLoading();
    } else {
      alert('Gagal mencatat produksi! Silakan periksa kembali kecukupan stok bahan baku di gudang.');
    }
  };

  const handleCreateManualProductionJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDepartmentId) return alert('Pilih departemen produksi terlebih dahulu.');
    const outputs = manualOutputs
      .map(output => {
        const product = products.find(item => item.id === output.product_id);
        return product ? { product, target_qty: Math.max(1, Number(output.target_qty) || 1) } : null;
      })
      .filter(Boolean) as Array<{ product: Product; target_qty: number }>;

    if (outputs.length === 0) return alert('Pilih minimal satu output produk.');
    if (outputs.some(output => output.product.department_id !== manualDepartmentId)) {
      return alert('Produk output harus sesuai dengan departemen yang dipilih.');
    }

    const first = outputs[0];
    const stages = manualStages.split('\n').map(stage => stage.trim()).filter(Boolean);
    if (stages.length === 0) return alert('Isi minimal satu tahapan produksi.');

    const materialsPlanned = manualMaterials
      .map(item => {
        const material = rawMaterials.find(mat => mat.id === item.material_id);
        return material ? {
          material_id: material.id,
          material_name: material.name,
          qty: Math.max(0, Number(item.qty) || 0),
          unit: material.unit
        } : null;
      })
      .filter((item): item is { material_id: string; material_name: string; qty: number; unit: string } => Boolean(item && item.qty > 0));
    if (materialsPlanned.length === 0) return alert('Pilih minimal satu bahan baku yang dipakai.');

    const assignedEmployees = manualEmployeeIds
      .map(id => employees.find(employee => employee.id === id))
      .filter(employee => employee && employee.department_id === manualDepartmentId)
      .map(employee => ({ employee_id: employee!.id, employee_name: employee!.name }));

    const orderNumber = `PROD/${new Date().getFullYear()}/${String(productionJobs.length + 1).padStart(4, '0')}`;
    const job: ProductionJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      order_number: orderNumber,
      product_id: first.product.id,
      product_name: outputs.length > 1 ? `${first.product.name} +${outputs.length - 1} output` : first.product.name,
      variant: first.product.variant,
      qty: first.target_qty,
      department_id: manualDepartmentId,
      stages: stages.map((stage, index) => ({ stage, status: index === 0 ? 'ongoing' : 'pending' })),
      current_stage: stages[0],
      status: 'ongoing',
      notes: manualNotes.trim() || undefined,
      created_at: wibNowISO(),
      materials_planned: materialsPlanned,
      outputs: outputs.map(output => ({
        product_id: output.product.id,
        product_name: output.product.name,
        variant: output.product.variant,
        target_qty: output.target_qty,
        good_qty: 0,
        reject_qty: 0
      })),
      assigned_employees: assignedEmployees
    };

    const materialSummary = materialsPlanned.map(item => `- ${item.material_name}: ${item.qty} ${item.unit}`).join('\n');
    const employeeWarning = assignedEmployees.length === 0 ? '\nPERHATIAN: belum ada karyawan yang ditugaskan.\n' : '';
    if (!window.confirm(`Buat order produksi ${orderNumber}?\n\nStok bahan baku berikut akan LANGSUNG dipotong dari persediaan:\n${materialSummary}\n${employeeWarning}\nLanjutkan?`)) return;

    const result = dataStore.createManualProductionJob(job);
    if (!result.ok) {
      return alert(`Order produksi tidak bisa dibuat karena bahan kurang:\n- ${result.shortages.join('\n- ')}`);
    }

    setManualOutputs([{ product_id: '', target_qty: 1 }]);
    setManualMaterials([{ material_id: '', qty: 1 }]);
    setManualStages(DEFAULT_STAGES_BY_DEPARTMENT[manualDepartmentId]);
    setManualEmployeeIds([]);
    setManualNotes('');
    setManualStep(1);
    loadData();
    setSubTab('tracker');
    alert(`Order produksi ${orderNumber} berhasil dibuat. Bahan baku yang dipilih sudah dipotong dari persediaan.`);
  };

  const syncFinalOutputsForJob = (jobId: string) => {
    setFinalJobId(jobId);
    const job = productionJobs.find(item => item.id === jobId);
    if (!job) return setFinalOutputs([]);
    const outputs = (job.outputs && job.outputs.length > 0)
      ? job.outputs
      : [{ product_id: job.product_id, product_name: job.product_name, variant: job.variant, target_qty: job.qty, good_qty: 0, reject_qty: 0 }];
    setFinalOutputs(outputs.map(output => ({
      product_id: output.product_id,
      good_qty: output.good_qty || output.target_qty || 0,
      reject_qty: output.reject_qty || 0,
      reject_reason: ''
    })));
  };

  const handleFinalizeManualProduction = (e: React.FormEvent) => {
    e.preventDefault();
    const job = productionJobs.find(item => item.id === finalJobId);
    if (!job) return alert('Pilih order produksi yang akan difinalisasi.');
    const outputs = finalOutputs.map(output => {
      const product = products.find(item => item.id === output.product_id);
      return product ? {
        product_id: product.id,
        product_name: product.name,
        variant: product.variant,
        good_qty: Math.max(0, Number(output.good_qty) || 0),
        reject_qty: Math.max(0, Number(output.reject_qty) || 0),
        reject_reason: output.reject_reason.trim()
      } : null;
    }).filter(Boolean) as Array<{ product_id: string; product_name: string; variant: string; good_qty: number; reject_qty: number; reject_reason?: string }>;

    if (outputs.every(output => output.good_qty <= 0 && output.reject_qty <= 0)) {
      return alert('Isi minimal barang bagus atau reject.');
    }

    const result = dataStore.finalizeProductionOutput(job.id, outputs);
    if (!result.ok) return alert(result.message || 'Gagal finalisasi produksi.');
    setFinalJobId('');
    setFinalOutputs([]);
    loadData();
    alert('Hasil produksi berhasil difinalisasi. Barang bagus masuk stok produk jadi dan reject dicatat sebagai barang reject.');
  };

  const handleSubmitEmployeeTaskLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmployee) return alert('Identitas karyawan tidak tersedia.');
    const job = productionJobs.find(item => item.id === taskJobId);
    if (!job) return alert('Pilih order produksi terlebih dahulu.');
    const qtyDone = Math.max(0, Number(taskQtyDone) || 0);
    const qtyRejected = Math.max(0, Number(taskQtyRejected) || 0);
    if (qtyDone <= 0 && qtyRejected <= 0) {
      return alert('Isi minimal Qty Selesai atau Qty Reject lebih dari 0.');
    }
    const label = `${job.order_number || job.id} - ${job.product_name}`;
    dataStore.postProductionTaskLog({
      id: `ptask-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      production_job_id: job.id,
      production_label: label,
      employee_id: currentEmployee.id,
      employee_name: currentEmployee.name,
      date: wibTodayStr(),
      stage_name: taskStage || job.current_stage,
      task_name: taskName.trim() || taskStage || job.current_stage,
      qty_done: qtyDone,
      qty_rejected: qtyRejected,
      notes: taskNotes.trim() || undefined,
      created_at: wibNowISO()
    });
    setTaskName('');
    setTaskQtyDone(0);
    setTaskQtyRejected(0);
    setTaskNotes('');
    loadData();
    alert('Hasil kerja berhasil dicatat.');
  };

  const handleDeleteEmployeeTaskLog = (logId: string) => {
    if (!window.confirm('Hapus catatan kerjaan ini?')) return;
    if (!dataStore.deleteProductionTaskLog(logId)) return alert('Catatan kerja tidak ditemukan.');
    loadData();
  };

  const handleCompletePackingTask = async (taskId: string) => {
    if (!window.confirm('Tandai packing ini sudah selesai?')) return;
    let photo: { url: string; uploaded_by: string } | undefined;
    if (packingPhoto) {
      const task = packingTasks.find(item => item.id === taskId);
      setUploadingPackingPhoto(true);
      try {
        const url = await uploadPackingPhoto(task?.order_number || taskId, packingPhoto);
        if (url) photo = { url, uploaded_by: currentEmployee?.name || dataStore.getCurrentActor().name };
      } catch {
        alert('Packing tercatat, tapi upload foto gagal. Bisa diabaikan atau dicoba lagi nanti.');
      } finally {
        setUploadingPackingPhoto(false);
      }
    }
    if (!dataStore.completePackingTask(taskId, taskNotes.trim() || undefined, photo)) return alert('Tugas packing tidak ditemukan.');
    setTaskNotes('');
    setOpenedPackingTaskId('');
    setPackingPhoto(null);
    loadData();
    alert('Packing selesai. Order sekarang siap dikirim.');
  };

  const handleManualAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItemId || adjustQty <= 0) return;

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
        id: Math.random().toString(36).substring(2, 9),
        type,
        item_id: prod.id,
        item_name: prod.name,
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
        id: Math.random().toString(36).substring(2, 9),
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
    
    // Reset adjust form
    setAdjustItemId('');
    setAdjustQty(0);
    setShowAdjust(false);
    alert('Penyesuaian stok manual berhasil diposting!');
    loadData();
    triggerLoading();
  };

  const handleUpdateJobStage = (jobId: string, stageName: string, action: 'start' | 'complete', customNote?: string) => {
    if (action === 'complete' && dataStore.getProductionHandoffs().some(item => item.job_id === jobId)) {
      alert('Job ini sudah memakai serah-terima hasil. Penyelesaian tahap harus melalui konfirmasi penerima agar jumlah dan pelaksana tetap tercatat.');
      return;
    }
    const currentJobs = dataStore.getProductionJobs();
    const job = currentJobs.find(j => j.id === jobId);
    if (!job) return;

    const note = customNote !== undefined ? customNote : modalNote;

    // Update specific stage
    const updatedStages = job.stages.map(stg => {
      if (stg.stage === stageName) {
        return {
          ...stg,
          status: (action === 'start' ? 'ongoing' : 'completed') as 'pending' | 'ongoing' | 'completed',
          updated_at: new Date().toISOString(),
          updated_by: currentEmployee?.name || (userRole === 'owner' ? 'Owner' : 'Operator Produksi'),
          notes: note || stg.notes
        };
      }
      return stg;
    });

    // Check if ALL stages are now completed
    const allCompleted = updatedStages.every(stg => stg.status === 'completed');
    const status = allCompleted ? 'completed' : 'ongoing';

    // Figure out what the current active stage is
    const current_stage = updatedStages.find(stg => stg.status === 'ongoing')?.stage || 
                          (allCompleted ? updatedStages[updatedStages.length - 1].stage : job.current_stage);

    const updatedJob: ProductionJob = {
      ...job,
      stages: updatedStages,
      current_stage,
      status,
      notes: note || job.notes
    };

    // If completed, let's automatically add this product to products stock!
    if (allCompleted && job.status !== 'completed') {
      const currentProducts = dataStore.getProducts();
      const updatedProducts = currentProducts.map(p => {
        if (p.id === job.product_id) {
          return { ...p, stock: p.stock + job.qty };
        }
        return p;
      });
      dataStore.setProducts(updatedProducts);

      // Record a Stock Movement
      const movements = dataStore.getStockMovements();
      movements.unshift({
        id: Math.random().toString(36).substring(2, 9),
        type: 'barang_jadi_masuk',
        item_id: job.product_id,
        item_name: job.product_name,
        amount: job.qty,
        reference: `Selesai Produksi (${job.order_number || 'Internal'})`,
        created_at: new Date().toISOString()
      });
      dataStore.setStockMovements(movements);

      alert(`Selamat! Produksi ${job.product_name} sebanyak ${job.qty} Pcs telah SELESAI seluruh tahapannya. Stok otomatis ditambahkan ke Gudang.`);
    }

    const updatedJobsList = currentJobs.map(j => j.id === jobId ? updatedJob : j);
    dataStore.setProductionJobs(updatedJobsList);

    // Update state & reset notes
    // Jangan buka modal bila update dipicu dari tombol cepat di kartu
    setSelectedJob(prev => (prev && prev.id === jobId ? updatedJob : prev));
    setModalNote('');
    loadData();
    triggerLoading();
  };

  const handleSaveOnlyNotes = (jobId: string, asKendala = false) => {
    if (!modalNote.trim()) {
      alert(asKendala ? 'Tulis dulu kendalanya sebelum melaporkan.' : 'Tulis catatan terlebih dahulu sebelum menyimpan.');
      return;
    }

    const currentJobs = dataStore.getProductionJobs();
    const job = currentJobs.find(j => j.id === jobId);
    if (!job) return;

    // Prefiks "KENDALA:" membuat job otomatis terdeteksi bermasalah di papan & filter
    const finalNote = asKendala && !modalNote.toLowerCase().includes('kendala')
      ? `KENDALA: ${modalNote}`
      : modalNote;

    // Save notes to the overall job notes and the active stage notes as well
    const updatedStages = job.stages.map(stg => {
      if (stg.stage === job.current_stage || stg.status === 'ongoing') {
        return {
          ...stg,
          notes: finalNote,
          updated_at: new Date().toISOString(),
          updated_by: userRole === 'owner' ? 'Owner' : 'Operator Produksi'
        };
      }
      return stg;
    });

    const updatedJob: ProductionJob = {
      ...job,
      stages: updatedStages,
      notes: finalNote
    };

    const updatedJobsList = currentJobs.map(j => j.id === jobId ? updatedJob : j);
    dataStore.setProductionJobs(updatedJobsList);

    setSelectedJob(updatedJob);
    setModalNote('');
    loadData();
    triggerLoading();
    alert('Catatan & status kendala berhasil disimpan pada tahapan ini!');
  };

  const handleRevertJobStage = (jobId: string) => {
    const currentJobs = dataStore.getProductionJobs();
    const job = currentJobs.find(j => j.id === jobId);
    if (!job) return;

    const reverseStages = [...job.stages].reverse();
    const targetStage = reverseStages.find(stg => stg.status !== 'pending');
    if (!targetStage) {
      alert("Tidak ada tahapan yang bisa dikembalikan (semua masih antre/pending).");
      return;
    }

    const confirmRollback = window.confirm(`Apakah Anda yakin ingin membatalkan/mengoreksi mundur tahap "${targetStage.stage}" untuk ${job.product_name}?`);
    if (!confirmRollback) return;

    let newStatus: 'pending' | 'ongoing' | 'completed' = 'pending';
    if (targetStage.status === 'completed') {
      newStatus = 'ongoing';
    } else if (targetStage.status === 'ongoing') {
      newStatus = 'pending';
    }

    const updatedStages = job.stages.map(stg => {
      if (stg.stage === targetStage.stage) {
        return {
          ...stg,
          status: newStatus,
          updated_at: new Date().toISOString(),
          updated_by: userRole,
          notes: ''
        };
      }
      return stg;
    });

    const allCompleted = updatedStages.every(stg => stg.status === 'completed');
    const wasCompleted = job.status === 'completed';

    if (wasCompleted && !allCompleted) {
      const currentProducts = dataStore.getProducts();
      const updatedProducts = currentProducts.map(p => {
        if (p.id === job.product_id) {
          return { ...p, stock: Math.max(0, p.stock - job.qty) };
        }
        return p;
      });
      dataStore.setProducts(updatedProducts);

      const movements = dataStore.getStockMovements();
      movements.unshift({
        id: Math.random().toString(36).substring(2, 9),
        type: 'barang_jadi_keluar',
        item_id: job.product_id,
        item_name: job.product_name,
        amount: job.qty,
        reference: `Koreksi Mundur Tahapan (${job.order_number || 'Internal'})`,
        created_at: new Date().toISOString()
      });
      dataStore.setStockMovements(movements);
      alert(`Stok produk ${job.product_name} sebanyak ${job.qty} Pcs otomatis ditarik kembali dari gudang karena status pekerjaan dibatalkan dari selesai.`);
    }

    const status = allCompleted ? 'completed' : 'ongoing';
    const current_stage = updatedStages.find(stg => stg.status === 'ongoing')?.stage || 
                          (allCompleted ? updatedStages[updatedStages.length - 1].stage : updatedStages[0].stage);

    const updatedJob: ProductionJob = {
      ...job,
      stages: updatedStages,
      current_stage,
      status
    };

    const updatedJobsList = currentJobs.map(j => j.id === jobId ? updatedJob : j);
    dataStore.setProductionJobs(updatedJobsList);
    
    setSelectedJob(updatedJob);
    loadData();
    triggerLoading();
    alert(`Sukses mengembalikan status tahap "${targetStage.stage}" kembali menjadi "${newStatus === 'ongoing' ? 'Diproses' : 'Antre'}".`);
  };

  const isEmployee = userRole === 'karyawan';
  const isRestrictedProduction = isEmployee || userRole === 'admin_marketplace' || userRole === 'admin_keuangan_hr';

  useEffect(() => {
    if (isEmployee && subTab !== 'tracker') setSubTab('tracker');
  }, [isEmployee, subTab]);

  const scopedProductionJobs = isEmployee && currentEmployee
    ? productionJobs.filter(job => job.department_id === currentEmployee.department_id)
    : productionJobs;

  // Kanban Query Filters
  const filteredJobs = scopedProductionJobs.filter(job => {
    // 1. Search Query
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (job.order_number || '').toLowerCase().includes(searchLower) ||
      job.product_name.toLowerCase().includes(searchLower) ||
      (job.variant || '').toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // 2. Active filter selection
    if (activeFilter === 'all') return true;
    if (activeFilter === 'ongoing') return job.status === 'ongoing';
    if (activeFilter === 'kendala') return hasKendala(job);
    if (activeFilter === 'terlambat') return isJobOverdue(job);
    if (activeFilter === 'completed_today') return isCompletedToday(job);

    return true;
  });

  // Aksi berikutnya untuk satu job: tahap mana yang harus dimulai/diselesaikan (untuk tombol satu-tap di kartu)
  const getNextAction = (job: ProductionJob): { stage: string; action: 'start' | 'complete' } | null => {
    if (job.status === 'completed') return null;
    const ongoing = job.stages.find(stg => stg.status === 'ongoing');
    if (ongoing) return { stage: ongoing.stage, action: 'complete' };
    const pending = job.stages.find(stg => stg.status === 'pending');
    if (pending) return { stage: pending.stage, action: 'start' };
    return null;
  };

  // Count helper functions for quick-filter tabs
  const getFilterCounts = () => {
    return {
      all: scopedProductionJobs.length,
      ongoing: scopedProductionJobs.filter(j => j.status === 'ongoing').length,
      kendala: scopedProductionJobs.filter(hasKendala).length,
      terlambat: scopedProductionJobs.filter(isJobOverdue).length,
      completed_today: scopedProductionJobs.filter(isCompletedToday).length,
    };
  };

  const counts = getFilterCounts();
  const manualSelectedOutputs = manualOutputs
    .map(output => {
      const product = products.find(item => item.id === output.product_id);
      return product ? { product, target_qty: Math.max(1, Number(output.target_qty) || 1) } : null;
    })
    .filter(Boolean) as Array<{ product: Product; target_qty: number }>;
  const manualSelectedMaterials = manualMaterials
    .map(item => {
      const material = rawMaterials.find(mat => mat.id === item.material_id);
      return material ? { material, qty: Math.max(0, Number(item.qty) || 0) } : null;
    })
    .filter((item): item is { material: RawMaterial; qty: number } => Boolean(item && item.qty > 0));
  const manualBasicValid = Boolean(manualDepartmentId) && manualSelectedOutputs.length > 0;
  const manualMaterialsValid = manualSelectedMaterials.length > 0;
  const manualStagesValid = manualStages.split('\n').some(stage => stage.trim());

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-evergreen)] font-sans">{isEmployee ? 'Daftar Kerjaan' : 'Manajemen Alur Kerja Produksi'}</h1>
          <p className="text-xs text-gray-400">{isEmployee ? 'Daftar tugas aktif dan input hasil kerja harian.' : 'Pencatatan real-time alur pengerjaan pesanan tiap divisi (Eva Foam & Konveksi) serta audit log bahan baku.'}</p>
        </div>
      </div>

      {/* Sub-Tabs navigation */}
      <div className="no-print flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 w-fit gap-1 flex-wrap">
        {!isEmployee && (
          <TabButton
            active={subTab === 'order'}
            onClick={() => { setSubTab('order'); triggerLoading(); }}
            icon={Plus}
            label="Order Produksi"
          />
        )}
        <TabButton
          active={subTab === 'tracker'}
          onClick={() => { setSubTab('tracker'); triggerLoading(); }}
          icon={Clipboard}
          label={isEmployee ? 'Daftar Kerjaan' : 'Progress'}
        />
        {!isEmployee && (
          <TabButton
            active={subTab === 'finalize'}
            onClick={() => { setSubTab('finalize'); triggerLoading(); }}
            icon={CheckCircle2}
            label="Finalisasi"
          />
        )}
        {!isEmployee && (
          <TabButton
            active={subTab === 'history'}
            onClick={() => { setSubTab('history'); triggerLoading(); }}
            icon={History}
            label="Riwayat & Stok"
          />
        )}
        {!isEmployee && (
          <TabButton
            active={subTab === 'packing-docs'}
            onClick={() => { setSubTab('packing-docs'); triggerLoading(); }}
            icon={Camera}
            label="Dokumentasi Foto Packing"
          />
        )}
        {!isRestrictedProduction && (
          <TabButton
            active={subTab === 'settings'}
            onClick={() => { setSubTab('settings'); triggerLoading(); }}
            icon={Settings}
            label="Pengaturan Alur"
          />
        )}
      </div>

      {/* PENGATURAN ALUR PRODUKSI — pindahan dari menu Gudang */}
      {subTab === 'settings' && !isRestrictedProduction && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs">
            <h2 className="text-sm font-bold text-gray-800 mb-1">Tahapan Produksi per Produk</h2>
            <p className="text-xs text-gray-400 mb-4">Atur urutan tahapan kerja untuk tiap barang jadi. Produk tanpa alur khusus otomatis memakai alur bawaan divisinya.</p>
            <div className="relative mb-3 max-w-xs">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={settingsSearchQuery}
                onChange={(e) => setSettingsSearchQuery(e.target.value)}
                placeholder="Cari produk..."
                className="w-full bg-gray-50 border border-gray-200 rounded pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-evergreen"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-600 uppercase text-[10px] font-bold border-b-2 border-gray-300">
                    <th className="p-2">Produk</th>
                    <th className="p-2">Divisi</th>
                    <th className="p-2">Alur Saat Ini</th>
                    <th className="p-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter(prod =>
                      prod.name.toLowerCase().includes(settingsSearchQuery.toLowerCase()) ||
                      prod.variant.toLowerCase().includes(settingsSearchQuery.toLowerCase())
                    )
                    .map(prod => (
                      <tr key={prod.id} className="border-b border-gray-200 hover:bg-emerald-50/20">
                        <td className="p-2 font-semibold text-gray-700">{prod.name} <span className="text-gray-400 font-normal">({prod.variant})</span></td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${prod.department_id === 'dept-eva-foam' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>
                            {PRODUCTION_DEPARTMENTS.find(d => d.id === prod.department_id)?.label || prod.department_id}
                          </span>
                        </td>
                        <td className="p-2 text-gray-500" title={stagesForProduct(prod).join(' → ')}>
                          {prod.production_stages?.length ? `${prod.production_stages.length} Tahap` : 'Bawaan'}
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => { setStageEditProduct(prod); setStageEditList([...stagesForProduct(prod)]); }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 hover:bg-emerald-50 text-gray-600 rounded text-[9px] font-bold cursor-pointer"
                          >
                            <ListOrdered className="w-3 h-3" /> Atur Alur
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {products.length === 0 && <p className="text-center text-gray-400 text-xs py-6">Belum ada produk. Tambahkan produk lewat menu Gudang terlebih dahulu.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal edit alur produksi produk */}
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

      {/* TRACKER VIEW */}
      {subTab === 'tracker' && (
        <div className="space-y-6 animate-fadeIn">
          {!isEmployee && <ProductionHandoffPanel jobs={scopedProductionJobs} currentEmployee={currentEmployee} isAdmin={!isEmployee} />}

          {isEmployee && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {(() => {
                const myJobs = scopedProductionJobs.filter(job =>
                  job.status !== 'completed' &&
                  (
                    job.assigned_employees?.some(item => item.employee_id === currentEmployee?.id) ||
                    (!job.assigned_employees?.length && job.department_id === currentEmployee?.department_id)
                  )
                );
                const selectedTaskJob = myJobs.find(job => job.id === openedEmployeeJobId);
                const myPackingTasks = packingTasks.filter(task => task.employee_id === currentEmployee?.id && task.status === 'assigned');
                const selectedPackingTask = myPackingTasks.find(task => task.id === openedPackingTaskId);
                const myLogs = taskLogs.filter(log => log.employee_id === currentEmployee?.id);
                const selectedLogs = selectedTaskJob ? myLogs.filter(log => log.production_job_id === selectedTaskJob.id) : myLogs;
                return (
                  <>
                    <div className={`${selectedTaskJob || selectedPackingTask ? 'lg:col-span-5' : 'lg:col-span-12'} bg-white rounded-xl border border-gray-200 p-4 space-y-4`}>
                      <div>
                        <h3 className="font-black text-sm text-gray-800">Daftar Kerjaan Saya</h3>
                        <p className="text-xs text-gray-400">Buka salah satu kerjaan untuk input hasil atau reject.</p>
                      </div>
                      <div className="space-y-2">
                        {myJobs.length === 0 && myPackingTasks.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">Belum ada kerjaan aktif.</p>
                        ) : myJobs.map(job => {
                          const hasInputToday = myLogs.some(log => log.production_job_id === job.id && log.date === wibTodayStr());
                          return (
                            <button
                              key={job.id}
                              type="button"
                              onClick={() => {
                                setOpenedEmployeeJobId(job.id);
                                setOpenedPackingTaskId('');
                                setPackingPhoto(null);
                                setTaskJobId(job.id);
                                setTaskStage(job.current_stage);
                                setTaskName(job.current_stage);
                                setTaskQtyDone(0);
                                setTaskQtyRejected(0);
                                setTaskNotes('');
                              }}
                              className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-colors ${openedEmployeeJobId === job.id ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100 hover:bg-emerald-50/50'}`}
                            >
                              <div className="flex justify-between gap-3">
                                <div>
                                  <p className="font-black text-gray-800 text-xs">{job.product_name}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">{job.order_number || job.id}</p>
                                  {job.notes && <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{job.notes}</p>}
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-mono text-xs font-black text-[var(--color-evergreen)]">{job.qty} pcs</p>
                                  <p className="text-[10px] font-bold text-amber-700">{job.current_stage}</p>
                                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold ${hasInputToday ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>{hasInputToday ? 'Sudah input' : 'Belum input'}</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {myPackingTasks.map(task => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => {
                              setOpenedPackingTaskId(task.id);
                              setOpenedEmployeeJobId('');
                              setTaskJobId('');
                              setTaskNotes('');
                              setPackingPhoto(null);
                            }}
                            className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-colors ${openedPackingTaskId === task.id ? 'bg-sky-50 border-sky-200' : 'bg-gray-50 border-gray-100 hover:bg-sky-50/60'}`}
                          >
                            <div className="flex justify-between gap-3">
                              <div>
                                <p className="font-black text-gray-800 text-xs">Packing Order</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{task.order_number} · {task.customer_name}</p>
                                <p className="text-[10px] text-gray-500 mt-1">{task.items.map(item => `${item.qty}x ${item.product_name}`).join(', ')}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-mono text-xs font-black text-sky-700">{task.items.reduce((sum, item) => sum + item.qty, 0)} pcs</p>
                                <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold bg-sky-100 text-sky-700">Packing</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedPackingTask && <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-sm text-gray-800">Packing {selectedPackingTask.order_number}</h3>
                          <p className="text-xs text-gray-400">{selectedPackingTask.customer_name}</p>
                        </div>
                        <button type="button" onClick={() => setOpenedPackingTaskId('')} className="text-xs font-bold text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5 cursor-pointer">Tutup</button>
                      </div>
                      <div className="border border-gray-300 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-100 text-gray-700"><tr><th className="p-2 text-left font-bold">Barang</th><th className="p-2 text-right font-bold">Qty</th></tr></thead>
                          <tbody>{selectedPackingTask.items.map(item => <tr key={item.id} className="border-t border-gray-200"><td className="p-2 font-bold text-gray-800">{item.product_name}<p className="text-[10px] text-gray-400 font-normal">{item.variant}</p></td><td className="p-2 text-right font-mono font-black">{item.qty}</td></tr>)}</tbody>
                        </table>
                      </div>
                      <textarea value={taskNotes} onChange={event => setTaskNotes(event.target.value)} rows={3} placeholder="Catatan packing bila ada" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs" />
                      {isCloudEnabled && (
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Foto Dokumentasi Barang (opsional)</label>
                          <input type="file" accept="image/*" onChange={event => setPackingPhoto(event.target.files?.[0] || null)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                        </div>
                      )}
                      <button type="button" disabled={uploadingPackingPhoto} onClick={() => handleCompletePackingTask(selectedPackingTask.id)} className="w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 bg-[var(--color-evergreen)] text-white cursor-pointer hover:bg-[var(--color-evergreen-dark)] disabled:opacity-60"><CheckCircle2 className="w-4 h-4" /> {uploadingPackingPhoto ? 'Mengunggah foto...' : 'Selesai Packing'}</button>
                    </div>}

                    {selectedTaskJob && <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black text-sm text-gray-800">{selectedTaskJob.product_name}</h3>
                            <p className="text-xs text-gray-400">{selectedTaskJob.order_number || selectedTaskJob.id} · target {selectedTaskJob.qty} pcs</p>
                          </div>
                          <button type="button" onClick={() => { setOpenedEmployeeJobId(''); setTaskJobId(''); }} className="text-xs font-bold text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5 cursor-pointer">Tutup</button>
                        </div>
                      </div>

                      {/* Proses / Finish tahap saat ini */}
                      {(() => {
                        const ongoingStage = selectedTaskJob.stages.find(stg => stg.status === 'ongoing');
                        const pendingStage = selectedTaskJob.stages.find(stg => stg.status === 'pending');
                        const activeStage = ongoingStage || pendingStage;
                        if (!activeStage) return null;
                        const isLastStage = selectedTaskJob.stages.filter(stg => stg.status !== 'completed').length === 1 && !!ongoingStage;
                        const doneStages = selectedTaskJob.stages.filter(stg => stg.status === 'completed').length;
                        return (
                          <div className={`rounded-xl border p-3 space-y-2 ${ongoingStage ? 'border-amber-200 bg-amber-50/60' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Tahap Sekarang</p>
                                <p className="font-black text-gray-800">{activeStage.stage} <span className={`ml-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${ongoingStage ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-500'}`}>{ongoingStage ? 'Sedang Diproses' : 'Belum Dimulai'}</span></p>
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono shrink-0">{doneStages}/{selectedTaskJob.stages.length} tahap</p>
                            </div>
                            {ongoingStage ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const warn = isLastStage
                                    ? `Finish tahap terakhir "${activeStage.stage}"?\n\nSeluruh produksi ${selectedTaskJob.product_name} (${selectedTaskJob.qty} pcs) akan ditandai SELESAI dan stok otomatis masuk gudang.`
                                    : `Tandai tahap "${activeStage.stage}" selesai?`;
                                  if (!window.confirm(warn)) return;
                                  handleUpdateJobStage(selectedTaskJob.id, activeStage.stage, 'complete', '');
                                }}
                                className="w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Finish — {isLastStage ? 'Barang Selesai' : `Tahap ${activeStage.stage} Selesai`}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUpdateJobStage(selectedTaskJob.id, activeStage.stage, 'start', '')}
                                className="w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 bg-amber-500 text-white cursor-pointer hover:bg-amber-600"
                              >
                                ▶ Proses — Mulai Kerjakan {activeStage.stage}
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      <form onSubmit={handleSubmitEmployeeTaskLog} className="space-y-3 border border-gray-100 rounded-xl p-3 bg-gray-50/60">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Tahap</label>
                            <select value={taskStage} onChange={event => setTaskStage(event.target.value)} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs">
                              {(selectedTaskJob.stages || []).map(stage => <option key={stage.stage} value={stage.stage}>{stage.stage}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Kerjaan</label>
                            <input value={taskName} onChange={event => setTaskName(event.target.value)} placeholder="Contoh: jahit" className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Qty Selesai</label>
                            <input type="number" min={0} value={taskQtyDone || ''} onChange={event => setTaskQtyDone(Number(event.target.value))} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-mono font-bold" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Qty Reject</label>
                            <input type="number" min={0} value={taskQtyRejected || ''} onChange={event => setTaskQtyRejected(Number(event.target.value))} className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs font-mono font-bold" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Catatan</label>
                          <textarea value={taskNotes} onChange={event => setTaskNotes(event.target.value)} rows={3} placeholder="Kendala, alasan reject, atau detail pekerjaan" className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-xs" />
                        </div>
                        <button type="submit" className="w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 bg-[var(--color-evergreen)] text-white cursor-pointer hover:bg-[var(--color-evergreen-dark)]">
                          <CheckCircle2 className="w-4 h-4" />
                          Simpan Hasil Kerja
                        </button>
                      </form>

                      <div>
                        <h4 className="font-black text-xs text-gray-700 mb-2">Riwayat Kerjaan Ini</h4>
                      <div className="space-y-2 max-h-[520px] overflow-y-auto">
                        {selectedLogs.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">Belum ada riwayat untuk kerjaan ini.</p>
                        ) : selectedLogs.slice(0, 30).map(log => (
                          <div key={log.id} className="p-3 rounded-lg border border-gray-100 bg-gray-50 text-xs flex justify-between gap-3">
                            <div>
                              <p className="font-black text-gray-800">{log.task_name}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">{log.production_label} · {log.stage_name}</p>
                              {log.notes && <p className="mt-1 text-[11px] text-gray-500">{log.notes}</p>}
                            </div>
                            <div className="text-right shrink-0 font-mono">
                              <p className="font-black text-emerald-700">{log.qty_done} selesai</p>
                              {log.qty_rejected > 0 && <p className="font-bold text-rose-600">{log.qty_rejected} reject</p>}
                              <p className="text-[9px] text-gray-400 mt-1">{new Date(log.created_at).toLocaleDateString('id-ID')}</p>
                              <button type="button" onClick={() => handleDeleteEmployeeTaskLog(log.id)} className="mt-2 text-[10px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer">
                                Hapus
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      </div>
                    </div>}
                  </>
                );
              })()}
            </div>
          )}
          
          {/* SEARCH, FILTERS & CONTROLS */}
          {!isEmployee && <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              
              {/* Search bar */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nomor order, produk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-evergreen)] text-gray-800 placeholder-gray-400 transition-all font-sans"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status info banner */}
              <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span> Selesai</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[var(--color-evergreen)] block"></span> Aktif/Utama</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 block"></span> Diproses</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 block"></span> Antre</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 block"></span> Kendala</span>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              <button
                onClick={() => { setActiveFilter('all'); triggerLoading(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-[var(--color-evergreen)] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Semua <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>{counts.all}</span>
              </button>
              <button
                onClick={() => { setActiveFilter('ongoing'); triggerLoading(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeFilter === 'ongoing'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Diproses <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeFilter === 'ongoing' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>{counts.ongoing}</span>
              </button>
              <button
                onClick={() => { setActiveFilter('kendala'); triggerLoading(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeFilter === 'kendala'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Kendala <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeFilter === 'kendala' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'}`}>{counts.kendala}</span>
              </button>
              <button
                onClick={() => { setActiveFilter('terlambat'); triggerLoading(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeFilter === 'terlambat'
                    ? 'bg-red-700 text-white'
                    : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" /> Terlambat <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeFilter === 'terlambat' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800'}`}>{counts.terlambat}</span>
              </button>
              <button
                onClick={() => { setActiveFilter('completed_today'); triggerLoading(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeFilter === 'completed_today'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Selesai Hari Ini <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeFilter === 'completed_today' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>{counts.completed_today}</span>
              </button>
            </div>
          </div>}

          {/* RINGKASAN ALUR: berapa job sedang berada di tiap tahap, per departemen */}
          {!isEmployee && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {([
              { id: 'dept-eva-foam', label: 'Alur Eva Foam' },
              { id: 'dept-konveksi', label: 'Alur Konveksi' },
            ] as const).map(dept => {
              // Kolom tahap dinamis: gabungan tahap dari job aktif departemen ini (urutan sesuai alur job), fallback alur bawaan
              const stageColumns: string[] = [];
              scopedProductionJobs
                .filter(j => j.department_id === dept.id && j.status !== 'completed')
                .forEach(j => j.stages.forEach(s => { if (!stageColumns.includes(s.stage)) stageColumns.push(s.stage); }));
              if (stageColumns.length === 0) stageColumns.push(...(DEFAULT_PRODUCTION_STAGES[dept.id] || []));
              return { ...dept, stages: stageColumns };
            }).filter(dept => !isEmployee || dept.id === currentEmployee?.department_id).map(dept => {
              const deptJobs = scopedProductionJobs.filter(j => j.department_id === dept.id);
              const activeJobs = deptJobs.filter(j => j.status !== 'completed');
              const doneCount = deptJobs.filter(j => j.status === 'completed').length;
              return (
                <div key={dept.id} className="bg-white rounded-xl border border-gray-200 p-3.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{dept.label}</p>
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {dept.stages.map((stg, idx) => {
                      const count = activeJobs.filter(j => j.current_stage === stg).length;
                      return (
                        <React.Fragment key={stg}>
                          {idx > 0 && <span className="text-gray-300 shrink-0">→</span>}
                          <span className={`shrink-0 px-2 py-1 rounded-lg text-xs font-semibold border ${
                            count > 0
                              ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]'
                              : 'bg-gray-50 text-gray-400 border-gray-100'
                          }`}>
                            {stg}{count > 0 && <span className="ml-1 font-black">{count}</span>}
                          </span>
                        </React.Fragment>
                      );
                    })}
                    <span className="text-gray-300 shrink-0">→</span>
                    <span className={`shrink-0 px-2 py-1 rounded-lg text-xs font-semibold border ${
                      doneCount > 0 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-gray-50 text-gray-400 border-gray-100'
                    }`}>
                      Selesai{doneCount > 0 && <span className="ml-1 font-black">{doneCount}</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>}

          {/* LOADING STATE */}
          {!isEmployee && (isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3 bg-white rounded-xl border border-gray-100">
              <Loader2 className="w-8 h-8 text-[var(--color-evergreen)] animate-spin" />
              <p className="text-xs text-gray-500 font-medium">Memuat data alur kerja...</p>
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${isEmployee ? '' : 'lg:grid-cols-2'} gap-6 items-start`}>
              
              {/* DEPARTEMEN EVA FOAM COLUMN */}
              {(!isEmployee || currentEmployee?.department_id === 'dept-eva-foam') && <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between border-b border-gray-100 p-4 bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                    <h3 className="font-bold text-sm text-[var(--color-evergreen)] uppercase tracking-wide">1. Departemen Eva Foam</h3>
                  </div>
                  <span className="text-[11px] bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full font-black font-mono">
                    {filteredJobs.filter(j => j.department_id === 'dept-eva-foam').length} Pekerjaan
                  </span>
                </div>

                <div className="divide-y divide-gray-100 max-h-[650px] overflow-y-auto pr-1">
                  {filteredJobs.filter(j => j.department_id === 'dept-eva-foam').length === 0 ? (
                    <div className="text-center py-16 p-6">
                      <Clipboard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400 italic">Tidak ada antrean pengerjaan.</p>
                    </div>
                  ) : (
                    filteredJobs
                      .filter(j => j.department_id === 'dept-eva-foam')
                      .map(job => {
                        const { sufficient } = checkMaterialSufficiency(job);
                        const delay = isJobOverdue(job);
                        const issue = hasKendala(job);

                        return (
                          <div 
                            key={job.id} 
                            onClick={() => setSelectedJob(job)}
                            className="group relative p-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-center justify-between hover:bg-emerald-50/20 transition-all cursor-pointer"
                          >
                            {/* 1. WO & PRODUCT INFO (5 columns on md+) */}
                            <div className="w-full md:col-span-5 space-y-1 text-left">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[9px] font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-emerald-100">
                                  {job.order_number || 'Internal'}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  job.status === 'completed' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {job.status === 'completed' ? 'Selesai' : 'Diproses'}
                                </span>
                                {issue && (
                                  <span className="text-[8px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5" /> KENDALA
                                  </span>
                                )}
                              </div>
                              <h4 className="font-extrabold text-gray-900 text-xs tracking-tight leading-snug group-hover:text-[var(--color-evergreen)] transition-colors">{job.product_name}</h4>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
                                <span>Varian: <strong className="text-gray-600 font-semibold">{job.variant}</strong></span>
                                <span>&bull;</span>
                                <span className={`inline-flex items-center gap-1 font-bold ${sufficient ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  <span className={`w-1 h-1 rounded-full ${sufficient ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                  Bahan {sufficient ? 'Tersedia' : 'Kurang'}
                                </span>
                              </div>
                            </div>

                            {/* 2. PROGRESS BAR & STAGE (4 columns on md+) */}
                            <div className="w-full md:col-span-4 space-y-1.5 text-left">
                              <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                                <span>Tahap: <strong className="text-[var(--color-evergreen)] font-extrabold">{job.current_stage}</strong></span>
                                <span>{job.stages.filter(s => s.status === 'completed').length} / {job.stages.length}</span>
                              </div>
                              
                              <div className="flex gap-0.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                {job.stages.map((stg, index) => {
                                  let bgClass = 'bg-gray-200/50';
                                  if (stg.status === 'completed') bgClass = 'bg-emerald-500';
                                  else if (stg.status === 'ongoing') {
                                    bgClass = hasKendala(job) ? 'bg-rose-500' : 'bg-[var(--color-evergreen)]';
                                  }
                                  return (
                                    <div
                                      key={index}
                                      className={`h-full flex-1 ${bgClass} transition-all`}
                                      title={`${stg.stage}: ${stg.status}`}
                                    />
                                  );
                                })}
                              </div>

                              {/* Tombol satu-tap untuk operator */}
                              {!isEmployee && (() => {
                                const na = getNextAction(job);
                                if (!na) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleUpdateJobStage(job.id, na.stage, na.action, ''); }}
                                    className={`mt-1.5 w-full text-xs font-bold py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
                                      na.action === 'start'
                                        ? 'bg-white border border-[var(--color-evergreen)] text-[var(--color-evergreen)] hover:bg-emerald-50'
                                        : 'bg-[var(--color-evergreen)] text-white hover:bg-[var(--color-evergreen-dark)]'
                                    }`}
                                  >
                                    {na.action === 'start' ? `▶ Mulai: ${na.stage}` : `✓ Selesaikan: ${na.stage}`}
                                  </button>
                                );
                              })()}
                            </div>

                            {/* 3. SPECS & DEADLINE (3 columns on md+) */}
                            <div className="w-full md:col-span-3 text-left md:text-right flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2">
                              <div className="flex items-center gap-2 md:flex-col md:items-end md:gap-0.5">
                                <span className="font-mono text-xs font-black text-gray-900 px-2 py-0.5 bg-gray-100 rounded">
                                  {job.qty} Pcs
                                </span>
                                <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                                  <User className="w-3 h-3 text-gray-400" />
                                  <span className="truncate max-w-[80px]">{job.stages.find(s => s.status === 'ongoing')?.updated_by || '—'}</span>
                                </span>
                              </div>

                              <div className="flex flex-col items-end">
                                <span className={`text-[10px] font-bold flex items-center gap-1 ${delay ? 'text-red-600' : 'text-gray-400'}`}>
                                  <Calendar className="w-3 h-3" />
                                  {getJobDeadlineStr(job)}
                                </span>
                                <span className="text-[9.5px] font-black text-[var(--color-evergreen)] hover:underline flex items-center gap-0.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                  Atur <ChevronRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>}

              {/* DEPARTEMEN KONVEKSI COLUMN */}
              {(!isEmployee || currentEmployee?.department_id === 'dept-konveksi') && <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between border-b border-gray-100 p-4 bg-sky-50/20">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-sky-600"></div>
                    <h3 className="font-bold text-sm text-sky-900 uppercase tracking-wide">2. Departemen Konveksi (Jahit)</h3>
                  </div>
                  <span className="text-[11px] bg-sky-100 text-sky-900 px-2.5 py-0.5 rounded-full font-black font-mono">
                    {filteredJobs.filter(j => j.department_id === 'dept-konveksi').length} Pekerjaan
                  </span>
                </div>

                <div className="divide-y divide-gray-100 max-h-[650px] overflow-y-auto pr-1">
                  {filteredJobs.filter(j => j.department_id === 'dept-konveksi').length === 0 ? (
                    <div className="text-center py-16 p-6">
                      <Clipboard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-400 italic">Tidak ada antrean pengerjaan.</p>
                    </div>
                  ) : (
                    filteredJobs
                      .filter(j => j.department_id === 'dept-konveksi')
                      .map(job => {
                        const { sufficient } = checkMaterialSufficiency(job);
                        const delay = isJobOverdue(job);
                        const issue = hasKendala(job);

                        return (
                          <div 
                            key={job.id} 
                            onClick={() => setSelectedJob(job)}
                            className="group relative p-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-center justify-between hover:bg-sky-50/20 transition-all cursor-pointer"
                          >
                            {/* 1. WO & PRODUCT INFO (5 columns on md+) */}
                            <div className="w-full md:col-span-5 space-y-1 text-left">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[9px] font-mono bg-sky-50 text-sky-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-sky-100">
                                  {job.order_number || 'Internal'}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  job.status === 'completed' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {job.status === 'completed' ? 'Selesai' : 'Diproses'}
                                </span>
                                {issue && (
                                  <span className="text-[8px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">
                                    <AlertTriangle className="w-2.5 h-2.5" /> KENDALA
                                  </span>
                                )}
                              </div>
                              <h4 className="font-extrabold text-gray-900 text-xs tracking-tight leading-snug group-hover:text-sky-800 transition-colors">{job.product_name}</h4>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
                                <span>Varian: <strong className="text-gray-600 font-semibold">{job.variant}</strong></span>
                                <span>&bull;</span>
                                <span className={`inline-flex items-center gap-1 font-bold ${sufficient ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  <span className={`w-1 h-1 rounded-full ${sufficient ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                  Bahan {sufficient ? 'Tersedia' : 'Kurang'}
                                </span>
                              </div>
                            </div>

                            {/* 2. PROGRESS BAR & STAGE (4 columns on md+) */}
                            <div className="w-full md:col-span-4 space-y-1.5 text-left">
                              <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                                <span>Tahap: <strong className="text-sky-800 font-extrabold">{job.current_stage}</strong></span>
                                <span>{job.stages.filter(s => s.status === 'completed').length} / {job.stages.length}</span>
                              </div>
                              
                              <div className="flex gap-0.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                {job.stages.map((stg, index) => {
                                  let bgClass = 'bg-gray-200/50';
                                  if (stg.status === 'completed') bgClass = 'bg-emerald-500';
                                  else if (stg.status === 'ongoing') {
                                    bgClass = hasKendala(job) ? 'bg-rose-500' : 'bg-sky-700';
                                  }
                                  return (
                                    <div
                                      key={index}
                                      className={`h-full flex-1 ${bgClass} transition-all`}
                                      title={`${stg.stage}: ${stg.status}`}
                                    />
                                  );
                                })}
                              </div>

                              {/* Tombol satu-tap untuk operator */}
                              {!isEmployee && (() => {
                                const na = getNextAction(job);
                                if (!na) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleUpdateJobStage(job.id, na.stage, na.action, ''); }}
                                    className={`mt-1.5 w-full text-xs font-bold py-1.5 px-2 rounded-lg cursor-pointer transition-colors ${
                                      na.action === 'start'
                                        ? 'bg-white border border-sky-700 text-sky-800 hover:bg-sky-50'
                                        : 'bg-sky-700 text-white hover:bg-sky-800'
                                    }`}
                                  >
                                    {na.action === 'start' ? `▶ Mulai: ${na.stage}` : `✓ Selesaikan: ${na.stage}`}
                                  </button>
                                );
                              })()}
                            </div>

                            {/* 3. SPECS & DEADLINE (3 columns on md+) */}
                            <div className="w-full md:col-span-3 text-left md:text-right flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2">
                              <div className="flex items-center gap-2 md:flex-col md:items-end md:gap-0.5">
                                <span className="font-mono text-xs font-black text-gray-900 px-2 py-0.5 bg-gray-100 rounded">
                                  {job.qty} Pcs
                                </span>
                                <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                                  <User className="w-3 h-3 text-gray-400" />
                                  <span className="truncate max-w-[80px]">{job.stages.find(s => s.status === 'ongoing')?.updated_by || '—'}</span>
                                </span>
                              </div>

                              <div className="flex flex-col items-end">
                                <span className={`text-[10px] font-bold flex items-center gap-1 ${delay ? 'text-red-600' : 'text-gray-400'}`}>
                                  <Calendar className="w-3 h-3" />
                                  {getJobDeadlineStr(job)}
                                </span>
                                <span className="text-[9.5px] font-black text-sky-800 hover:underline flex items-center gap-0.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                  Atur <ChevronRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>}

            </div>
          ))}
        </div>
      )}

      {/* DETAIL WORKFLOW DRAWER / MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
            
            {/* Modal Header */}
            <div className="bg-[var(--color-evergreen)] text-white p-5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-white/20 text-white rounded text-[10px] font-mono font-bold uppercase tracking-wider border border-white/10">
                    {selectedJob.order_number || 'INTERNAL JOB'}
                  </span>
                  <h3 className="text-base font-black tracking-wide uppercase">{selectedJob.product_name}</h3>
                </div>
                <p className="text-xs text-emerald-100 font-medium">
                  Divisi: {selectedJob.department_id === 'dept-eva-foam' ? 'Eva Foam' : 'Konveksi (Jahit)'} &middot; Varian: {selectedJob.variant} &middot; Qty: <span className="font-bold underline">{selectedJob.qty} Pcs</span>
                </p>
              </div>
              <button 
                onClick={() => { setSelectedJob(null); setModalNote(''); }}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: Production Details & Progressive Stepper */}
              <div className={`${isEmployee ? 'md:col-span-12' : 'md:col-span-7'} space-y-6`}>
                
                {/* Stepper Title */}
                <div>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Progress Stepper Tahap Produksi</h4>
                  
                  <div className="space-y-3">
                    {selectedJob.stages.map((stg, sIdx) => {
                      const isCompleted = stg.status === 'completed';
                      const isOngoing = stg.status === 'ongoing';
                      const isPending = stg.status === 'pending';
                      const isIssue = stg.notes && (
                        stg.notes.toLowerCase().includes('kendala') || 
                        stg.notes.toLowerCase().includes('rusak') || 
                        stg.notes.toLowerCase().includes('macet')
                      );

                      // Colors mapped according to guidelines
                      let statusBg = 'bg-gray-100 border-gray-200 text-gray-500';
                      let labelText = 'Antre';
                      if (isCompleted) {
                        statusBg = 'bg-emerald-50 border-emerald-200 text-emerald-800';
                        labelText = 'Selesai';
                      } else if (isOngoing) {
                        statusBg = isIssue 
                          ? 'bg-rose-50 border-rose-300 text-rose-800' 
                          : 'bg-[var(--color-evergreen)]/10 border-[var(--color-evergreen)]/20 text-[var(--color-evergreen)] font-bold';
                        labelText = isIssue ? 'KENDALA' : 'Sedang Diproses';
                      }

                      return (
                        <div 
                          key={sIdx} 
                          className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${statusBg} ${isOngoing ? 'ring-2 ring-[var(--color-evergreen)]/10' : ''}`}
                        >
                          <div className="flex flex-col items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              isCompleted ? 'bg-emerald-500 text-white' : isOngoing ? 'bg-[var(--color-evergreen)] text-white' : 'bg-gray-200 text-gray-500'
                            }`}>
                              {sIdx + 1}
                            </div>
                            {sIdx < selectedJob.stages.length - 1 && (
                              <div className="w-0.5 h-10 bg-gray-200 my-1"></div>
                            )}
                          </div>

                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold font-sans uppercase tracking-wide">{stg.stage}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">{labelText}</span>
                            </div>

                            {stg.updated_at && (
                              <p className="text-[9.5px] opacity-75 font-mono">
                                Diperbarui oleh: <span className="font-bold underline">{stg.updated_by || 'PIC'}</span> &middot; {new Date(stg.updated_at).toLocaleString('id-ID')}
                              </p>
                            )}

                            {stg.notes && (
                              <div className="mt-1.5 p-2 bg-white/60 rounded border border-black/5 text-[10.5px] italic text-gray-700 font-mono">
                                Catatan: {stg.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Estimate Raw Materials Used */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">Estimasi Alokasi Bahan Baku</h4>
                  
                  {(() => {
                    const { sufficient, details } = checkMaterialSufficiency(selectedJob);
                    return (
                      <div className="space-y-2">
                        {details.length === 0 ? (
                          <p className="text-xs text-gray-400 italic font-mono">Formula bahan baku untuk produk ini tidak didefinisikan.</p>
                        ) : (
                          details.map((det, idx) => {
                            const matSuff = det.available >= det.required;
                            return (
                              <div key={idx} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-100 text-xs font-medium">
                                <span className="text-gray-700 font-sans">{det.name}</span>
                                <div className="text-right space-y-0.5 font-mono">
                                  <p className="text-[11px] font-bold text-gray-800">
                                    Butuh: {det.required} Unit
                                  </p>
                                  <p className={`text-[10px] font-semibold ${matSuff ? 'text-emerald-700' : 'text-rose-600'}`}>
                                    Sedia di Gudang: {det.available} Unit
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}

                        <div className={`p-3 rounded-lg text-xs font-bold border mt-2 flex items-center gap-1.5 ${
                          sufficient ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'
                        }`}>
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {sufficient 
                            ? 'Bahan baku lengkap & mencukupi di gudang utama.' 
                            : 'PERINGATAN: Stok bahan baku di gudang kurang untuk melengkapi job produksi ini.'
                          }
                        </div>
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* RIGHT COLUMN: Operator Field Interaction panel */}
              {!isEmployee && <div className="md:col-span-5 bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-6 h-fit">
                
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">Portal Operator Lapangan</h4>
                  <p className="text-[11px] text-gray-400">Gunakan panel di bawah ini untuk memperbarui progres pengerjaan.</p>
                </div>

                {/* ACTIVE STAGE CONTROL INTERACTIVE PANEL */}
                {selectedJob.status !== 'completed' ? (
                  <div className="space-y-4">
                    {(() => {
                      // Find the active stage to update
                      let activeStageIndex = selectedJob.stages.findIndex(stg => stg.status === 'ongoing');
                      let actionType: 'start' | 'complete' = 'complete';
                      
                      if (activeStageIndex === -1) {
                        // If no ongoing, find the first pending
                        activeStageIndex = selectedJob.stages.findIndex(stg => stg.status === 'pending');
                        actionType = 'start';
                      }

                      if (activeStageIndex === -1) return null; // All done or fallback
                      const activeStageObj = selectedJob.stages[activeStageIndex];

                      return (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 shadow-3xs">
                          <div className="border-b border-gray-100 pb-2.5">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                              TAHAP AKTIF
                            </span>
                            <h5 className="font-bold text-xs text-gray-800 mt-1 uppercase font-sans">
                              {activeStageObj.stage} ({actionType === 'start' ? 'Belum Mulai' : 'Sedang Berjalan'})
                            </h5>
                          </div>

                          {/* Notes Textarea input */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              Catatan Progres / Laporan Kendala:
                            </label>
                            <textarea
                              rows={3}
                              placeholder="Ketik detail operator pelaksana, kendala mesin, keterlambatan bahan, dll..."
                              value={modalNote}
                              onChange={(e) => setModalNote(e.target.value)}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-[var(--color-evergreen)] font-mono placeholder-gray-400"
                            />
                          </div>

                          {/* Primary "Selesaikan Tahap" / "Mulai Kerja" button */}
                          <div className="space-y-2.5">
                            {actionType === 'start' ? (
                              <button
                                type="button"
                                onClick={() => handleUpdateJobStage(selectedJob.id, activeStageObj.stage, 'start')}
                                className="w-full bg-[var(--color-evergreen)] hover:bg-[#122d20] text-white font-bold text-xs px-4 py-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
                              >
                                <PlayButtonIcon className="w-4 h-4 text-emerald-200" />
                                Mulai Kerjakan Tahap: {activeStageObj.stage}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleUpdateJobStage(selectedJob.id, activeStageObj.stage, 'complete')}
                                className="w-full bg-[var(--color-evergreen)] hover:bg-[#122d20] text-white font-black text-xs px-4 py-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all uppercase tracking-wider"
                              >
                                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-300" />
                                Selesaikan Tahap: {activeStageObj.stage}
                              </button>
                            )}

                            {/* Secondary Action: Save Only Notes without switching stage */}
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveOnlyNotes(selectedJob.id)}
                                className="bg-white hover:bg-gray-50 text-[var(--color-evergreen)] border border-gray-200 font-bold text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Simpan Catatan
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveOnlyNotes(selectedJob.id, true)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Laporkan Kendala
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-xl p-4 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
                    <h5 className="font-bold text-xs uppercase font-sans">Produksi Selesai!</h5>
                    <p className="text-[11px] text-emerald-700 leading-relaxed font-sans">
                      Seluruh tahapan produksi untuk pekerjaan ini telah selesai dikerjakan &amp; stok telah dimasukkan ke gudang barang jadi.
                    </p>
                  </div>
                )}

                {/* DANGEROUS BACKSTAGE ROLLBACK BUTTON */}
                {selectedJob.stages.some(stg => stg.status !== 'pending') && (
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl space-y-3">
                    <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" /> Area Koreksi / Rollback Status
                    </p>
                    <p className="text-[10.5px] text-rose-700 leading-normal font-sans">
                      Gunakan tombol di bawah ini apabila operator salah mengklik penyelesaian tahap. Sistem akan menarik kembali status ke tahap sebelumnya.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRevertJobStage(selectedJob.id)}
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
                    >
                      <History className="w-3.5 h-3.5" />
                      Kembalikan Tahap Sebelumnya (Mundur)
                    </button>
                  </div>
                )}

              </div>}

            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-100 p-4 flex justify-between items-center text-[10px] text-gray-400">
              <span>Sistem Manajemen Alur Kerja Produksi &middot; {brandName()}</span>
              <button
                type="button"
                onClick={() => { setSelectedJob(null); setModalNote(''); }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Tutup Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN WORKFLOW VIEWS */}
      {!isEmployee && (subTab === 'order' || subTab === 'finalize') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* LEFT COLUMN: Input Production Logs */}
          <div className={`${subTab === 'finalize' ? 'hidden' : subTab === 'order' && manualStep === 1 ? 'lg:col-span-12' : subTab === 'order' ? 'lg:col-span-7' : 'lg:col-span-5'} space-y-6`}>
            {!isRestrictedProduction ? (
              <>
              {subTab === 'order' && <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-2xs">
                <div className="border-b border-gray-100 pb-3 flex items-center gap-1.5">
                  <Clipboard className="w-4.5 h-4.5 text-[var(--color-evergreen)]" />
                  <h3 className="font-bold text-sm text-gray-800">Buat Order Produksi Manual</h3>
                </div>

                <form onSubmit={handleCreateManualProductionJob} className="space-y-4">
                  {/* Indikator progres: selesai = centang, aktif = solid, terkunci = abu redup */}
                  <div className="flex items-center">
                    {[
                      { step: 1, label: 'Detail', unlocked: true, done: manualBasicValid },
                      { step: 2, label: 'Bahan', unlocked: manualBasicValid, done: manualMaterialsValid },
                      { step: 3, label: 'Tahapan', unlocked: manualBasicValid && manualMaterialsValid, done: manualStagesValid },
                    ].map((item, index) => (
                      <React.Fragment key={item.step}>
                        {index > 0 && <div className={`flex-1 h-0.5 mx-2 rounded ${item.unlocked ? 'bg-emerald-300' : 'bg-gray-200'}`} />}
                        <button
                          type="button"
                          onClick={() => {
                            if (item.step === 2 && !manualBasicValid) return alert('Pilih departemen dan output produk dulu.');
                            if (item.step === 3 && (!manualBasicValid || !manualMaterialsValid)) return alert('Lengkapi departemen, output, dan bahan dulu.');
                            setManualStep(item.step as 1 | 2 | 3);
                          }}
                          className={`flex items-center gap-1.5 ${item.unlocked ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                          title={item.unlocked ? `Buka langkah ${item.step}` : 'Lengkapi langkah sebelumnya dulu'}
                        >
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 ${
                            manualStep === item.step
                              ? 'bg-[var(--color-evergreen)] text-white border-[var(--color-evergreen)]'
                              : item.done && item.unlocked
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-400'
                                : 'bg-white text-gray-400 border-gray-300'
                          }`}>
                            {item.done && item.unlocked && manualStep !== item.step ? <Check className="w-3.5 h-3.5" /> : item.step}
                          </span>
                          <span className={`text-[11px] font-bold ${manualStep === item.step ? 'text-[var(--color-evergreen)]' : item.unlocked ? 'text-gray-600' : 'text-gray-400'}`}>{item.label}</span>
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  {manualStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-700">Departemen Produksi</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {PRODUCTION_DEPARTMENTS.filter(department => !lockedManualDepartment || department.id === lockedManualDepartment).map(department => {
                            const isSelected = manualDepartmentId === department.id;
                            const palette = department.id === 'dept-eva-foam'
                              ? { selected: 'bg-emerald-500 border-emerald-600 text-white', idle: 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100' }
                              : { selected: 'bg-sky-500 border-sky-600 text-white', idle: 'bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100' };
                            return (
                              <button
                                key={department.id}
                                type="button"
                                onClick={() => setManualDepartment(department.id)}
                                className={`relative text-left rounded-xl border-2 p-3 cursor-pointer transition-colors ${isSelected ? `${palette.selected} shadow-sm` : palette.idle}`}
                              >
                                {isSelected && (
                                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/25 flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                  </span>
                                )}
                                <p className="text-xs font-black pr-6">{department.label}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500">Produk yang Akan Dibuat</label>
                        {!manualDepartmentId && <p className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-[11px] text-amber-800">Pilih departemen dulu agar produk dan karyawan tidak tercampur.</p>}
                        {manualOutputs.map((output, index) => (
                          <div key={index} className="grid grid-cols-12 gap-2">
                            <select
                              value={output.product_id}
                              onChange={event => {
                                const productId = event.target.value;
                                setManualOutputs(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, product_id: productId } : item));
                                // Output pertama menentukan alur: prefill tahapan dari pengaturan produk
                                if (index === 0 && productId) {
                                  const product = products.find(p => p.id === productId);
                                  if (product) setManualStages(stagesForProduct(product).join('\n'));
                                }
                              }}
                              className="col-span-8 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-evergreen)]"
                              disabled={!manualDepartmentId}
                              required={index === 0}
                            >
                              <option value="">Pilih produk jadi</option>
                              {manualProducts.map(product => <option key={product.id} value={product.id}>{product.name} ({product.variant})</option>)}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={output.target_qty || ''}
                              onChange={event => setManualOutputs(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, target_qty: Number(event.target.value) } : item))}
                              className="col-span-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold"
                            />
                            <button type="button" title="Hapus baris" onClick={() => setManualOutputs(items => items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index))} className="col-span-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-xs font-bold cursor-pointer">×</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setManualOutputs(items => [...items, { product_id: '', target_qty: 1 }])} className="text-xs font-semibold text-gray-500 hover:text-[var(--color-evergreen)] border border-dashed border-gray-300 hover:border-emerald-300 rounded-lg px-3 py-1.5 flex items-center gap-1 cursor-pointer transition-colors"><Plus className="w-3.5 h-3.5" /> Tambah output</button>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Karyawan Ditugaskan</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-2">
                          {!manualDepartmentId && <p className="text-[11px] text-gray-400 col-span-full">Pilih departemen dulu.</p>}
                          {manualDepartmentId && manualAssignableEmployees.length === 0 && <p className="text-[11px] text-gray-400 col-span-full">Belum ada karyawan aktif di departemen ini.</p>}
                          {manualAssignableEmployees.map(employee => (
                            <label key={employee.id} className="flex items-center gap-2 text-xs text-gray-700">
                              <input type="checkbox" checked={manualEmployeeIds.includes(employee.id)} onChange={event => setManualEmployeeIds(ids => event.target.checked ? [...ids, employee.id] : ids.filter(id => id !== employee.id))} />
                              <span>{employee.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Catatan Instruksi</label>
                        <textarea value={manualNotes} onChange={event => setManualNotes(event.target.value)} rows={2} placeholder="Instruksi warna, prioritas, atau detail custom..." className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-evergreen)]" />
                      </div>
                    </div>
                  )}

                  {manualStep === 2 && (
                    <div className="space-y-3">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                        {manualDepartment && <p><b>Departemen:</b> {manualDepartment.label}</p>}
                        {manualSelectedOutputs.map(item => <p key={item.product.id}><b>{item.product.name}</b> · target {item.target_qty} pcs</p>)}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500">Bahan Baku Diambil</label>
                        {manualMaterials.map((material, index) => {
                          const selected = rawMaterials.find(item => item.id === material.material_id);
                          return (
                            <div key={index} className="grid grid-cols-12 gap-2">
                              <select value={material.material_id} onChange={event => setManualMaterials(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, material_id: event.target.value } : item))} className="col-span-8 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-evergreen)]">
                                <option value="">Pilih bahan</option>
                                {manualFilteredMaterials.map(item => <option key={item.id} value={item.id}>{item.name} - stok {item.current_stock} {item.unit}</option>)}
                              </select>
                              <input type="number" min={0} step="0.01" value={material.qty || ''} onChange={event => setManualMaterials(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, qty: Number(event.target.value) } : item))} className="col-span-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold" placeholder={selected?.unit || 'Qty'} />
                              <button type="button" title="Hapus baris" onClick={() => setManualMaterials(items => items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index))} className="col-span-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 text-xs font-bold cursor-pointer">×</button>
                            </div>
                          );
                        })}
                        <button type="button" onClick={() => setManualMaterials(items => [...items, { material_id: '', qty: 1 }])} className="text-xs font-semibold text-gray-500 hover:text-[var(--color-evergreen)] border border-dashed border-gray-300 hover:border-emerald-300 rounded-lg px-3 py-1.5 flex items-center gap-1 cursor-pointer transition-colors"><Plus className="w-3.5 h-3.5" /> Tambah bahan</button>
                      </div>
                    </div>
                  )}

                  {manualStep === 3 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Tahapan Produksi</label>
                        <textarea value={manualStages} onChange={event => setManualStages(event.target.value)} rows={4} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-evergreen)]" />
                        <p className="text-[10px] text-gray-400 mt-1">Satu baris = satu tahap. Bisa disesuaikan per order.</p>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-2 text-gray-600">
                        <p className="font-bold text-gray-700">Ringkasan — periksa sebelum membuat order</p>
                        <p><b>Departemen:</b> {manualDepartment?.label || '-'}</p>
                        <div>
                          <p className="font-semibold text-gray-700">Output produk:</p>
                          {manualSelectedOutputs.map(item => (
                            <p key={item.product.id} className="pl-2">• {item.product.name} ({item.product.variant}) — target {item.target_qty} pcs</p>
                          ))}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-700">Bahan baku yang akan dipotong dari stok:</p>
                          {manualSelectedMaterials.map(item => (
                            <p key={item.material.id} className="pl-2">• {item.material.name} — {item.qty} {item.material.unit}</p>
                          ))}
                        </div>
                        <p><b>Karyawan:</b> {manualEmployeeIds.length > 0 ? `${manualEmployeeIds.length} orang ditugaskan` : ''}</p>
                        {manualEmployeeIds.length === 0 && (
                          <p className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Belum ada karyawan ditugaskan — order tetap bisa dibuat, tugaskan nanti dari tracker.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {manualStep > 1 && <button type="button" onClick={() => setManualStep((manualStep - 1) as 1 | 2 | 3)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-bold text-xs cursor-pointer">Kembali</button>}
                    {manualStep < 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (manualStep === 1 && !manualBasicValid) return alert('Pilih departemen dan minimal satu output produk.');
                          if (manualStep === 2 && !manualMaterialsValid) return alert('Pilih minimal satu bahan baku yang dipakai.');
                          setManualStep((manualStep + 1) as 1 | 2 | 3);
                        }}
                        className="flex-1 bg-[var(--color-evergreen)] hover:bg-[var(--color-evergreen-dark)] text-white py-2.5 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Lanjut
                      </button>
                    ) : (
                      <button type="submit" disabled={!manualStagesValid || !manualMaterialsValid} className={`flex-1 py-2.5 rounded-lg font-bold text-xs shadow-md flex items-center justify-center gap-1.5 ${manualStagesValid && manualMaterialsValid ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                        <AlertTriangle className="w-4 h-4" />
                        Buat Order &amp; Potong Bahan
                      </button>
                    )}
                  </div>
                </form>
              </div>}

              </>
            ) : (
              <div className="bg-amber-50 text-[var(--color-evergreen)] border border-amber-200 rounded-xl p-6 text-center space-y-3">
                <Hammer className="w-12 h-12 mx-auto text-[var(--color-evergreen)] opacity-75" />
                <h3 className="font-bold text-base">Hanya Bisa Mengamati</h3>
                <p className="text-xs text-gray-600">
                  Menu pencatatan konversi bahan baku ini dinonaktifkan untuk role akun marketing / keuangan Anda.
                </p>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Active stock of Finished Goods & movements */}
          <div className={`${subTab === 'order' && manualStep === 1 ? 'hidden' : subTab === 'finalize' ? 'lg:col-span-12' : subTab === 'order' ? 'lg:col-span-5' : 'lg:col-span-7'} space-y-6`}>
            {subTab === 'order' && manualStep > 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-2xs">
                <div>
                  <h3 className="font-bold text-sm text-gray-800 font-sans">Order Produksi Berjalan</h3>
                  <p className="text-xs text-gray-400">Ringkasan order aktif setelah dibuat dari form manual.</p>
                </div>
                <div className="space-y-2 max-h-[520px] overflow-y-auto">
                  {productionJobs.filter(job => job.status !== 'completed').length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">Belum ada order produksi berjalan.</p>
                  ) : productionJobs.filter(job => job.status !== 'completed').slice(0, 12).map(job => (
                    <button key={job.id} type="button" onClick={() => { setSelectedJob(job); setSubTab('tracker'); }} className="w-full text-left p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-emerald-50/50 cursor-pointer">
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-gray-800">{job.order_number || job.id}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{job.product_name}</p>
                          {job.assigned_employees && job.assigned_employees.length > 0 && <p className="text-[10px] text-gray-400 mt-1">{job.assigned_employees.map(item => item.employee_name).join(', ')}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-xs font-black text-[var(--color-evergreen)]">{job.qty} pcs</p>
                          <p className="text-[10px] text-amber-700 font-bold">{job.current_stage}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {subTab === 'finalize' && !isRestrictedProduction && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-2xs">
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-gray-800 font-sans">Finalisasi Hasil Order Produksi</h3>
                    <p className="text-xs text-gray-400">Barang bagus masuk stok produk jadi, barang reject dicatat terpisah.</p>
                  </div>
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                </div>

                <form onSubmit={handleFinalizeManualProduction} className="space-y-4">
                  <select
                    value={finalJobId}
                    onChange={event => syncFinalOutputsForJob(event.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-evergreen)]"
                  >
                    <option value="">Pilih order produksi berjalan</option>
                    {productionJobs.filter(job => job.status !== 'completed').map(job => (
                      <option key={job.id} value={job.id}>{job.order_number || job.id} - {job.product_name}</option>
                    ))}
                  </select>

                  {finalOutputs.map((output, index) => {
                    const product = products.find(item => item.id === output.product_id);
                    const jobOutput = productionJobs.find(job => job.id === finalJobId)?.outputs?.find(item => item.product_id === output.product_id);
                    return (
                      <div key={`${output.product_id}-${index}`} className="border border-gray-100 rounded-xl p-3 bg-gray-50 space-y-3">
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-gray-800">{product?.name || output.product_id}</p>
                            <p className="text-[10px] text-gray-400">Target: {jobOutput?.target_qty || 0} pcs</p>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">{product?.variant}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Bagus</label>
                            <input type="number" min={0} value={output.good_qty || ''} onChange={event => setFinalOutputs(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, good_qty: Number(event.target.value) } : item))} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Reject</label>
                            <input type="number" min={0} value={output.reject_qty || ''} onChange={event => setFinalOutputs(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, reject_qty: Number(event.target.value) } : item))} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono font-bold" />
                          </div>
                        </div>
                        <input value={output.reject_reason} onChange={event => setFinalOutputs(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, reject_reason: event.target.value } : item))} placeholder="Alasan reject bila ada" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs" />
                      </div>
                    );
                  })}

                  <button type="submit" disabled={!finalJobId} className={`w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 ${!finalJobId ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    Finalisasi Produksi
                  </button>
                </form>
              </div>
            )}

            {subTab === 'finalize' && <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-2xs">
              <div>
                <h3 className="font-bold text-sm text-gray-800 font-sans">Barang Reject Produksi</h3>
                <p className="text-xs text-gray-400">Catatan barang reject yang masih disimpan atau perlu tindak lanjut.</p>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {rejectedGoods.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">Belum ada barang reject tercatat.</p>
                ) : rejectedGoods.slice(0, 10).map(item => (
                  <div key={item.id} className="p-3 rounded-lg border border-rose-100 bg-rose-50/40 text-xs flex justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-800">{item.product_name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{item.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono font-black text-rose-700">{item.qty} pcs</p>
                      <p className="text-[9px] uppercase text-rose-500 font-bold">{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>}

          </div>

        </div>
      )}

      {!isEmployee && subTab === 'history' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="no-print flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 w-fit gap-1 flex-wrap">
            <TabButton active={historyView === 'materials'} onClick={() => setHistoryView('materials')} icon={Box} label="Stok Bahan Baku" />
            <TabButton active={historyView === 'products'} onClick={() => setHistoryView('products')} icon={Clipboard} label="Stok Barang Jadi" />
            <TabButton active={historyView === 'reject'} onClick={() => setHistoryView('reject')} icon={Trash2} label="Barang Reject" />
            <TabButton active={historyView === 'movements'} onClick={() => setHistoryView('movements')} icon={History} label="Riwayat Mutasi" />
          </div>

          {historyView === 'materials' && <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-gray-800">Status Stok Bahan Baku</h3>
              <p className="text-xs text-gray-400">Monitoring sisa bahan baku di pabrik {brandName()}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rawMaterials.map((mat) => {
                const isCritical = mat.current_stock <= mat.stock_minimum;
                return (
                  <div
                    key={mat.id}
                    className={`p-3 rounded-lg border text-xs flex justify-between items-center transition-all ${
                      isCritical ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-gray-800 font-sans">{mat.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Min: {mat.stock_minimum} {mat.unit}</p>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono font-bold text-xs ${isCritical ? 'text-amber-700' : 'text-[var(--color-evergreen)]'}`}>
                        {mat.current_stock} {mat.unit}
                      </span>
                      {isCritical && (
                        <span className="block text-[8px] font-black text-amber-700 uppercase mt-0.5 tracking-wider">stok kritis!</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>}

          {historyView === 'products' && <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-gray-800 font-sans">Sisa Stok Barang Jadi</h3>
              <p className="text-xs text-gray-400">Stok siap kirim hasil produksi gudang {brandName()}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.map((p) => {
                const isCritical = p.stock <= 15;
                return (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-lg border text-xs flex justify-between items-center transition-all ${
                      isCritical ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-gray-800 font-sans">{p.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{p.variant}</p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono font-bold text-sm text-gray-800">{p.stock} Unit</p>
                      {isCritical && (
                        <span className="text-[9px] font-black text-amber-700 uppercase tracking-wide block mt-0.5">Kritis</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>}

          {historyView === 'reject' && <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-gray-800 font-sans">Barang Reject Produksi</h3>
              <p className="text-xs text-gray-400">Catatan barang reject yang masih disimpan atau perlu tindak lanjut.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rejectedGoods.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200 col-span-full">Belum ada barang reject tercatat.</p>
              ) : rejectedGoods.map(item => (
                <div key={item.id} className="p-3 rounded-lg border border-rose-100 bg-rose-50/40 text-xs flex justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-800">{item.product_name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-black text-rose-700">{item.qty} pcs</p>
                    <p className="text-[9px] uppercase text-rose-500 font-bold">{item.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {historyView === 'movements' && <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-2xs">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-gray-800 font-sans">Riwayat Mutasi Stok</h3>
                <p className="text-xs text-gray-400">Log audit real-time sirkulasi bahan dan barang jadi</p>
              </div>
              <History className="w-4.5 h-4.5 text-gray-400" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {movements.slice(0, 30).map((mov) => {
                const isIncoming = mov.type.includes('masuk');
                const isProduct = mov.type.includes('barang_jadi');
                const timeString = new Date(mov.created_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={mov.id} className="flex justify-between items-center text-xs p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="space-y-0.5">
                      <p className="font-bold text-gray-800 font-sans">{mov.item_name}</p>
                      <p className="text-[10px] text-gray-400">Ref: {mov.reference} | {timeString}</p>
                    </div>

                    <div className="text-right flex items-center gap-1.5 font-mono font-bold text-[11px]">
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
                      <span className="text-[9px] font-normal text-gray-400 uppercase">
                        {isProduct ? 'Unit' : 'Bahan'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>}
        </div>
      )}

      {!isEmployee && subTab === 'packing-docs' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-2xs animate-fadeIn">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-gray-800 font-sans">Dokumentasi Foto Packing</h3>
              <p className="text-xs text-gray-400">Foto barang saat selesai packing, sebagai bukti sebelum dikirim</p>
            </div>
            <Camera className="w-4.5 h-4.5 text-gray-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {packingTasks.filter(task => task.status === 'completed' && task.photo_url).length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-6 col-span-full">Belum ada foto dokumentasi packing.</p>
            ) : packingTasks.filter(task => task.status === 'completed' && task.photo_url).map(task => (
              <div key={task.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                <a href={task.photo_url} target="_blank" rel="noreferrer">
                  <img src={task.photo_url} alt={`Dokumentasi packing ${task.order_number}`} className="w-full h-36 object-cover rounded border border-gray-200" />
                </a>
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold text-gray-800">{task.order_number} · {task.customer_name}</p>
                    <p className="text-[10px] text-gray-400">Oleh {task.photo_uploaded_by || task.employee_name} · {task.photo_uploaded_at ? new Date(task.photo_uploaded_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
                  {userRole === 'owner' && canDeletePhoto(task.photo_uploaded_at) && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Hapus foto dokumentasi packing ${task.order_number}?`)) return;
                        if (task.photo_url) { try { await deletePackingPhoto(task.photo_url); } catch { /* file mungkin sudah terhapus, lanjut bersihkan record */ } }
                        dataStore.deletePackingTaskPhoto(task.id);
                        loadData();
                      }}
                      title="Hapus foto (hanya bisa dalam 14 hari sejak diunggah)"
                      className="bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded px-2 py-1 text-[10px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper tiny subcomponent for PlayButtonIcon to keep imports clean
const PlayButtonIcon: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
    </svg>
  );
};
