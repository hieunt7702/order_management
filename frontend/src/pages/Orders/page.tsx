import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShoppingBag,
  RefreshCw,
  Eye,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity,
  Plus,
  Edit2,
  Trash2,
  Package,
  Store,
  X,
  RotateCcw,
  MoreHorizontal,
  Boxes,
  FileText,
  ShieldCheck,
  Building2,
  Sparkles,
  Calculator,
  Copy,
  Search,
} from 'lucide-react';
import { ordersApi } from '../../services/ordersApi';
import { productsApi } from '../../services/productsApi';
import { orderReturnsApi } from '../../services/orderReturnsApi';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { formatCurrency } from '../../utils';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import {
  getPlatformStatusConfig,
  getVerificationStatusConfig,
} from '../../utils/orderStatus';
import { VerificationStatusBadge } from '../../components/orders/VerificationStatusBadge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../../components/ui/DropdownMenu';
import { toast } from '../../components/ui/Toast';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableEmpty,
  SystemTableSkeleton,
  SystemPagination,
} from '../../components/ui/SystemTable';
import {
  SystemFilter,
  SystemFilterItem,
  SystemFilterSearch,
} from '../../components/ui/SystemFilter';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { OrderDetailDrawer } from './OrderDetailDrawer';
import { getOrderProductSummary } from './orderUtils';

const PRESET_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'READY_TO_SHIP', label: 'Chờ giao hàng' },
  { id: 'SHIPPED', label: 'Đang giao' },
  { id: 'COMPLETED', label: 'Giao thành công' },
  { id: 'CANCELLED_AND_RETURNED', label: 'Hủy & Hoàn hàng' },
  { id: 'CANCELLED', label: 'Đã hủy' },
  { id: 'TO_RETURN', label: 'Trả hàng/Hoàn tiền' },
  { id: 'NOT_VERIFIED', label: 'Chưa quét kho' },
  { id: 'VERIFIED', label: 'Đã xuất kho' },
  { id: 'NEEDS_ATTENTION', label: 'Chưa map SKU' },
];

export const OrdersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { selectedShopId, shops, warehouses, selectedWarehouseId } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<string>(
    () =>
      searchParams.get('tab') ||
      searchParams.get('platformStatus') ||
      searchParams.get('verificationStatus') ||
      'ALL',
  );
  const [searchTerm, setSearchTerm] = useState<string>(
    searchParams.get('search') || '',
  );
  const [fromDate, setFromDate] = useState<string>(
    searchParams.get('fromDate') || '',
  );
  const [toDate, setToDate] = useState<string>(
    searchParams.get('toDate') || '',
  );
  const [page, setPage] = useState<number>(
    parseInt(searchParams.get('page') || '1', 10),
  );
  const [limit, setLimit] = useState<number>(25);

  const [orders, setOrders] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Modals for Orders CRUD
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState<boolean>(false);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState<boolean>(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any>(null);
  const [isDeleteOrderModalOpen, setIsDeleteOrderModalOpen] = useState<boolean>(false);
  const [selectedOrderForDelete, setSelectedOrderForDelete] = useState<any>(null);

  // Bulk Delete State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState<boolean>(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState<boolean>(false);
  const [forceBulkDelete, setForceBulkDelete] = useState<boolean>(false);
  const [forceDeleteAll, setForceDeleteAll] = useState<boolean>(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState<boolean>(false);

  // Virtual Order State & Filter
  const [virtualFilter, setVirtualFilter] = useState<string>('ALL');
  const [isVirtualModalOpen, setIsVirtualModalOpen] = useState<boolean>(false);
  const [targetOrdersForVirtual, setTargetOrdersForVirtual] = useState<string[]>([]);
  const [virtualForm, setVirtualForm] = useState<{ isVirtual: boolean; isRealGoods: boolean }>({
    isVirtual: true,
    isRealGoods: false,
  });
  const [isUpdatingVirtual, setIsUpdatingVirtual] = useState<boolean>(false);

  // Manual Dispatch State
  const [isBulkDispatchModalOpen, setIsBulkDispatchModalOpen] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [selectedWarehouseForDispatch, setSelectedWarehouseForDispatch] = useState<string>('');

  // Procurement Demand State (Hàng cần nhập cho đơn READY_TO_SHIP)
  const [isDemandModalOpen, setIsDemandModalOpen] = useState<boolean>(false);
  const [demandData, setDemandData] = useState<{ summary: any; items: any[] } | null>(null);
  const [isLoadingDemand, setIsLoadingDemand] = useState<boolean>(false);
  const [demandFilterTab, setDemandFilterTab] = useState<'ALL' | 'SHORTAGE' | 'SUFFICIENT' | 'UNMAPPED'>('ALL');
  const [demandSearchQuery, setDemandSearchQuery] = useState<string>('');
  const [demandWarehouseId, setDemandWarehouseId] = useState<string>('');
  const [demandShopId, setDemandShopId] = useState<string>('');

  // Global Order Summary Metrics for KPI cards
  const [orderSummary, setOrderSummary] = useState({
    total: 0,
    readyToShip: 0,
    shipped: 0,
    verified: 0,
    completed: 0,
    returned: 0,
    unmapped: 0,
    virtualOrders: 0,
  });

  const [isSavingOrder, setIsSavingOrder] = useState<boolean>(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState<boolean>(false);
  const [availableVariants, setAvailableVariants] = useState<any[]>([]);

  // Create Order Form
  const [createOrderForm, setCreateOrderForm] = useState({
    shopId: '',
    externalOrderId: '',
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    shippingCarrier: 'SPX Express',
    trackingCode: '',
    shippingFee: 0,
    note: '',
    isVirtual: false,
    isRealGoods: false,
    items: [
      {
        variantId: '',
        productName: '',
        variationName: '',
        sellerSku: '',
        quantity: 1,
        unitPrice: 0,
      },
    ],
  });

  // Edit Order Form
  const [editOrderForm, setEditOrderForm] = useState({
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    shippingCarrier: '',
    trackingCode: '',
    shippingFee: 0,
    totalAmount: 0,
    platformStatus: 'READY_TO_SHIP',
    note: '',
    isVirtual: false,
    isRealGoods: false,
  });

  const loadSummary = async () => {
    try {
      const res: any = await ordersApi.getSummary({
        shopId: selectedShopId,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      if (res) {
        setOrderSummary({
          total: Number(res.total) || 0,
          readyToShip: Number(res.readyToShip) || 0,
          shipped: Number(res.shipped) || 0,
          verified: Number(res.verified) || 0,
          completed: Number(res.completed) || 0,
          returned: Number(res.returned) || 0,
          unmapped: Number(res.unmapped) || 0,
          virtualOrders: Number(res.virtualOrders) || 0,
        });
      }
    } catch (err) {
      console.error('Error loading order summary:', err);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [selectedShopId, fromDate, toDate]);

  useEffect(() => {
    loadOrders();
  }, [selectedShopId, activeTab, searchTerm, fromDate, toDate, page, limit, virtualFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        shopId: selectedShopId,
        page,
        limit,
        search: searchTerm || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      };

      if (virtualFilter === 'VIRTUAL') {
        params.isVirtual = true;
      } else if (virtualFilter === 'REAL_ONLY') {
        params.isVirtual = false;
      } else if (virtualFilter === 'VIRTUAL_NO_STOCK') {
        params.isVirtual = true;
        params.isRealGoods = false;
      } else if (virtualFilter === 'VIRTUAL_REAL_GOODS') {
        params.isVirtual = true;
        params.isRealGoods = true;
      }

      if (activeTab === 'READY_TO_SHIP') {
        params.platformStatus = 'READY_TO_SHIP';
      } else if (activeTab === 'SHIPPED') {
        params.platformStatus = 'SHIPPED';
      } else if (activeTab === 'TO_CONFIRM_RECEIVE') {
        params.platformStatus = 'TO_CONFIRM_RECEIVE';
      } else if (activeTab === 'COMPLETED') {
        params.platformStatus = 'COMPLETED';
      } else if (activeTab === 'CANCELLED_AND_RETURNED' || activeTab === 'CANCELLED_OR_RETURNED') {
        params.platformStatus = 'CANCELLED_AND_RETURNED';
      } else if (activeTab === 'CANCELLED') {
        params.platformStatus = 'CANCELLED';
      } else if (activeTab === 'TO_RETURN') {
        params.platformStatus = 'TO_RETURN';
      } else if (activeTab === 'NOT_VERIFIED') {
        params.verificationStatus = 'NOT_VERIFIED';
      } else if (activeTab === 'PARTIALLY_VERIFIED') {
        params.verificationStatus = 'PARTIALLY_VERIFIED';
      } else if (activeTab === 'VERIFIED') {
        params.verificationStatus = 'VERIFIED';
      } else if (activeTab === 'NEEDS_ATTENTION') {
        params.fulfillmentStatus = 'UNMAPPED';
      }

      const res: any = await ordersApi.findAll(params);
      setOrders(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đơn hàng');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = async (orderId: string) => {
    try {
      const fullOrder = await ordersApi.findOne(orderId);
      setSelectedOrder(fullOrder);
      setIsDrawerOpen(true);
    } catch (err: any) {
      alert('Lỗi tải chi tiết đơn: ' + err.message);
    }
  };

  const loadVariantsForOrder = async () => {
    try {
      const res: any = await productsApi.findAll({ limit: 150 });
      const prods = res?.data || res?.items || res || [];
      const flat = prods.flatMap((p: any) =>
        (p.variants || []).map((v: any) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          productName: p.name,
          sellPrice: v.sellingPrice ?? v.sellPrice ?? 0,
        }))
      );
      setAvailableVariants(flat);
    } catch (err) {
      console.error('Error loading variants:', err);
    }
  };

  const handleOpenCreateOrder = () => {
    loadVariantsForOrder();
    const defaultShop =
      selectedShopId && selectedShopId !== 'ALL'
        ? selectedShopId
        : shops.length > 0
        ? shops[0].id
        : '';
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const autoOrderCode = `DH${dateStr}-${rand}`;
    const autoTracking = `SPX${Math.floor(100000000 + Math.random() * 900000000)}`;

    setCreateOrderForm({
      shopId: defaultShop,
      externalOrderId: autoOrderCode,
      recipientName: '',
      recipientPhone: '',
      recipientAddress: '',
      shippingCarrier: 'SPX Express',
      trackingCode: autoTracking,
      shippingFee: 0,
      note: '',
      items: [
        {
          variantId: '',
          productName: '',
          variationName: '',
          sellerSku: '',
          quantity: 1,
          unitPrice: 0,
        },
      ],
    });
    setIsCreateOrderModalOpen(true);
  };

  const handleAddItemToCreateOrder = () => {
    setCreateOrderForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          variantId: '',
          productName: '',
          variationName: '',
          sellerSku: '',
          quantity: 1,
          unitPrice: 0,
        },
      ],
    }));
  };

  const handleRemoveItemFromCreateOrder = (idx: number) => {
    if (createOrderForm.items.length <= 1) return;
    setCreateOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleSelectVariantForItem = (idx: number, variantId: string) => {
    const selected = availableVariants.find((v) => v.id === variantId);
    setCreateOrderForm((prev) => {
      const newItems = [...prev.items];
      if (selected) {
        newItems[idx] = {
          ...newItems[idx],
          variantId: selected.id,
          productName: selected.productName,
          variationName: selected.name,
          sellerSku: selected.sku,
          unitPrice: selected.sellPrice,
        };
      } else {
        newItems[idx] = {
          ...newItems[idx],
          variantId: '',
        };
      }
      return { ...prev, items: newItems };
    });
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOrderForm.shopId) {
      alert('Vui lòng chọn gian hàng Shop cho đơn hàng');
      return;
    }
    if (!createOrderForm.recipientName.trim()) {
      alert('Vui lòng nhập tên người nhận');
      return;
    }
    if (
      createOrderForm.items.some(
        (it) => !it.productName.trim() || it.quantity < 1
      )
    ) {
      alert('Vui lòng kiểm tra lại thông tin sản phẩm (Tên sản phẩm và số lượng >= 1)');
      return;
    }

    const itemsTotal = createOrderForm.items.reduce(
      (sum, it) =>
        sum + it.quantity * (parseFloat(String(it.unitPrice)) || 0),
      0
    );
    const totalAmount =
      itemsTotal + (parseFloat(String(createOrderForm.shippingFee)) || 0);

    setIsSavingOrder(true);
    try {
      await ordersApi.create({
        shopId: createOrderForm.shopId,
        externalOrderId: createOrderForm.externalOrderId.trim() || undefined,
        recipientName: createOrderForm.recipientName.trim(),
        recipientPhone: createOrderForm.recipientPhone.trim() || undefined,
        recipientAddress: createOrderForm.recipientAddress.trim() || undefined,
        shippingCarrier: createOrderForm.shippingCarrier.trim() || undefined,
        trackingCode: createOrderForm.trackingCode.trim() || undefined,
        totalAmount,
        shippingFee: parseFloat(String(createOrderForm.shippingFee)) || 0,
        note: createOrderForm.note.trim() || undefined,
        isVirtual: createOrderForm.isVirtual,
        isRealGoods: createOrderForm.isVirtual ? createOrderForm.isRealGoods : false,
        items: createOrderForm.items.map((it) => ({
          variantId: it.variantId || undefined,
          productName: it.productName.trim(),
          variationName: it.variationName?.trim() || undefined,
          sellerSku: it.sellerSku?.trim() || undefined,
          quantity: parseInt(String(it.quantity), 10) || 1,
          unitPrice: parseFloat(String(it.unitPrice)) || 0,
        })),
      });

      setIsCreateOrderModalOpen(false);
      loadOrders();
      loadSummary();
    } catch (err: any) {
      alert(`Lỗi tạo đơn hàng: ${err.message || 'Không thể tạo đơn'}`);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleOpenEditOrder = (order: any) => {
    setSelectedOrderForEdit(order);
    setEditOrderForm({
      recipientName: order.recipientName || '',
      recipientPhone: order.recipientPhone || '',
      recipientAddress: order.recipientAddress || '',
      shippingCarrier: order.shippingCarrier || '',
      trackingCode: order.trackingCode || '',
      shippingFee: order.shippingFee || 0,
      totalAmount: order.totalAmount || 0,
      platformStatus: order.platformStatus || 'READY_TO_SHIP',
      note: order.note || '',
      isVirtual: !!order.isVirtual,
      isRealGoods: !!order.isRealGoods,
    });
    setIsEditOrderModalOpen(true);
  };

  const handleUpdateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForEdit) return;
    setIsSavingOrder(true);
    try {
      await ordersApi.update(selectedOrderForEdit.id, {
        recipientName: editOrderForm.recipientName.trim(),
        recipientPhone: editOrderForm.recipientPhone.trim() || undefined,
        recipientAddress: editOrderForm.recipientAddress.trim() || undefined,
        shippingCarrier: editOrderForm.shippingCarrier.trim() || undefined,
        trackingCode: editOrderForm.trackingCode.trim() || undefined,
        shippingFee: parseFloat(String(editOrderForm.shippingFee)) || 0,
        totalAmount: parseFloat(String(editOrderForm.totalAmount)) || 0,
        platformStatus: editOrderForm.platformStatus,
        note: editOrderForm.note.trim() || undefined,
        isVirtual: editOrderForm.isVirtual,
        isRealGoods: editOrderForm.isVirtual ? editOrderForm.isRealGoods : false,
      });

      setIsEditOrderModalOpen(false);
      loadOrders();
      loadSummary();
      if (selectedOrder?.id === selectedOrderForEdit.id) {
        handleOpenDetail(selectedOrderForEdit.id);
      }
    } catch (err: any) {
      alert(`Lỗi cập nhật đơn hàng: ${err.message || 'Không thể cập nhật'}`);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleOpenVirtualModal = (order: any) => {
    setTargetOrdersForVirtual([order.id]);
    setVirtualForm({
      isVirtual: !order.isVirtual ? true : order.isVirtual,
      isRealGoods: order.isVirtual ? !!order.isRealGoods : false,
    });
    setIsVirtualModalOpen(true);
  };

  const handleOpenBulkVirtualModal = (markAsVirtual = true) => {
    if (selectedOrderIds.length === 0) return;
    setTargetOrdersForVirtual(selectedOrderIds);
    setVirtualForm({
      isVirtual: markAsVirtual,
      isRealGoods: false,
    });
    setIsVirtualModalOpen(true);
  };

  const handleVirtualModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetOrdersForVirtual.length === 0) return;
    setIsUpdatingVirtual(true);
    try {
      if (targetOrdersForVirtual.length === 1) {
        await ordersApi.markVirtual(targetOrdersForVirtual[0], {
          isVirtual: virtualForm.isVirtual,
          isRealGoods: virtualForm.isRealGoods,
        });
        toast.success(
          virtualForm.isVirtual
            ? `Đã cập nhật đơn ảo (${virtualForm.isRealGoods ? 'có đi hàng thật' : 'không trừ kho'})`
            : 'Đã chuyển thành đơn thường'
        );
      } else {
        const res: any = await ordersApi.bulkMarkVirtual({
          orderIds: targetOrdersForVirtual,
          isVirtual: virtualForm.isVirtual,
          isRealGoods: virtualForm.isRealGoods,
        });
        toast.success(res?.message || `Đã cập nhật ${targetOrdersForVirtual.length} đơn hàng`);
        setSelectedOrderIds([]);
      }
      setIsVirtualModalOpen(false);
      loadOrders();
      loadSummary();
      if (selectedOrder && targetOrdersForVirtual.includes(selectedOrder.id)) {
        handleOpenDetail(selectedOrder.id);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Lỗi cập nhật cấu hình đơn ảo');
    } finally {
      setIsUpdatingVirtual(false);
    }
  };

  const handleMarkDispatched = async (order: any) => {
    try {
      const res: any = await ordersApi.markDispatched(order.id, {
        warehouseId: selectedWarehouseId && selectedWarehouseId !== 'ALL' ? selectedWarehouseId : undefined,
      });
      toast.success(res?.message || 'Đã đánh dấu xuất kho / đã quét thành công');
      loadOrders();
      loadSummary();
      if (selectedOrder?.id === order.id) {
        handleOpenDetail(order.id);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Lỗi khi đánh dấu xuất kho');
    }
  };

  const handleReverseDispatched = async (order: any) => {
    if (!window.confirm(`Xác nhận hoàn tác xuất kho cho đơn ${order.externalOrderId}? Tồn kho thực tế sẽ được phục hồi nếu là đơn thật.`)) {
      return;
    }
    try {
      const res: any = await ordersApi.reverseDispatched(order.id, {
        reason: 'Hoàn tác từ trang danh sách đơn hàng',
      });
      toast.success(res?.message || 'Đã hoàn tác xuất kho thành công');
      loadOrders();
      loadSummary();
      if (selectedOrder?.id === order.id) {
        handleOpenDetail(order.id);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Lỗi khi hoàn tác xuất kho');
    }
  };

  const handleOpenBulkDispatchModal = () => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkDispatchModalOpen(true);
  };

  const handleBulkDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) return;
    setIsDispatching(true);
    try {
      const res: any = await ordersApi.bulkMarkDispatched({
        orderIds: selectedOrderIds,
        warehouseId: selectedWarehouseForDispatch || (selectedWarehouseId && selectedWarehouseId !== 'ALL' ? selectedWarehouseId : undefined),
      });
      toast.success(res?.message || `Đã đánh dấu xuất kho thành công ${selectedOrderIds.length} đơn`);
      setIsBulkDispatchModalOpen(false);
      setSelectedOrderIds([]);
      loadOrders();
      loadSummary();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Lỗi xuất kho hàng loạt');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleOpenProcurementDemand = async (overrideParams?: { shopId?: string; warehouseId?: string }) => {
    setIsDemandModalOpen(true);
    setIsLoadingDemand(true);
    const shopId = overrideParams?.shopId !== undefined
      ? overrideParams.shopId
      : (selectedShopId && selectedShopId !== 'ALL' ? selectedShopId : undefined);
    const warehouseId = overrideParams?.warehouseId !== undefined
      ? overrideParams.warehouseId
      : (selectedWarehouseId && selectedWarehouseId !== 'ALL' ? selectedWarehouseId : undefined);

    setDemandShopId(shopId || '');
    setDemandWarehouseId(warehouseId || '');

    try {
      const data = await ordersApi.getProcurementDemand({
        shopId: shopId || undefined,
        warehouseId: warehouseId || undefined,
      });
      setDemandData(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Lỗi tính toán nhu cầu nhập hàng');
    } finally {
      setIsLoadingDemand(false);
    }
  };

  const handleRefreshDemand = () => {
    handleOpenProcurementDemand({
      shopId: demandShopId || undefined,
      warehouseId: demandWarehouseId || undefined,
    });
  };

  const handleCopyShortageList = () => {
    if (!demandData || !demandData.items) return;
    const shortageItems = demandData.items.filter((it: any) => it.status === 'SHORTAGE');
    if (shortageItems.length === 0) {
      toast.info('Hiện tại không có mặt hàng nào bị thiếu!');
      return;
    }
    const lines = [
      `DANH SÁCH MẶT HÀNG CẦN NHẬP (ĐƠN CHỜ GIAO - ${new Date().toLocaleDateString('vi-VN')}):`,
      ...shortageItems.map((it: any, idx: number) => 
        `${idx + 1}. [${it.sku}] ${it.productName}${it.variationName ? ` - ${it.variationName}` : ''} | Cần giao: ${it.requiredQuantity} | Tồn kho: ${it.onHand} | THIẾU CẦN NHẬP: ${it.shortageQuantity} ${it.unit}`
      ),
      `Tổng số mặt hàng thiếu: ${shortageItems.length} | Tổng số lượng cần nhập thêm: ${shortageItems.reduce((acc: number, it: any) => acc + it.shortageQuantity, 0)} sản phẩm`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success(`Đã sao chép danh sách ${shortageItems.length} mặt hàng cần nhập vào clipboard!`);
  };

  const handleOpenDeleteOrder = (order: any) => {
    setSelectedOrderForDelete(order);
    setIsDeleteOrderModalOpen(true);
  };

  const handleDeleteOrderSubmit = async () => {
    if (!selectedOrderForDelete) return;
    setIsDeletingOrder(true);
    try {
      await ordersApi.delete(selectedOrderForDelete.id);
      toast.success('Đã xóa đơn hàng thành công');
      setIsDeleteOrderModalOpen(false);
      if (selectedOrder?.id === selectedOrderForDelete.id) {
        setIsDrawerOpen(false);
        setSelectedOrder(null);
      }
      setSelectedOrderForDelete(null);
      loadOrders();
      loadSummary();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Không thể xóa đơn hàng');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const handleToggleSelectAll = () => {
    const currentPageIds = orders.map((o) => o.id);
    const allSelectedOnPage =
      currentPageIds.length > 0 &&
      currentPageIds.every((id) => selectedOrderIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedOrderIds((prev) =>
        prev.filter((id) => !currentPageIds.includes(id)),
      );
    } else {
      setSelectedOrderIds((prev) =>
        Array.from(new Set([...prev, ...currentPageIds])),
      );
    }
  };

  const handleToggleSelectOrder = (id: string, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBulkDeleteSubmit = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsDeletingBulk(true);
    try {
      const res: any = await ordersApi.bulkDelete({
        orderIds: selectedOrderIds,
        force: forceBulkDelete,
      });
      toast.success(
        res?.message || `Đã xóa thành công ${selectedOrderIds.length} đơn hàng`,
      );
      setIsBulkDeleteModalOpen(false);
      setSelectedOrderIds([]);
      setForceBulkDelete(false);
      loadOrders();
      loadSummary();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Lỗi khi xóa các đơn hàng đã chọn',
      );
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleDeleteAllSubmit = async () => {
    if (!confirmDeleteAll) return;
    setIsDeletingBulk(true);
    try {
      const res: any = await ordersApi.bulkDelete({
        deleteAll: true,
        shopId: selectedShopId && selectedShopId !== 'ALL' ? selectedShopId : undefined,
        force: forceDeleteAll,
      });
      if (res?.count === 0) {
        toast.info(res?.message || 'Không tìm thấy đơn hàng nào phù hợp để xóa');
      } else {
        toast.success(res?.message || 'Đã xóa toàn bộ đơn hàng thành công');
      }
      setIsDeleteAllModalOpen(false);
      setSelectedOrderIds([]);
      setConfirmDeleteAll(false);
      setForceDeleteAll(false);
      loadOrders();
      loadSummary();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Lỗi khi xóa toàn bộ đơn hàng',
      );
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Return Processing State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<any>(null);
  const [returnMode, setReturnMode] = useState<'MARK_IN_TRANSIT' | 'INSPECT_AND_RECEIVE'>('INSPECT_AND_RECEIVE');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState<boolean>(false);
  const [returnForm, setReturnForm] = useState<{
    warehouseId: string;
    trackingCode: string;
    receivedDate: string;
    inspectorName: string;
    reason: string;
    note: string;
    conditionPhoto: string;
    items: Array<{
      orderItemId: string;
      variantId: string;
      sku: string;
      productName: string;
      variationName?: string;
      dispatchedQuantity: number;
      totalAccounted: number;
      remainingToReturn: number;
      sellableQuantity: number;
      damagedQuantity: number;
      missingQuantity: number;
      batchCode?: string;
      expiryDate?: string;
      note?: string;
    }>;
  }>({
    warehouseId: '',
    trackingCode: '',
    receivedDate: new Date().toISOString().split('T')[0],
    inspectorName: 'Thủ kho',
    reason: 'Khách không nhận / Giao thất bại / Đổi trả sàn',
    note: '',
    conditionPhoto: '',
    items: [],
  });

  const handleOpenReturnModal = async (order: any) => {
    try {
      const fullOrder = await ordersApi.findOne(order.id);
      setSelectedOrderForReturn(fullOrder);

      const defaultWh =
        fullOrder.shop?.defaultWarehouseId ||
        selectedWarehouseId ||
        (warehouses && warehouses[0]?.id) ||
        '';

      const isDispatched =
        fullOrder.fulfillmentStatus === 'DISPATCHED' ||
        fullOrder.fulfillmentStatus === 'PARTIALLY_RETURN_RECEIVED';

      // Tính toán tiến độ hoàn của từng sản phẩm trong đơn
      const items = (fullOrder.orderItems || []).map((oi: any) => {
        let returnedSellable = 0;
        let returnedDamaged = 0;
        let returnedMissing = 0;

        (fullOrder.orderReturns || []).forEach((ret: any) => {
          (ret.items || []).forEach((it: any) => {
            if (it.variantId === oi.variantId) {
              returnedSellable += it.sellableQuantity || 0;
              returnedDamaged += it.damagedQuantity || 0;
              returnedMissing += it.missingQuantity || 0;
            }
          });
        });

        const totalAccounted = returnedSellable + returnedDamaged + returnedMissing;
        const remaining = Math.max(0, oi.quantity - totalAccounted);

        return {
          orderItemId: oi.id,
          variantId: oi.variantId,
          sku: oi.variant?.sku || oi.sellerSku || 'SKU',
          productName: oi.variant?.product?.name || oi.productName || 'Sản phẩm',
          variationName: oi.variant?.name || oi.variationName || '',
          dispatchedQuantity: oi.quantity,
          totalAccounted,
          remainingToReturn: remaining,
          sellableQuantity: remaining,
          damagedQuantity: 0,
          missingQuantity: 0,
          batchCode: '',
          expiryDate: '',
          note: '',
        };
      });

      setReturnMode(isDispatched ? 'INSPECT_AND_RECEIVE' : 'MARK_IN_TRANSIT');
      setReturnForm({
        warehouseId: defaultWh,
        trackingCode: fullOrder.trackingCode || '',
        receivedDate: new Date().toISOString().split('T')[0],
        inspectorName: 'Thủ kho',
        reason: 'Khách không nhận / Giao thất bại / Đổi trả sàn',
        note: '',
        conditionPhoto: '',
        items,
      });

      setIsReturnModalOpen(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể tải thông tin đơn hàng');
    }
  };

  const handleReturnItemChange = (index: number, field: string, val: any) => {
    const updated = [...returnForm.items];
    updated[index] = { ...updated[index], [field]: val };
    setReturnForm({ ...returnForm, items: updated });
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForReturn) return;

    setIsSubmittingReturn(true);
    try {
      if (returnMode === 'MARK_IN_TRANSIT') {
        // Chế độ 1: Báo sàn đang trả hàng về kho - Không tác động tồn kho
        await ordersApi.update(selectedOrderForReturn.id, {
          platformStatus: 'TO_RETURN',
          note: returnForm.note
            ? `${selectedOrderForReturn.note ? selectedOrderForReturn.note + ' | ' : ''}[Báo hoàn: ${returnForm.reason} - ${returnForm.note}]`
            : selectedOrderForReturn.note,
        });
        toast.info(
          'Đã chuyển trạng thái sang "Trả hàng/Hoàn tiền"',
          'Tồn kho chưa thay đổi cho đến khi kho kiểm nhận thực tế.'
        );
      } else {
        // Chế độ 2: Kho nhận thực tế và kiểm hàng (Kiểm tra & Nhập kho)
        if (!returnForm.warehouseId) {
          toast.warning('Vui lòng chọn kho tiếp nhận hàng hoàn');
          setIsSubmittingReturn(false);
          return;
        }
        if (!returnForm.inspectorName.trim()) {
          toast.warning('Vui lòng nhập tên người kiểm tra hàng hoàn');
          setIsSubmittingReturn(false);
          return;
        }

        // Kiểm tra ràng buộc: Tổng lượng hoàn không được vượt số lượng còn chờ
        for (const it of returnForm.items) {
          const sellable = Number(it.sellableQuantity) || 0;
          const damaged = Number(it.damagedQuantity) || 0;
          const missing = Number(it.missingQuantity) || 0;
          const sumThisTime = sellable + damaged + missing;
          if (sumThisTime > it.remainingToReturn) {
            toast.error(
              `Lỗi SKU ${it.sku}`,
              `Tổng số lượng hoàn (${sumThisTime}) vượt quá số lượng chưa nhận (${it.remainingToReturn})`
            );
            setIsSubmittingReturn(false);
            return;
          }
        }

        const totalCount = returnForm.items.reduce(
          (acc, it) => acc + (Number(it.sellableQuantity) || 0) + (Number(it.damagedQuantity) || 0) + (Number(it.missingQuantity) || 0),
          0,
        );

        if (totalCount === 0) {
          toast.warning('Vui lòng nhập số lượng nhận lại hoặc thiếu ít nhất 1 sản phẩm');
          setIsSubmittingReturn(false);
          return;
        }

        await orderReturnsApi.inspectAndReceive({
          orderId: selectedOrderForReturn.id,
          warehouseId: returnForm.warehouseId,
          trackingCode: returnForm.trackingCode || selectedOrderForReturn.trackingCode || '',
          receivedDate: returnForm.receivedDate,
          inspectorName: returnForm.inspectorName,
          conditionPhoto: returnForm.conditionPhoto,
          reason: returnForm.reason,
          note: returnForm.note,
          items: returnForm.items.map((it) => ({
            variantId: it.variantId,
            sku: it.sku,
            sellableQuantity: Number(it.sellableQuantity) || 0,
            damagedQuantity: Number(it.damagedQuantity) || 0,
            missingQuantity: Number(it.missingQuantity) || 0,
            batchCode: it.batchCode || undefined,
            expiryDate: it.expiryDate || undefined,
            note: it.note || undefined,
          })),
        });

        toast.success(
          'Nhận hàng hoàn thành công!',
          'Đã cập nhật hàng vào kho và ghi nhận sổ cái tồn kho.'
        );
      }

      setIsReturnModalOpen(false);
      setSelectedOrderForReturn(null);
      loadOrders();
      loadSummary();
    } catch (err: any) {
      toast.error(
        'Có lỗi xảy ra khi xử lý đơn hoàn',
        err?.response?.data?.message || err?.message
      );
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Handle Quick KPI filter click
  const handleKpiFilter = (tabId: string) => {
    if (activeTab === tabId) {
      setActiveTab('ALL');
    } else {
      setActiveTab(tabId);
    }
    setPage(1);
  };

  const resetAllFilters = () => {
    setActiveTab('ALL');
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const hasActiveFilter = activeTab !== 'ALL' || searchTerm || fromDate || toDate;

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <ShoppingBag size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="sm:hidden truncate">Đơn hàng</span>
            <span className="hidden sm:inline truncate">Quản lý Đơn hàng</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Theo dõi, tra cứu trạng thái sàn Shopee, mã vận đơn và tiến độ xuất kho
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenProcurementDemand()}
            className="gap-1.5 px-2.5 sm:px-3 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
            title="Tính toán số lượng từng mặt hàng cần nhập thêm hoặc thừa cho các đơn Chờ giao hàng (READY_TO_SHIP)"
          >
            <Calculator size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Dự toán nhập hàng</span>
            <span className="sm:hidden">Cần nhập</span>
            {orderSummary.readyToShip > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 font-bold">
                {orderSummary.readyToShip}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreateOrder}
            className="gap-1.5 px-2.5 sm:px-3"
            title="Tạo đơn hàng mới"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Tạo đơn hàng mới</span>
            <span className="sm:hidden">Tạo mới</span>
          </Button>

          {selectedOrderIds.length > 0 ? (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenBulkDispatchModal()}
                className="gap-1.5 px-2.5 sm:px-3 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                title="Đánh dấu các đơn đã chọn là đã xuất kho / đã quét"
              >
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>Xuất kho ({selectedOrderIds.length})</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenBulkVirtualModal(true)}
                className="gap-1.5 px-2.5 sm:px-3 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 bg-purple-50/50 dark:bg-purple-950/20"
                title="Đánh dấu các đơn đã chọn là đơn ảo (seeding)"
              >
                <Sparkles size={13} className="text-purple-600 dark:text-purple-400" />
                <span>Đơn ảo ({selectedOrderIds.length})</span>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="gap-1.5 px-2.5 sm:px-3"
                title="Xóa các đơn hàng đã chọn"
              >
                <Trash2 size={13} />
                <span>Xóa đã chọn ({selectedOrderIds.length})</span>
              </Button>
              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                className="h-8 px-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#181b22] text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Bỏ chọn tất cả"
              >
                <X size={13} />
                <span className="hidden sm:inline">Bỏ chọn</span>
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirmDeleteAll(false);
                setForceDeleteAll(true);
                setIsDeleteAllModalOpen(true);
              }}
              className="gap-1.5 p-2 sm:px-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
              title="Xóa toàn bộ đơn hàng trong hệ thống hoặc shop hiện tại"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Xóa tất cả</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadOrders();
              loadSummary();
            }}
            className="gap-1.5 p-2 lg:px-3"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden lg:inline">Làm mới</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards Row matching mobile pair reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 shrink-0">
        <SystemMetricPairCard
          leftItem={{
            title: 'Tất cả đơn',
            value: orderSummary.total,
            subtitle: 'Tổng đơn',
            icon: ShoppingBag,
            colorScheme: 'blue',
            isActive: activeTab === 'ALL',
            onClick: () => handleKpiFilter('ALL'),
          }}
          rightItem={{
            title: 'Chờ giao hàng',
            value: orderSummary.readyToShip,
            subtitle: 'Cần đóng gói',
            icon: Clock,
            colorScheme: 'orange',
            isActive: activeTab === 'READY_TO_SHIP',
            onClick: () => handleKpiFilter('READY_TO_SHIP'),
          }}
        />
        <SystemMetricPairCard
          leftItem={{
            title: 'Đã xuất kho',
            value: orderSummary.verified,
            subtitle: 'Đã quét xuất',
            icon: CheckCircle2,
            colorScheme: 'green',
            isActive: activeTab === 'VERIFIED',
            onClick: () => handleKpiFilter('VERIFIED'),
          }}
          rightItem={{
            title: 'Đang giao',
            value: orderSummary.shipped,
            subtitle: 'ĐVVC vận chuyển',
            icon: Truck,
            colorScheme: 'purple',
            isActive: activeTab === 'SHIPPED',
            onClick: () => handleKpiFilter('SHIPPED'),
          }}
        />
        <SystemMetricPairCard
          leftItem={{
            title: 'Giao thành công',
            value: orderSummary.completed,
            subtitle: 'Hoàn thành & Đã giao',
            icon: CheckCircle2,
            colorScheme: 'green',
            isActive: activeTab === 'COMPLETED' || activeTab === 'TO_CONFIRM_RECEIVE',
            onClick: () => handleKpiFilter('COMPLETED'),
          }}
          rightItem={{
            title: 'Hủy & Hoàn hàng',
            value: orderSummary.returned,
            subtitle: 'Đã hủy & Trả hàng',
            icon: RotateCcw,
            colorScheme: 'red',
            isActive:
              activeTab === 'CANCELLED_AND_RETURNED' ||
              activeTab === 'CANCELLED' ||
              activeTab === 'TO_RETURN',
            onClick: () => handleKpiFilter('CANCELLED_AND_RETURNED'),
          }}
        />
      </div>

      {/* Filter Bar */}
      <SystemFilter className="p-2.5 sm:p-3 flex-col sm:flex-row items-stretch sm:items-center">
        <SystemFilterItem icon={Activity} label="Trạng thái:" className="w-full sm:w-auto">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 max-w-full">
            {PRESET_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors cursor-pointer border-0 shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-[#5865f2] text-white font-medium shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1b23] font-normal'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </SystemFilterItem>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto sm:ml-auto">
          <div className="w-full sm:w-44 shrink-0">
            <Select
              value={virtualFilter}
              onChange={(val: any) => {
                setVirtualFilter(val);
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả loại đơn' },
                { value: 'REAL_ONLY', label: 'Chỉ đơn thật' },
                { value: 'VIRTUAL_ALL', label: 'Đơn ảo (Tất cả)' },
                { value: 'VIRTUAL_NO_STOCK', label: 'Đơn ảo - K.trừ kho' },
                { value: 'VIRTUAL_REAL_GOODS', label: 'Đơn ảo - Hàng thật' },
              ]}
              size="sm"
              className="w-full"
              menuWidth="w-full"
            />
          </div>

          <div className="w-full sm:w-64">
            <SystemFilterSearch
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm mã đơn, MVD, người mua..."
              className="w-full"
            />
          </div>
        </div>
      </SystemFilter>

      {/* Error alert */}
      {error && (
        <div className="p-3.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-normal">
          {error}
        </div>
      )}

      {/* Return process notice banner */}
      {activeTab === 'TO_RETURN' && (
        <div className="p-3.5 rounded bg-amber-500/10 border border-amber-500/20 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-semibold">Quy trình nhập hàng hoàn:</span> Đơn yêu cầu hoàn hoặc đang hoàn chưa cộng kho tự động. Khi kho thực tế nhận bưu phẩm, hãy dùng chức năng <b>Xử lý đơn hoàn</b> để quét mã, phân loại (bán lại được / hàng lỗi / thiếu), sau đó hệ thống mới ghi nhận vào sổ cái kho.
            </div>
          </div>
          <Link
            to="/order-returns"
            className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 flex items-center gap-1.5 transition-colors no-underline shadow-sm"
          >
            <RotateCcw size={13} />
            Hàng chờ hoàn
          </Link>
        </div>
      )}



      {/* Desktop Table View */}
      <div className="hidden md:flex flex-1 flex-col min-h-0">
        <SystemTableWrapper
          tableClassName="min-w-[1050px]"
          pagination={
            <SystemPagination
              page={page - 1}
              totalPages={totalPages}
              totalItems={totalCount}
              setPage={(p) => setPage(p + 1)}
              itemsPerPage={limit}
              setItemsPerPage={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          }
        >
          <SystemThead>
            <SystemTh className="w-[44px] text-center" align="center">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={
                    orders.length > 0 &&
                    orders.every((o) => selectedOrderIds.includes(o.id))
                  }
                  indeterminate={
                    orders.some((o) => selectedOrderIds.includes(o.id)) &&
                    !orders.every((o) => selectedOrderIds.includes(o.id))
                  }
                  onChange={handleToggleSelectAll}
                />
              </div>
            </SystemTh>
            <SystemTh className="w-14 text-center" align="center">STT</SystemTh>
            <SystemTh className="w-56">Mã đơn / Shop</SystemTh>
            <SystemTh className="w-32">Ngày đặt</SystemTh>
            <SystemTh className="w-48">Khách hàng</SystemTh>
            <SystemTh className="w-32 text-center">Sản phẩm / SL</SystemTh>
            <SystemTh className="w-36 text-right">Tổng tiền</SystemTh>
            <SystemTh className="w-40 text-center">Trạng thái sàn</SystemTh>
            <SystemTh className="w-24 text-center">Kho / Quét</SystemTh>
            <SystemTh className="w-20 text-center">Thao tác</SystemTh>
          </SystemThead>
          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton cols={10} rows={7} />
            ) : orders.length === 0 ? (
              <SystemTableEmpty
                title="Không có đơn hàng nào"
                description="Không tìm thấy đơn hàng nào phù hợp với điều kiện tìm kiếm hoặc bộ lọc hiện tại."
                colSpan={10}
              />
            ) : (
              orders.map((o, index) => {
                const pCfg = getPlatformStatusConfig(o.platformStatus);
                const stt = (page - 1) * limit + index + 1;
                const prodSummary = getOrderProductSummary(o.orderItems);

                return (
                  <SystemTr
                    key={o.id}
                    onClick={() => handleOpenDetail(o.id)}
                    className={`cursor-pointer ${
                      selectedOrderIds.includes(o.id)
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                        : ''
                    }`}
                  >
                    <SystemTd align="center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={selectedOrderIds.includes(o.id)}
                          onChange={() => handleToggleSelectOrder(o.id)}
                        />
                      </div>
                    </SystemTd>
                    <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                      {stt}
                    </SystemTd>
                    <SystemTd>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-medium text-xs text-gray-900 dark:text-white hover:text-[#5865f2] truncate">
                          {o.externalOrderId}
                        </span>
                        {o.isVirtual && (
                          <span
                            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                              o.isRealGoods
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            }`}
                            title={o.isRealGoods ? 'Đơn ảo có đi hàng thật (trừ tồn kho)' : 'Đơn ảo không đi hàng thật (không trừ tồn kho)'}
                          >
                            <Sparkles size={10} className="shrink-0" />
                            <span>{o.isRealGoods ? 'Ảo (Hàng thật)' : 'Đơn ảo (K.trừ kho)'}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-normal truncate mt-0.5">
                        {o.shop?.name || 'Shop Shopee'}
                      </div>
                    </SystemTd>

                    <SystemTd className="text-gray-500 dark:text-gray-400 font-normal text-xs">
                      {o.orderDate ? new Date(o.orderDate).toLocaleDateString('vi-VN') : 'N/A'}
                    </SystemTd>

                    <SystemTd>
                      <p className="font-medium text-xs text-gray-800 dark:text-gray-200 truncate">
                        {o.recipientName || 'Khách lẻ'}
                      </p>
                      {o.trackingCode && (
                        <p className="text-[11px] font-mono text-gray-400 truncate mt-0.5">
                          MVD: {o.trackingCode}
                        </p>
                      )}
                    </SystemTd>

                    <SystemTd className="text-center font-normal text-xs text-gray-600 dark:text-gray-400">
                      <div
                        className="flex flex-col items-center justify-center cursor-default group/prod relative"
                        title={prodSummary.tooltipText}
                      >
                        <span className="font-semibold text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/40 inline-flex items-center gap-1 max-w-[125px] truncate">
                          <Package size={12} className="text-indigo-500 shrink-0" />
                          <span className="truncate">{prodSummary.mainText}</span>
                        </span>
                        {prodSummary.subText && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[125px]">
                            {prodSummary.subText}
                          </span>
                        )}
                      </div>
                    </SystemTd>

                    <SystemTd className="text-right font-medium text-xs text-gray-900 dark:text-white">
                      {formatCurrency(o.totalAmount)} đ
                    </SystemTd>

                    <SystemTd className="text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${pCfg.badgeClass}`}
                      >
                        {pCfg.label}
                      </span>
                    </SystemTd>

                    <SystemTd className="text-center">
                      <div className="flex items-center justify-center">
                        <VerificationStatusBadge status={o.verificationStatus} />
                      </div>
                    </SystemTd>

                    <SystemTd className="text-center">
                      <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                              title="Thao tác"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleOpenDetail(o.id)}
                            >
                              <Eye size={14} className="text-gray-400" />
                              <span>Xem chi tiết</span>
                            </DropdownMenuItem>
                            {o.verificationStatus === 'VERIFIED' || o.fulfillmentStatus === 'DISPATCHED' ? (
                              <DropdownMenuItem
                                onClick={() => handleReverseDispatched(o)}
                              >
                                <RotateCcw size={14} className="text-amber-500" />
                                <span>Hoàn tác xuất kho</span>
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleMarkDispatched(o)}
                              >
                                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                  Đánh dấu xuất kho / đã quét
                                </span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleOpenVirtualModal(o)}
                            >
                              <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                              <span>Cấu hình đơn ảo</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenReturnModal(o)}
                            >
                              <RotateCcw size={14} className="text-amber-500" />
                              <span className="font-medium text-amber-600 dark:text-amber-400">
                                Xử lý hoàn hàng
                              </span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenEditOrder(o)}
                            >
                              <Edit2 size={14} className="text-gray-400" />
                              <span>Chỉnh sửa đơn</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => handleOpenDeleteOrder(o)}
                            >
                              <Trash2 size={14} />
                              <span>Xóa đơn hàng</span>
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

      {/* Mobile Card View */}
      <div className="md:hidden flex-1 flex flex-col min-h-fit space-y-3">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400 font-normal">
            Đang tải đơn hàng...
          </div>
        ) : orders.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 font-normal">
            Không tìm thấy đơn hàng nào
          </div>
        ) : (
          orders.map((o) => {
            const pCfg = getPlatformStatusConfig(o.platformStatus);
            const prodSummary = getOrderProductSummary(o.orderItems);

            return (
              <div
                key={o.id}
                onClick={() => handleOpenDetail(o.id)}
                className={`p-3.5 rounded-[4px] bg-white dark:bg-[#181b22] border ${
                  selectedOrderIds.includes(o.id)
                    ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20'
                    : 'border-gray-200/60 dark:border-white/[0.08]'
                } space-y-2 cursor-pointer shadow-none card-border`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedOrderIds.includes(o.id)}
                      onChange={() => handleToggleSelectOrder(o.id)}
                    />
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-mono font-medium text-xs text-gray-900 dark:text-white truncate">
                        {o.externalOrderId}
                      </span>
                      {o.isVirtual && (
                        <span
                          className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                            o.isRealGoods
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          }`}
                        >
                          <Sparkles size={10} className="shrink-0" />
                          <span>{o.isRealGoods ? 'Ảo (Hàng thật)' : 'Đơn ảo (K.trừ kho)'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${pCfg.badgeClass}`}
                    >
                      {pCfg.label}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDetail(o.id)}>
                          <Eye size={14} className="text-gray-400" />
                          <span>Xem chi tiết</span>
                        </DropdownMenuItem>
                        {o.verificationStatus === 'VERIFIED' || o.fulfillmentStatus === 'DISPATCHED' ? (
                          <DropdownMenuItem onClick={() => handleReverseDispatched(o)}>
                            <RotateCcw size={14} className="text-amber-500" />
                            <span>Hoàn tác xuất kho</span>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleMarkDispatched(o)}>
                            <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              Đánh dấu xuất kho / đã quét
                            </span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleOpenVirtualModal(o)}>
                          <Sparkles size={14} className="text-purple-600 dark:text-purple-400" />
                          <span>Cấu hình đơn ảo</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenReturnModal(o)}>
                          <RotateCcw size={14} className="text-amber-500" />
                          <span className="font-medium text-amber-600 dark:text-amber-400">Xử lý hoàn hàng</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenEditOrder(o)}>
                          <Edit2 size={14} className="text-gray-400" />
                          <span>Chỉnh sửa đơn</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => handleOpenDeleteOrder(o)}>
                          <Trash2 size={14} />
                          <span>Xóa đơn hàng</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="text-xs text-gray-500 flex items-center justify-between font-normal">
                  <span className="truncate">{o.recipientName || 'Khách lẻ'}</span>
                  <span className="font-medium text-gray-900 dark:text-white shrink-0">
                    {formatCurrency(o.totalAmount)} đ
                  </span>
                </div>

                {/* Product quantity & unit breakdown */}
                <div className="flex items-center justify-between text-xs py-1 border-t border-dashed border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1.5 min-w-0 text-gray-700 dark:text-gray-300">
                    <Package size={13} className="text-indigo-500 shrink-0" />
                    <span className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                      {prodSummary.mainText}
                    </span>
                    {prodSummary.subText && (
                      <span className="text-[11px] text-gray-400 truncate">
                        • {prodSummary.subText}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {o.orderDate ? new Date(o.orderDate).toLocaleDateString('vi-VN') : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 dark:border-gray-800 text-gray-400 font-normal">
                  <span className="truncate">{o.shop?.name || 'Shop'}</span>
                  <VerificationStatusBadge status={o.verificationStatus} showLabel />
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination */}
        <div className="rounded-[4px] border border-gray-200/60 dark:border-white/[0.08] overflow-hidden bg-white dark:bg-[#14151a] shadow-none mt-2 shrink-0">
          <SystemPagination
            page={page - 1}
            totalPages={totalPages}
            totalItems={totalCount}
            setPage={(p) => setPage(p + 1)}
            itemsPerPage={limit}
            setItemsPerPage={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            className="border-t-0"
          />
        </div>
      </div>

      {/* Order Detail Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRefresh={() => {
          loadOrders();
          loadSummary();
          if (selectedOrder) handleOpenDetail(selectedOrder.id);
        }}
        onEdit={(ord) => handleOpenEditOrder(ord)}
        onDelete={(ord) => handleOpenDeleteOrder(ord)}
      />

      {/* MODAL 1: CREATE MANUAL ORDER */}
      {isCreateOrderModalOpen && (
        <Modal
          isOpen={isCreateOrderModalOpen}
          onClose={() => setIsCreateOrderModalOpen(false)}
          title={<><span className="sm:hidden">Tạo đơn hàng</span><span className="hidden sm:inline">Tạo đơn hàng mới</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">Khởi tạo đơn hàng thủ công hoặc bán ngoài sàn với thông tin vận chuyển và tồn kho</span>}
          icon={Plus}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleCreateOrderSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-4 max-h-[78vh] sm:max-h-[75vh] overflow-y-auto pr-1 p-3 sm:p-5">
              {/* Row 1: Shop & Order Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Gian hàng Shop *
                  </label>
                  <Select
                    value={createOrderForm.shopId}
                    onChange={(val: any) =>
                      setCreateOrderForm({ ...createOrderForm, shopId: val })
                    }
                    options={[
                      { value: '', label: '-- Chọn shop nhận đơn --' },
                      ...shops.map((s) => ({
                        value: s.id,
                        label: `${s.name} (${s.code})`,
                      })),
                    ]}
                    placeholder="-- Chọn shop nhận đơn --"
                    size="md"
                    className="w-full"
                    menuWidth="w-full"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Mã đơn hàng
                      </label>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-medium">
                        Tự sinh
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
                        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
                        setCreateOrderForm((prev) => ({ ...prev, externalOrderId: `DH${dateStr}-${rand}` }));
                      }}
                      className="text-[11px] text-[#5865f2] hover:underline font-medium cursor-pointer"
                    >
                      Đổi mã
                    </button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    disabled
                    tabIndex={-1}
                    value={createOrderForm.externalOrderId || 'Hệ thống tự động cấp'}
                    title="Mã đơn hàng được hệ thống tự động sinh ngầm khi lưu để đảm bảo tuyệt đối không bị trùng lặp"
                    className="w-full px-3 py-2 text-xs font-mono uppercase font-bold bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded text-gray-500 dark:text-gray-400 cursor-not-allowed select-none transition-colors pointer-events-none"
                  />
                </div>
              </div>

              {/* Row 2: Customer info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tên khách hàng / Người nhận *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nguyễn Văn A"
                    value={createOrderForm.recipientName}
                    onChange={(e) =>
                      setCreateOrderForm({
                        ...createOrderForm,
                        recipientName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0912345678"
                    value={createOrderForm.recipientPhone}
                    onChange={(e) =>
                      setCreateOrderForm({
                        ...createOrderForm,
                        recipientPhone: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>

              {/* Row 3: Shipping address */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Địa chỉ giao hàng chi tiết
                </label>
                <input
                  type="text"
                  placeholder="VD: Số 123 Đường Cầu Giấy, Phường Dịch Vọng, Cầu Giấy, Hà Nội"
                  value={createOrderForm.recipientAddress}
                  onChange={(e) =>
                    setCreateOrderForm({
                      ...createOrderForm,
                      recipientAddress: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              {/* Row 4: Carrier & Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Đơn vị vận chuyển
                  </label>
                  <input
                    type="text"
                    placeholder="VD: SPX Express, GHN, Viettel Post"
                    value={createOrderForm.shippingCarrier}
                    onChange={(e) =>
                      setCreateOrderForm({
                        ...createOrderForm,
                        shippingCarrier: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Mã vận đơn (MVD)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: SPXVN0123456789"
                    value={createOrderForm.trackingCode}
                    onChange={(e) =>
                      setCreateOrderForm({
                        ...createOrderForm,
                        trackingCode: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Phí vận chuyển (VND)
                  </label>
                  <CurrencyInput
                    value={createOrderForm.shippingFee}
                    onChange={(val) =>
                      setCreateOrderForm({
                        ...createOrderForm,
                        shippingFee: val,
                      })
                    }
                    placeholder="0"
                    suffix="đ"
                    inputClassName="px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Package size={14} className="text-[#5865f2]" />
                    Sản phẩm trong đơn ({createOrderForm.items.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemToCreateOrder}
                    className="text-xs text-[#5865f2] font-semibold flex items-center gap-1 hover:underline cursor-pointer px-2 py-0.5 rounded bg-[#5865f2]/10 border border-[#5865f2]/20"
                  >
                    <Plus size={13} /> Thêm sản phẩm
                  </button>
                </div>

                <div className="space-y-3">
                  {createOrderForm.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 space-y-2.5 relative"
                    >
                      {createOrderForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromCreateOrder(idx)}
                          className="absolute right-2.5 top-2.5 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                          title="Xóa dòng sản phẩm"
                        >
                          <X size={15} />
                        </button>
                      )}

                      {/* Dropdown pick internal variant if available */}
                      {availableVariants.length > 0 && (
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">
                            Chọn nhanh từ danh mục SKU nội bộ (Tùy chọn)
                          </label>
                          <Select
                            value={item.variantId || ''}
                            onChange={(val: any) =>
                              handleSelectVariantForItem(idx, val)
                            }
                            options={[
                              { value: '', label: '-- Nhập thủ công hoặc chọn SKU --' },
                              ...availableVariants.map((v) => ({
                                value: v.id,
                                label: `${v.productName} - ${v.name} (${v.sku}) [${formatCurrency(v.sellPrice)} đ]`,
                              })),
                            ]}
                            placeholder="-- Nhập thủ công hoặc chọn SKU --"
                            size="sm"
                            className="w-full"
                            menuWidth="w-full"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                            Tên sản phẩm *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="VD: Bánh gạo One One Vị Bò Nướng 150g"
                            value={item.productName}
                            onChange={(e) => {
                              const next = [...createOrderForm.items];
                              next[idx].productName = e.target.value;
                              setCreateOrderForm({
                                ...createOrderForm,
                                items: next,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                            Phân loại / Biến thể (Variation)
                          </label>
                          <input
                            type="text"
                            placeholder="VD: Gói 150g"
                            value={item.variationName || ''}
                            onChange={(e) => {
                              const next = [...createOrderForm.items];
                              next[idx].variationName = e.target.value;
                              setCreateOrderForm({
                                ...createOrderForm,
                                items: next,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                            Mã SKU người bán
                          </label>
                          <input
                            type="text"
                            placeholder="VD: SKU-ONE-01"
                            value={item.sellerSku || ''}
                            onChange={(e) => {
                              const next = [...createOrderForm.items];
                              next[idx].sellerSku = e.target.value.toUpperCase();
                              setCreateOrderForm({
                                ...createOrderForm,
                                items: next,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                            Số lượng *
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity}
                            onChange={(e) => {
                              const next = [...createOrderForm.items];
                              next[idx].quantity =
                                parseInt(e.target.value, 10) || 1;
                              setCreateOrderForm({
                                ...createOrderForm,
                                items: next,
                              });
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                            Đơn giá (VND) *
                          </label>
                          <CurrencyInput
                            value={item.unitPrice}
                            onChange={(val) => {
                              const next = [...createOrderForm.items];
                              next[idx].unitPrice = val;
                              setCreateOrderForm({
                                ...createOrderForm,
                                items: next,
                              });
                            }}
                            placeholder="0"
                            suffix="đ"
                            inputClassName="px-2.5 py-1.5 text-xs bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ghi chú đơn hàng
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú đóng gói, thời gian giao hàng..."
                  value={createOrderForm.note}
                  onChange={(e) =>
                    setCreateOrderForm({
                      ...createOrderForm,
                      note: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              {/* Virtual Order Settings */}
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded border border-purple-200/60 dark:border-purple-900/40 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-purple-900 dark:text-purple-200">
                  <input
                    type="checkbox"
                    checked={createOrderForm.isVirtual}
                    onChange={(e) =>
                      setCreateOrderForm({
                        ...createOrderForm,
                        isVirtual: e.target.checked,
                        isRealGoods: e.target.checked ? createOrderForm.isRealGoods : false,
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600"
                  />
                  <span>Đánh dấu là Đơn ảo (Seeding / Buff đơn)</span>
                </label>
                {createOrderForm.isVirtual && (
                  <div className="pl-6 pt-1 border-t border-purple-200/50 dark:border-purple-900/30 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={createOrderForm.isRealGoods}
                        onChange={(e) =>
                          setCreateOrderForm({
                            ...createOrderForm,
                            isRealGoods: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-[#5865f2] focus:ring-[#5865f2] border-gray-300 dark:border-gray-600"
                      />
                      <span className="font-medium">Có gửi hàng thật (Sẽ trừ tồn kho khi xuất đơn)</span>
                    </label>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {createOrderForm.isRealGoods
                        ? 'Đơn ảo này sẽ đóng gói và xuất hàng thật -> Tồn kho sẽ bị trừ.'
                        : 'Mặc định đơn ảo không đi hàng thật -> Hệ thống KHÔNG trừ tồn kho, không giữ hàng.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Order Total Preview */}
              <div className="p-3 bg-gray-50 dark:bg-[#14151a] rounded border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Tổng giá trị đơn hàng tính toán:</span>
                <span className="font-bold text-sm text-[#5865f2]">
                  {formatCurrency(
                    createOrderForm.items.reduce(
                      (sum, it) => sum + it.quantity * (parseFloat(String(it.unitPrice)) || 0),
                      0
                    ) + (parseFloat(String(createOrderForm.shippingFee)) || 0)
                  )}{' '}
                  đ
                </span>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsCreateOrderModalOpen(false)}
                disabled={isSavingOrder}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="primary"
                type="submit"
                disabled={isSavingOrder}
                className="flex-1 sm:flex-initial"
              >
                {isSavingOrder ? 'Đang tạo...' : 'Tạo đơn hàng'}
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 2: EDIT ORDER */}
      {isEditOrderModalOpen && selectedOrderForEdit && (
        <Modal
          isOpen={isEditOrderModalOpen}
          onClose={() => setIsEditOrderModalOpen(false)}
          title={<><span className="sm:hidden">Sửa đơn hàng</span><span className="hidden sm:inline">Chỉnh sửa đơn hàng</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">{`Cập nhật thông tin giao hàng cho đơn [${selectedOrderForEdit.externalOrderId}]`}</span>}
          icon={Edit2}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleUpdateOrderSubmit} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 max-h-[78vh] sm:max-h-[75vh] overflow-y-auto pr-1 p-3 sm:p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tên người nhận *
                  </label>
                  <input
                    type="text"
                    required
                    value={editOrderForm.recipientName}
                    onChange={(e) =>
                      setEditOrderForm({
                        ...editOrderForm,
                        recipientName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={editOrderForm.recipientPhone}
                    onChange={(e) =>
                      setEditOrderForm({
                        ...editOrderForm,
                        recipientPhone: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Địa chỉ giao hàng
                </label>
                <input
                  type="text"
                  value={editOrderForm.recipientAddress}
                  onChange={(e) =>
                    setEditOrderForm({
                      ...editOrderForm,
                      recipientAddress: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Đơn vị vận chuyển
                  </label>
                  <input
                    type="text"
                    value={editOrderForm.shippingCarrier}
                    onChange={(e) =>
                      setEditOrderForm({
                        ...editOrderForm,
                        shippingCarrier: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Mã vận đơn (MVD)
                  </label>
                  <input
                    type="text"
                    value={editOrderForm.trackingCode}
                    onChange={(e) =>
                      setEditOrderForm({
                        ...editOrderForm,
                        trackingCode: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Phí vận chuyển (VND)
                  </label>
                  <CurrencyInput
                    value={editOrderForm.shippingFee}
                    onChange={(val) =>
                      setEditOrderForm({
                        ...editOrderForm,
                        shippingFee: val,
                      })
                    }
                    placeholder="0"
                    suffix="đ"
                    inputClassName="px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Tổng tiền thanh toán (VND)
                  </label>
                  <CurrencyInput
                    value={editOrderForm.totalAmount}
                    onChange={(val) =>
                      setEditOrderForm({
                        ...editOrderForm,
                        totalAmount: val,
                      })
                    }
                    placeholder="0"
                    suffix="đ"
                    inputClassName="px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Trạng thái sàn Shopee
                </label>
                <Select
                  value={editOrderForm.platformStatus}
                  onChange={(val: any) =>
                    setEditOrderForm({ ...editOrderForm, platformStatus: val })
                  }
                  options={[
                    { value: 'READY_TO_SHIP', label: 'Chờ giao hàng (READY_TO_SHIP)' },
                    { value: 'SHIPPED', label: 'Đang giao (SHIPPED)' },
                    { value: 'TO_CONFIRM_RECEIVE', label: 'Đã giao (TO_CONFIRM_RECEIVE)' },
                    { value: 'COMPLETED', label: 'Hoàn thành (COMPLETED)' },
                    { value: 'CANCELLED', label: 'Đã hủy (CANCELLED)' },
                    { value: 'TO_RETURN', label: 'Yêu cầu trả hàng (TO_RETURN)' },
                  ]}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ghi chú đơn hàng
                </label>
                <textarea
                  rows={2}
                  value={editOrderForm.note}
                  onChange={(e) =>
                    setEditOrderForm({
                      ...editOrderForm,
                      note: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                />
              </div>

              {/* Virtual Order Settings */}
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded border border-purple-200/60 dark:border-purple-900/40 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-purple-900 dark:text-purple-200">
                  <input
                    type="checkbox"
                    checked={editOrderForm.isVirtual}
                    onChange={(e) =>
                      setEditOrderForm({
                        ...editOrderForm,
                        isVirtual: e.target.checked,
                        isRealGoods: e.target.checked ? editOrderForm.isRealGoods : false,
                      })
                    }
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600"
                  />
                  <span>Đánh dấu là Đơn ảo (Seeding / Buff đơn)</span>
                </label>
                {editOrderForm.isVirtual && (
                  <div className="pl-6 pt-1 border-t border-purple-200/50 dark:border-purple-900/30 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={editOrderForm.isRealGoods}
                        onChange={(e) =>
                          setEditOrderForm({
                            ...editOrderForm,
                            isRealGoods: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-[#5865f2] focus:ring-[#5865f2] border-gray-300 dark:border-gray-600"
                      />
                      <span className="font-medium">Có gửi hàng thật (Sẽ trừ tồn kho khi xuất đơn)</span>
                    </label>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {editOrderForm.isRealGoods
                        ? 'Đơn ảo này sẽ đóng gói và xuất hàng thật -> Tồn kho sẽ bị trừ.'
                        : 'Mặc định đơn ảo không đi hàng thật -> Hệ thống KHÔNG trừ tồn kho. Nếu đơn từng giữ hàng (RESERVED) sẽ được tự động giải phóng.'}
                    </p>
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsEditOrderModalOpen(false)}
                disabled={isSavingOrder}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="primary"
                type="submit"
                disabled={isSavingOrder}
                className="flex-1 sm:flex-initial"
              >
                {isSavingOrder ? 'Đang lưu...' : 'Lưu thay đổi'}
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* MODAL 3: DELETE ORDER */}
      {isDeleteOrderModalOpen && selectedOrderForDelete && (
        <Modal
          isOpen={isDeleteOrderModalOpen}
          onClose={() => setIsDeleteOrderModalOpen(false)}
          title={<><span className="sm:hidden">Xóa đơn hàng</span><span className="hidden sm:inline">Xác nhận xóa đơn hàng</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">{`Bạn có chắc muốn xóa vĩnh viễn đơn hàng "${selectedOrderForDelete.externalOrderId}"?`}</span>}
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 p-3 sm:p-5">
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold">Ràng buộc xử lý kho:</p>
                  <p className="mt-0.5 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                    - Nếu đơn hàng đã xuất kho (<strong>DISPATCHED</strong>), hệ thống sẽ từ chối xóa để đảm bảo toàn vẹn sổ cái thực tế. Bạn phải tiếp nhận hàng hoàn.<br />
                    - Nếu đơn hàng đang được giữ hàng (<strong>RESERVED</strong>), số lượng hàng giữ sẽ được tự động hoàn lại vào kho.
                  </p>
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsDeleteOrderModalOpen(false)}
                disabled={isDeletingOrder}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleDeleteOrderSubmit}
                disabled={isDeletingOrder}
                className="flex-1 sm:flex-initial"
              >
                {isDeletingOrder ? 'Đang xóa...' : 'Xác nhận xóa'}
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}

      {/* MODAL 3B: BULK DELETE ORDERS */}
      {isBulkDeleteModalOpen && selectedOrderIds.length > 0 && (
        <Modal
          isOpen={isBulkDeleteModalOpen}
          onClose={() => !isDeletingBulk && setIsBulkDeleteModalOpen(false)}
          title={<><span className="sm:hidden">Xóa hàng loạt</span><span className="hidden sm:inline">Xác nhận xóa hàng loạt</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">{`Bạn có chắc muốn xóa ${selectedOrderIds.length} đơn hàng đã chọn?`}</span>}
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Ràng buộc nghiệp vụ kho:</p>
                  <p className="text-amber-700 dark:text-amber-400/90 leading-relaxed">
                    - Đơn ở trạng thái giữ hàng (<strong>RESERVED</strong>) sẽ tự động được hoàn trả tồn kho.<br />
                    - Mặc định hệ thống sẽ tự động bỏ qua các đơn đã xuất kho bàn giao (<strong>DISPATCHED</strong>) để bảo toàn lịch sử xuất kho.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <div
                  onClick={() => setForceBulkDelete(!forceBulkDelete)}
                  className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-700 dark:text-gray-300 select-none group"
                >
                  <Checkbox
                    checked={forceBulkDelete}
                    onChange={(e) => setForceBulkDelete(e.target.checked)}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-red-600 dark:text-red-400 block leading-snug">Buộc xóa cả đơn đã xuất kho bàn giao</span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-normal">
                      Bật tùy chọn này nếu bạn muốn xóa dọn dẹp triệt để dữ liệu mà không bị chặn bởi trạng thái xuất kho.
                    </p>
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isDeletingBulk}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleBulkDeleteSubmit}
                disabled={isDeletingBulk}
                className="flex-1 sm:flex-initial"
              >
                {isDeletingBulk ? 'Đang xóa...' : `Xác nhận xóa (${selectedOrderIds.length})`}
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}

      {/* MODAL 3C: DELETE ALL ORDERS */}
      {isDeleteAllModalOpen && (
        <Modal
          isOpen={isDeleteAllModalOpen}
          onClose={() => !isDeletingBulk && setIsDeleteAllModalOpen(false)}
          title={<><span className="sm:hidden">Xóa toàn bộ đơn</span><span className="hidden sm:inline">Xác nhận xóa toàn bộ đơn hàng</span></>}
          subtitle={
            <span className="line-clamp-1 sm:line-clamp-none">
              {selectedShopId && selectedShopId !== 'ALL'
                ? `Xóa toàn bộ đơn hàng của gian hàng đang lọc (${shops.find((s) => s.id === selectedShopId)?.name || 'Shop'})`
                : 'Xóa toàn bộ tất cả đơn hàng trong hệ thống'}
            </span>
          }
          icon={Trash2}
          maxWidth="max-w-md"
        >
          <div className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
              <div className="p-3.5 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-300">
                <AlertTriangle size={18} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-red-900 dark:text-red-200">CẢNH BÁO NGUY HIỂM: HÀNH ĐỘNG KHÔNG THỂ HOÀN TÁC</p>
                  <p className="text-red-700 dark:text-red-300 leading-relaxed">
                    Hành động này sẽ xóa toàn bộ đơn hàng, kiện hàng, lịch sử quét và dữ liệu đối soát liên quan. Thường chỉ dùng khi làm mới môi trường thử nghiệm.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-2.5">
                <div
                  onClick={() => setForceDeleteAll(!forceDeleteAll)}
                  className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-700 dark:text-gray-300 select-none group"
                >
                  <Checkbox
                    checked={forceDeleteAll}
                    onChange={(e) => setForceDeleteAll(e.target.checked)}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-red-600 dark:text-red-400 block leading-snug">
                      Buộc xóa cả đơn đã xuất kho bàn giao (Force delete)
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-normal">
                      Bỏ qua kiểm tra trạng thái DISPATCHED và xóa sạch toàn bộ đơn.
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-gray-200 dark:border-gray-700">
                  <div
                    onClick={() => setConfirmDeleteAll(!confirmDeleteAll)}
                    className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-900 dark:text-white font-medium select-none group"
                  >
                    <Checkbox
                      checked={confirmDeleteAll}
                      onChange={(e) => setConfirmDeleteAll(e.target.checked)}
                      size="sm"
                    />
                    <span className="leading-snug">Tôi hiểu và đồng ý xóa vĩnh viễn toàn bộ đơn hàng</span>
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => {
                  setIsDeleteAllModalOpen(false);
                  setConfirmDeleteAll(false);
                }}
                disabled={isDeletingBulk}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="danger"
                onClick={handleDeleteAllSubmit}
                disabled={!confirmDeleteAll || isDeletingBulk}
                className="flex-1 sm:flex-initial"
              >
                {isDeletingBulk ? 'Đang xóa...' : 'Xác nhận xóa'}
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}

      {/* MODAL 4: RETURN PROCESSING (ĐÁNH DẤU & XỬ LÝ HOÀN HÀNG) */}
      {isReturnModalOpen && selectedOrderForReturn && (
        <Modal
          isOpen={isReturnModalOpen}
          onClose={() => {
            if (!isSubmittingReturn) {
              setIsReturnModalOpen(false);
              setSelectedOrderForReturn(null);
            }
          }}
          title={<><span className="sm:hidden">Xử lý hoàn hàng</span><span className="hidden sm:inline">Đánh Dấu & Xử Lý Hoàn Hàng</span></>}
          subtitle={<span className="line-clamp-1 sm:line-clamp-none">{`Đơn: ${selectedOrderForReturn.externalOrderId || selectedOrderForReturn.internalOrderCode} • ${selectedOrderForReturn.shop?.name || 'Gian hàng'}`}</span>}
          icon={RotateCcw}
          maxWidth="max-w-4xl"
        >
          <form onSubmit={handleSubmitReturn} className="flex flex-col flex-1 min-h-0">
            <ModalBody className="space-y-3 sm:space-y-4 p-3 sm:p-5">
              {/* Order Context Banner */}
              <div className="p-3 rounded bg-gray-50 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-gray-400 block font-normal">Mã đơn Shopee</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    {selectedOrderForReturn.externalOrderId}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-normal">Mã vận đơn</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {selectedOrderForReturn.trackingCode || 'Chưa cập nhật'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-normal">Khách hàng</span>
                  <span className="text-gray-800 dark:text-gray-200 font-medium truncate block">
                    {selectedOrderForReturn.recipientName || 'Khách lẻ'} ({selectedOrderForReturn.recipientPhone || 'N/A'})
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block font-normal">Trạng thái kho</span>
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">
                    {selectedOrderForReturn.fulfillmentStatus}
                  </span>
                </div>
              </div>

              {/* Mode Selection Tabs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800/80 rounded">
                <button
                  type="button"
                  onClick={() => setReturnMode('MARK_IN_TRANSIT')}
                  className={`py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    returnMode === 'MARK_IN_TRANSIT'
                      ? 'bg-white dark:bg-[#1f232b] text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Truck size={15} />
                  <span>1. Báo đơn đang hoàn (Chưa nhận hàng)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const isDispatched =
                      selectedOrderForReturn.fulfillmentStatus === 'DISPATCHED' ||
                      selectedOrderForReturn.fulfillmentStatus === 'PARTIALLY_RETURN_RECEIVED';
                    if (!isDispatched) {
                      alert('Đơn hàng chưa ghi nhận xuất kho thực tế (DISPATCHED). Chỉ có thể dùng chế độ "Báo đơn đang hoàn".');
                      return;
                    }
                    setReturnMode('INSPECT_AND_RECEIVE');
                  }}
                  className={`py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    returnMode === 'INSPECT_AND_RECEIVE'
                      ? 'bg-white dark:bg-[#1f232b] text-[#5865f2] dark:text-indigo-400 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck size={15} />
                  <span>2. Kho đã nhận hàng → Kiểm tra & Nhập kho</span>
                </button>
              </div>

              {/* Mode 1 Description & Form */}
              {returnMode === 'MARK_IN_TRANSIT' && (
                <div className="space-y-3.5">
                  <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-semibold">Quy tắc bảo vệ sổ cái kho:</p>
                      <p className="mt-0.5 text-amber-700 dark:text-amber-400/90 leading-relaxed">
                        Hàng đang trên đường quay đầu từ khách hàng / sàn giao dịch. Khi đánh dấu, đơn hàng sẽ chuyển trạng thái sàn thành <strong>Trả hàng/Hoàn tiền (TO_RETURN)</strong> và đưa vào danh sách chờ tiếp nhận hoàn.
                        <br />
                        <strong>Tuyệt đối không tăng tồn kho ảo</strong> cho đến khi kiện hàng thực tế được giao đến kho và kiểm đếm.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Lý do báo hoàn
                      </label>
                      <select
                        value={returnForm.reason}
                        onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2]"
                      >
                        <option value="Khách từ chối nhận hàng (Giao thất bại)">Khách từ chối nhận hàng (Giao thất bại)</option>
                        <option value="Khách yêu cầu Trả hàng / Hoàn tiền trên Shopee">Khách yêu cầu Trả hàng / Hoàn tiền trên Shopee</option>
                        <option value="Bưu tá giao không thành công 3 lần">Bưu tá giao không thành công 3 lần</option>
                        <option value="Hàng bị bể vỡ / móp méo khi vận chuyển">Hàng bị bể vỡ / móp méo khi vận chuyển</option>
                        <option value="Đổi trả theo thỏa thuận với khách">Đổi trả theo thỏa thuận với khách</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ghi chú chi tiết
                      </label>
                      <input
                        type="text"
                        value={returnForm.note}
                        onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
                        placeholder="VD: Khách báo đi công tác không nhận, shipper chuyển hoàn..."
                        className="w-full px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 2: INSPECT AND RECEIVE FORM */}
              {returnMode === 'INSPECT_AND_RECEIVE' && (
                <div className="space-y-4">
                  <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <div>
                      <p className="font-semibold">Quy trình kiểm tra & cộng tồn kho thực tế:</p>
                      <p className="mt-0.5 text-emerald-700 dark:text-emerald-400/90 leading-relaxed">
                        • <strong>Hàng còn nguyên:</strong> Tự động tăng tồn kho có thể bán (onHand) qua bút toán RETURN_RECEIVE.<br />
                        • <strong>Hàng hư hỏng / móp méo:</strong> Tự động đưa vào tồn kho lỗi (damaged) qua bút toán RETURN_DAMAGE.<br />
                        • <strong>Khách giữ lại / Thiếu mất:</strong> Ghi nhận vào biên bản nhưng không cộng vào tồn kho.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kho tiếp nhận hàng hoàn *
                      </label>
                      <select
                        value={returnForm.warehouseId}
                        onChange={(e) => setReturnForm({ ...returnForm, warehouseId: e.target.value })}
                        required
                        className="w-full px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2]"
                      >
                        <option value="">-- Chọn kho nhận hàng --</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ngày nhận thực tế *
                      </label>
                      <input
                        type="date"
                        required
                        value={returnForm.receivedDate}
                        onChange={(e) => setReturnForm({ ...returnForm, receivedDate: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Người kiểm tra hàng *
                      </label>
                      <input
                        type="text"
                        required
                        value={returnForm.inspectorName}
                        onChange={(e) => setReturnForm({ ...returnForm, inspectorName: e.target.value })}
                        placeholder="VD: Nguyễn Văn A (Thủ kho)"
                        className="w-full px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mã vận đơn hoàn (nếu có)
                      </label>
                      <input
                        type="text"
                        value={returnForm.trackingCode}
                        onChange={(e) => setReturnForm({ ...returnForm, trackingCode: e.target.value })}
                        placeholder="Mã vận đơn hàng hoàn về..."
                        className="w-full px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:border-[#5865f2]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Lý do hoàn & Tình trạng kiện hàng
                      </label>
                      <input
                        type="text"
                        value={returnForm.reason}
                        onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                        placeholder="VD: Hộp nguyên seal, tem vận chuyển còn nguyên..."
                        className="w-full px-3 py-2 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#5865f2]"
                      />
                    </div>
                  </div>

                  {/* Items Inspection Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Boxes size={14} className="text-[#5865f2]" />
                        Chi tiết kiểm đếm từng sản phẩm:
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Tổng cộng {returnForm.items.length} dòng sản phẩm
                      </span>
                    </div>

                    {/* 1. MOBILE CARD VIEW (sm:hidden) */}
                    <div className="sm:hidden space-y-3">
                      {returnForm.items.map((it, idx) => (
                        <div
                          key={it.orderItemId || idx}
                          className="p-3 bg-white dark:bg-[#161922] border border-gray-200/70 dark:border-white/[0.08] rounded-[4px] space-y-2.5 shadow-none"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-bold text-[#5865f2] dark:text-indigo-400 font-mono text-xs">
                                {it.sku}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium">
                                  Xuất: <strong className="font-mono text-gray-900 dark:text-white">{it.dispatchedQuantity}</strong>
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-medium">
                                  Chờ hoàn: <strong className="font-mono">{it.remainingToReturn}</strong>
                                </span>
                              </div>
                            </div>
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug">
                              {it.productName} {it.variationName ? `(${it.variationName})` : ''}
                            </p>
                          </div>

                          {/* 3 Classification Columns */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                            {/* Còn nguyên */}
                            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-2 rounded-[4px] border border-emerald-200/80 dark:border-emerald-900/40 text-center flex flex-col justify-between">
                              <label className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 block mb-1 truncate" title="Nguyên vẹn (Bán)">
                                Còn nguyên
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={it.remainingToReturn}
                                value={it.sellableQuantity}
                                onChange={(e) =>
                                  handleReturnItemChange(idx, 'sellableQuantity', Math.max(0, parseInt(e.target.value, 10) || 0))
                                }
                                className="w-full text-center bg-white dark:bg-[#131720] border border-emerald-400 rounded-[4px] h-8 font-bold font-mono text-emerald-600 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 block">
                                Tồn bán +{it.sellableQuantity}
                              </span>
                            </div>

                            {/* Bị hỏng */}
                            <div className="bg-rose-50/60 dark:bg-rose-950/20 p-2 rounded-[4px] border border-rose-200/80 dark:border-rose-900/40 text-center flex flex-col justify-between">
                              <label className="text-[10px] font-semibold text-rose-700 dark:text-rose-400 block mb-1 truncate" title="Hàng lỗi (Hỏng)">
                                Hàng lỗi/hỏng
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={it.remainingToReturn}
                                value={it.damagedQuantity}
                                onChange={(e) =>
                                  handleReturnItemChange(idx, 'damagedQuantity', Math.max(0, parseInt(e.target.value, 10) || 0))
                                }
                                className="w-full text-center bg-white dark:bg-[#131720] border border-rose-400 rounded-[4px] h-8 font-bold font-mono text-rose-600 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                              />
                              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-1 block">
                                Hàng lỗi +{it.damagedQuantity}
                              </span>
                            </div>

                            {/* Khách giữ / thiếu */}
                            <div className="bg-gray-50/80 dark:bg-gray-800/40 p-2 rounded-[4px] border border-gray-200 dark:border-gray-700/60 text-center flex flex-col justify-between">
                              <label className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 block mb-1 truncate" title="Khách giữ / Mất">
                                Khách giữ
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={it.remainingToReturn}
                                value={it.missingQuantity}
                                onChange={(e) =>
                                  handleReturnItemChange(idx, 'missingQuantity', Math.max(0, parseInt(e.target.value, 10) || 0))
                                }
                                className="w-full text-center bg-white dark:bg-[#131720] border border-gray-300 dark:border-gray-700 rounded-[4px] h-8 font-mono text-xs text-gray-700 dark:text-gray-300 focus:outline-none"
                              />
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1 block">
                                Ko cộng tồn
                              </span>
                            </div>
                          </div>

                          {/* Ghi chú / Lô */}
                          <div className="pt-1.5 border-t border-gray-100 dark:border-gray-800">
                            <label className="text-[10px] text-gray-500 dark:text-gray-400 block mb-0.5 font-medium">Ghi chú / Lô</label>
                            <input
                              type="text"
                              placeholder="Ghi chú tình trạng, lô sản xuất..."
                              value={it.note || ''}
                              onChange={(e) => handleReturnItemChange(idx, 'note', e.target.value)}
                              className="w-full bg-white dark:bg-[#131720] border border-gray-200 dark:border-gray-700 rounded-[4px] px-2 h-7 text-xs font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 2. DESKTOP TABLE VIEW (hidden sm:block) */}
                    <div className="hidden sm:block overflow-x-auto rounded-[4px] border border-gray-200 dark:border-gray-800">
                      <table className="w-full text-left text-xs border-collapse min-w-[780px]">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 font-semibold">
                            <th className="py-2.5 px-3 min-w-[180px]">Sản phẩm / SKU</th>
                            <th className="py-2.5 px-2 text-center w-16">Đã xuất</th>
                            <th className="py-2.5 px-2 text-center w-16">Đã nhận</th>
                            <th className="py-2.5 px-2 text-center w-16 text-indigo-600 font-bold">Còn chờ</th>
                            <th className="py-2.5 px-2 text-center w-28 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300">
                              Nguyên vẹn (Bán)
                            </th>
                            <th className="py-2.5 px-2 text-center w-28 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300">
                              Hàng lỗi (Hỏng)
                            </th>
                            <th className="py-2.5 px-2 text-center w-24 bg-gray-50/50 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300">
                              Khách giữ/Mất
                            </th>
                            <th className="py-2.5 px-3 w-40">Ghi chú / Lô</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {returnForm.items.map((it, idx) => (
                            <tr key={it.orderItemId || idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-gray-900 dark:text-white line-clamp-1">
                                  {it.productName}
                                </div>
                                <div className="text-[11px] font-mono text-gray-500">
                                  {it.sku} {it.variationName ? `• ${it.variationName}` : ''}
                                </div>
                              </td>

                              <td className="py-2.5 px-2 text-center font-mono text-gray-600 dark:text-gray-300">
                                {it.dispatchedQuantity}
                              </td>

                              <td className="py-2.5 px-2 text-center font-mono text-gray-400">
                                {it.totalAccounted}
                              </td>

                              <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {it.remainingToReturn}
                              </td>

                              {/* Sellable */}
                              <td className="py-2 px-2 text-center bg-emerald-50/30 dark:bg-emerald-950/10">
                                <input
                                  type="number"
                                  min={0}
                                  max={it.remainingToReturn}
                                  value={it.sellableQuantity}
                                  onChange={(e) =>
                                    handleReturnItemChange(idx, 'sellableQuantity', Math.max(0, parseInt(e.target.value, 10) || 0))
                                  }
                                  className="w-full text-center px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-[#131720] border border-emerald-300 dark:border-emerald-800 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>

                              {/* Damaged */}
                              <td className="py-2 px-2 text-center bg-rose-50/30 dark:bg-rose-950/10">
                                <input
                                  type="number"
                                  min={0}
                                  max={it.remainingToReturn}
                                  value={it.damagedQuantity}
                                  onChange={(e) =>
                                    handleReturnItemChange(idx, 'damagedQuantity', Math.max(0, parseInt(e.target.value, 10) || 0))
                                  }
                                  className="w-full text-center px-2 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-white dark:bg-[#131720] border border-rose-300 dark:border-rose-800 rounded focus:outline-none focus:ring-1 focus:ring-rose-500"
                                />
                              </td>

                              {/* Missing */}
                              <td className="py-2 px-2 text-center bg-gray-50/30 dark:bg-gray-800/20">
                                <input
                                  type="number"
                                  min={0}
                                  max={it.remainingToReturn}
                                  value={it.missingQuantity}
                                  onChange={(e) =>
                                    handleReturnItemChange(idx, 'missingQuantity', Math.max(0, parseInt(e.target.value, 10) || 0))
                                  }
                                  className="w-full text-center px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-[#131720] border border-gray-300 dark:border-gray-700 rounded focus:outline-none"
                                />
                              </td>

                              {/* Note / Batch */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  placeholder="Ghi chú/Lô..."
                                  value={it.note || ''}
                                  onChange={(e) => handleReturnItemChange(idx, 'note', e.target.value)}
                                  className="w-full px-2 py-1 text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#131720] text-gray-900 dark:text-gray-100 focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded bg-gray-50 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 text-xs">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Tổng kết nhận hàng hoàn:
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Tồn bán lại (+onHand):{' '}
                          {returnForm.items.reduce((acc, it) => acc + (Number(it.sellableQuantity) || 0), 0)}
                        </span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          Tồn hàng lỗi (+damaged):{' '}
                          {returnForm.items.reduce((acc, it) => acc + (Number(it.damagedQuantity) || 0), 0)}
                        </span>
                        <span className="text-gray-500 font-medium">
                          Khách giữ / Thiếu:{' '}
                          {returnForm.items.reduce((acc, it) => acc + (Number(it.missingQuantity) || 0), 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => {
                  setIsReturnModalOpen(false);
                  setSelectedOrderForReturn(null);
                }}
                disabled={isSubmittingReturn}
                className="flex-1 sm:flex-initial"
              >
                Đóng
              </ModalButton>

              <ModalButton
                variant="primary"
                type="submit"
                disabled={isSubmittingReturn}
                className="flex-1 sm:flex-initial"
              >
                {isSubmittingReturn ? (
                  'Đang xử lý...'
                ) : returnMode === 'INSPECT_AND_RECEIVE' ? (
                  <>
                    <span className="sm:hidden">Nhập kho hoàn</span>
                    <span className="hidden sm:inline">Xác nhận kiểm nhận & Cập nhật kho</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Báo đang hoàn</span>
                    <span className="hidden sm:inline">Xác nhận báo đơn đang hoàn</span>
                  </>
                )}
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Virtual Order Configuration Modal */}
      {isVirtualModalOpen && (
        <Modal
          isOpen={isVirtualModalOpen}
          onClose={() => setIsVirtualModalOpen(false)}
          title={
            targetOrdersForVirtual.length === 1
              ? 'Cấu hình Đơn ảo (Seeding / Buff đơn)'
              : `Cấu hình Đơn ảo hàng loạt (${targetOrdersForVirtual.length} đơn đã chọn)`
          }
          size="md"
        >
          <form onSubmit={handleVirtualModalSubmit}>
            <ModalBody className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded border border-purple-200 dark:border-purple-900/50 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
                <Sparkles size={16} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">Đơn ảo (Buff đơn / Seeding đánh giá)</div>
                  <div className="text-purple-700 dark:text-purple-300 text-[11px]">
                    Giúp quản lý riêng các đơn đặt ảo để tăng lượt mua/đánh giá sàn. Cho phép lựa chọn có gửi hàng thật để trừ kho hay không gửi để tránh trừ kho sản phẩm.
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-2.5 p-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#181b22] cursor-pointer hover:border-purple-300 dark:hover:border-purple-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={virtualForm.isVirtual}
                    onChange={(e) =>
                      setVirtualForm({
                        ...virtualForm,
                        isVirtual: e.target.checked,
                        isRealGoods: e.target.checked ? virtualForm.isRealGoods : false,
                      })
                    }
                    className="w-4 h-4 mt-0.5 rounded text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-gray-600"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                      Đánh dấu là đơn hàng ảo
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Bỏ chọn nếu đây là đơn bán bình thường của khách thật.
                    </span>
                  </div>
                </label>

                {virtualForm.isVirtual && (
                  <div className="p-3.5 rounded border border-purple-200/80 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 space-y-2 animate-in fade-in">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={virtualForm.isRealGoods}
                        onChange={(e) =>
                          setVirtualForm({
                            ...virtualForm,
                            isRealGoods: e.target.checked,
                          })
                        }
                        className="w-4 h-4 mt-0.5 rounded text-[#5865f2] focus:ring-[#5865f2] border-gray-300 dark:border-gray-600"
                      />
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white block">
                          Có gửi hàng thật (Xuất kho thực tế)
                        </span>
                        <span className="text-[11px] text-gray-600 dark:text-gray-400 block mt-0.5">
                          {virtualForm.isRealGoods ? (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              Đang bật: Kho sẽ trừ tồn kho thực tế khi quét đóng gói/xuất đơn.
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Đang tắt (Mặc định): Không trừ kho, không giữ hàng, không ảnh hưởng tồn thực tế.
                            </span>
                          )}
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsVirtualModalOpen(false)}
                disabled={isUpdatingVirtual}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="primary"
                type="submit"
                disabled={isUpdatingVirtual}
                className="flex-1 sm:flex-initial bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isUpdatingVirtual ? 'Đang lưu...' : 'Xác nhận lưu'}
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Bulk Dispatch Modal */}
      {isBulkDispatchModalOpen && (
        <Modal
          isOpen={isBulkDispatchModalOpen}
          onClose={() => setIsBulkDispatchModalOpen(false)}
          title={`Đánh dấu Xuất kho / Đã quét (${selectedOrderIds.length} đơn hàng đã chọn)`}
          size="md"
        >
          <form onSubmit={handleBulkDispatchSubmit}>
            <ModalBody className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold">Xác nhận xuất kho hàng loạt</div>
                  <div className="text-emerald-700 dark:text-emerald-300 text-[11px]">
                    Hệ thống sẽ cập nhật trạng thái các đơn đã chọn thành <strong>ĐÃ QUÉT / XUẤT KHO (DISPATCHED)</strong>.
                    Với đơn thường và đơn ảo có đi hàng thật sẽ tự động trừ tồn kho. Đơn ảo không đi hàng thật sẽ <strong>không trừ kho</strong>.
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Chọn kho xuất hàng
                </label>
                <Select
                  value={selectedWarehouseForDispatch || selectedWarehouseId || ''}
                  onChange={(val: any) => setSelectedWarehouseForDispatch(val)}
                  options={[
                    { value: '', label: 'Tự động (Theo kho mặc định của Shop)' },
                    ...(warehouses || []).map((w: any) => ({
                      value: w.id,
                      label: `${w.name} (${w.code})`,
                    })),
                  ]}
                  size="md"
                  className="w-full"
                  menuWidth="w-full"
                />
              </div>

              <div className="p-3 rounded bg-gray-50 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
                Tổng số đơn được xử lý: <strong className="text-gray-900 dark:text-white">{selectedOrderIds.length} đơn</strong>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between sm:justify-end gap-2.5 w-full">
              <ModalButton
                variant="secondary"
                onClick={() => setIsBulkDispatchModalOpen(false)}
                disabled={isDispatching}
                className="flex-1 sm:flex-initial"
              >
                Hủy
              </ModalButton>
              <ModalButton
                variant="primary"
                type="submit"
                disabled={isDispatching}
                className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isDispatching ? 'Đang xuất kho...' : 'Xác nhận xuất kho'}
              </ModalButton>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Procurement Demand Modal (Dự toán hàng cần nhập cho đơn READY_TO_SHIP) */}
      {/* Procurement Demand Modal (Dự toán hàng cần nhập cho đơn READY_TO_SHIP) */}
      {isDemandModalOpen && (
        <Modal
          isOpen={isDemandModalOpen}
          onClose={() => setIsDemandModalOpen(false)}
          title="Dự toán nhu cầu nhập hàng (Đơn Chờ giao hàng - READY_TO_SHIP)"
          size="3xl"
        >
          <div className="flex flex-col flex-1 min-h-0 space-y-4">
            <ModalBody className="space-y-4 p-4 sm:p-5 max-h-[78vh] overflow-y-auto custom-scrollbar">
              {/* Header Description & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/40 rounded">
                <div className="flex items-start gap-2.5">
                  <Calculator size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-xs text-indigo-950 dark:text-indigo-200 block">
                      Tự động tính toán mặt hàng cần nhập hoặc thừa/dư tồn kho
                    </span>
                    <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      Chỉ xét các đơn hàng Shopee ở trạng thái <strong>Chờ giao hàng (READY_TO_SHIP)</strong> chưa xuất kho (bỏ qua đơn ảo không đi hàng thật).
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshDemand}
                    disabled={isLoadingDemand}
                    className="h-8 px-2.5 rounded border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-[#181b22] text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Tính toán lại dữ liệu mới nhất"
                  >
                    <RefreshCw size={13} className={isLoadingDemand ? 'animate-spin' : ''} />
                    <span>Làm mới</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyShortageList}
                    disabled={isLoadingDemand || !demandData || demandData.summary?.shortageItemsCount === 0}
                    className="h-8 px-2.5 rounded border border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Sao chép danh sách các mặt hàng thiếu vào clipboard"
                  >
                    <Copy size={13} />
                    <span>Copy DS Thiếu</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              {demandData?.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800">
                    <span className="text-[11px] font-medium text-gray-500 block">Đơn chờ giao (READY_TO_SHIP)</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white mt-0.5 block">
                      {demandData.summary.totalOrders} <span className="text-xs font-normal text-gray-500">đơn</span>
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      Tổng cần giao: {demandData.summary.totalRequiredQuantity} sp
                    </span>
                  </div>

                  <div className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800">
                    <span className="text-[11px] font-medium text-gray-500 block">Mặt hàng cần giao</span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                      {demandData.summary.totalItems} <span className="text-xs font-normal text-gray-500">loại SKU</span>
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      Tồn hiện có: {demandData.summary.totalOnHand} sp
                    </span>
                  </div>

                  <div className="p-3 rounded bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50">
                    <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 block">
                      THIẾU HÀNG (Cần nhập)
                    </span>
                    <span className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5 block">
                      {demandData.summary.shortageItemsCount} <span className="text-xs font-normal text-rose-500">loại</span>
                    </span>
                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-0.5 block">
                      Thiếu: {demandData.summary.totalShortageQuantity} sản phẩm
                    </span>
                  </div>

                  <div className="p-3 rounded bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">
                      ĐỦ HÀNG (Thừa/Dư tồn)
                    </span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      {demandData.summary.sufficientItemsCount} <span className="text-xs font-normal text-emerald-500">loại</span>
                    </span>
                    <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 block">
                      Chi phí thiếu: {formatCurrency(demandData.summary.totalEstimatedCost)} đ
                    </span>
                  </div>
                </div>
              )}

              {/* Filter Controls Bar */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
                {/* Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  {[
                    { id: 'ALL', label: `Tất cả (${demandData?.summary?.totalItems || 0})` },
                    { id: 'SHORTAGE', label: `Cần nhập (${demandData?.summary?.shortageItemsCount || 0})` },
                    { id: 'SUFFICIENT', label: `Đủ hàng (${demandData?.summary?.sufficientItemsCount || 0})` },
                    { id: 'UNMAPPED', label: `Chưa mapping (${demandData?.summary?.unmappedItemsCount || 0})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDemandFilterTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors cursor-pointer border-0 shrink-0 font-medium ${
                        demandFilterTab === tab.id
                          ? 'bg-[#5865f2] text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1a1b23]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Warehouse, Shop and Search Selectors */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <div className="w-full sm:w-44 shrink-0">
                    <Select
                      value={demandWarehouseId}
                      onChange={(val: any) => {
                        setDemandWarehouseId(val);
                        handleOpenProcurementDemand({ warehouseId: val, shopId: demandShopId });
                      }}
                      options={[
                        { value: '', label: 'Tất cả kho hàng' },
                        ...(warehouses || []).map((w: any) => ({
                          value: w.id,
                          label: `${w.name} (${w.code})`,
                        })),
                      ]}
                      size="sm"
                      className="w-full"
                      menuWidth="w-full"
                    />
                  </div>

                  <div className="w-full sm:w-44 shrink-0">
                    <Select
                      value={demandShopId}
                      onChange={(val: any) => {
                        setDemandShopId(val);
                        handleOpenProcurementDemand({ shopId: val, warehouseId: demandWarehouseId });
                      }}
                      options={[
                        { value: '', label: 'Tất cả Shop' },
                        ...(shops || []).map((s: any) => ({
                          value: s.id,
                          label: s.name,
                        })),
                      ]}
                      size="sm"
                      className="w-full"
                      menuWidth="w-full"
                    />
                  </div>

                  <div className="w-full sm:w-56 relative">
                    <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={demandSearchQuery}
                      onChange={(e) => setDemandSearchQuery(e.target.value)}
                      placeholder="Tìm SKU, tên sản phẩm..."
                      className="w-full pl-7 pr-3 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#14151a] text-gray-900 dark:text-white focus:outline-none focus:border-[#5865f2]"
                    />
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-gray-200 dark:border-gray-800 rounded overflow-hidden">
                <div className="overflow-x-auto max-h-[45vh] custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 dark:bg-[#14151a] sticky top-0 z-10 text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="py-2 px-3 w-10 text-center">#</th>
                        <th className="py-2 px-3 min-w-[220px]">Sản phẩm / Biến thể</th>
                        <th className="py-2 px-3 text-center min-w-[90px]">Nhu cầu giao</th>
                        <th className="py-2 px-3 text-center min-w-[110px]">Tồn kho hiện có</th>
                        <th className="py-2 px-3 text-center min-w-[160px]">Chênh lệch Thừa / Thiếu</th>
                        <th className="py-2 px-3 text-right min-w-[110px]">Giá vốn dự tính</th>
                        <th className="py-2 px-3 text-center min-w-[80px]">Số đơn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 bg-white dark:bg-[#181b22]">
                      {isLoadingDemand ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-gray-400">
                            Đang phân tích số lượng cần nhập từ các đơn Chờ giao hàng...
                          </td>
                        </tr>
                      ) : !demandData || demandData.items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs text-gray-400">
                            Không có đơn hàng nào ở trạng thái Chờ giao hàng (READY_TO_SHIP) phù hợp.
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          const filtered = demandData.items.filter((it: any) => {
                            if (demandFilterTab === 'SHORTAGE' && it.status !== 'SHORTAGE') return false;
                            if (demandFilterTab === 'SUFFICIENT' && it.status !== 'SUFFICIENT') return false;
                            if (demandFilterTab === 'UNMAPPED' && it.isMapped) return false;
                            if (demandSearchQuery.trim()) {
                              const q = demandSearchQuery.toLowerCase().trim();
                              const matchSku = it.sku?.toLowerCase().includes(q);
                              const matchProd = it.productName?.toLowerCase().includes(q);
                              const matchVar = it.variationName?.toLowerCase().includes(q);
                              if (!matchSku && !matchProd && !matchVar) return false;
                            }
                            return true;
                          });

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="py-8 text-center text-xs text-gray-400">
                                  Không tìm thấy mặt hàng nào phù hợp với bộ lọc hiện tại.
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((it: any, idx: number) => {
                            const isShort = it.status === 'SHORTAGE';
                            return (
                              <tr
                                key={it.groupKey || idx}
                                className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors ${
                                  isShort ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                                }`}
                              >
                                <td className="py-2 px-3 text-center text-gray-400 text-xs">
                                  {idx + 1}
                                </td>
                                <td className="py-2 px-3">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono font-bold text-xs text-gray-900 dark:text-white">
                                        {it.sku}
                                      </span>
                                      {!it.isMapped && (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-medium">
                                          Chưa mapping SKU
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium line-clamp-1 mt-0.5">
                                      {it.productName}
                                    </span>
                                    {it.variationName && (
                                      <span className="text-[11px] text-gray-400 line-clamp-1">
                                        Phân loại: {it.variationName}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">
                                    {it.requiredQuantity} {it.unit}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className={`font-semibold text-xs ${it.onHand < 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-gray-800 dark:text-gray-200'}`}>
                                      {it.onHand} {it.unit}
                                    </span>
                                    {it.onHand < 0 && (
                                      <span className="text-[10px] text-rose-500 font-medium">
                                        (Âm kho)
                                      </span>
                                    )}
                                    {it.reserved > 0 && (
                                      <span className="text-[10px] text-gray-400">
                                        (Đang giữ: {it.reserved})
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {isShort ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                                      <span>Thiếu -{it.shortageQuantity} {it.unit} (Cần nhập)</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                                      <span>Đủ hàng (Dư +{it.surplusQuantity} {it.unit})</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <div className="flex flex-col items-end">
                                    {isShort && it.estimatedShortageCost > 0 ? (
                                      <>
                                        <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                                          {formatCurrency(it.estimatedShortageCost)} đ
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                          ({formatCurrency(it.costPrice)} đ/sp)
                                        </span>
                                      </>
                                    ) : it.costPrice > 0 ? (
                                      <span className="text-gray-500 text-xs">
                                        {formatCurrency(it.costPrice)} đ
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">-</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                    title={`Nằm trong ${it.ordersCount} đơn hàng Chờ giao`}
                                  >
                                    {it.ordersCount} đơn
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between gap-2.5 w-full">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyShortageList}
                  disabled={!demandData || demandData.summary?.shortageItemsCount === 0}
                  className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#181b22] hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Copy size={13} />
                  <span>Sao chép danh sách cần nhập</span>
                </button>
              </div>

              <ModalButton
                variant="secondary"
                onClick={() => setIsDemandModalOpen(false)}
                className="px-4"
              >
                Đóng
              </ModalButton>
            </ModalFooter>
          </div>
        </Modal>
      )}
    </div>
  );
};

