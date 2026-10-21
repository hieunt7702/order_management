import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  Receipt,
  CreditCard,
  RotateCcw,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  UserCheck,
  Eye,
  Trash2,
  Edit,
  DollarSign,
  Info,
  Check,
  MoreHorizontal,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Landmark,
  Hash,
  X,
  Truck,
  Warehouse,
  Boxes,
  FileText,
  Wallet,
  Filter,
  QrCode,
  ArrowRightLeft,
} from 'lucide-react';
import { SupplierBankQr } from '../../components/suppliers/SupplierBankQr';
import { SupplierLoansTab } from '../../components/suppliers/SupplierLoansTab';
import { SupplierProductBorrowsTab } from '../../components/suppliers/SupplierProductBorrowsTab';
import { SupplierTransfersTab } from '../../components/suppliers/SupplierTransfersTab';
import { SupplierTransferModal } from '../../components/suppliers/SupplierTransferModal';
import { cn } from '../../lib/utils';
import { suppliersApi, SupplierItem, SupplierStatement, DebtReportsResponse } from '../../services/suppliersApi';
import { supplierPaymentsApi, SupplierPaymentModel, CreateSupplierPaymentPayload } from '../../services/supplierPaymentsApi';
import { purchaseReturnsApi, PurchaseReturnModel, CreatePurchaseReturnPayload } from '../../services/purchaseReturnsApi';
import { purchaseReceiptsApi, PurchaseReceiptModel } from '../../services/purchaseReceiptsApi';
import { productsApi } from '../../services/productsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { confirmModal } from '../../components/ui/ConfirmModal';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableEmpty,
  SystemTableSkeleton,
} from '../../components/ui/SystemTable';
import { Button } from '../../components/ui/Button';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';

export const SupplierDebtsPage: React.FC = () => {
  const { warehouses, selectedWarehouseId } = useWorkspaceStore();
  const [searchParams] = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const validTabs: Array<'DEBT_LIST' | 'TRANSFERS' | 'LOANS' | 'PRODUCT_BORROWS' | 'PAYMENTS' | 'RETURNS' | 'REPORTS'> = [
    'DEBT_LIST', 'TRANSFERS', 'LOANS', 'PRODUCT_BORROWS', 'PAYMENTS', 'RETURNS', 'REPORTS'
  ];
  const defaultTab = validTabs.includes(initialTabParam as any) ? (initialTabParam as any) : 'DEBT_LIST';

  const [activeTab, setActiveTab] = useState<'DEBT_LIST' | 'TRANSFERS' | 'LOANS' | 'PRODUCT_BORROWS' | 'PAYMENTS' | 'RETURNS' | 'REPORTS'>(defaultTab);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Data states
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [payments, setPayments] = useState<SupplierPaymentModel[]>([]);
  const [returns, setReturns] = useState<PurchaseReturnModel[]>([]);
  const [debtReports, setDebtReports] = useState<DebtReportsResponse | null>(null);

  // Modals
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    bankName: '',
    bankAccount: '',
    bankBeneficiary: '',
    openingDebt: 0,
    note: '',
  });

  // Statement Drawer/Modal
  const [statementData, setStatementData] = useState<SupplierStatement | null>(null);
  const [isStatementOpen, setIsStatementOpen] = useState<boolean>(false);
  const [activeStatementSupplierId, setActiveStatementSupplierId] = useState<string>('');

  // Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferInitialFromId, setTransferInitialFromId] = useState<string | undefined>(undefined);
  const [transferInitialToId, setTransferInitialToId] = useState<string | undefined>(undefined);

  const handleOpenTransferModal = (fromId?: string, toId?: string) => {
    setTransferInitialFromId(fromId);
    setTransferInitialToId(toId);
    setIsTransferModalOpen(true);
  };

  // Payment Voucher Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [qrModalSupplier, setQrModalSupplier] = useState<SupplierItem | null>(null);
  const [unpaidReceipts, setUnpaidReceipts] = useState<PurchaseReceiptModel[]>([]);
  const [paymentForm, setPaymentForm] = useState<{
    supplierId: string;
    amount: number;
    paymentDate: string;
    payerName: string;
    fundSource: 'CASH_FUND' | 'BANK_ACCOUNT' | 'PERSONAL_FUND';
    paymentMethod: string;
    referenceCode: string;
    paymentType: 'PAYMENT' | 'ADVANCE_DEPOSIT' | 'REFUND_RECEIVED';
    isReimbursementNeeded: boolean;
    note: string;
    allocations: Array<{ receiptId: string; amount: number; note?: string }>;
  }>({
    supplierId: '',
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    payerName: 'HieuNT',
    fundSource: 'CASH_FUND',
    paymentMethod: 'BANK_TRANSFER',
    referenceCode: '',
    paymentType: 'PAYMENT',
    isReimbursementNeeded: false,
    note: '',
    allocations: [],
  });

  // Purchase Return Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [allVariants, setAllVariants] = useState<any[]>([]);
  const [returnForm, setReturnForm] = useState<CreatePurchaseReturnPayload>({
    supplierId: '',
    receiptId: undefined,
    warehouseId: selectedWarehouseId || (warehouses[0]?.id || ''),
    returnDate: new Date().toISOString().split('T')[0],
    debtOffsetAmount: 0,
    reason: 'Hàng lỗi / rách bao bì / cận date',
    note: '',
    items: [
      {
        variantId: '',
        sku: '',
        quantity: 1,
        unitPrice: 0,
      },
    ],
  });

  useEffect(() => {
    loadAllData();
    loadVariants();
  }, []);

  useEffect(() => {
    if (activeTab === 'DEBT_LIST' || activeTab === 'TRANSFERS' || activeTab === 'LOANS' || activeTab === 'PRODUCT_BORROWS') loadSuppliers();
    if (activeTab === 'PAYMENTS') loadPayments();
    if (activeTab === 'RETURNS') loadReturns();
    if (activeTab === 'REPORTS') loadDebtReports();
  }, [activeTab]);

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.all([loadSuppliers(), loadPayments(), loadReturns(), loadDebtReports()]);
    setIsLoading(false);
  };

  const loadVariants = async () => {
    try {
      const res: any = await productsApi.findAllVariants({ limit: 1000 });
      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      setAllVariants(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Lỗi tải danh mục biến thể:', err);
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await suppliersApi.findAll({ search: searchTerm });
      const data = (res as any)?.data || res;
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Lỗi tải danh sách NCC:', err);
    }
  };

  const loadPayments = async () => {
    try {
      const res = await supplierPaymentsApi.findAll({ search: searchTerm });
      const data = (res as any)?.data || res;
      setPayments(data?.data || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error('Lỗi tải danh sách thanh toán:', err);
    }
  };

  const loadReturns = async () => {
    try {
      const res = await purchaseReturnsApi.findAll();
      const data = (res as any)?.data || res;
      setReturns(data?.data || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error('Lỗi tải danh sách trả hàng:', err);
    }
  };

  const loadDebtReports = async () => {
    try {
      const res = await suppliersApi.getDebtReports();
      const raw = (res as any)?.data || res;
      if (!raw) return;

      const summary = raw.summary || {
        totalSuppliers: raw.kpis?.supplierCount || 0,
        totalDebtPayable: raw.kpis?.totalPayable || 0,
        totalAdvanceHeld: raw.kpis?.totalAdvanceHeld || 0,
        totalOverdueDebt: raw.kpis?.overduePayable || 0,
        totalDueSoonDebt: raw.kpis?.dueSoonPayable || 0,
        pendingReimbursementCount: raw.personalFundPayments?.length || 0,
        totalPendingReimbursement: raw.kpis?.pendingReimbursements || 0,
      };

      const overdueList = raw.overdueList || (raw.overdueReceipts || []).map((r: any) => ({
        receiptId: r.id,
        receiptCode: r.code,
        supplierId: r.supplierId,
        supplierName: r.supplier?.name || '',
        payableAmount: Number(r.payableAmount || 0),
        remainingAmount: Number(r.remainingAmount || 0),
        paymentDueDate: r.paymentDueDate || '',
        overdueDays: r.overdueDays || 0,
      }));

      const dueSoonList = raw.dueSoonList || (raw.dueSoonReceipts || []).map((r: any) => ({
        receiptId: r.id,
        receiptCode: r.code,
        supplierId: r.supplierId,
        supplierName: r.supplier?.name || '',
        remainingAmount: Number(r.remainingAmount || 0),
        paymentDueDate: r.paymentDueDate || '',
      }));

      const reimbursementNeeds = raw.reimbursementNeeds || (raw.personalFundPayments || [])
        .filter((p: any) => p.isReimbursementNeeded && p.reimbursementStatus === 'PENDING_REIMBURSEMENT')
        .map((p: any) => ({
          paymentId: p.id,
          paymentCode: p.code,
          payerName: p.payerName || 'Cá nhân',
          amount: Number(p.amount || 0),
          paymentDate: p.paymentDate || '',
          supplierName: p.supplier?.name || '',
        }));

      setDebtReports({
        summary,
        overdueList,
        dueSoonList,
        reimbursementNeeds,
      });
    } catch (err) {
      console.error('Lỗi tải báo cáo công nợ:', err);
    }
  };

  // Statement viewer
  const handleOpenStatement = async (supplierId: string) => {
    try {
      setActiveStatementSupplierId(supplierId);
      const res = await suppliersApi.getStatement(supplierId);
      const data = (res as any)?.data || res;
      if (data?.transactions && Array.isArray(data.transactions) && data.transactions.length > 1) {
        const firstTime = new Date(data.transactions[0].date).getTime();
        const lastTime = new Date(data.transactions[data.transactions.length - 1].date).getTime();
        if (firstTime < lastTime) {
          data.transactions.reverse();
        }
      }
      setStatementData(data);
      setIsStatementOpen(true);
    } catch (err: any) {
      alert('Không thể tải sao kê công nợ: ' + (err?.message || 'Lỗi'));
    }
  };

  // Supplier CRUD
  const handleOpenAddSupplier = async () => {
    setEditingSupplier(null);
    let nextCode = '';
    try {
      const res: any = await suppliersApi.getNextCode();
      nextCode = res?.code || res?.data?.code || '';
    } catch {
      // ignore
    }
    if (!nextCode) {
      let maxNum = 0;
      for (const s of suppliers) {
        const match = s.code.match(/^NCC(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      nextCode = `NCC${String(maxNum + 1).padStart(3, '0')}`;
    }

    setSupplierForm({
      code: nextCode,
      name: '',
      phone: '',
      email: '',
      address: '',
      bankName: '',
      bankAccount: '',
      bankBeneficiary: '',
      openingDebt: 0,
      note: '',
    });
    setIsAddSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (s: SupplierItem) => {
    setEditingSupplier(s);
    setSupplierForm({
      code: s.code,
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      bankName: s.bankName || '',
      bankAccount: s.bankAccount || '',
      bankBeneficiary: s.bankBeneficiary || '',
      openingDebt: s.openingDebt || 0,
      note: s.note || '',
    });
    setIsAddSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      toast.warning('Vui lòng nhập tên nhà cung cấp');
      return;
    }

    try {
      if (editingSupplier) {
        await suppliersApi.update(editingSupplier.id, supplierForm);
        toast.success('Cập nhật nhà cung cấp thành công!');
      } else {
        await suppliersApi.create(supplierForm);
        toast.success('Thêm nhà cung cấp mới thành công!');
      }
      setIsAddSupplierModalOpen(false);
      loadSuppliers();
    } catch (err: any) {
      toast.error('Lỗi lưu thông tin', err?.response?.data?.message || err?.message);
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    const ok = await confirmModal({
      title: 'Xóa nhà cung cấp',
      message: `Bạn có chắc chắn muốn xóa/ngừng hoạt động nhà cung cấp "${name}"?`,
      description: 'Nếu nhà cung cấp đã phát sinh công nợ hoặc phiếu nhập, hệ thống sẽ chuyển sang trạng thái ngừng hoạt động để bảo toàn lịch sử sổ sách kế toán.',
      confirmText: 'Xác nhận xóa',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await suppliersApi.delete(id);
      const data = (res as any)?.data || res;
      toast.success(data.message || 'Đã xử lý nhà cung cấp');
      loadSuppliers();
    } catch (err: any) {
      toast.error('Không thể xóa nhà cung cấp', err?.response?.data?.message || err?.message);
    }
  };

  // Payment Voucher Handlers
  const handleOpenPaymentModal = async (preselectedSupplierId?: string) => {
    const sId = preselectedSupplierId || (suppliers[0]?.id || '');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const autoRefCode = `PC-${dateStr}-${rand}`;

    setPaymentForm({
      supplierId: sId,
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      payerName: 'HieuNT',
      fundSource: 'CASH_FUND',
      paymentMethod: 'BANK_TRANSFER',
      referenceCode: autoRefCode,
      paymentType: 'PAYMENT',
      isReimbursementNeeded: false,
      note: '',
      allocations: [],
    });

    if (sId) {
      await loadUnpaidReceiptsForSupplier(sId);
    }
    setIsPaymentModalOpen(true);
  };

  const loadUnpaidReceiptsForSupplier = async (supplierId: string) => {
    try {
      const res = await purchaseReceiptsApi.findAll({
        supplierId,
        paymentStatus: 'UNPAID,PARTIALLY_PAID',
        limit: 100,
      });
      const data = (res as any)?.data || res;
      const receiptsList: PurchaseReceiptModel[] =
        data?.items || data?.data || (Array.isArray(data) ? data : []);
      // Filter out those with 0 remaining
      const outstanding = receiptsList.filter((r) => Number(r.remainingAmount) > 0);
      setUnpaidReceipts(outstanding);

      // Initialize allocations
      setPaymentForm((prev) => ({
        ...prev,
        supplierId,
        allocations: outstanding.map((r) => ({ receiptId: r.id, amount: 0 })),
      }));
    } catch (err) {
      console.error('Lỗi tải phiếu nợ:', err);
    }
  };

  const handleAutoAllocate = (totalAmount: number) => {
    let remainingToAllocate = totalAmount;
    const newAllocations = unpaidReceipts.map((r) => {
      const debt = Number(r.remainingAmount);
      const allocated = Math.min(debt, remainingToAllocate);
      remainingToAllocate = Math.max(0, remainingToAllocate - allocated);
      return {
        receiptId: r.id,
        amount: allocated,
      };
    });

    setPaymentForm((prev) => ({
      ...prev,
      amount: totalAmount,
      allocations: newAllocations,
    }));
  };

  const handleAllocationAmountChange = (receiptId: string, amount: number) => {
    const updated = paymentForm.allocations.map((a) =>
      a.receiptId === receiptId ? { ...a, amount } : a,
    );
    setPaymentForm({ ...paymentForm, allocations: updated });
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.supplierId) {
      toast.warning('Vui lòng chọn nhà cung cấp');
      return;
    }
    if (paymentForm.amount <= 0) {
      toast.warning('Số tiền chi phải lớn hơn 0');
      return;
    }

    const totalAllocated = paymentForm.allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    if (totalAllocated > paymentForm.amount && paymentForm.paymentType !== 'REFUND_RECEIVED') {
      toast.warning(`Tổng phân bổ (${totalAllocated.toLocaleString('vi-VN')}đ) vượt quá số tiền chi (${paymentForm.amount.toLocaleString('vi-VN')}đ)`);
      return;
    }

    try {
      await supplierPaymentsApi.create({
        supplierId: paymentForm.supplierId,
        amount: paymentForm.amount,
        paymentDate: paymentForm.paymentDate,
        payerName: paymentForm.payerName,
        fundSource: paymentForm.fundSource,
        paymentMethod: paymentForm.paymentMethod,
        referenceCode: paymentForm.referenceCode || undefined,
        paymentType: paymentForm.paymentType,
        isReimbursementNeeded: paymentForm.fundSource === 'PERSONAL_FUND' ? true : paymentForm.isReimbursementNeeded,
        note: paymentForm.note || undefined,
        allocations: paymentForm.allocations.filter((a) => a.amount > 0),
      });

      setIsPaymentModalOpen(false);
      loadAllData();
      toast.success('Đã lập phiếu chi thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi tạo phiếu chi', err?.response?.data?.message || err?.message);
    }
  };

  const handleMarkReimbursed = async (paymentId: string) => {
    const ok = await confirmModal({
      title: 'Xác nhận hoàn tiền chi hộ',
      message: 'Xác nhận shop đã hoàn trả lại tiền cá nhân chi hộ cho khoản này?',
      description: 'Khoản chi hộ sẽ được đánh dấu đã hoàn trả xong và không còn hiển thị trong danh sách cảnh báo nợ cần trả lại.',
      confirmText: 'Đã hoàn tiền',
      variant: 'primary',
    });
    if (!ok) return;
    try {
      await supplierPaymentsApi.markReimbursed(paymentId, 'Đã hoàn trả từ quỹ shop');
      loadPayments();
      loadDebtReports();
      toast.success('Đã cập nhật trạng thái hoàn tiền thành công!');
    } catch (err: any) {
      toast.error('Không thể cập nhật', err?.message);
    }
  };

  const handleDeletePayment = async (id: string, code: string) => {
    const ok = await confirmModal({
      title: 'Hủy phiếu chi',
      message: `Bạn có chắc chắn muốn hủy phiếu chi "${code}"?`,
      description: 'Khoản thanh toán sẽ bị xóa và công nợ trên các phiếu nhập tương ứng sẽ được tự động khôi phục lại.',
      confirmText: 'Xác nhận hủy phiếu',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await supplierPaymentsApi.delete(id);
      loadAllData();
      toast.success('Đã hủy phiếu chi thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi xóa', err?.response?.data?.message || err?.message);
    }
  };

  // Purchase Return Handlers
  const handleOpenReturnModal = () => {
    setReturnForm({
      supplierId: suppliers[0]?.id || '',
      receiptId: undefined,
      warehouseId: selectedWarehouseId || (warehouses[0]?.id || ''),
      returnDate: new Date().toISOString().split('T')[0],
      debtOffsetAmount: 0,
      reason: 'Hàng lỗi / rách bao bì / cận date',
      note: '',
      items: [
        {
          variantId: '',
          sku: '',
          quantity: 1,
          unitPrice: 0,
        },
      ],
    });
    setIsReturnModalOpen(true);
  };

  const handleReturnItemChange = (index: number, field: string, value: any) => {
    const updated = [...returnForm.items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'variantId') {
      const v = allVariants.find((item) => item.id === value);
      if (v) {
        updated[index].sku = v.sku || '';
        updated[index].unitPrice = Number(v.costPrice || 0);
      }
    }

    const newItemsTotal = updated.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
    setReturnForm({
      ...returnForm,
      items: updated,
      debtOffsetAmount: newItemsTotal,
    });
  };

  const handleAddReturnItemRow = () => {
    setReturnForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          variantId: '',
          sku: '',
          quantity: 1,
          unitPrice: 0,
        },
      ],
    }));
  };

  const handleRemoveReturnItemRow = (index: number) => {
    if (returnForm.items.length <= 1) {
      toast.warning('Phiếu trả hàng cần ít nhất 1 sản phẩm');
      return;
    }
    const updated = returnForm.items.filter((_, i) => i !== index);
    const newItemsTotal = updated.reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0);
    setReturnForm((prev) => ({
      ...prev,
      items: updated,
      debtOffsetAmount: newItemsTotal,
    }));
  };

  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnForm.supplierId) {
      toast.warning('Vui lòng chọn nhà cung cấp');
      return;
    }
    for (const it of returnForm.items) {
      if (!it.variantId || it.quantity <= 0) {
        toast.warning('Vui lòng chọn sản phẩm và số lượng trả hợp lệ');
        return;
      }
    }

    try {
      await purchaseReturnsApi.create(returnForm);
      setIsReturnModalOpen(false);
      loadAllData();
      toast.success('Đã tạo phiếu trả hàng và ghi nhận giảm trừ công nợ!');
    } catch (err: any) {
      toast.error('Lỗi khi tạo phiếu trả hàng', err?.response?.data?.message || err?.message);
    }
  };

  const handleDeleteReturn = async (id: string, code: string) => {
    const ok = await confirmModal({
      title: 'Hủy phiếu trả hàng',
      message: `Bạn có chắc chắn muốn hủy phiếu trả hàng "${code}"?`,
      description: 'Số lượng tồn kho sản phẩm và công nợ nhà cung cấp sẽ được khôi phục lại nguyên trạng.',
      confirmText: 'Xác nhận hủy phiếu',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await purchaseReturnsApi.delete(id);
      loadAllData();
      toast.success('Đã hủy phiếu trả hàng thành công!');
    } catch (err: any) {
      toast.error('Lỗi khi xóa', err?.response?.data?.message || err?.message);
    }
  };

  // Top summary KPIs from debtReports or suppliers
  const summaryTotalPayable = debtReports?.summary?.totalDebtPayable ?? suppliers.reduce((sum, s) => sum + (s.closingDebt > 0 ? s.closingDebt : 0), 0);
  const summaryTotalAdvance = debtReports?.summary?.totalAdvanceHeld ?? suppliers.reduce((sum, s) => sum + (s.advanceAmountHeld || 0), 0);
  const summaryOverdue = debtReports?.summary?.totalOverdueDebt ?? 0;
  const summaryPendingReimbursement = debtReports?.summary?.totalPendingReimbursement ?? 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-semibold sm:font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <Wallet size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="sm:hidden truncate">Công nợ NCC</span>
            <span className="hidden sm:inline truncate">Công Nợ & Thanh Toán Nhà Cung Cấp</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Số dư cuối kỳ = Nợ đầu kỳ + Phát sinh phải trả − Giảm trừ trả hàng − Tiền đã trả + Tiền NCC hoàn lại
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={handleOpenAddSupplier} className="p-2 sm:px-3" title="Thêm NCC">
            <Plus size={14} /> <span className="hidden sm:inline">Thêm NCC</span>
          </Button>
          <Button size="sm" variant="outline" onClick={handleOpenReturnModal} className="p-2 sm:px-3 text-orange-600 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/20" title="Trả hàng NCC">
            <RotateCcw size={14} /> <span className="hidden sm:inline">Trả hàng NCC</span>
          </Button>
          <Button size="sm" onClick={() => handleOpenTransferModal()} className="gap-1 px-2.5 sm:px-3 bg-indigo-600 hover:bg-indigo-700 text-white" title="Chuyển tiền giữa 2 NCC">
            <ArrowRightLeft size={14} />
            <span className="hidden sm:inline">Chuyển tiền NCC</span>
            <span className="sm:hidden">Chuyển tiền</span>
          </Button>
          <Button size="sm" onClick={() => handleOpenPaymentModal()} className="gap-1 px-2.5 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white" title="Lập phiếu chi trả">
            <CreditCard size={14} />
            <span className="hidden sm:inline">Lập phiếu chi trả</span>
            <span className="sm:hidden">Chi trả</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            className="p-2 lg:px-3"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden lg:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row matching Orders page */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
        <SystemMetricPairCard
          leftItem={{
            title: 'Tổng nợ phải trả NCC',
            mobileTitle: 'Tổng nợ NCC',
            value: `${summaryTotalPayable.toLocaleString('vi-VN')}đ`,
            subtitle: 'Nghĩa vụ phải trả',
            icon: Receipt,
            colorScheme: 'red',
            isActive: activeTab === 'DEBT_LIST',
            onClick: () => setActiveTab('DEBT_LIST'),
          }}
          rightItem={{
            title: 'Ứng trước / Đặt cọc',
            mobileTitle: 'Ứng trước / Cọc',
            value: `${summaryTotalAdvance.toLocaleString('vi-VN')}đ`,
            subtitle: 'NCC đang giữ',
            icon: ArrowDownLeft,
            colorScheme: 'blue',
            isActive: activeTab === 'PAYMENTS',
            onClick: () => setActiveTab('PAYMENTS'),
          }}
        />
        <SystemMetricPairCard
          leftItem={{
            title: 'Nợ quá hạn thanh toán',
            mobileTitle: 'Nợ quá hạn',
            value: `${summaryOverdue.toLocaleString('vi-VN')}đ`,
            subtitle: 'Cần ưu tiên trả',
            icon: AlertTriangle,
            colorScheme: 'orange',
            isActive: activeTab === 'REPORTS',
            onClick: () => setActiveTab('REPORTS'),
          }}
          rightItem={{
            title: 'Cá nhân chi hộ cần hoàn',
            mobileTitle: 'Cá nhân chi hộ',
            value: `${summaryPendingReimbursement.toLocaleString('vi-VN')}đ`,
            subtitle: 'Shop nợ cá nhân',
            icon: UserCheck,
            colorScheme: 'purple',
            isActive: activeTab === 'REPORTS',
            onClick: () => setActiveTab('REPORTS'),
          }}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded w-full sm:w-fit shrink-0 max-w-full overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('DEBT_LIST')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer border-0 shrink-0 ${
            activeTab === 'DEBT_LIST'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Building2 size={13} />
          <span>Sổ Công Nợ NCC ({suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('TRANSFERS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer border-0 shrink-0 ${
            activeTab === 'TRANSFERS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <ArrowRightLeft size={13} />
          <span>Chuyển Tiền NCC</span>
        </button>

        <button
          onClick={() => setActiveTab('LOANS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer border-0 shrink-0 ${
            activeTab === 'LOANS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Landmark size={13} />
          <span>Vay Vốn NCC (Vay / Cho vay)</span>
        </button>

        <button
          onClick={() => setActiveTab('PRODUCT_BORROWS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer border-0 shrink-0 ${
            activeTab === 'PRODUCT_BORROWS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Boxes size={13} />
          <span>Mượn / Vay Sản Phẩm</span>
        </button>

        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer border-0 shrink-0 ${
            activeTab === 'PAYMENTS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <CreditCard size={13} />
          <span>Lịch Sử Thanh Toán ({payments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RETURNS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer border-0 shrink-0 ${
            activeTab === 'RETURNS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <RotateCcw size={13} />
          <span>Phiếu Trả Hàng ({returns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer border-0 shrink-0 ${
            activeTab === 'REPORTS'
              ? 'bg-[#5865f2] text-white font-medium shadow-xs'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-normal'
          }`}
        >
          <Clock size={13} />
          <span>Hạn Nợ & Hoàn Trả</span>
        </button>
      </div>

      {/* TAB 1: SỔ CÔNG NỢ NHÀ CUNG CẤP */}
      {activeTab === 'DEBT_LIST' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div className="relative w-full max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm nhà cung cấp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadSuppliers()}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-[#5865f2]"
              />
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:flex flex-1 flex-col min-h-0">
            <SystemTableWrapper tableClassName="min-w-[1100px]">
              <SystemThead>
                <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                <SystemTh className="w-52">Mã & Nhà Cung Cấp</SystemTh>
                <SystemTh className="w-56">Liên Hệ / Ngân Hàng</SystemTh>
                <SystemTh className="w-32 text-right">Nợ Đầu Kỳ</SystemTh>
                <SystemTh className="w-32 text-right">Phát Sinh (+)</SystemTh>
                <SystemTh className="w-32 text-right">Giảm Trừ (-)</SystemTh>
                <SystemTh className="w-32 text-right">Đã Trả (-)</SystemTh>
                <SystemTh className="w-32 text-right">Ứng Trước / Dư</SystemTh>
                <SystemTh className="w-36 text-right">Số Dư Cuối Kỳ</SystemTh>
                <SystemTh className="w-32 text-center">Trạng Thái</SystemTh>
                <SystemTh className="w-20 text-center">Thao Tác</SystemTh>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton cols={11} rows={7} />
                ) : suppliers.length === 0 ? (
                  <SystemTableEmpty
                    title="Chưa có dữ liệu nhà cung cấp"
                    description="Không tìm thấy nhà cung cấp nào phù hợp với bộ lọc hiện tại."
                    colSpan={11}
                  />
                ) : (
                  suppliers.map((s, index) => {
                    const isShopOwing = s.closingDebt > 0;
                    const isSupplierHolding = s.closingDebt < 0;

                    return (
                      <SystemTr
                        key={s.id}
                        onClick={() => handleOpenStatement(s.id)}
                        className="cursor-pointer"
                      >
                        <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                          {index + 1}
                        </SystemTd>
                        <SystemTd>
                          <div className="font-semibold text-gray-900 dark:text-white hover:text-[#5865f2] transition-colors truncate" title={s.name}>
                            {s.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[11px] font-mono text-gray-400">{s.code}</span>
                            {(s.totalBorrowedProducts || 0) > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50"
                                title={`Đang mượn ${s.totalBorrowedProducts} sản phẩm từ nhà cung cấp`}
                              >
                                <Boxes size={10} className="shrink-0 text-indigo-500" />
                                <span>Mượn {s.totalBorrowedProducts} sp</span>
                              </span>
                            )}
                            {(s.totalLoanDebt || 0) > 0 && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40"
                                title={`Dư nợ hợp đồng vay: ${Number(s.totalLoanDebt).toLocaleString('vi-VN')}đ`}
                              >
                                <span>Vay: {Number(s.totalLoanDebt).toLocaleString('vi-VN')}đ</span>
                              </span>
                            )}
                          </div>
                        </SystemTd>

                        <SystemTd className="text-gray-600 dark:text-gray-300">
                          <div>{s.phone || 'Chưa có SĐT'}</div>
                          {s.bankAccount && (
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
                              <span className="truncate">
                                {s.bankName}: {s.bankAccount} {s.bankBeneficiary ? `(${s.bankBeneficiary})` : ''}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setQrModalSupplier(s);
                                }}
                                className="p-0.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded cursor-pointer transition-colors shrink-0"
                                title="Xem mã QR thanh toán VietQR"
                              >
                                <QrCode size={13} />
                              </button>
                            </div>
                          )}
                        </SystemTd>

                        <SystemTd className="text-right font-mono text-gray-600 dark:text-gray-300">
                          {Number(s.openingDebt || 0).toLocaleString('vi-VN')}đ
                        </SystemTd>

                        <SystemTd className="text-right font-mono font-medium text-gray-900 dark:text-white">
                          +{Number(s.totalPurchases || 0).toLocaleString('vi-VN')}đ
                        </SystemTd>

                        <SystemTd className="text-right font-mono text-orange-500">
                          -{Number(s.totalReturns || 0).toLocaleString('vi-VN')}đ
                        </SystemTd>

                        <SystemTd className="text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          -{Number(s.totalPaid || 0).toLocaleString('vi-VN')}đ
                        </SystemTd>

                        <SystemTd className="text-right font-mono text-indigo-500">
                          {Number(s.advanceAmountHeld || 0).toLocaleString('vi-VN')}đ
                        </SystemTd>

                        <SystemTd className="text-right font-mono font-bold text-xs sm:text-sm">
                          {isShopOwing ? (
                            <span className="text-rose-600 dark:text-rose-400">
                              +{Number(s.closingDebt).toLocaleString('vi-VN')}đ
                            </span>
                          ) : isSupplierHolding ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {Number(s.closingDebt).toLocaleString('vi-VN')}đ
                            </span>
                          ) : (
                            <span className="text-gray-400">0đ</span>
                          )}
                        </SystemTd>

                        <SystemTd className="text-center">
                          {isShopOwing ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                              Shop nợ NCC
                            </span>
                          ) : isSupplierHolding ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              NCC giữ tiền
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                              Cân bằng
                            </span>
                          )}
                        </SystemTd>

                        <SystemTd className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                  title="Thao tác"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenStatement(s.id)}>
                                  <Eye className="w-4 h-4 text-indigo-500" />
                                  <span>Xem sao kê đối soát</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenPaymentModal(s.id)}>
                                  <CreditCard className="w-4 h-4 text-emerald-500" />
                                  <span>Lập phiếu chi trả</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenTransferModal(s.id)}>
                                  <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
                                  <span>Chuyển tiền sang NCC khác</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setQrModalSupplier(s)}>
                                  <QrCode className="w-4 h-4 text-[#5865f2]" />
                                  <span>Mã QR Chuyển khoản VietQR</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEditSupplier(s)}>
                                  <Edit className="w-4 h-4 text-gray-500" />
                                  <span>Chỉnh sửa thông tin</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleDeleteSupplier(s.id, s.name)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Xóa nhà cung cấp</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </SystemTd>
                      </SystemTr>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>
          </div>

          {/* Mobile Card View (md:hidden) */}
          <div className="md:hidden space-y-2.5 pb-24 sm:pb-6">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-gray-400 font-normal">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5865f2] mb-2" />
                Đang tải công nợ nhà cung cấp...
              </div>
            ) : suppliers.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 font-normal bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 p-6">
                <Building2 className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Chưa có nhà cung cấp nào</p>
                <p className="text-[11px] text-gray-400">Không tìm thấy nhà cung cấp nào phù hợp với bộ lọc.</p>
              </div>
            ) : (
              suppliers.map((s) => {
                const isShopOwing = s.closingDebt > 0;
                const isSupplierHolding = s.closingDebt < 0;

                return (
                  <div
                    key={s.id}
                    onClick={() => handleOpenStatement(s.id)}
                    className="p-3.5 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 space-y-2.5 shadow-xs cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                  >
                    {/* Header: Supplier Name & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                          {s.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-mono text-gray-400">{s.code}</span>
                          {(s.totalBorrowedProducts || 0) > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50"
                              title={`Đang mượn ${s.totalBorrowedProducts} sản phẩm từ nhà cung cấp`}
                            >
                              <Boxes size={10} className="shrink-0 text-indigo-500" />
                              <span>Mượn {s.totalBorrowedProducts} sp</span>
                            </span>
                          )}
                          {(s.totalLoanDebt || 0) > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40"
                              title={`Dư nợ hợp đồng vay: ${Number(s.totalLoanDebt).toLocaleString('vi-VN')}đ`}
                            >
                              <span>Vay: {Number(s.totalLoanDebt).toLocaleString('vi-VN')}đ</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {isShopOwing ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 shrink-0">
                          Shop nợ NCC
                        </span>
                      ) : isSupplierHolding ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                          NCC giữ cọc/dư
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shrink-0">
                          Khớp nợ (0đ)
                        </span>
                      )}
                    </div>

                    {/* Contact & Bank */}
                    {(s.phone || s.bankAccount) && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
                        {s.phone && (
                          <div>
                            SĐT: <span className="text-gray-700 dark:text-gray-300 font-medium">{s.phone}</span>
                          </div>
                        )}
                        {s.bankAccount && (
                          <div>
                            TK: <span className="font-mono text-gray-700 dark:text-gray-300">{s.bankAccount} {s.bankName ? `(${s.bankName})` : ''}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Financial Summary */}
                    <div className="grid grid-cols-3 gap-2 p-2 rounded bg-gray-50 dark:bg-[#1a1e28] border border-gray-100 dark:border-gray-800/60 text-center">
                      <div>
                        <div className="text-[10px] text-gray-400">Phát sinh (+)</div>
                        <div className="font-mono font-medium text-xs text-gray-900 dark:text-white mt-0.5">
                          {(s.totalPurchases || 0).toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400">Đã trả (-)</div>
                        <div className="font-mono font-medium text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                          {(s.totalPaid || 0).toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400">Số dư nợ cuối</div>
                        <div className={`font-mono font-bold text-xs mt-0.5 ${isShopOwing ? 'text-rose-600 dark:text-rose-400' : isSupplierHolding ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
                          {Math.abs(s.closingDebt || 0).toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-800/80" onClick={(e) => e.stopPropagation()}>
                      {s.bankAccount && (
                        <button
                          type="button"
                          onClick={() => setQrModalSupplier(s)}
                          className="px-2.5 py-1 text-xs rounded border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <QrCode size={12} />
                          <span>QR</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenStatement(s.id)}
                        className="px-2.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Eye size={12} className="text-indigo-500" />
                        <span>Xem sao kê</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenTransferModal(s.id)}
                        className="px-2.5 py-1 text-xs rounded border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 flex items-center gap-1 font-medium cursor-pointer"
                        title="Chuyển tiền sang NCC khác"
                      >
                        <ArrowRightLeft size={12} />
                        <span>Chuyển tiền</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentModal(s.id)}
                        className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-semibold cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        <CreditCard size={12} />
                        <span>Chi trả nợ</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LỊCH SỬ THANH TOÁN & NGUỒN TIỀN */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-3">
          {/* Desktop Table View */}
          <div className="hidden md:flex flex-1 flex-col min-h-0">
            <SystemTableWrapper tableClassName="min-w-[1100px]">
              <SystemThead>
                <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                <SystemTh className="w-44">Mã Phiếu & Ngày</SystemTh>
                <SystemTh className="w-48">Nhà Cung Cấp</SystemTh>
                <SystemTh className="w-36 text-right">Số Tiền Thực Chi</SystemTh>
                <SystemTh className="w-48">Người Chi & Nguồn Tiền</SystemTh>
                <SystemTh className="w-56">Phân Bổ Cho Phiếu Nhập</SystemTh>
                <SystemTh className="w-32 text-right">Tiền Dư / Đặt Cọc</SystemTh>
                <SystemTh className="w-36 text-center">Hoàn Trả Cá Nhân</SystemTh>
                <SystemTh className="w-20 text-center">Thao Tác</SystemTh>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton cols={9} rows={7} />
                ) : payments.length === 0 ? (
                  <SystemTableEmpty
                    title="Chưa có phiếu thanh toán nào"
                    description="Các phiếu chi trả nợ hoặc đặt cọc sẽ hiển thị tại đây."
                    colSpan={9}
                  />
                ) : (
                  payments.map((p, index) => {
                    const isPersonal = p.fundSource === 'PERSONAL_FUND';
                    const isPendingReimbursement = p.isReimbursementNeeded && p.reimbursementStatus === 'PENDING_REIMBURSEMENT';

                    return (
                      <SystemTr key={p.id}>
                        <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                          {index + 1}
                        </SystemTd>
                        <SystemTd>
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{p.paymentCode}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {new Date(p.paymentDate).toLocaleDateString('vi-VN')}
                          </div>
                          {p.referenceCode && (
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">UNC: {p.referenceCode}</div>
                          )}
                        </SystemTd>

                        <SystemTd className="font-medium text-gray-900 dark:text-white">
                          {p.supplier?.name}
                        </SystemTd>

                        <SystemTd className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(p.amount).toLocaleString('vi-VN')}đ
                        </SystemTd>

                        <SystemTd>
                          <div className="font-semibold text-gray-900 dark:text-white">{p.payerName}</div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-medium mt-0.5 ${
                              isPersonal
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                                : p.fundSource === 'BANK_ACCOUNT'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {isPersonal ? 'Tiền cá nhân chi hộ' : p.fundSource === 'BANK_ACCOUNT' ? 'Tài khoản công ty' : 'Quỹ tiền mặt'}
                          </span>
                        </SystemTd>

                        <SystemTd>
                          {p.allocations && p.allocations.length > 0 ? (
                            <div className="space-y-1">
                              {p.allocations.map((a) => (
                                <div key={a.id} className="text-[11px] flex justify-between gap-2">
                                  <span className="font-mono text-gray-700 dark:text-gray-300">{a.receipt?.receiptCode}:</span>
                                  <span className="font-bold font-mono text-gray-900 dark:text-white">
                                    {Number(a.allocatedAmount).toLocaleString('vi-VN')}đ
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Không phân bổ (Đặt cọc / Ứng trước)</span>
                          )}
                        </SystemTd>

                        <SystemTd className="text-right font-mono font-semibold text-indigo-500">
                          {Number(p.advanceAmount) > 0 ? `${Number(p.advanceAmount).toLocaleString('vi-VN')}đ` : '0đ'}
                        </SystemTd>

                        <SystemTd className="text-center">
                          {p.isReimbursementNeeded ? (
                            isPendingReimbursement ? (
                              <button
                                onClick={() => handleMarkReimbursed(p.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 cursor-pointer"
                              >
                                Shop cần hoàn trả
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <Check className="w-3 h-3" /> Đã hoàn trả
                              </span>
                            )
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </SystemTd>

                        <SystemTd className="text-center">
                          <button
                            title="Hủy phiếu chi"
                            onClick={() => handleDeletePayment(p.id, p.paymentCode)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </SystemTd>
                      </SystemTr>
                    );
                  })
                )}
              </SystemTbody>
            </SystemTableWrapper>
          </div>

          {/* Mobile Card View (md:hidden) */}
          <div className="md:hidden space-y-2.5 pb-24 sm:pb-6">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-gray-400 font-normal">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5865f2] mb-2" />
                Đang tải lịch sử thanh toán...
              </div>
            ) : payments.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 font-normal bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 p-6">
                <CreditCard className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Chưa có phiếu thanh toán nào</p>
                <p className="text-[11px] text-gray-400">Các phiếu chi trả nợ hoặc đặt cọc sẽ hiển thị tại đây.</p>
              </div>
            ) : (
              payments.map((p) => {
                const isPersonal = p.fundSource === 'PERSONAL_FUND';
                const isPendingReimbursement = p.isReimbursementNeeded && p.reimbursementStatus === 'PENDING_REIMBURSEMENT';

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 space-y-2.5 shadow-xs"
                  >
                    {/* Header: Payment Code, Date & Amount */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono truncate">
                          {p.paymentCode}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(p.paymentDate).toLocaleDateString('vi-VN')}
                          {p.referenceCode && <span className="ml-1.5 font-mono">UNC: {p.referenceCode}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {Number(p.amount).toLocaleString('vi-VN')}đ
                        </div>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mt-0.5 ${
                            isPersonal
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                              : p.fundSource === 'BANK_ACCOUNT'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {isPersonal ? 'Cá nhân chi hộ' : p.fundSource === 'BANK_ACCOUNT' ? 'Tài khoản cty' : 'Quỹ tiền mặt'}
                        </span>
                      </div>
                    </div>

                    {/* Supplier & Payer Info */}
                    <div className="text-xs space-y-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-[11px]">Nhà cung cấp:</span>
                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{p.supplier?.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-[11px]">Người chi:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{p.payerName}</span>
                      </div>
                      {Number(p.advanceAmount) > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-500 text-[11px]">Tiền dư / Đặt cọc:</span>
                          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            {Number(p.advanceAmount).toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Allocations (if any) */}
                    {p.allocations && p.allocations.length > 0 && (
                      <div className="p-2 rounded bg-gray-50 dark:bg-[#1a1e28] border border-gray-100 dark:border-gray-800/60 space-y-1">
                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Phân bổ phiếu nhập</div>
                        {p.allocations.map((a) => (
                          <div key={a.id} className="text-[11px] flex justify-between gap-2">
                            <span className="font-mono text-gray-700 dark:text-gray-300">{a.receipt?.receiptCode}:</span>
                            <span className="font-bold font-mono text-gray-900 dark:text-white">
                              {Number(a.allocatedAmount).toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800/80">
                      <div>
                        {p.isReimbursementNeeded && (
                          isPendingReimbursement ? (
                            <button
                              onClick={() => handleMarkReimbursed(p.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 cursor-pointer shadow-xs active:scale-95 transition-all"
                            >
                              Shop cần hoàn trả
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <Check className="w-3 h-3" /> Đã hoàn trả
                            </span>
                          )
                        )}
                      </div>
                      <button
                        title="Hủy phiếu chi"
                        onClick={() => handleDeletePayment(p.id, p.paymentCode)}
                        className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors flex items-center gap-1 cursor-pointer font-medium ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hủy phiếu</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TRẢ HÀNG NCC */}
      {activeTab === 'RETURNS' && (
        <div className="space-y-3">
          {/* Desktop Table View */}
          <div className="hidden md:flex flex-1 flex-col min-h-0">
            <SystemTableWrapper tableClassName="min-w-[1100px]">
              <SystemThead>
                <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
                <SystemTh className="w-40">Mã Phiếu Trả</SystemTh>
                <SystemTh className="w-32">Ngày Trả</SystemTh>
                <SystemTh className="w-48">Nhà Cung Cấp</SystemTh>
                <SystemTh className="w-44">Phiếu Nhập Gốc</SystemTh>
                <SystemTh className="w-36 text-right">Tổng Giá Trị Hàng</SystemTh>
                <SystemTh className="w-36 text-right">Giảm Trừ Công Nợ</SystemTh>
                <SystemTh className="w-48">Lý Do</SystemTh>
                <SystemTh className="w-20 text-center">Thao Tác</SystemTh>
              </SystemThead>
              <SystemTbody>
                {isLoading ? (
                  <SystemTableSkeleton cols={9} rows={7} />
                ) : returns.length === 0 ? (
                  <SystemTableEmpty
                    title="Chưa có phiếu trả hàng nào"
                    description="Các phiếu xuất trả hàng nhà cung cấp sẽ hiển thị tại đây."
                    colSpan={9}
                  />
                ) : (
                  returns.map((ret, index) => (
                    <SystemTr key={ret.id}>
                      <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                        {index + 1}
                      </SystemTd>
                      <SystemTd className="font-bold font-mono text-orange-600">{ret.returnCode}</SystemTd>
                      <SystemTd className="text-gray-500">
                        {new Date(ret.returnDate).toLocaleDateString('vi-VN')}
                      </SystemTd>
                      <SystemTd className="font-medium text-gray-900 dark:text-white">
                        {ret.supplier?.name}
                      </SystemTd>
                      <SystemTd className="font-mono text-indigo-600">
                        {ret.receipt?.receiptCode || 'Không gắn phiếu'}
                      </SystemTd>
                      <SystemTd className="text-right font-mono font-medium">
                        {Number(ret.totalReturnAmount).toLocaleString('vi-VN')}đ
                      </SystemTd>
                      <SystemTd className="text-right font-mono font-bold text-orange-600">
                        -{Number(ret.debtOffsetAmount).toLocaleString('vi-VN')}đ
                      </SystemTd>
                      <SystemTd className="text-gray-600 dark:text-gray-400">{ret.reason || 'N/A'}</SystemTd>
                      <SystemTd className="text-center">
                        <button
                          title="Hủy phiếu trả hàng"
                          onClick={() => handleDeleteReturn(ret.id, ret.returnCode)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </SystemTd>
                    </SystemTr>
                  ))
                )}
              </SystemTbody>
            </SystemTableWrapper>
          </div>

          {/* Mobile Card View (md:hidden) */}
          <div className="md:hidden space-y-2.5 pb-24 sm:pb-6">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-gray-400 font-normal">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin text-[#5865f2] mb-2" />
                Đang tải danh sách trả hàng...
              </div>
            ) : returns.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 font-normal bg-white dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 p-6">
                <RotateCcw className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Chưa có phiếu trả hàng nào</p>
                <p className="text-[11px] text-gray-400">Các phiếu xuất trả hàng nhà cung cấp sẽ hiển thị tại đây.</p>
              </div>
            ) : (
              returns.map((ret) => (
                <div
                  key={ret.id}
                  className="p-3.5 rounded bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 space-y-2.5 shadow-xs"
                >
                  {/* Header: Return Code & Date */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-orange-600 dark:text-orange-400 font-mono truncate">
                        {ret.returnCode}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {new Date(ret.returnDate).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-xs text-orange-600 dark:text-orange-400">
                        -{Number(ret.debtOffsetAmount).toLocaleString('vi-VN')}đ
                      </div>
                      <div className="text-[10px] text-gray-400">Giảm trừ nợ</div>
                    </div>
                  </div>

                  {/* Supplier & Receipt */}
                  <div className="text-xs space-y-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">Nhà cung cấp:</span>
                      <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{ret.supplier?.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">Phiếu nhập gốc:</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        {ret.receipt?.receiptCode || 'Không gắn phiếu'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[11px]">Tổng giá trị hàng:</span>
                      <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                        {Number(ret.totalReturnAmount).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    {ret.reason && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1a1e28] p-2 rounded border border-gray-100 dark:border-gray-800/60 mt-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Lý do: </span>{ret.reason}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-end pt-1 border-t border-gray-100 dark:border-gray-800/80">
                    <button
                      title="Hủy phiếu trả hàng"
                      onClick={() => handleDeleteReturn(ret.id, ret.returnCode)}
                      className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hủy phiếu</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BÁO CÁO CÔNG NỢ & HẠN NỢ */}
      {activeTab === 'REPORTS' && debtReports && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-24 sm:pb-6">
          {/* Overdue Debts */}
          <div className="bg-white dark:bg-[#14151a] p-4 rounded border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <span className="font-bold text-sm text-rose-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Phiếu Nhập Nợ Đã Quá Hạn ({debtReports.overdueList?.length || 0})
              </span>
              <span className="text-xs font-mono font-bold text-rose-600">
                Tổng: {(debtReports.summary?.totalOverdueDebt || 0).toLocaleString('vi-VN')}đ
              </span>
            </div>

            <div className="space-y-2 md:max-h-80 md:overflow-y-auto custom-scrollbar">
              {(!debtReports.overdueList || debtReports.overdueList.length === 0) ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">Tuyệt vời! Không có khoản nợ nào quá hạn.</p>
              ) : (
                debtReports.overdueList.map((item) => (
                  <div key={item.receiptId} className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white font-mono">{item.receiptCode}</div>
                      <div className="text-[11px] text-gray-500">{item.supplierName}</div>
                      <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                        Quá hạn {item.overdueDays || 0} ngày (Hạn: {item.paymentDueDate ? new Date(item.paymentDueDate).toLocaleDateString('vi-VN') : '---'})
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-rose-600 text-sm">
                        {(item.remainingAmount || 0).toLocaleString('vi-VN')}đ
                      </div>
                      <button
                        onClick={() => handleOpenPaymentModal(item.supplierId)}
                        className="mt-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold cursor-pointer active:scale-95 transition-all"
                      >
                        Trả ngay
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Personal Reimbursements */}
          <div className="bg-white dark:bg-[#14151a] p-4 rounded border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <span className="font-bold text-sm text-purple-600 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" /> Tiền Cá Nhân Chi Hộ Cần Shop Hoàn Trả ({debtReports.reimbursementNeeds?.length || 0})
              </span>
              <span className="text-xs font-mono font-bold text-purple-600">
                Tổng: {(debtReports.summary?.totalPendingReimbursement || 0).toLocaleString('vi-VN')}đ
              </span>
            </div>

            <div className="space-y-2 md:max-h-80 md:overflow-y-auto custom-scrollbar">
              {(!debtReports.reimbursementNeeds || debtReports.reimbursementNeeds.length === 0) ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">Không có khoản cá nhân chi hộ nào đang chờ hoàn tiền.</p>
              ) : (
                debtReports.reimbursementNeeds.map((item) => (
                  <div key={item.paymentId} className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">
                        {item.payerName} chi hộ NCC {item.supplierName}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        Phiếu: {item.paymentCode} • {item.paymentDate ? new Date(item.paymentDate).toLocaleDateString('vi-VN') : '---'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold font-mono text-purple-600 text-sm">
                        {(item.amount || 0).toLocaleString('vi-VN')}đ
                      </div>
                      <button
                        onClick={() => handleMarkReimbursed(item.paymentId)}
                        className="mt-1 px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold cursor-pointer active:scale-95 transition-all"
                      >
                        Xác nhận đã hoàn trả
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: CHUYỂN TIỀN GIỮA CÁC NCC */}
      {activeTab === 'TRANSFERS' && (
        <SupplierTransfersTab
          suppliers={suppliers}
          onRefreshData={loadAllData}
          onOpenTransferModal={handleOpenTransferModal}
        />
      )}

      {/* TAB: VAY VỐN & CHO VAY VỚI NHÀ CUNG CẤP */}
      {activeTab === 'LOANS' && (
        <SupplierLoansTab
          suppliers={suppliers}
          onRefreshData={loadAllData}
        />
      )}

      {/* TAB: MƯỢN / VAY SẢN PHẨM TỒN KHO */}
      {activeTab === 'PRODUCT_BORROWS' && (
        <SupplierProductBorrowsTab
          suppliers={suppliers}
          onRefreshData={loadAllData}
        />
      )}

      {/* Mobile bottom spacer for floating navigation dock */}
      <div className="h-10 md:hidden shrink-0" aria-hidden="true" />

      {/* MODAL: SAO KÊ DÒNG THỜI GIAN 360° */}
      <Modal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        icon={Receipt}
        title={
          <div className="flex items-center gap-2 min-w-0">
            <span className="sm:hidden font-semibold truncate">Sao kê: {statementData?.supplier?.name}</span>
            <span className="hidden sm:inline font-semibold truncate">{`Sao Kê Đối Soát 360°: ${statementData?.supplier?.name || ''}`}</span>
          </div>
        }
        subtitle={
          statementData?.supplier ? (
            <div className="flex items-center gap-2 text-[11px] text-gray-500 truncate">
              <span className="font-mono">{statementData.supplier.code}</span>
              {statementData.supplier.phone && (
                <>
                  <span>•</span>
                  <span>{statementData.supplier.phone}</span>
                </>
              )}
            </div>
          ) : undefined
        }
        size="xl"
      >
        {statementData && (
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-4 p-3 sm:p-5 text-xs sm:text-sm">
              {/* Summary Card */}
              <div className="p-3 rounded-[4px] bg-gray-50/80 dark:bg-[#1a1d26] border border-gray-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Số dư nợ hiện tại</div>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        'text-base sm:text-lg font-bold font-mono tracking-tight',
                        statementData.supplier.closingDebt > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : statementData.supplier.closingDebt < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-700 dark:text-gray-300'
                      )}
                    >
                      {statementData.supplier.closingDebt.toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-[11px] text-gray-400 font-normal">
                      {statementData.supplier.closingDebt > 0
                        ? '(Shop nợ NCC)'
                        : statementData.supplier.closingDebt < 0
                        ? '(NCC giữ cọc)'
                        : '(Cân bằng)'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs font-semibold bg-gray-200/70 dark:bg-white/[0.08] text-gray-700 dark:text-gray-300">
                    {statementData.transactions.length} giao dịch
                  </span>
                  <div className="text-[10px] text-gray-400 mt-0.5 font-normal">Mới nhất trước</div>
                </div>
              </div>

              {/* MOBILE: Card View (sm:hidden) */}
              <div className="sm:hidden space-y-2">
                {statementData.transactions.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center p-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-[4px] bg-gray-50/50 dark:bg-white/[0.01]">
                    <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                    <p className="text-xs text-gray-500 font-medium">Chưa có giao dịch nào với nhà cung cấp này</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Các phiếu nhập hàng, thanh toán và hoàn trả sẽ hiển thị tại đây</p>
                  </div>
                ) : (
                  statementData.transactions.map((tx, idx) => {
                    const isIncrease = tx.increaseDebt > 0;
                    const isDecrease = tx.decreaseDebt > 0;

                    let typeLabel = 'Giao dịch';
                    let typeBadgeClass = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
                    let borderLeftClass = 'border-l-gray-400 dark:border-l-gray-600';
                    let TypeIcon = Receipt;

                    if (tx.type === 'RECEIPT') {
                      typeLabel = 'Nhập hàng';
                      typeBadgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/50';
                      borderLeftClass = 'border-l-rose-500';
                      TypeIcon = ArrowDownLeft;
                    } else if (tx.type === 'PAYMENT') {
                      typeLabel = 'Thanh toán';
                      typeBadgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900/50';
                      borderLeftClass = 'border-l-emerald-500';
                      TypeIcon = ArrowUpRight;
                    } else if (tx.type === 'RETURN') {
                      typeLabel = 'Trả hàng NCC';
                      typeBadgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/50';
                      borderLeftClass = 'border-l-amber-500';
                      TypeIcon = RotateCcw;
                    } else if (tx.type === 'REFUND') {
                      typeLabel = 'Hoàn tiền';
                      typeBadgeClass = 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200/80 dark:border-purple-900/50';
                      borderLeftClass = 'border-l-purple-500';
                      TypeIcon = DollarSign;
                    } else if (tx.type === 'TRANSFER_OUT') {
                      typeLabel = 'Chuyển NCC';
                      typeBadgeClass = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-900/50';
                      borderLeftClass = 'border-l-indigo-500';
                      TypeIcon = ArrowRightLeft;
                    } else if (tx.type === 'TRANSFER_IN') {
                      typeLabel = 'Nhận từ NCC';
                      typeBadgeClass = 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200/80 dark:border-teal-900/50';
                      borderLeftClass = 'border-l-teal-500';
                      TypeIcon = ArrowRightLeft;
                    } else if (tx.type === 'OPENING') {
                      typeLabel = 'Nợ đầu kỳ';
                      typeBadgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200/80 dark:border-blue-900/50';
                      borderLeftClass = 'border-l-blue-500';
                      TypeIcon = Receipt;
                    }

                    return (
                      <div
                        key={idx}
                        className={cn(
                          'p-3 rounded-[4px] border border-gray-200/80 dark:border-white/[0.08] bg-white dark:bg-[#161922] space-y-2 shadow-xs border-l-[3px]',
                          borderLeftClass
                        )}
                      >
                        {/* Top: Type Badge + Date + Amount Delta */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold border',
                                typeBadgeClass
                              )}
                            >
                              <TypeIcon size={11} strokeWidth={2.2} />
                              <span>{typeLabel}</span>
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-sans flex items-center gap-1">
                              <Calendar size={11} />
                              {new Date(tx.date).toLocaleDateString('vi-VN')}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            {isIncrease && (
                              <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                                +{tx.increaseDebt.toLocaleString('vi-VN')}đ
                              </span>
                            )}
                            {isDecrease && (
                              <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                -{tx.decreaseDebt.toLocaleString('vi-VN')}đ
                              </span>
                            )}
                            {!isIncrease && !isDecrease && (
                              <span className="font-mono text-xs text-gray-400">-</span>
                            )}
                          </div>
                        </div>

                        {/* Transaction Code & Description */}
                        <div>
                          <div className="font-mono font-bold text-xs text-gray-900 dark:text-gray-100 select-all">
                            {tx.code}
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 font-sans mt-0.5 leading-relaxed">
                            {tx.description}
                          </p>
                        </div>

                        {/* Metadata tags (Payer, Fund source) */}
                        {(tx.payerOrCreator || tx.fundSource) && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-sans">
                            {tx.payerOrCreator && (
                              <span className="inline-flex items-center gap-1">
                                <UserCheck size={11} />
                                {tx.payerOrCreator}
                              </span>
                            )}
                            {tx.fundSource && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-[3px] font-mono text-[10px] text-gray-600 dark:text-gray-300">
                                <Wallet size={10} />
                                {tx.fundSource}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Footer: Running Balance */}
                        <div className="pt-2 border-t border-gray-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 text-[11px]">Dư nợ sau GD:</span>
                          <span
                            className={cn(
                              'font-mono font-bold text-xs',
                              tx.runningBalance > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : tx.runningBalance < 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-gray-600 dark:text-gray-400'
                            )}
                          >
                            {tx.runningBalance.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* DESKTOP: Timeline Ledger Table (hidden sm:block) */}
              <div className="hidden sm:block border border-gray-200 dark:border-gray-800 rounded-[4px] overflow-x-auto text-xs">
                <table className="w-full text-left min-w-[960px]">
                  <thead className="bg-gray-100 dark:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="p-2.5 w-28 min-w-[110px] whitespace-nowrap">Thời Gian</th>
                      <th className="p-2.5 w-48 min-w-[170px] whitespace-nowrap">Loại & Mã Giao Dịch</th>
                      <th className="p-2.5 min-w-[280px] whitespace-nowrap">Nội Dung Nghiệp Vụ</th>
                      <th className="p-2.5 w-36 min-w-[140px] text-right text-rose-600 dark:text-rose-400 whitespace-nowrap">Phát Sinh Nợ (+)</th>
                      <th className="p-2.5 w-36 min-w-[140px] text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Giảm Nợ (-)</th>
                      <th className="p-2.5 w-40 min-w-[150px] text-right font-bold whitespace-nowrap">Số Dư Lũy Kế</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                    {statementData.transactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 font-sans">
                          Chưa có giao dịch nào với nhà cung cấp này
                        </td>
                      </tr>
                    ) : (
                      statementData.transactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="p-2.5 text-gray-500 font-sans whitespace-nowrap">
                            {new Date(tx.date).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="p-2.5 font-bold whitespace-nowrap">
                            {tx.code}
                          </td>
                          <td className="p-2.5 font-sans text-gray-800 dark:text-gray-200">
                            {tx.description}
                          </td>
                          <td className="p-2.5 text-right text-rose-600 dark:text-rose-400 whitespace-nowrap font-medium">
                            {tx.increaseDebt > 0 ? `+${tx.increaseDebt.toLocaleString('vi-VN')}đ` : '-'}
                          </td>
                          <td className="p-2.5 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap font-medium">
                            {tx.decreaseDebt > 0 ? `-${tx.decreaseDebt.toLocaleString('vi-VN')}đ` : '-'}
                          </td>
                          <td className={`p-2.5 text-right font-bold whitespace-nowrap ${tx.runningBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {tx.runningBalance.toLocaleString('vi-VN')}đ
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-end w-full">
              <ModalButton variant="secondary" onClick={() => setIsStatementOpen(false)} className="w-full sm:w-auto">
                Đóng
              </ModalButton>
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* MODAL: LẬP PHIẾU CHI / THANH TOÁN NCC */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={
          <div className="flex items-center gap-2 min-w-0">
            <span className="sm:hidden font-semibold truncate">Phiếu chi trả nợ NCC</span>
            <span className="hidden sm:inline font-semibold truncate">Lập Phiếu Chi Thanh Toán Nhà Cung Cấp</span>
          </div>
        }
        subtitle={
          <div className="min-w-0 truncate">
            <span className="sm:hidden truncate">Chi trả giảm trừ công nợ / đặt cọc</span>
            <span className="hidden sm:inline truncate">
              Ghi nhận dòng tiền thanh toán giảm trừ công nợ hoặc đặt cọc trước cho nhà cung cấp
            </span>
          </div>
        }
        icon={CreditCard}
        size="xl"
      >
        <form onSubmit={handleSavePayment} className="flex flex-col flex-1 min-h-0">
          <ModalBody className="space-y-3 sm:space-y-4 text-xs sm:text-sm p-3 sm:p-5">
            {/* 1. THÔNG TIN THANH TOÁN & ĐỐI TÁC */}
            {(() => {
              const curSupplier = suppliers.find((s) => s.id === paymentForm.supplierId);
              return (
                <div className="w-full flex flex-col gap-2.5 sm:gap-3">
                  <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded border border-gray-200/80 dark:border-gray-800 space-y-2.5 sm:space-y-3.5">
                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                      <Building2 className="w-3.5 h-3.5 text-[#5865f2]" />
                      <span className="sm:hidden">Thông tin thanh toán & NCC</span>
                      <span className="hidden sm:inline">Thông tin thanh toán & Nhà cung cấp</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                      {/* Field 1: Nhà cung cấp */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                          <Building2 size={13} className="text-[#5865f2]" />
                          <span>Nhà cung cấp *</span>
                        </label>
                        <Select
                          value={paymentForm.supplierId}
                          onChange={(val) => {
                            const sId = String(val);
                            setPaymentForm((prev) => ({ ...prev, supplierId: sId }));
                            loadUnpaidReceiptsForSupplier(sId);
                          }}
                          options={[
                            { value: '', label: '-- Chọn Nhà Cung Cấp --' },
                            ...suppliers.map((s) => ({
                              value: s.id,
                              label: `${s.code} - ${s.name}`,
                              icon: Building2,
                              badge: s.closingDebt > 0 ? `Nợ: ${s.closingDebt.toLocaleString('vi-VN')}đ` : undefined,
                            })),
                          ]}
                          placeholder="-- Chọn Nhà Cung Cấp --"
                          searchable={true}
                          size="sm"
                          className="w-full"
                        />
                        {(() => {
                          if (!curSupplier) return null;
                          const debtBefore = Number(curSupplier.closingDebt || 0);
                          const payAmt = Number(paymentForm.amount || 0);
                          const debtAfter = debtBefore - payAmt;
                          return (
                            <div className="mt-2 p-2 rounded bg-gray-100/70 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 space-y-1 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Tiền nợ cũ trước giao dịch:</span>
                                <span
                                  className={`font-mono font-bold ${
                                    debtBefore > 0
                                      ? 'text-rose-600 dark:text-rose-400'
                                      : debtBefore < 0
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                  }`}
                                >
                                  {debtBefore > 0
                                    ? `${debtBefore.toLocaleString('vi-VN')} đ (Shop nợ NCC)`
                                    : debtBefore < 0
                                      ? `Cọc/Ứng trước ${Math.abs(debtBefore).toLocaleString('vi-VN')} đ`
                                      : '0 đ (Cân bằng)'}
                                </span>
                              </div>
                              {payAmt > 0 && (
                                <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
                                  <span className="text-gray-600 dark:text-gray-300 font-medium">Dự kiến nợ sau giao dịch:</span>
                                  <span
                                    className={`font-mono font-bold ${
                                      debtAfter > 0
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : debtAfter < 0
                                          ? 'text-blue-600 dark:text-blue-400'
                                          : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    {debtAfter > 0
                                      ? `Còn nợ: ${debtAfter.toLocaleString('vi-VN')} đ`
                                      : debtAfter < 0
                                        ? `Dư cọc: ${Math.abs(debtAfter).toLocaleString('vi-VN')} đ`
                                        : '0 đ (Hết nợ)'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Field 2: Số tiền thực tế chi ra */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                          <DollarSign size={13} className="text-emerald-600 dark:text-emerald-400" />
                          <span>Số tiền thực tế chi (đ) *</span>
                        </label>
                        <CurrencyInput
                          value={paymentForm.amount}
                          onChange={(amt) => {
                            setPaymentForm((prev) => ({ ...prev, amount: amt }));
                            handleAutoAllocate(amt);
                          }}
                          suffix="đ"
                          inputClassName="w-full bg-white dark:bg-[#1a1b23] border border-emerald-500/60 dark:border-emerald-600/70 rounded px-2.5 py-1.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        {(() => {
                          if (!curSupplier || curSupplier.closingDebt <= 0 || paymentForm.amount === curSupplier.closingDebt) {
                            return null;
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentForm((prev) => ({ ...prev, amount: curSupplier.closingDebt }));
                                handleAutoAllocate(curSupplier.closingDebt);
                              }}
                              className="text-[11px] text-[#5865f2] hover:underline mt-1 cursor-pointer flex items-center gap-1 font-medium active:scale-95 transition-transform"
                            >
                              <span>Chi đủ nợ ({curSupplier.closingDebt.toLocaleString('vi-VN')}đ)</span>
                            </button>
                          );
                        })()}
                      </div>

                      {/* Field 3: Ngày chi tiền */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                          <Calendar size={13} className="text-blue-500" />
                          <span className="sm:hidden">Ngày chi</span>
                          <span className="hidden sm:inline">Ngày chi tiền</span>
                        </label>
                        <input
                          type="date"
                          value={paymentForm.paymentDate}
                          onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                          className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
                        />
                      </div>

                      {/* Field 4: Người chi tiền */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                          <UserCheck size={13} className="text-purple-500" />
                          <span>Người chi tiền *</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="VD: HieuNT, Kế toán..."
                          value={paymentForm.payerName}
                          onChange={(e) => setPaymentForm({ ...paymentForm, payerName: e.target.value })}
                          className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
                        />
                      </div>

                      {/* Field 5: Nguồn tiền */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                          <Wallet size={13} className="text-amber-500" />
                          <span>Nguồn tiền *</span>
                        </label>
                        <Select
                          value={paymentForm.fundSource}
                          onChange={(val) => {
                            const src = String(val) as any;
                            setPaymentForm((prev) => ({
                              ...prev,
                              fundSource: src,
                              isReimbursementNeeded: src === 'PERSONAL_FUND',
                            }));
                          }}
                          options={[
                            { value: 'CASH_FUND', label: 'Quỹ tiền mặt của shop', icon: Wallet },
                            { value: 'BANK_ACCOUNT', label: 'Tài khoản ngân hàng công ty', icon: Landmark },
                            { value: 'PERSONAL_FUND', label: 'Tiền cá nhân người chi (Chi hộ)', icon: UserCheck },
                          ]}
                          size="sm"
                          className="w-full"
                        />
                      </div>

                      {/* Field 6: Mã giao dịch / Phiếu chi */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Hash size={13} className="text-indigo-500" />
                            <span>Mã phiếu chi / GD</span>
                          </label>
                          <span className="text-[10px] text-gray-400 font-normal">Hệ thống tự cấp</span>
                        </div>
                        <input
                          type="text"
                          readOnly
                          disabled
                          tabIndex={-1}
                          value={paymentForm.referenceCode || 'Hệ thống tự động cấp'}
                          title="Mã phiếu được hệ thống tự động sinh ngầm khi lưu để đảm bảo tuyệt đối không bị trùng lặp"
                          className="w-full bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded px-2.5 py-1.5 text-xs font-mono uppercase font-bold text-gray-500 dark:text-gray-400 cursor-not-allowed select-none pointer-events-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ghi chú chi hộ nếu dùng tiền cá nhân */}
                  {paymentForm.fundSource === 'PERSONAL_FUND' && (
                    <div className="p-3 bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/40 rounded flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-200">
                      <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-semibold text-purple-900 dark:text-purple-200">
                          Khoản chi hộ bằng tiền cá nhân ({paymentForm.payerName || 'Cá nhân'}):
                        </span>
                        <p className="text-[11px] text-purple-700 dark:text-purple-300">
                          Công nợ nhà cung cấp sẽ giảm ngay, đồng thời hệ thống tự động ghi nhận một khoản cảnh báo{' '}
                          <strong>Shop cần hoàn lại {paymentForm.amount.toLocaleString('vi-VN')}đ cho {paymentForm.payerName || 'người chi'}</strong> trong mục Quản lý hoàn ứng.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Allocations Section */}
            <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded border border-gray-200/80 dark:border-gray-800 space-y-2.5 sm:space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 text-[#5865f2] shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200 truncate">
                    <span className="sm:hidden">Phân bổ phiếu nợ</span>
                    <span className="hidden sm:inline">Phân bổ số tiền cho các phiếu nhập nợ</span>
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 shrink-0">
                    {unpaidReceipts.length} phiếu nợ
                  </span>
                </div>
                {unpaidReceipts.length > 0 && (
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleAutoAllocate(paymentForm.amount)}
                      className="px-2 py-1 text-[11px] sm:text-xs font-medium rounded text-[#5865f2] bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      <RefreshCw size={11} />
                      <span>Tự động FIFO</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentForm((prev) => ({
                          ...prev,
                          allocations: unpaidReceipts.map((r) => ({ receiptId: r.id, amount: 0 })),
                        }));
                      }}
                      className="px-2 py-1 text-[11px] sm:text-xs font-medium rounded text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      Xóa
                    </button>
                  </div>
                )}
              </div>

              {unpaidReceipts.length === 0 ? (
                <div className="p-4 sm:p-5 text-center rounded bg-white dark:bg-[#1a1b23] border border-dashed border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Nhà cung cấp này hiện không có phiếu nhập nào chưa thanh toán.
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Toàn bộ số tiền chi ({paymentForm.amount.toLocaleString('vi-VN')}đ) sẽ được ghi nhận là Đặt cọc / Tiền ứng trước tại NCC.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Cards View (< sm) */}
                  <div className="sm:hidden space-y-2">
                    {unpaidReceipts.map((r) => {
                      const alloc = paymentForm.allocations.find((a) => a.receiptId === r.id);
                      const allocAmount = alloc ? alloc.amount : 0;
                      const remaining = Number(r.remainingAmount);

                      return (
                        <div
                          key={r.id}
                          className="p-2.5 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded space-y-2 text-xs shadow-xs"
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-800">
                            <span className="font-bold text-[#5865f2] dark:text-indigo-400 font-mono">
                              {r.receiptCode}
                            </span>
                            <span className="text-[11px] text-gray-500 font-sans">
                              {new Date(r.receiptDate).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500">
                              Phải trả: {Number(r.payableAmount).toLocaleString('vi-VN')}đ
                            </span>
                            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                              Còn nợ: {remaining.toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100 dark:border-gray-800">
                            <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                              Phân bổ:
                            </span>
                            <div className="flex items-center gap-1.5 flex-1 max-w-[170px] justify-end">
                              <CurrencyInput
                                value={allocAmount}
                                onChange={(val) => handleAllocationAmountChange(r.id, val)}
                                className="flex-1"
                                inputClassName="text-right border-indigo-200 dark:border-indigo-800/70 font-mono font-bold text-[#5865f2] dark:text-indigo-400 text-xs py-1 px-2 rounded h-[34px] focus:ring-1 focus:ring-[#5865f2]"
                              />
                              <button
                                type="button"
                                onClick={() => handleAllocationAmountChange(r.id, remaining)}
                                className="text-[11px] px-2 h-[34px] rounded bg-indigo-50 dark:bg-indigo-950/60 text-[#5865f2] dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold transition-all cursor-pointer shrink-0 active:scale-95"
                                title="Phân bổ toàn bộ khoản nợ phiếu này"
                              >
                                Đủ
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block border border-gray-200/80 dark:border-gray-800 rounded overflow-hidden bg-white dark:bg-[#1a1b23]">
                    <div className="overflow-x-auto max-h-56">
                      <table className="w-full text-left text-xs min-w-[680px]">
                        <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 sticky top-0 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-3 py-2 font-semibold whitespace-nowrap w-44">Mã Phiếu Nhập</th>
                            <th className="px-3 py-2 font-semibold whitespace-nowrap w-32">Ngày Nhập</th>
                            <th className="px-3 py-2 text-right font-semibold whitespace-nowrap w-36">Tổng Phải Trả</th>
                            <th className="px-3 py-2 text-right font-semibold whitespace-nowrap w-36">Còn Nợ</th>
                            <th className="px-3 py-2 text-right font-semibold whitespace-nowrap w-40">Tiền Phân Bổ (đ)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                          {unpaidReceipts.map((r) => {
                            const alloc = paymentForm.allocations.find((a) => a.receiptId === r.id);
                            const allocAmount = alloc ? alloc.amount : 0;
                            const remaining = Number(r.remainingAmount);

                            return (
                              <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                <td className="px-3 py-2 font-bold text-[#5865f2] dark:text-indigo-400 font-mono">
                                  {r.receiptCode}
                                </td>
                                <td className="px-3 py-2 text-gray-500 font-sans">
                                  {new Date(r.receiptDate).toLocaleDateString('vi-VN')}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                  {Number(r.payableAmount).toLocaleString('vi-VN')}đ
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-rose-600 dark:text-rose-400">
                                  {remaining.toLocaleString('vi-VN')}đ
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <CurrencyInput
                                      value={allocAmount}
                                      onChange={(val) => handleAllocationAmountChange(r.id, val)}
                                      className="w-28"
                                      inputClassName="text-right border-indigo-200 dark:border-indigo-800/70 font-mono font-bold text-[#5865f2] dark:text-indigo-400 text-xs py-1 px-2 rounded focus:ring-1 focus:ring-[#5865f2]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAllocationAmountChange(r.id, remaining)}
                                      className="text-[10px] px-1.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-[#5865f2] dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-sans font-semibold transition-colors cursor-pointer shrink-0 active:scale-95"
                                      title="Phân bổ toàn bộ khoản nợ phiếu này"
                                    >
                                      Đủ
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Summary Calculation */}
              {(() => {
                const totalAlloc = paymentForm.allocations.reduce((sum, a) => sum + Number(a.amount || 0), 0);
                const excess = Math.max(0, paymentForm.amount - totalAlloc);
                const isOverAllocated = totalAlloc > paymentForm.amount;

                if (isOverAllocated) {
                  return (
                    <div className="p-2.5 sm:p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="text-[11px] sm:text-xs">
                          Tiền phân bổ vượt quá số tiền chi ({paymentForm.amount.toLocaleString('vi-VN')}đ)!
                        </span>
                      </div>
                      <span className="font-bold font-mono text-[11px] sm:text-xs shrink-0">
                        -{(totalAlloc - paymentForm.amount).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  );
                }

                if (excess > 0 && paymentForm.amount > 0) {
                  return (
                    <div className="p-2.5 sm:p-3 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/40 rounded flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="text-[11px] sm:text-xs truncate">Khoản dư ghi nhận làm Tiền Đặt Cọc / Ứng Trước:</span>
                      </div>
                      <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm shrink-0 ml-2">
                        +{excess.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  );
                }

                if (totalAlloc > 0 && totalAlloc === paymentForm.amount) {
                  return (
                    <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/30 rounded flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-[11px] sm:text-xs">Đã phân bổ khớp 100% số tiền chi trả cho các phiếu nợ.</span>
                      </div>
                      <span className="font-mono font-bold text-xs shrink-0">{totalAlloc.toLocaleString('vi-VN')}đ</span>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* Ghi chú thanh toán */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                <FileText size={13} className="text-gray-500" />
                <span>Ghi chú thanh toán</span>
              </label>
              <input
                type="text"
                placeholder="Nội dung thanh toán, số UNC, ủy nhiệm chi, chứng từ kèm theo..."
                value={paymentForm.note}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
              />
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton
              type="button"
              variant="outline"
              onClick={() => setIsPaymentModalOpen(false)}
              className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
            >
              <X size={14} />
              <span>Hủy</span>
            </ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs active:scale-95 transition-all text-xs justify-center"
            >
              <CheckCircle2 size={14} />
              <span className="sm:hidden">Lập Phiếu Chi</span>
              <span className="hidden sm:inline">Xác nhận Lập Phiếu Chi</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL: THÊM / SỬA NHÀ CUNG CẤP */}
      <Modal
        isOpen={isAddSupplierModalOpen}
        onClose={() => setIsAddSupplierModalOpen(false)}
        title={
          <div className="flex items-center gap-2 min-w-0">
            <span className="sm:hidden font-semibold truncate">
              {editingSupplier ? 'Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp'}
            </span>
            <span className="hidden sm:inline font-semibold truncate">
              {editingSupplier ? 'Chỉnh Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}
            </span>
          </div>
        }
        subtitle={
          <div className="min-w-0 truncate">
            <span className="sm:hidden truncate">Thông tin đối tác & tài khoản thanh toán</span>
            <span className="hidden sm:inline truncate">
              Quản lý thông tin đối tác cung ứng, liên hệ và tài khoản thanh toán
            </span>
          </div>
        }
        icon={Building2}
        size="lg"
      >
        <form onSubmit={handleSaveSupplier} className="flex flex-col flex-1 min-h-0">
          <ModalBody className="space-y-3 sm:space-y-4 text-xs sm:text-sm p-3 sm:p-5">
            {/* 1. THÔNG TIN ĐỐI TÁC CƠ BẢN */}
            <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded border border-gray-200/80 dark:border-gray-800 space-y-2.5 sm:space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5 text-[#5865f2]" />
                <span>Thông tin định danh đối tác</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Hash size={13} className="text-[#5865f2]" />
                      <span>Mã NCC</span>
                    </label>
                    <span className="text-[10px] text-gray-400 font-normal">Hệ thống tự cấp</span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    disabled
                    tabIndex={-1}
                    value={supplierForm.code || 'Hệ thống tự động cấp'}
                    title="Mã được hệ thống tự động sinh ngầm khi lưu để đảm bảo tuyệt đối không bị trùng lặp"
                    className="w-full bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded px-2.5 py-1.5 text-xs font-mono uppercase font-bold text-gray-500 dark:text-gray-400 cursor-not-allowed select-none pointer-events-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Truck size={13} className="text-[#5865f2]" />
                    <span>Tên Nhà Cung Cấp *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    placeholder="VD: Xưởng May An Phát, Công ty TNHH Hưng Thịnh..."
                    className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Phone size={13} className="text-emerald-500" />
                    <span>Số điện thoại</span>
                  </label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="0912 345 678"
                    className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Mail size={13} className="text-blue-500" />
                    <span>Email liên hệ</span>
                  </label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="supplier@company.vn"
                    className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <MapPin size={13} className="text-amber-500" />
                  <span>Địa chỉ kho hàng / Trụ sở</span>
                </label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="VD: Cụm Công nghiệp Triều Khúc, Tân Triều, Thanh Trì, Hà Nội"
                  className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
                />
              </div>
            </div>

            {/* 2. TÀI KHOẢN NGÂN HÀNG THANH TOÁN */}
            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded border border-indigo-100 dark:border-indigo-900/40 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-indigo-100 dark:border-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Tài khoản ngân hàng / Nhận chuyển khoản</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <Landmark size={12} className="text-indigo-500" />
                    <span>Ngân hàng</span>
                  </label>
                  <input
                    type="text"
                    placeholder="MB, VCB, ACB..."
                    value={supplierForm.bankName}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, bankName: e.target.value })
                    }
                    className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <CreditCard size={12} className="text-indigo-500" />
                    <span>Số tài khoản</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0123456789..."
                    value={supplierForm.bankAccount}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, bankAccount: e.target.value })
                    }
                    className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs font-mono font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                    <UserCheck size={12} className="text-indigo-500" />
                    <span>Tên người thụ hưởng</span>
                  </label>
                  <input
                    type="text"
                    placeholder="NGUYEN VAN A"
                    value={supplierForm.bankBeneficiary}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, bankBeneficiary: e.target.value })
                    }
                    className="w-full bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-xs uppercase text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]"
                  />
                </div>
              </div>
            </div>

            {/* 3. THIẾT LẬP CÔNG NỢ ĐẦU KỲ */}
            <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 rounded border border-amber-100 dark:border-amber-900/40 space-y-2.5">
              <div className="flex items-center gap-2 pb-1.5 border-b border-amber-100 dark:border-amber-900/30 text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Số dư công nợ ban đầu</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Số tiền nợ ban đầu / Số dư đầu kỳ (đ)
                </label>
                <CurrencyInput
                  value={supplierForm.openingDebt}
                  onChange={(val) => setSupplierForm({ ...supplierForm, openingDebt: val })}
                  suffix="đ"
                  inputClassName="py-1.5 px-3 font-mono text-sm font-semibold text-gray-900 dark:text-white rounded"
                />
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <Info size={13} className="text-amber-500 shrink-0" />
                  <span>
                    <strong className="text-rose-600 dark:text-rose-400 font-semibold">Dương (+)</strong>: Shop đang nợ NCC. <strong className="text-blue-600 dark:text-blue-400 font-semibold">Âm (-)</strong>: NCC đang giữ tiền cọc của shop.
                  </span>
                </div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton
              type="button"
              variant="outline"
              onClick={() => setIsAddSupplierModalOpen(false)}
              className="gap-1.5 flex-none px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
            >
              <X size={14} />
              <span>Hủy</span>
            </ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 font-semibold shadow-xs active:scale-95 transition-all text-xs justify-center"
            >
              <Check size={14} />
              <span className="sm:hidden">{editingSupplier ? 'Cập nhật' : 'Lưu NCC'}</span>
              <span className="hidden sm:inline">{editingSupplier ? 'Cập Nhật Nhà Cung Cấp' : 'Lưu Nhà Cung Cấp'}</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL: TẠO PHIẾU TRẢ HÀNG NCC */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={
          <div className="flex items-center gap-2 min-w-0">
            <span className="sm:hidden font-semibold truncate">Phiếu trả hàng NCC</span>
            <span className="hidden sm:inline font-semibold truncate">Lập Phiếu Trả Hàng Cho Nhà Cung Cấp</span>
          </div>
        }
        subtitle={
          <div className="min-w-0 truncate">
            <span className="sm:hidden truncate">Xuất trả hàng lỗi & giảm trừ công nợ</span>
            <span className="hidden sm:inline truncate">
              Xuất trả hàng lỗi / hỏng / thừa về nhà cung cấp và ghi nhận giảm trừ công nợ trực tiếp
            </span>
          </div>
        }
        icon={RotateCcw}
        size="2xl"
      >
        <form onSubmit={handleSaveReturn} className="flex flex-col flex-1 min-h-0">
          <ModalBody className="space-y-3 sm:space-y-4 text-xs sm:text-sm p-3 sm:p-5">
            {/* 1. THÔNG TIN ĐỐI TÁC & KHO XUẤT */}
            <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded border border-gray-200/80 dark:border-gray-800 space-y-2.5 sm:space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5 text-[#5865f2]" />
                <span>Thông tin xuất trả & Đối tác</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Building2 size={13} className="text-[#5865f2]" />
                    <span>Nhà cung cấp *</span>
                  </label>
                  <Select
                    value={returnForm.supplierId}
                    onChange={(val) => setReturnForm({ ...returnForm, supplierId: String(val) })}
                    options={[
                      { value: '', label: '-- Chọn Nhà Cung Cấp --' },
                      ...suppliers.map((s) => ({
                        value: s.id,
                        label: `${s.code} - ${s.name}`,
                        icon: Building2,
                        badge: s.closingDebt > 0 ? `Nợ: ${s.closingDebt.toLocaleString('vi-VN')}đ` : undefined,
                      })),
                    ]}
                    placeholder="-- Chọn Nhà Cung Cấp --"
                    searchable={true}
                    size="sm"
                    className="w-full"
                  />
                  {(() => {
                    const currentSupplier = suppliers.find((s) => s.id === returnForm.supplierId);
                    if (!currentSupplier) return null;
                    const debt = currentSupplier.closingDebt || 0;
                    return (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                        <span className="text-gray-500">Dư nợ hiện tại:</span>
                        <span
                          className={`font-mono font-bold ${
                            debt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {debt > 0 ? `${debt.toLocaleString('vi-VN')} đ` : '0 đ (Cân bằng)'}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Warehouse size={13} className="text-[#5865f2]" />
                    <span>Kho xuất trả hàng *</span>
                  </label>
                  <Select
                    value={returnForm.warehouseId}
                    onChange={(val) => setReturnForm({ ...returnForm, warehouseId: String(val) })}
                    options={warehouses.map((w) => ({
                      value: w.id,
                      label: `${w.code} - ${w.name}`,
                      icon: Warehouse,
                      badge: w.status === 'ACTIVE' ? 'Hoạt động' : undefined,
                    }))}
                    placeholder="-- Chọn Kho Xuất Hàng --"
                    searchable={true}
                    size="sm"
                    className="w-full"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                    <Info size={11} className="text-blue-500 shrink-0" />
                    <span>Tồn kho (onHand) của kho này sẽ tự động giảm trừ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. DANH SÁCH SẢN PHẨM XUẤT TRẢ */}
            <div className="p-3 sm:p-3.5 bg-gray-50/80 dark:bg-gray-900/60 rounded border border-gray-200/80 dark:border-gray-800 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800 gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider truncate min-w-0">
                  <Boxes size={14} className="text-[#5865f2] shrink-0" />
                  <span className="truncate">Sản phẩm xuất trả ({returnForm.items.length})</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddReturnItemRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#5865f2] dark:text-indigo-400 hover:bg-[#5865f2]/10 rounded border border-[#5865f2]/30 transition-colors cursor-pointer shrink-0 whitespace-nowrap active:scale-95"
                >
                  <Plus size={13} />
                  <span>Thêm sản phẩm</span>
                </button>
              </div>

              {/* Table Header (Desktop) */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800/80 rounded text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                <div className="col-span-5">Sản phẩm & Biến thể / SKU *</div>
                <div className="col-span-2 text-center">Số lượng</div>
                <div className="col-span-2 text-right">Đơn giá hoàn (đ)</div>
                <div className="col-span-2 text-right">Thành tiền (đ)</div>
                <div className="col-span-1 text-center">Xóa</div>
              </div>

              {/* Items Rows */}
              <div className="space-y-2">
                {returnForm.items.map((row, idx) => {
                  const lineTotal = (row.quantity || 0) * (row.unitPrice || 0);
                  return (
                    <div
                      key={idx}
                      className="p-3 sm:p-2 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700/80 rounded sm:rounded space-y-2.5 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center shadow-xs"
                    >
                      {/* Mobile Row Header: Item index & Delete action */}
                      <div className="sm:hidden flex items-center justify-between pb-1.5 border-b border-gray-100 dark:border-gray-800">
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                          Mục #{idx + 1}
                        </span>
                        {returnForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveReturnItemRow(idx)}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-medium px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/30 active:scale-95 transition-all cursor-pointer"
                          >
                            <Trash2 size={12} />
                            <span>Xóa dòng</span>
                          </button>
                        )}
                      </div>

                      {/* Product select */}
                      <div className="col-span-5">
                        <label className="sm:hidden block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          Sản phẩm & Biến thể *
                        </label>
                        <Select
                          value={row.variantId}
                          onChange={(val) => handleReturnItemChange(idx, 'variantId', String(val))}
                          options={[
                            { value: '', label: '-- Chọn biến thể hàng trả --' },
                            ...allVariants.map((v) => ({
                              value: v.id,
                              label: `${v.sku ? `[${v.sku}] ` : ''}${v.product?.name || v.productName || ''}${
                                v.name && v.name !== 'Mặc định' ? ` (${v.name})` : ''
                              }`,
                              badge: v.costPrice ? `${Number(v.costPrice).toLocaleString('vi-VN')}đ` : undefined,
                            })),
                          ]}
                          placeholder="-- Chọn biến thể hàng trả --"
                          searchable={true}
                          size="sm"
                          className="w-full"
                        />
                      </div>

                      {/* Mobile 2-column group: Quantity & Unit Price */}
                      <div className="grid grid-cols-2 gap-2 sm:contents">
                        <div className="col-span-2">
                          <label className="sm:hidden block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                            Số lượng trả
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) =>
                              handleReturnItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full text-center font-bold text-xs h-[34px] sm:h-[30px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded sm:rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="sm:hidden block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                            Đơn giá hoàn (đ)
                          </label>
                          <CurrencyInput
                            value={row.unitPrice}
                            onChange={(val) => handleReturnItemChange(idx, 'unitPrice', val)}
                            suffix="đ"
                            inputClassName="text-right font-mono text-xs h-[34px] sm:h-[30px] p-2 sm:p-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded sm:rounded text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Line Total */}
                      <div className="col-span-2 sm:text-right flex items-center justify-between sm:justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                        <span className="sm:hidden text-[11px] font-semibold text-gray-500">
                          Thành tiền:
                        </span>
                        <div className="font-mono font-bold text-xs text-orange-600 dark:text-orange-400 sm:text-gray-900 sm:dark:text-white">
                          {lineTotal.toLocaleString('vi-VN')} đ
                        </div>
                      </div>

                      {/* Desktop Delete button */}
                      <div className="hidden sm:flex col-span-1 text-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveReturnItemRow(idx)}
                          disabled={returnForm.items.length <= 1}
                          className="text-gray-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-gray-400 p-1 rounded transition-colors cursor-pointer"
                          title="Xóa dòng"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. TỔNG TIỀN GIẢM TRỪ NỢ & LÝ DO */}
            <div className="p-3 sm:p-3.5 bg-orange-50/50 dark:bg-orange-950/20 rounded border border-orange-200/80 dark:border-orange-900/40 space-y-2.5 sm:space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-start">
                <div>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <label className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 truncate min-w-0">
                      <DollarSign size={13} className="text-orange-500 shrink-0" />
                      <span className="truncate">Khoản tiền giảm nợ NCC (đ) *</span>
                    </label>
                    {(() => {
                      const totalGoods = returnForm.items.reduce(
                        (sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0),
                        0,
                      );
                      if (totalGoods !== returnForm.debtOffsetAmount) {
                        return (
                          <button
                            type="button"
                            onClick={() => setReturnForm({ ...returnForm, debtOffsetAmount: totalGoods })}
                            className="text-[10px] text-orange-600 dark:text-orange-400 hover:underline font-semibold cursor-pointer shrink-0 whitespace-nowrap active:opacity-75"
                          >
                            = Tổng tiền hàng
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <CurrencyInput
                    value={returnForm.debtOffsetAmount}
                    onChange={(val) => setReturnForm({ ...returnForm, debtOffsetAmount: val })}
                    suffix="đ"
                    inputClassName="border-orange-400 dark:border-orange-600 font-bold font-mono text-orange-600 dark:text-orange-400 text-sm py-2 sm:py-1.5 px-3 bg-white dark:bg-[#1a1b23] rounded shadow-xs"
                  />
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <Info size={12} className="text-orange-500 shrink-0" />
                    <span className="truncate">
                      Tổng giá trị hàng xuất:{' '}
                      <strong className="font-mono text-gray-900 dark:text-white">
                        {returnForm.items
                          .reduce((sum, it) => sum + (it.quantity || 0) * (it.unitPrice || 0), 0)
                          .toLocaleString('vi-VN')}{' '}
                        đ
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <FileText size={13} className="text-gray-500 shrink-0" />
                    <span>Lý do xuất trả hàng</span>
                  </label>

                  {/* Quick reason tag buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Hàng lỗi / rách bao bì',
                      'Cận date / hết hạn',
                      'Giao sai mẫu mã',
                      'Thừa hàng nhập',
                    ].map((reasonTag) => (
                      <button
                        key={reasonTag}
                        type="button"
                        onClick={() => setReturnForm({ ...returnForm, reason: reasonTag })}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                          returnForm.reason === reasonTag
                            ? 'bg-orange-500 text-white border-orange-500 font-semibold shadow-xs'
                            : 'bg-white dark:bg-[#1a1b23] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-300'
                        }`}
                      >
                        {reasonTag}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={returnForm.reason}
                    onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                    placeholder="VD: Hàng lỗi vải, rách bao bì khi kiểm đếm..."
                    className="w-full px-3 py-2 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
                  />
                </div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
            <ModalButton
              type="button"
              variant="outline"
              onClick={() => setIsReturnModalOpen(false)}
              className="gap-1.5 px-4 py-2.5 sm:py-1.5 text-xs font-semibold shrink-0"
            >
              <X size={14} />
              <span>Hủy</span>
            </ModalButton>
            <ModalButton
              type="submit"
              variant="primary"
              className="gap-1.5 flex-1 sm:flex-none py-2.5 sm:py-1.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-xs active:scale-95 transition-all text-xs justify-center"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Xác nhận Trả Hàng & Giảm Nợ</span>
              <span className="sm:hidden">Xác nhận Trả Hàng</span>
            </ModalButton>
          </ModalFooter>
        </form>
      </Modal>

      {/* MODAL XEM MÃ QR THANH TOÁN VIETQR */}
      <Modal
        isOpen={!!qrModalSupplier}
        onClose={() => setQrModalSupplier(null)}
        title={
          <div className="flex items-center gap-2">
            <span>Mã QR Chuyển Khoản VietQR</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              Napas 247
            </span>
          </div>
        }
        subtitle={qrModalSupplier ? `${qrModalSupplier.code} - ${qrModalSupplier.name}` : ''}
        icon={QrCode}
        size="sm"
      >
        <ModalBody className="p-3 sm:p-5">
          {qrModalSupplier && (
            <SupplierBankQr
              supplier={qrModalSupplier}
              amount={qrModalSupplier.closingDebt > 0 ? qrModalSupplier.closingDebt : 0}
              description={`Thanh toan NCC ${qrModalSupplier.code}`}
            />
          )}
        </ModalBody>
        <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
          <ModalButton
            type="button"
            variant="outline"
            onClick={() => setQrModalSupplier(null)}
            className="gap-1.5 px-4 py-2 sm:py-1.5 text-xs font-semibold"
          >
            <X size={14} />
            <span>Đóng</span>
          </ModalButton>
          {qrModalSupplier && (
            <ModalButton
              type="button"
              variant="primary"
              onClick={() => {
                const supp = qrModalSupplier;
                setQrModalSupplier(null);
                handleOpenPaymentModal(supp.id);
              }}
              className="gap-1.5 px-4 py-2 sm:py-1.5 text-xs font-semibold"
            >
              <CreditCard size={14} />
              <span>Lập phiếu chi cho NCC này</span>
            </ModalButton>
          )}
        </ModalFooter>
      </Modal>

      {/* MODAL: CHUYỂN TIỀN GIỮA 2 NHÀ CUNG CẤP */}
      <SupplierTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={loadAllData}
        suppliers={suppliers}
        initialFromSupplierId={transferInitialFromId}
        initialToSupplierId={transferInitialToId}
      />
    </div>
  );
};
