import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  FileText,
  Package,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  Zap,
  ZapOff,
  Download,
  Trash2,
  UploadCloud,
  Clock,
  Store,
  Warehouse,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useScanSessionStore, SessionItem } from '../../stores/scanSessionStore';
import { playSuccessSound, playErrorSound, playWarningSound } from '../../utils/sound';
import { SessionsHistoryModal } from './SessionsHistoryModal';
import { OrderDetailDrawer } from '../Orders/OrderDetailDrawer';
import { ordersApi } from '../../services/ordersApi';
import { fulfillmentApi } from '../../services/fulfillmentApi';
import { toast } from '../../components/ui/Toast';
import { Modal, ModalBody, ModalFooter, ModalButton } from '../../components/ui/Modal';
import { confirmModal } from '../../components/ui/ConfirmModal';

export const ScanOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedShopId, shops, setSelectedShopId, selectedWarehouseId, warehouses, setSelectedWarehouseId } =
    useWorkspaceStore();

  // Scan Session Store
  const {
    activeSessionId,
    loadSessionsFromStorage,
    getActiveSession,
    setActiveSession,
    addBarcodeToActiveSession,
    removeItemFromActiveSession,
    submitSession,
    isVerifyingBatch,
  } = useScanSessionStore();

  // Load sessions from localStorage on mount
  useEffect(() => {
    loadSessionsFromStorage();
  }, []);

  const activeSession = getActiveSession();

  // Auto select default warehouse if not selected
  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId, setSelectedWarehouseId]);

  // Focus mode / Fullscreen
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Camera state & Zoom (DEFAULT 2X)
  const [, setIsCameraActive] = useState<boolean>(false);
  const [isCameraPaused, setIsCameraPaused] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(2);
  const [scanFlash, setScanFlash] = useState<'success' | 'warning' | 'error' | null>(null);

  // Modals & Drawers
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'REVERSE' | 'DELETE';
    item: SessionItem;
  } | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  // Recent scan feedback banner
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{
    code: string;
    isDuplicate: boolean;
    timestamp: string;
  } | null>(null);

  // Refs
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCameraRunningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const lastScanTimeRef = useRef<number>(0);
  const lastDuplicateScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // List cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('sau') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment'),
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.warn('Could not list cameras:', err);
      });
  }, []);

  // Initialize camera directly on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [selectedCameraId, facingMode]);

  // Apply Zoom
  const applyZoom = async (newZoom: number) => {
    setZoom(newZoom);
    try {
      const videoEl = document.querySelector('#barcode-camera-reader video') as HTMLVideoElement;
      if (videoEl && videoEl.srcObject instanceof MediaStream) {
        const track = videoEl.srcObject.getVideoTracks()[0];
        const capabilities: any = track?.getCapabilities ? track.getCapabilities() : {};
        if (capabilities && capabilities.zoom) {
          const minZ = capabilities.zoom.min || 1;
          const maxZ = capabilities.zoom.max || 10;
          await track.applyConstraints({
            advanced: [{ zoom: Math.min(Math.max(newZoom, minZ), maxZ) } as any],
          });
        }
      }
    } catch {
      // Ignore hardware constraint failure
    }

    const videoEl = document.querySelector('#barcode-camera-reader video') as HTMLVideoElement;
    if (videoEl) {
      videoEl.style.transform = `scale(${newZoom})`;
      videoEl.style.transformOrigin = 'center center';
      videoEl.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  };

  const handleToggleZoom = () => {
    const zoomLevels = [1, 2, 3, 4];
    const currentIndex = zoomLevels.indexOf(zoom);
    const nextZoom = zoomLevels[(currentIndex + 1) % zoomLevels.length];
    applyZoom(nextZoom);
  };

  const startCamera = async () => {
    try {
      setCameraError('');
      if (scannerRef.current) {
        await stopCamera();
      }

      const container = document.getElementById('barcode-camera-reader');
      if (!container) return;

      const html5QrCode = new Html5Qrcode('barcode-camera-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });
      scannerRef.current = html5QrCode;

      const config = {
        fps: 25,
        aspectRatio: 1.33,
      };

      const cameraParam = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode };

      await html5QrCode.start(
        cameraParam,
        config,
        (decodedText) => {
          if (!isPausedRef.current) {
            handleIncomingBarcode(decodedText);
          }
        },
        () => {},
      );

      setIsCameraActive(true);
      setIsCameraPaused(false);
      isPausedRef.current = false;
      isCameraRunningRef.current = true;

      // Apply initial zoom 2x
      setTimeout(() => {
        applyZoom(2);
      }, 350);
    } catch (err) {
      console.warn('Cannot start camera:', err);
      setCameraError('Không thể mở camera. Vui lòng cấp quyền camera trong cài đặt trình duyệt.');
      setIsCameraActive(false);
      isCameraRunningRef.current = false;
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && isCameraRunningRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
      setIsCameraActive(false);
      isCameraRunningRef.current = false;
    }
  };

  const togglePauseCamera = async () => {
    const nextPaused = !isCameraPaused;
    setIsCameraPaused(nextPaused);
    isPausedRef.current = nextPaused;

    if (scannerRef.current && isCameraRunningRef.current) {
      try {
        if (nextPaused) {
          const state = (scannerRef.current as any).getState?.();
          // Html5QrcodeScannerState: SCANNING is 2
          if (state === 2 || state === undefined) {
            scannerRef.current.pause(true);
          }
        } else {
          const state = (scannerRef.current as any).getState?.();
          // Html5QrcodeScannerState: PAUSED is 3
          if (state === 3 || state === undefined) {
            scannerRef.current.resume();
          }
        }
      } catch (err) {
        console.warn('Toggle pause camera hardware stream:', err);
      }
    }

    if (nextPaused) {
      toast.info('Đã tạm dừng nhận mã quét');
    } else {
      toast.success('Đã tiếp tục quét mã');
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn(!torchOn);
    } catch {
      toast.warning('Thiết bị hoặc camera không hỗ trợ đèn flash');
    }
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    setSelectedCameraId('');
  };

  // CORE BATCH SCANNING HANDLER: Captures code into active session
  const handleIncomingBarcode = (rawText: string) => {
    if (isPausedRef.current) {
      return;
    }
    const raw = (rawText || '').trim();
    if (!raw) return;

    // Debounce rapid double trigger (within 700ms)
    const now = Date.now();
    if (now - lastScanTimeRef.current < 700) {
      return;
    }
    lastScanTimeRef.current = now;

    const res = addBarcodeToActiveSession(raw);
    const timestamp = new Date().toLocaleTimeString('vi-VN');

    if (res.isDuplicate) {
      // Prevent repeated duplicate alerts for the same barcode within 3 seconds
      const isSameDuplicateRecent =
        lastDuplicateScanRef.current.code === raw.toUpperCase() &&
        now - lastDuplicateScanRef.current.time < 3000;

      if (!isSameDuplicateRecent) {
        lastDuplicateScanRef.current = { code: raw.toUpperCase(), time: now };
        if (soundEnabled) playWarningSound();
        setScanFlash('warning');
        setTimeout(() => setScanFlash(null), 700);
      }

      setLastScannedFeedback({
        code: raw.toUpperCase(),
        isDuplicate: true,
        timestamp,
      });
    } else {
      lastDuplicateScanRef.current = { code: '', time: 0 };
      if (soundEnabled) playSuccessSound();
      setScanFlash('success');
      setTimeout(() => setScanFlash(null), 700);
      setLastScannedFeedback({
        code: raw.toUpperCase(),
        isDuplicate: false,
        timestamp,
      });
    }
  };

  // Background hardware USB / Bluetooth barcode scanner listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture if user is focusing a modal input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (isPausedRef.current) {
        buffer = '';
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 120) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          handleIncomingBarcode(buffer);
          buffer = '';
          e.preventDefault();
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [soundEnabled, activeSessionId]);

  // Primary action: Confirm & Verify Batch against Orders
  const handleSubmitBatch = async () => {
    if (!activeSession || activeSession.items.length === 0) {
      toast.warning('Phiên quét chưa có mã nào để gửi đối soát');
      return;
    }

    const pendingCount = activeSession.items.filter((i) => i.status === 'PENDING').length;
    if (pendingCount === 0 && activeSession.status === 'SUBMITTED') {
      const ok = await confirmModal({
        title: 'Đối soát lại phiên quét',
        message: 'Phiên quét này đã được gửi đối soát trước đó. Bạn có muốn gửi đối soát lại không?',
        description: 'Hệ thống sẽ kiểm tra lại toàn bộ trạng thái các đơn hàng trong phiên theo dữ liệu kho hiện tại.',
        confirmText: 'Gửi đối soát lại',
        variant: 'warning',
      });
      if (!ok) return;
    }

    try {
      toast.info(`Đang gửi ${activeSession.items.length} mã lên hệ thống để đối soát đơn hàng...`);
      const whId = selectedWarehouseId || warehouses[0]?.id;
      const res = await submitSession(activeSession.id, whId);

      if (res.success) {
        if (soundEnabled) playSuccessSound();
        toast.success(
          `Đối soát hoàn tất: ${res.summary.verified} đơn thành công, ${res.summary.alreadyVerified} đã xuất trước, ${res.summary.notFound} không tìm thấy`,
        );
      }
    } catch (err: any) {
      if (soundEnabled) playErrorSound();
      toast.error('Lỗi khi gửi đối soát', err.message || 'Vui lòng thử lại');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Đã sao chép: ${code}`);
  };

  const handleOpenOrderDetail = async (orderId?: string) => {
    if (!orderId || orderId === 'N/A') {
      navigate('/orders');
      return;
    }
    try {
      const res: any = await ordersApi.findAll({ search: orderId, limit: 1 });
      if (res?.data?.[0]) {
        setSelectedOrderForDrawer(res.data[0]);
        setIsDrawerOpen(true);
      } else {
        navigate(`/orders?search=${encodeURIComponent(orderId)}`);
      }
    } catch {
      navigate(`/orders?search=${encodeURIComponent(orderId)}`);
    }
  };

  // Action executor for confirmation modal (Reversal & Deletion)
  const handleExecuteConfirmAction = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'DELETE') {
      removeItemFromActiveSession(confirmAction.item.id);
      toast.success(`Đã xóa mã "${confirmAction.item.code}" khỏi phiên`);
      setConfirmAction(null);
      return;
    }

    if (confirmAction.type === 'REVERSE') {
      const { item } = confirmAction;
      if (!item.packageId) {
        toast.warning('Không tìm thấy thông tin kiện hàng để hoàn tác');
        setConfirmAction(null);
        return;
      }

      setIsActionLoading(true);
      try {
        toast.info(`Đang hoàn tác xuất kho mã "${item.code}"...`);
        await fulfillmentApi.reverseDispatch(item.packageId, 'Hủy đơn tại kho / Đổi kiện cho đơn khác');
        toast.success(`Đã hoàn tác mã "${item.code}", tồn kho đã được cộng lại!`);
        removeItemFromActiveSession(item.id);
        if (soundEnabled) playWarningSound();
        setConfirmAction(null);
      } catch (err: any) {
        toast.error('Lỗi hoàn tác', err.message || 'Không thể hoàn tác xuất kho');
      } finally {
        setIsActionLoading(false);
      }
    }
  };

  // Export current session CSV
  const handleExportCurrentSession = () => {
    if (!activeSession || activeSession.items.length === 0) {
      toast.warning('Chưa có mã quét nào trong phiên');
      return;
    }

    const headers = ['Mã vận đơn / Đơn hàng', 'Mã kiện', 'Gian hàng', 'Đơn vị VC', 'Trạng thái', 'Thời gian'];
    const rows = activeSession.items.map((s) => [
      s.code,
      s.packageCode || '',
      s.shopName || '',
      s.carrierName || '',
      s.status === 'VERIFIED'
        ? 'Thành công'
        : s.status === 'ALREADY_VERIFIED'
        ? 'Đã xuất trước'
        : s.status === 'NOT_FOUND'
        ? 'Không tìm thấy'
        : s.status === 'PENDING'
        ? 'Chờ đối soát'
        : 'Lỗi',
      s.scannedAt,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c || ''}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `phien_quet_${activeSession.sessionCode}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã tải danh sách mã quét');
  };

  const pendingItemsCount = (activeSession?.items || []).filter((i) => i.status === 'PENDING').length;
  const verifiedItemsCount = (activeSession?.items || []).filter((i) => i.status === 'VERIFIED').length;
  const displayedItems = activeSession?.items || [];

  // Clean session title: "Phiên quét #1 (01:41 17-10)" -> "Phiên Quét 1"
  const formatSessionTitle = (rawName?: string) => {
    if (!rawName) return 'Phiên Quét 1';
    const match = rawName.match(/phiên\s+quét\s+#?(\d+)/i);
    if (match) {
      return `Phiên Quét ${match[1]}`;
    }
    return rawName.replace(/\s*\(\d{2}:\d{2}\s+\d{2}[-/]\d{2}\)/i, '').trim();
  };

  const formattedStartTime = activeSession
    ? new Date(activeSession.createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }) +
      ', ' +
      new Date(activeSession.createdAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      })
    : '--:--, --/--';

  return (
    <div
      className={`w-full ${
        isFocusMode
          ? 'fixed inset-0 z-50 bg-[#0c0e14] p-3 sm:p-5 overflow-y-auto max-w-none'
          : 'max-w-xl lg:max-w-none mx-auto pb-16'
      } flex flex-col space-y-3 lg:space-y-4 animate-in fade-in duration-300`}
    >
      {/* 1. TOP HEADER NAVIGATION */}
      <div className="flex items-center justify-between gap-3 shrink-0 pt-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0 shadow-xs"
            title="Quay lại"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
              Quét xuất hàng
            </h1>
            <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Trạm quét & Đối soát xuất kho
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFocusMode(!isFocusMode)}
            className="h-8 px-2.5 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0 shadow-xs text-xs font-semibold"
            title={isFocusMode ? 'Thu nhỏ' : 'Toàn màn hình'}
          >
            {isFocusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            <span className="hidden sm:inline">{isFocusMode ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        </div>
      </div>

      {/* 2-COLUMN RESPONSIVE LAYOUT CONTAINER (Mobile: stacked, Desktop PC: 2 columns full width) */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-4 xl:gap-5 lg:items-start space-y-3 lg:space-y-0">
        {/* LEFT COLUMN: SCANNING STATION & HARDWARE CONTROLS (lg:col-span-5 xl:col-span-5 space-y-3) */}
        <div className="flex flex-col space-y-3 lg:col-span-5 xl:col-span-5">
          {/* 2. SHOP & KHO DROPDOWN SELECTORS */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Shop Selector Card */}
            <div className="relative p-2.5 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Store size={15} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">Shop</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white block leading-tight truncate">
                    {selectedShopId === 'ALL'
                      ? 'Tất cả shop'
                      : shops.find((s) => s.id === selectedShopId)?.name || 'Tất cả shop'}
                  </span>
                </div>
              </div>
              <ChevronDown size={13} className="text-gray-400 shrink-0 pointer-events-none" />
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Chọn Shop"
              >
                <option value="ALL">Tất cả shop</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse Selector Card */}
            <div className="relative p-2.5 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Warehouse size={15} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">Kho</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white block leading-tight truncate">
                    {warehouses.find((w) => w.id === selectedWarehouseId)?.name || 'Kho tổng'}
                  </span>
                </div>
              </div>
              <ChevronDown size={13} className="text-gray-400 shrink-0 pointer-events-none" />
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Chọn Kho"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. ACTIVE SESSION STATUS & 3 METRIC PILLS */}
          <div className="p-3 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs space-y-2.5">
            {/* Session Info Line */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#3b82f6] flex items-center justify-center shrink-0 border border-[#2563eb]/20">
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                      {formatSessionTitle(activeSession?.name)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Sẵn sàng
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate">
                    {activeSession?.sessionCode} • Bắt đầu {formattedStartTime}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-xs text-[#2563eb] dark:text-[#3b82f6] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer shrink-0"
              >
                <span>Đổi phiên</span>
                <ChevronRight size={13} />
              </button>
            </div>

            {/* 3 Metric Pills */}
            <div className="grid grid-cols-3 gap-2">
              {/* Đã quét */}
              <div className="p-2 rounded bg-gray-50 dark:bg-[#1c2230] border border-gray-100 dark:border-gray-800/80 flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-500/10 dark:bg-blue-500/15 text-blue-500 dark:text-blue-400 grid place-items-center shrink-0">
                  <ScanLine size={14} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate leading-tight">
                    Đã quét
                  </span>
                  <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-mono leading-none">
                    {activeSession?.items.length || 0}
                  </span>
                </div>
              </div>

              {/* Chờ đối soát */}
              <div className="p-2 rounded bg-gray-50 dark:bg-[#1c2230] border border-gray-100 dark:border-gray-800/80 flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-amber-500/10 dark:bg-amber-500/15 text-amber-500 dark:text-amber-400 grid place-items-center shrink-0">
                  <Clock size={14} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate leading-tight">
                    Chờ đối soát
                  </span>
                  <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 font-mono leading-none">
                    {pendingItemsCount}
                  </span>
                </div>
              </div>

              {/* Thành công */}
              <div className="p-2 rounded bg-gray-50 dark:bg-[#1c2230] border border-gray-100 dark:border-gray-800/80 flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 grid place-items-center shrink-0">
                  <CheckCircle2 size={14} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate leading-tight">
                    Thành công
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono leading-none">
                    {verifiedItemsCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. CAMERA VIEWFINDER & LIVE SCANNER */}
          <div
            className={`rounded bg-black border overflow-hidden relative shadow-md transition-all duration-300 ${
              scanFlash === 'success'
                ? 'border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/60'
                : scanFlash === 'warning'
                ? 'border-amber-500 shadow-[0_0_24px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/60'
                : scanFlash === 'error'
                ? 'border-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.35)] ring-2 ring-rose-500/60'
                : 'border-gray-800'
            }`}
          >
            <style>{`
              #barcode-camera-reader #qr-shaded-region,
              #barcode-camera-reader svg,
              #barcode-camera-reader path {
                display: none !important;
              }
              #barcode-camera-reader {
                border: none !important;
                width: 100% !important;
                height: 100% !important;
              }
              #barcode-camera-reader video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
              }
              @keyframes laserSweepBeam {
                0% { top: 6%; opacity: 0.8; }
                50% { top: 92%; opacity: 1; }
                100% { top: 6%; opacity: 0.8; }
              }
              .laser-sweep-beam-active {
                animation: laserSweepBeam 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
            `}</style>

            {/* Viewport Box */}
            <div className="relative w-full h-[260px] sm:h-[300px] lg:h-[320px] bg-black overflow-hidden flex items-center justify-center">
              <div id="barcode-camera-reader" className="w-full h-full" />

              {/* Center Target Box */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="relative w-[82%] max-w-[320px] h-[130px] sm:h-[150px]">
                  {/* Laser beam */}
                  {!isCameraPaused && (
                    <div className="laser-sweep-beam-active absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent shadow-[0_0_12px_#3b82f6]" />
                  )}

                  {/* 4 Glowing Corner Angles */}
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-[3.5px] border-l-[3.5px] border-[#3b82f6] rounded-tl shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-[3.5px] border-r-[3.5px] border-[#3b82f6] rounded-tr shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-[3.5px] border-l-[3.5px] border-[#3b82f6] rounded-bl shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-[3.5px] border-r-[3.5px] border-[#3b82f6] rounded-br shadow-[0_0_8px_rgba(59,130,246,0.6)]" />

                  {/* Centered Instruction Pill */}
                  <div className="absolute -bottom-7 inset-x-0 flex justify-center">
                    <span className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-md text-[11px] font-medium text-white shadow-md border border-white/10">
                      {isCameraPaused ? 'Quét đang tạm dừng' : 'Đưa mã vận đơn vào khung'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pause Overlay */}
              {isCameraPaused && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-[3px] flex flex-col items-center justify-center text-center z-25 space-y-3 p-4 pointer-events-auto">
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
                    <Pause size={26} className="fill-current" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-white">Đang tạm dừng quét barcode</div>
                    <div className="text-xs text-gray-300 max-w-xs leading-relaxed">
                      Đã khóa nhận diện từ camera và máy quét mã vạch.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={togglePauseCamera}
                    className="mt-1 px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/25 active:scale-95 transition-all"
                  >
                    <Play size={14} className="fill-current" />
                    <span>Tiếp tục quét</span>
                  </button>
                </div>
              )}

              {/* Top Floating Controls */}
              <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-20 pointer-events-auto">
                {/* Camera Mode Badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white text-[11px] font-medium shadow-xs">
                  <span className={`w-1.5 h-1.5 rounded-full ${isCameraPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                  <span>{isCameraPaused ? 'Đang tạm dừng' : (facingMode === 'environment' ? 'Camera sau' : 'Camera trước')}</span>
                </div>

                {/* Zoom & Torch Buttons */}
                <div className="flex items-center gap-1.5">
                  {/* Zoom button */}
                  <button
                    type="button"
                    onClick={handleToggleZoom}
                    className="w-7 h-7 rounded-full bg-black/70 text-white border border-white/20 flex items-center justify-center font-mono text-[11px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer backdrop-blur-md"
                    title={`Thu phóng: ${zoom}x. Bấm để đổi`}
                  >
                    {zoom}x
                  </button>

                  {/* Torch button */}
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`w-7 h-7 rounded-full flex items-center justify-center border backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-xs ${
                      torchOn
                        ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                        : 'bg-black/70 text-white border-white/20 hover:bg-black/90'
                    }`}
                    title={torchOn ? 'Tắt đèn Flash' : 'Bật đèn Flash'}
                  >
                    {torchOn ? <Zap size={13} className="fill-current" /> : <ZapOff size={13} />}
                  </button>
                </div>
              </div>

              {/* Camera Error Alert */}
              {cameraError && (
                <div className="absolute inset-0 bg-black/90 p-5 flex flex-col items-center justify-center text-center z-30 space-y-3">
                  <AlertTriangle size={30} className="text-amber-500" />
                  <p className="text-xs text-gray-300 max-w-sm">{cameraError}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-1.5 rounded bg-[#2563eb] text-white text-xs font-semibold cursor-pointer"
                  >
                    Thử lại camera
                  </button>
                </div>
              )}
            </div>

            {/* 3 Camera Toolbar Buttons */}
            <div className="grid grid-cols-3 gap-1.5 p-2 bg-[#12151e] border-t border-gray-800 text-xs font-semibold">
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="flex items-center justify-center gap-1.5 py-2 rounded bg-[#1c2230] text-gray-200 hover:text-white active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Đổi camera</span>
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded border transition-all cursor-pointer active:scale-95 ${
                  soundEnabled
                    ? 'bg-[#1c2230] border-gray-700/80 text-gray-200'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
              >
                {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span>Âm thanh</span>
              </button>
              <button
                type="button"
                onClick={togglePauseCamera}
                className={`flex items-center justify-center gap-1.5 py-2 rounded border transition-all cursor-pointer active:scale-95 ${
                  isCameraPaused
                    ? 'bg-amber-500 text-white border-amber-400 shadow-sm shadow-amber-500/25 font-semibold'
                    : 'bg-[#2563eb] text-white border-blue-400 shadow-sm shadow-blue-500/20'
                }`}
              >
                {isCameraPaused ? <Play size={13} className="fill-current" /> : <Pause size={13} className="fill-current" />}
                <span>{isCameraPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
              </button>
            </div>
          </div>

          {/* 5. LIVE STATUS BANNER */}
          <div className="p-2.5 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-2.5">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                isCameraPaused
                  ? 'bg-amber-400'
                  : lastScannedFeedback
                  ? lastScannedFeedback.isDuplicate
                    ? 'bg-amber-400'
                    : 'bg-emerald-400 animate-ping'
                  : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-900 dark:text-white">
                {isCameraPaused ? (
                  <span className="text-amber-500 dark:text-amber-400">
                    Đang tạm dừng quét barcode (Bấm &apos;Tiếp tục&apos; để nhận mã)
                  </span>
                ) : lastScannedFeedback ? (
                  lastScannedFeedback.isDuplicate ? (
                    <span className="text-amber-500 dark:text-amber-400">
                      Mã đã có trong phiên (Trùng lặp) • {lastScannedFeedback.code}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Đã thêm mã vào phiên • {lastScannedFeedback.code}
                    </span>
                  )
                ) : (
                  'Sẵn sàng nhận mã tiếp theo'
                )}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {isCameraPaused
                  ? 'Máy quét phần cứng và camera đang tạm khóa. Không có mã nào được thêm vào phiên.'
                  : lastScannedFeedback
                  ? `Quét lúc ${lastScannedFeedback.timestamp} • Sẵn sàng quét mã tiếp theo.`
                  : 'Hỗ trợ máy quét mã vạch USB/2D & Camera. Kết quả hiển thị tức thì.'}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SESSION LEDGER & DISPATCH ACTIONS (lg:col-span-7 xl:col-span-7 space-y-3) */}
        <div className="flex flex-col space-y-3 lg:col-span-7 xl:col-span-7">
          {/* MOBILE VIEW (< lg): PRESERVE EXACT ACTION BUTTONS & COMPACT CARD LIST */}
          <div className="lg:hidden space-y-3">
            {/* 6. ACTION BUTTONS: TẢI XUỐNG & GỬI ĐỐI SOÁT */}
            <div className="flex items-center gap-2 pt-0.5">
              {/* Nút Tải xuống / Xuất CSV */}
              <button
                type="button"
                onClick={handleExportCurrentSession}
                disabled={!activeSession || activeSession.items.length === 0}
                className="h-9 px-3.5 rounded bg-white dark:bg-[#161a23] hover:bg-gray-50 dark:hover:bg-[#1c2230] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 active:scale-95 shrink-0 shadow-xs"
                title="Tải danh sách mã quét CSV"
              >
                <Download size={14} className="text-[#2563eb] dark:text-blue-400" />
                <span>Tải xuống</span>
              </button>

              {/* Nút Gửi đối soát */}
              <button
                type="button"
                onClick={handleSubmitBatch}
                disabled={!activeSession || activeSession.items.length === 0 || isVerifyingBatch}
                className="flex-1 h-9 px-4 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                {isVerifyingBatch ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Đang gửi đối soát...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={15} />
                    <span>Gửi đối soát ({activeSession?.items.length || 0})</span>
                  </>
                )}
              </button>
            </div>

            {/* 7. SESSION RESULTS LIST FOR MOBILE */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                    Kết quả phiên
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#3b82f6] font-mono">
                    {activeSession?.items.length || 0}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="text-xs text-[#2563eb] dark:text-[#3b82f6] hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Xem tất cả</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Empty state or list */}
              {displayedItems.length === 0 ? (
                <div className="p-6 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 text-center space-y-2 shadow-xs">
                  <div className="w-10 h-10 mx-auto rounded bg-gray-100 dark:bg-gray-800/60 text-gray-400 dark:text-gray-400 grid place-items-center">
                    <Package size={22} className="stroke-[1.5]" />
                  </div>
                  <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Chưa có mã nào được quét
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Quét mã trên kiện hàng để bắt đầu.
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5 custom-scrollbar">
                  {displayedItems.map((item, index) => {
                    const isVerified = item.status === 'VERIFIED';
                    const isAlreadyVerified = item.status === 'ALREADY_VERIFIED';
                    const isNotFound = item.status === 'NOT_FOUND';

                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 flex items-start gap-2 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                      >
                        <span className="font-mono text-xs font-bold text-gray-400 w-5 text-right shrink-0 pt-0.5">
                          #{displayedItems.length - index}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* Hàng 1: Mã vận đơn (Trái) & Trạng thái + Nút Hoàn tác + Nút Xóa (Phải) */}
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              onClick={() => handleCopyCode(item.code)}
                              className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate cursor-pointer hover:text-[#2563eb]"
                              title="Bấm để sao chép"
                            >
                              {item.code}
                            </span>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.isVirtual && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border shrink-0 ${
                                    !item.isRealGoods
                                      ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                      : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                  }`}
                                  title={!item.isRealGoods ? 'Đơn ảo không đi hàng thật: không trừ kho sản phẩm' : 'Đơn ảo có đi hàng thật: đã trừ kho sản phẩm'}
                                >
                                  Đơn ảo {!item.isRealGoods ? '(K.trừ kho)' : '(Hàng thật)'}
                                </span>
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border shrink-0 ${
                                  isVerified
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : isAlreadyVerified
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    : isNotFound || item.status === 'ERROR'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                }`}
                              >
                                {isVerified
                                  ? 'Thành công'
                                  : isAlreadyVerified
                                  ? 'Đã xuất trước'
                                  : isNotFound
                                  ? 'Không tìm thấy'
                                  : item.status === 'ERROR'
                                  ? 'Lỗi đối soát'
                                  : 'Chờ đối soát'}
                              </span>

                              {(isVerified || isAlreadyVerified) && item.packageId && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'REVERSE', item })}
                                  className="h-6 px-1.5 rounded flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer shrink-0"
                                  title="Hoàn tác xuất kho (cộng lại tồn kho)"
                                >
                                  <RotateCcw size={11} />
                                  <span>Hoàn tác</span>
                                </button>
                              )}

                              {!isVerified && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'DELETE', item })}
                                  className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
                                  title="Xóa mã này khỏi phiên"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Hàng 2: Thời gian & Mô tả (Trái) & Nút Xem đơn (Phải) */}
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 truncate min-w-0">
                              <span className="font-mono text-[10px] text-gray-400 shrink-0">{item.scannedAt}</span>
                              <span className="text-gray-300 dark:text-gray-700 shrink-0">•</span>
                              <span className="truncate">
                                {item.message || (item.status === 'PENDING' ? 'Chờ đối soát' : 'Đã đối soát')}
                              </span>
                            </div>

                            {item.orderId && (
                              <button
                                type="button"
                                onClick={() => handleOpenOrderDetail(item.orderId)}
                                className="text-[#2563eb] hover:underline font-semibold text-[11px] shrink-0 flex items-center gap-0.5 cursor-pointer ml-auto"
                              >
                                <span>Xem đơn</span>
                                <span>→</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* DESKTOP PC VIEW (>= lg): EXPANDED FULL-WIDTH WORKSTATION LEDGER TABLE */}
          <div className="hidden lg:flex lg:flex-col space-y-3">
            {/* Desktop Action & Header Bar */}
            <div className="p-3 rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
                  <span>Danh sách mã đã quét</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-[#2563eb] dark:text-[#3b82f6] font-mono shrink-0">
                    {activeSession?.items.length || 0}
                  </span>
                </h3>
                <span className="text-xs text-gray-400 font-mono hidden xl:inline shrink-0">
                  • Phiên: {activeSession?.sessionCode}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportCurrentSession}
                  disabled={!activeSession || activeSession.items.length === 0}
                  className="h-8 px-3 rounded bg-white dark:bg-[#1c2230] hover:bg-gray-50 dark:hover:bg-[#232a3b] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 shadow-xs active:scale-95"
                  title="Tải danh sách mã quét CSV"
                >
                  <Download size={13} className="text-[#2563eb] dark:text-blue-400" />
                  <span>Xuất CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleSubmitBatch}
                  disabled={!activeSession || activeSession.items.length === 0 || isVerifyingBatch}
                  className="h-8 px-4 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  {isVerifyingBatch ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Đang gửi đối soát...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      <span>Gửi đối soát ({activeSession?.items.length || 0})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(true)}
                  className="h-8 px-2.5 rounded bg-gray-50 dark:bg-[#1c2230] hover:bg-gray-100 dark:hover:bg-[#232a3b] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="Xem lịch sử các phiên quét"
                >
                  <span>Lịch sử phiên</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="rounded bg-white dark:bg-[#161a23] border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden flex flex-col">
              {displayedItems.length === 0 ? (
                <div className="py-20 text-center space-y-3 p-6">
                  <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 dark:bg-gray-800/80 text-gray-400 grid place-items-center">
                    <Package size={26} className="stroke-[1.5]" />
                  </div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Chưa có mã nào được quét trong phiên này
                  </div>
                  <div className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                    Sử dụng súng quét mã vạch cầm tay (USB/Bluetooth) hoặc đưa mã vận đơn vào khung camera để bắt đầu nhận diện tự động.
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[calc(100vh-270px)] min-h-[440px] custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/90 dark:bg-[#12151e] text-gray-500 dark:text-gray-400 font-semibold sticky top-0 z-10 border-b border-gray-200/80 dark:border-gray-800 backdrop-blur-xs">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">STT</th>
                        <th className="py-2.5 px-3 min-w-[170px]">Mã vận đơn / Kiện</th>
                        <th className="py-2.5 px-3 w-24 whitespace-nowrap">Thời gian</th>
                        <th className="py-2.5 px-3 w-32 whitespace-nowrap">Trạng thái</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Diễn giải đối soát</th>
                        <th className="py-2.5 px-3 w-28 text-right whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                      {displayedItems.map((item, index) => {
                        const isVerified = item.status === 'VERIFIED';
                        const isAlreadyVerified = item.status === 'ALREADY_VERIFIED';
                        const isNotFound = item.status === 'NOT_FOUND';

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-gray-50/70 dark:hover:bg-[#1c2230]/50 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-gray-400 text-[11px]">
                              #{displayedItems.length - index}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  onClick={() => handleCopyCode(item.code)}
                                  className="font-mono font-bold text-xs text-gray-900 dark:text-white cursor-pointer hover:text-[#2563eb] select-all"
                                  title="Bấm để sao chép"
                                >
                                  {item.code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(item.code)}
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                                  title="Sao chép mã"
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                              {item.scannedAt}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                  isVerified
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : isAlreadyVerified
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    : isNotFound || item.status === 'ERROR'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                }`}
                              >
                                {isVerified
                                  ? 'Thành công'
                                  : isAlreadyVerified
                                  ? 'Đã xuất trước'
                                  : isNotFound
                                  ? 'Không tìm thấy'
                                  : item.status === 'ERROR'
                                  ? 'Lỗi đối soát'
                                  : 'Chờ đối soát'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">
                              <div className="truncate max-w-md">
                                {item.message || (item.status === 'PENDING' ? 'Chờ gửi đối soát hệ thống' : 'Đã xử lý')}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {item.orderId && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOrderDetail(item.orderId)}
                                    className="px-2 py-1 rounded bg-[#2563eb]/10 hover:bg-[#2563eb]/20 text-[#2563eb] dark:text-blue-400 text-[11px] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                    title="Xem chi tiết đơn hàng"
                                  >
                                    <span>Xem đơn</span>
                                    <ExternalLink size={10} />
                                  </button>
                                )}
                                {(isVerified || isAlreadyVerified) && item.packageId && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmAction({ type: 'REVERSE', item })}
                                    className="px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-[11px] font-semibold border border-rose-200 dark:border-rose-900/40 transition-colors cursor-pointer inline-flex items-center gap-1"
                                    title="Hoàn tác xuất kho (cộng lại tồn kho)"
                                  >
                                    <RotateCcw size={10} />
                                    <span>Hoàn tác</span>
                                  </button>
                                )}
                                {!isVerified && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmAction({ type: 'DELETE', item })}
                                    className="p-1 rounded text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                    title="Xóa mã này khỏi phiên"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SESSIONS HISTORY MODAL */}
      <SessionsHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectSessionToScan={(session) => {
          setActiveSession(session.id);
          toast.info(`Đang mở: ${session.name}`);
        }}
        onOpenOrderDetail={handleOpenOrderDetail}
      />

      {/* ORDER DETAIL DRAWER */}
      <OrderDetailDrawer
        order={selectedOrderForDrawer}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onRefresh={() => {}}
      />

      {/* ACTION CONFIRMATION MODAL (System UI/UX) */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => !isActionLoading && setConfirmAction(null)}
        maxWidth="max-w-md"
        size="sm"
        mobilePlacement="bottom"
      >
        <ModalBody className="p-4 sm:p-5 space-y-3">
          {confirmAction?.type === 'REVERSE' ? (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                  <RotateCcw size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    Xác nhận hoàn tác xuất kho
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Bạn có chắc chắn muốn hoàn tác xuất kho cho mã{' '}
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                      "{confirmAction.item.code}"
                    </span>
                    ?
                  </p>
                </div>
              </div>

              <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Lưu ý về tồn kho</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                  Số lượng sản phẩm trong kiện sẽ được <strong>cộng hoàn trả lại vào tồn kho thực tế</strong> ngay lập tức và ghi nhận vào sổ cái kho.
                </p>
              </div>

              {confirmAction.item.carrierName && (
                <div className="p-2.5 rounded bg-gray-50 dark:bg-[#1a1d26] border border-gray-100 dark:border-gray-800 text-xs flex items-center justify-between text-gray-600 dark:text-gray-300">
                  <span>Đơn vị vận chuyển:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {confirmAction.item.carrierName}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                  <Trash2 size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    Xóa mã khỏi phiên quét
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Bạn có chắc chắn muốn xóa mã{' '}
                    <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                      "{confirmAction?.item.code}"
                    </span>{' '}
                    khỏi danh sách phiên quét hiện tại?
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1a1d26] p-2.5 rounded border border-gray-100 dark:border-gray-800">
                Thao tác này chỉ gỡ bỏ mã khỏi phiên quét trên thiết bị này, không làm thay đổi trạng thái đơn hàng trên sàn.
              </p>
            </>
          )}
        </ModalBody>

        <ModalFooter className="px-4 py-3">
          <ModalButton
            variant="outline"
            onClick={() => setConfirmAction(null)}
            disabled={isActionLoading}
          >
            Hủy bỏ
          </ModalButton>

          <ModalButton
            variant="danger"
            onClick={handleExecuteConfirmAction}
            loading={isActionLoading}
          >
            {confirmAction?.type === 'REVERSE' ? 'Xác nhận hoàn tác' : 'Xóa khỏi phiên'}
          </ModalButton>
        </ModalFooter>
      </Modal>
    </div>
  );
};
