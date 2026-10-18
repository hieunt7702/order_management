import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Eye,
  FileCode,
  CheckCircle,
  Package,
  Users,
  Globe,
  Copy,
  Check,
  ShoppingBag,
  Boxes,
  Warehouse,
  Store,
  Building2,
  Receipt,
  RotateCcw,
  FileSpreadsheet,
  CreditCard,
  Shield,
} from 'lucide-react';
import { auditApi } from '../../services/auditApi';
import { Button } from '../../components/ui/Button';
import { Badge, type BadgeVariant } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import {
  SystemTableWrapper,
  SystemThead,
  SystemTh,
  SystemTbody,
  SystemTr,
  SystemTd,
  SystemTableSkeleton,
  SystemTableEmpty,
  SystemPagination,
} from '../../components/ui/SystemTable';
import { SystemMetricPairCard } from '../../components/ui/SystemMetricCard';
import { toast } from '../../components/ui/Toast';

export interface ActionMetadata {
  label: string;
  variant: BadgeVariant;
  description?: string;
}

export const AUDIT_ACTIONS: Record<string, ActionMetadata> = {
  // Quét mã & Xuất kho
  SCAN_VERIFY_DISPATCH: { label: 'Quét xuất kho', variant: 'success', description: 'Xác nhận quét xuất kho đơn hàng' },
  SCAN_REVERSAL: { label: 'Hoàn tác xuất kho', variant: 'warning', description: 'Hoàn tác xuất kho do quét nhầm' },

  // Hàng hoàn
  ORDER_RETURN_INSPECTED: { label: 'Nghiệm thu hàng hoàn', variant: 'purple', description: 'Kiểm tra phân loại hàng hoàn về kho' },
  ORDER_RETURN_RECEIVED: { label: 'Nhập kho hàng hoàn', variant: 'success', description: 'Xác nhận nhập lại hàng hoàn vào tồn kho' },

  // Import Shopee
  IMPORT_UPLOAD: { label: 'Tải lên file đơn', variant: 'info', description: 'Tải lên file báo cáo đơn hàng Shopee' },
  IMPORT_CONFIRM: { label: 'Xác nhận Import', variant: 'success', description: 'Xác nhận nhập đơn từ file import' },

  // Kho hàng & Tồn kho
  INVENTORY_RECEIVE: { label: 'Nhập kho sản phẩm', variant: 'info', description: 'Nhập hàng vào kho lưu trữ' },
  INVENTORY_ADJUST: { label: 'Điều chỉnh tồn kho', variant: 'warning', description: 'Kiểm kê và điều chỉnh số lượng tồn' },

  // Đơn hàng & Xử lý đơn
  ORDER_RESERVED: { label: 'Giữ tồn kho đơn', variant: 'info', description: 'Giữ tồn khả dụng cho đơn hàng' },
  ORDER_CANCELLED_RELEASED: { label: 'Hủy đơn & Nhả tồn', variant: 'warning', description: 'Hủy đơn và hoàn trả tồn khả dụng' },
  ORDER_CANCELLED_POST_DISPATCH: { label: 'Hủy đơn sau xuất', variant: 'destructive', description: 'Đơn hàng bị hủy sau khi đã xuất kho' },
  ORDER_CREATED_MANUAL: { label: 'Tạo đơn thủ công', variant: 'default', description: 'Tạo mới đơn hàng trên hệ thống' },
  ORDER_UPDATED: { label: 'Cập nhật đơn hàng', variant: 'secondary', description: 'Chỉnh sửa thông tin đơn hàng' },
  ORDER_DELETED: { label: 'Xóa đơn hàng', variant: 'destructive', description: 'Xóa đơn hàng' },

  // Mua hàng & Công nợ NCC
  PURCHASE_RECEIPT_CREATED: { label: 'Lập phiếu nhập NCC', variant: 'info', description: 'Tạo phiếu nhập mua hàng từ NCC' },
  PURCHASE_RECEIPT_RECEIVED: { label: 'Nhập kho NCC', variant: 'success', description: 'Xác nhận nhập hàng thực tế từ NCC' },
  PURCHASE_RECEIPT_CANCELLED: { label: 'Hủy phiếu nhập NCC', variant: 'destructive', description: 'Hủy phiếu nhập mua hàng từ NCC' },
  SUPPLIER_PAYMENT_CREATED: { label: 'Thanh toán nợ NCC', variant: 'success', description: 'Lập phiếu chi thanh toán công nợ NCC' },

  // Tài chính & Đối soát
  SETTLEMENT_RECORDED: { label: 'Ghi nhận đối soát', variant: 'success', description: 'Cập nhật đối soát doanh thu sàn' },

  // Thành viên & Quyền
  ADD_MEMBER: { label: 'Thêm nhân viên', variant: 'info', description: 'Thêm tài khoản nhân viên mới' },
  UPDATE_MEMBER: { label: 'Cập nhật quyền', variant: 'warning', description: 'Chỉnh sửa quyền hạn hoặc shop gán' },
  REMOVE_MEMBER: { label: 'Xóa nhân viên', variant: 'destructive', description: 'Xóa tài khoản nhân viên khỏi Workspace' },

  // Gian hàng & Kho
  SHOP_CREATED: { label: 'Thêm gian hàng', variant: 'info', description: 'Kết nối gian hàng Shopee mới' },
  SHOP_UPDATED: { label: 'Cập nhật gian hàng', variant: 'secondary', description: 'Chỉnh sửa thông tin gian hàng' },
  SHOP_DELETED: { label: 'Xóa gian hàng', variant: 'destructive', description: 'Xóa gian hàng khỏi hệ thống' },
  WAREHOUSE_CREATED: { label: 'Tạo kho hàng', variant: 'info', description: 'Tạo mới kho hàng' },
  WAREHOUSE_UPDATED: { label: 'Cập nhật kho', variant: 'secondary', description: 'Sửa thông tin kho hàng' },
  WAREHOUSE_DELETED: { label: 'Xóa kho hàng', variant: 'destructive', description: 'Xóa kho hàng' },
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  Order: 'Đơn hàng',
  Package: 'Kiện hàng',
  Warehouse: 'Kho hàng',
  InventoryBalance: 'Tồn kho',
  ImportJob: 'File Import',
  OrderReturn: 'Hàng hoàn',
  Settlement: 'Đối soát sàn',
  PurchaseReceipt: 'Phiếu nhập NCC',
  Supplier: 'Nhà cung cấp',
  SupplierPayment: 'Phiếu chi NCC',
  Membership: 'Nhân sự / Quyền',
  Shop: 'Gian hàng',
  User: 'Tài khoản',
  ProductVariant: 'Biến thể SP',
};

export const getActionInfo = (action: string): ActionMetadata => {
  if (AUDIT_ACTIONS[action]) return AUDIT_ACTIONS[action];
  const readable = action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
  return {
    label: readable,
    variant: 'secondary',
    description: action,
  };
};

export const getEntityLabel = (entityType?: string): string => {
  if (!entityType) return '--';
  return ENTITY_TYPE_LABELS[entityType] || entityType;
};

// Component icon đại diện cho thực thể
const EntityIcon: React.FC<{ type?: string; size?: number; className?: string }> = ({
  type = '',
  size = 13,
  className = '',
}) => {
  const t = type.toLowerCase();
  if (t.includes('orderreturn')) return <RotateCcw size={size} className={className} />;
  if (t.includes('order')) return <ShoppingBag size={size} className={className} />;
  if (t.includes('package')) return <Package size={size} className={className} />;
  if (t.includes('warehouse')) return <Warehouse size={size} className={className} />;
  if (t.includes('supplierpayment')) return <CreditCard size={size} className={className} />;
  if (t.includes('purchasereceipt')) return <Receipt size={size} className={className} />;
  if (t.includes('supplier')) return <Building2 size={size} className={className} />;
  if (t.includes('shop')) return <Store size={size} className={className} />;
  if (t.includes('member') || t.includes('user')) return <Users size={size} className={className} />;
  if (t.includes('settlement')) return <FileSpreadsheet size={size} className={className} />;
  if (t.includes('inventory')) return <Boxes size={size} className={className} />;
  return <Shield size={size} className={className} />;
};

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected Log detail
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    loadAuditLogs();
  }, [page, limit]);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res: any = await auditApi.getAuditLogs({ page, limit });
      const items = res?.items || res?.data || (Array.isArray(res) ? res : []);
      setLogs(items);
      setTotalItems(res?.total ?? items.length);
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
      toast.error('Lỗi tải nhật ký kiểm toán', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (e: React.MouseEvent, text: string, label: string = 'ID') => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success(`Đã sao chép ${label}`);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getEntityDisplay = (log: any) => {
    const summary = log.entitySummary;
    const code = log.entityCode;
    const name = log.entityName;
    const rawId = log.entityId || '';
    const shortId = rawId ? (rawId.length > 13 ? `${rawId.substring(0, 8)}...` : rawId) : '--';

    let primaryText = summary;
    if (!primaryText) {
      if (name && code) {
        primaryText = `${name} (${code})`;
      } else if (code) {
        primaryText = `${getEntityLabel(log.entityType)} ${code}`;
      } else if (name) {
        primaryText = name;
      } else if (rawId) {
        primaryText = `${getEntityLabel(log.entityType)} #${rawId.substring(0, 8)}`;
      } else {
        primaryText = '--';
      }
    }

    return {
      title: primaryText,
      rawId,
      shortId,
      hasCodeOrName: Boolean(summary || code || name),
    };
  };

  const renderIpBadge = (ip?: string) => {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    if (!cleanIp || cleanIp === '--') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60">
          <Globe size={11} className="text-gray-400" />
          127.0.0.1 <span className="text-[9px] text-gray-400 font-sans">(Local)</span>
        </span>
      );
    }

    const isLocal =
      cleanIp === '127.0.0.1' ||
      cleanIp === '::1' ||
      cleanIp === 'localhost' ||
      cleanIp.startsWith('192.168.') ||
      cleanIp.startsWith('10.');

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
          isLocal
            ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/50'
        }`}
        title={isLocal ? 'Mạng cục bộ / Máy chủ nội bộ' : `Địa chỉ IP Client: ${cleanIp}`}
      >
        <Globe size={11} className={isLocal ? 'text-gray-400' : 'text-blue-500'} />
        <span>{cleanIp}</span>
        {isLocal && <span className="text-[9px] text-gray-400 font-sans">(Local)</span>}
      </span>
    );
  };

  // Metrics
  const orderLogsCount = logs.filter(
    (l) => (l.entityType || '').toLowerCase().includes('order') || (l.action || '').toLowerCase().includes('order'),
  ).length;
  const inventoryLogsCount = logs.filter(
    (l) => (l.entityType || '').toLowerCase().includes('inventory') || (l.action || '').toLowerCase().includes('stock'),
  ).length;
  const adminLogsCount = logs.filter(
    (l) =>
      (l.entityType || '').toLowerCase().includes('member') ||
      (l.entityType || '').toLowerCase().includes('shop') ||
      (l.entityType || '').toLowerCase().includes('user'),
  ).length;

  const filteredLogs = logs.filter((log) => {
    if (entityFilter !== 'ALL') {
      const entity = (log.entityType || '').toUpperCase();
      if (!entity.includes(entityFilter)) return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const actionCode = (log.action || '').toLowerCase();
      const actionLabel = (AUDIT_ACTIONS[log.action]?.label || '').toLowerCase();
      const entitySummary = (log.entitySummary || '').toLowerCase();
      const entityCode = (log.entityCode || '').toLowerCase();
      const entityName = (log.entityName || '').toLowerCase();
      const entityType = (log.entityType || '').toLowerCase();
      const entityLabel = (getEntityLabel(log.entityType) || '').toLowerCase();
      const actor = (log.user?.email || log.user?.name || log.userId || '').toLowerCase();
      const entityId = (log.entityId || '').toLowerCase();
      const ip = (log.ipAddress || '').toLowerCase();
      return (
        actionCode.includes(term) ||
        actionLabel.includes(term) ||
        entitySummary.includes(term) ||
        entityCode.includes(term) ||
        entityName.includes(term) ||
        entityType.includes(term) ||
        entityLabel.includes(term) ||
        actor.includes(term) ||
        entityId.includes(term) ||
        ip.includes(term)
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-fit md:min-h-0 space-y-3.5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl font-medium text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
            <ShieldAlert size={18} className="text-[#5865f2] shrink-0 sm:w-5 sm:h-5" />
            <span className="sm:hidden truncate">Nhật ký kiểm toán</span>
            <span className="hidden sm:inline truncate">Nhật ký kiểm toán hệ thống (Audit Trail)</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate hidden sm:block">
            Lưu vết mọi hành động xuất hàng, điều chỉnh kho, import đơn và phân quyền của nhân viên
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAuditLogs}
          className="h-8 w-8 sm:w-auto p-0 sm:px-2.5 sm:py-1 gap-1 text-xs shrink-0"
          title="Làm mới dữ liệu"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden lg:inline text-xs">Làm mới</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 shrink-0">
        <SystemMetricPairCard
          leftItem={{
            title: 'Tổng nhật ký kiểm toán',
            value: totalItems || logs.length,
            subtitle: 'Hành động đã ghi nhận',
            icon: ShieldAlert,
            colorScheme: 'blue',
          }}
          rightItem={{
            title: 'Đơn hàng & Xuất kho',
            value: orderLogsCount,
            subtitle: 'Thao tác xử lý đơn',
            icon: CheckCircle,
            colorScheme: 'green',
          }}
        />
        <SystemMetricPairCard
          leftItem={{
            title: 'Kho hàng & Tồn kho',
            value: inventoryLogsCount,
            subtitle: 'Nhập/xuất/điều chỉnh tồn',
            icon: Package,
            colorScheme: 'orange',
          }}
          rightItem={{
            title: 'Cấu hình & Nhân sự',
            value: adminLogsCount,
            subtitle: 'Thành viên & Shop',
            icon: Users,
            colorScheme: 'purple',
          }}
        />
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded shrink-0">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo hành động, mã đơn, tên kho, IP hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-4 py-1.5 h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 font-normal"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
            Thực thể:
          </span>
          <Select
            value={entityFilter}
            onChange={(val: any) => setEntityFilter(val)}
            options={[
              { value: 'ALL', label: 'Tất cả thực thể' },
              { value: 'ORDER', label: 'Đơn hàng (Order)' },
              { value: 'PACKAGE', label: 'Kiện hàng (Package)' },
              { value: 'INVENTORY', label: 'Kho tồn (Inventory)' },
              { value: 'IMPORT', label: 'Import Excel (ImportJob)' },
              { value: 'RETURN', label: 'Hàng hoàn (OrderReturn)' },
              { value: 'PURCHASE', label: 'Phiếu nhập NCC (PurchaseReceipt)' },
              { value: 'SUPPLIER', label: 'Nhà cung cấp (Supplier)' },
              { value: 'WAREHOUSE', label: 'Kho hàng (Warehouse)' },
              { value: 'SHOP', label: 'Gian hàng (Shop)' },
              { value: 'MEMBER', label: 'Nhân sự (Membership)' },
              { value: 'SETTLEMENT', label: 'Đối soát sàn (Settlement)' },
            ]}
            size="sm"
            className="w-full sm:w-52"
            menuWidth="w-56"
          />
        </div>
      </div>

      {/* Desktop Table with Bottom-Pinned SystemPagination */}
      <div className="hidden md:flex flex-1 flex-col min-h-fit md:min-h-0">
        <SystemTableWrapper
          tableClassName="min-w-[980px]"
          pagination={
            <SystemPagination
              page={page - 1}
              totalPages={Math.ceil(totalItems / limit) || 1}
              totalItems={totalItems}
              setPage={(p) => setPage(p + 1)}
              itemsPerPage={limit}
              setItemsPerPage={setLimit}
            />
          }
        >
          <SystemThead>
            <SystemTr>
              <SystemTh className="w-12 text-center" align="center">STT</SystemTh>
              <SystemTh className="w-36" align="left">Thời gian</SystemTh>
              <SystemTh className="w-44" align="left">Người thực hiện</SystemTh>
              <SystemTh className="w-40" align="left">Hành động</SystemTh>
              <SystemTh className="w-28" align="left">Loại đối tượng</SystemTh>
              <SystemTh className="min-w-[220px]" align="left">Mã / Đối tượng tác động</SystemTh>
              <SystemTh className="w-36 text-center" align="center">IP Client</SystemTh>
              <SystemTh className="w-16 text-center" align="center">Xem</SystemTh>
            </SystemTr>
          </SystemThead>
          <SystemTbody>
            {isLoading ? (
              <SystemTableSkeleton cols={8} rows={7} />
            ) : filteredLogs.length === 0 ? (
              <SystemTableEmpty
                colSpan={8}
                title="Không có bản ghi nhật ký kiểm toán nào"
                description={
                  searchTerm
                    ? 'Thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc thực thể.'
                    : 'Chưa có nhật ký kiểm toán nào được ghi nhận.'
                }
              />
            ) : (
              filteredLogs.map((log, index) => {
                const stt = (page - 1) * limit + index + 1;
                const actionInfo = getActionInfo(log.action);
                const display = getEntityDisplay(log);

                return (
                  <SystemTr key={log.id}>
                    <SystemTd align="center" className="text-center font-medium text-gray-500 dark:text-gray-400 text-xs">
                      {stt}
                    </SystemTd>
                    <SystemTd className="text-gray-500 dark:text-gray-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </SystemTd>
                    <SystemTd>
                      <div className="font-medium text-xs text-gray-900 dark:text-white truncate max-w-[160px]" title={log.user?.name || 'Hệ thống'}>
                        {log.user?.name || 'Hệ thống'}
                      </div>
                      <div className="text-[11px] font-mono text-gray-400 truncate max-w-[160px]" title={log.user?.email || log.userId || '--'}>
                        {log.user?.email || log.userId || '--'}
                      </div>
                    </SystemTd>
                    <SystemTd>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={actionInfo.variant} className="text-[11px] font-semibold">
                          {actionInfo.label}
                        </Badge>
                        <span className="font-mono text-[10px] text-gray-400 select-all tracking-tight">
                          {log.action}
                        </span>
                      </div>
                    </SystemTd>
                    <SystemTd>
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          <EntityIcon type={log.entityType} size={13} />
                        </span>
                        <div className="flex flex-col">
                          <span className="text-gray-900 dark:text-gray-100 font-medium text-xs">
                            {getEntityLabel(log.entityType)}
                          </span>
                          <span className="font-mono text-[10px] text-gray-400">
                            {log.entityType}
                          </span>
                        </div>
                      </div>
                    </SystemTd>
                    <SystemTd>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 font-medium text-xs text-gray-900 dark:text-gray-100">
                          <span className="truncate max-w-[240px]" title={display.title}>
                            {display.title}
                          </span>
                        </div>
                        {display.rawId && (
                          <div className="flex items-center gap-1 text-[11px] font-mono text-gray-400">
                            <span className="truncate" title={`UUID: ${display.rawId}`}>
                              ID: {display.shortId}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopy(e, display.rawId, 'UUID')}
                              className="text-gray-400 hover:text-[#5865f2] transition-colors p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                              title="Sao chép toàn bộ UUID"
                            >
                              {copiedId === display.rawId ? (
                                <Check size={11} className="text-emerald-500" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </SystemTd>
                    <SystemTd align="center" className="text-center">
                      {renderIpBadge(log.ipAddress)}
                    </SystemTd>
                    <SystemTd align="center">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setSelectedLog(log)}
                        className="px-2 text-gray-500 hover:text-[#5865f2]"
                        title="Xem chi tiết dữ liệu"
                      >
                        <Eye size={14} />
                      </Button>
                    </SystemTd>
                  </SystemTr>
                );
              })
            )}
          </SystemTbody>
        </SystemTableWrapper>
      </div>

      {/* Mobile Audit Card List View */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-2 pb-16">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-gray-400">Đang tải nhật ký kiểm toán...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">Không có bản ghi nhật ký nào</div>
        ) : (
          filteredLogs.map((log, index) => {
            const stt = (page - 1) * limit + index + 1;
            const actionInfo = getActionInfo(log.action);
            const display = getEntityDisplay(log);

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="p-3 rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 space-y-2 cursor-pointer shadow-none hover:border-[#5865f2]/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-semibold text-gray-500 flex items-center justify-center shrink-0">
                      {stt}
                    </span>
                    <Badge variant={actionInfo.variant} className="text-[10px] font-semibold truncate">
                      {actionInfo.label}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{' '}
                    {new Date(log.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                {/* Entity & IP */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="p-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">
                      <EntityIcon type={log.entityType} size={12} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium text-xs text-gray-800 dark:text-gray-200 truncate">
                        {display.title}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {getEntityLabel(log.entityType)} • {display.shortId}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {renderIpBadge(log.ipAddress)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-gray-100 dark:border-gray-800 text-gray-500">
                  <span className="truncate">
                    Bởi: <strong>{log.user?.name || log.user?.email || 'Hệ thống'}</strong>
                  </span>
                  <span className="text-xs text-[#5865f2] font-medium flex items-center gap-1 shrink-0">
                    <Eye size={12} /> Chi tiết
                  </span>
                </div>
              </div>
            );
          })
        )}

        {totalItems > limit && (
          <div className="pt-2">
            <SystemPagination
              page={page - 1}
              totalPages={Math.ceil(totalItems / limit) || 1}
              totalItems={totalItems}
              setPage={(p) => setPage(p + 1)}
              itemsPerPage={limit}
              setItemsPerPage={setLimit}
            />
          </div>
        )}
      </div>

      {/* MODAL: VIEW AUDIT METADATA */}
      {selectedLog && (() => {
        const modalDisplay = getEntityDisplay(selectedLog);
        const actionInfo = getActionInfo(selectedLog.action);
        const payloadData = {
          ...(selectedLog.oldValues ? { 'Dữ liệu trước (oldValues)': selectedLog.oldValues } : {}),
          ...(selectedLog.newValues ? { 'Dữ liệu sau (newValues)': selectedLog.newValues } : {}),
          ...(selectedLog.metadata ? { 'Metadata': selectedLog.metadata } : {}),
          ...(selectedLog.details ? { 'Chi tiết': selectedLog.details } : {}),
        };
        const hasPayload = Object.keys(payloadData).length > 0;

        return (
          <Modal
            isOpen={Boolean(selectedLog)}
            onClose={() => setSelectedLog(null)}
            title={
              <>
                <span className="sm:hidden">Kiểm toán #{selectedLog.id?.substring(0, 8)}</span>
                <span className="hidden sm:inline">{`Bản ghi kiểm toán #${selectedLog.id?.substring(0, 8)}`}</span>
              </>
            }
            subtitle={
              <span className="line-clamp-1 sm:line-clamp-none">
                {`${actionInfo.label} (${selectedLog.action}) • ${getEntityLabel(selectedLog.entityType)}`}
              </span>
            }
            icon={ShieldAlert}
            maxWidth="max-w-2xl"
          >
            <div className="flex flex-col flex-1 min-h-0">
              <ModalBody className="space-y-3 sm:space-y-3.5 p-3 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50 dark:bg-[#181b22] p-3.5 rounded border border-gray-200 dark:border-gray-800">
                  <div>
                    <span className="text-gray-400 text-[11px] font-medium">Thời gian thực hiện:</span>
                    <div className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                      {new Date(selectedLog.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] font-medium">Người thực hiện:</span>
                    <div className="font-medium text-gray-800 dark:text-gray-200 mt-0.5 truncate" title={selectedLog.user?.email || selectedLog.userId}>
                      {selectedLog.user?.name ? `${selectedLog.user.name} (${selectedLog.user.email || selectedLog.userId})` : (selectedLog.user?.email || selectedLog.userId || 'Hệ thống')}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] font-medium">Đối tượng tác động:</span>
                    <div className="font-semibold text-gray-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                      <EntityIcon type={selectedLog.entityType} size={14} className="text-[#5865f2]" />
                      <span>{modalDisplay.title}</span>
                    </div>
                    {modalDisplay.rawId && (
                      <div className="font-mono text-[10px] text-gray-400 mt-1 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded w-fit">
                        <span>UUID: {modalDisplay.rawId}</span>
                        <button
                          type="button"
                          onClick={(e) => handleCopy(e, modalDisplay.rawId, 'UUID')}
                          className="text-gray-400 hover:text-[#5865f2] transition-colors"
                          title="Sao chép UUID"
                        >
                          {copiedId === modalDisplay.rawId ? (
                            <Check size={11} className="text-emerald-500" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] font-medium">IP Client & Thiết bị:</span>
                    <div className="mt-1 flex items-center gap-2">
                      {renderIpBadge(selectedLog.ipAddress)}
                    </div>
                    {selectedLog.userAgent && (
                      <div className="text-[10px] font-mono text-gray-400 truncate mt-1" title={selectedLog.userAgent}>
                        Agent: {selectedLog.userAgent}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                      <FileCode size={14} className="text-[#5865f2]" /> Dữ liệu payload / thay đổi chi tiết:
                    </label>
                    {hasPayload && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={(e) => handleCopy(e, JSON.stringify(payloadData, null, 2), 'dữ liệu JSON')}
                        className="text-[11px] text-gray-400 hover:text-[#5865f2] h-6 px-2 gap-1"
                      >
                        <Copy size={11} /> Sao chép JSON
                      </Button>
                    )}
                  </div>
                  <pre className="p-3 bg-gray-950 text-emerald-400 dark:text-emerald-300 rounded border border-gray-800 text-[11px] font-mono overflow-x-auto max-h-72 custom-scrollbar">
                    {hasPayload
                      ? JSON.stringify(payloadData, null, 2)
                      : JSON.stringify({ message: 'Không có thông tin payload mở rộng cho bản ghi này' }, null, 2)}
                  </pre>
                </div>
              </ModalBody>

              <ModalFooter className="flex items-center justify-end w-full">
                <ModalButton variant="primary" onClick={() => setSelectedLog(null)} className="w-full sm:w-auto">
                  Đóng
                </ModalButton>
              </ModalFooter>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
};
