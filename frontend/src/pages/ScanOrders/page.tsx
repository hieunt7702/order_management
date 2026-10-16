import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  FileText,
  Package,
  Search,
  Maximize2,
  Minimize2,
  Copy,
  Pause,
  Play,
  Camera,
  Keyboard,
  ChevronRight,
  RefreshCw,
  Zap,
  ZapOff,
  Download,
  Trash2,
  Eye,
  Building2,
  UploadCloud,
  ArrowRight,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useScanSessionStore, ScanSession, SessionItem } from '../../stores/scanSessionStore';
import { playSuccessSound, playErrorSound, playWarningSound } from '../../utils/sound';
import { SessionsHistoryModal } from './SessionsHistoryModal';
import { OrderDetailDrawer } from '../Orders/OrderDetailDrawer';
import { ordersApi } from '../../services/ordersApi';
import { toast } from '../../components/ui/Toast';
import { Select } from '../../components/ui/Select';

export const ScanOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedWarehouseId, warehouses, setSelectedWarehouseId } = useWorkspaceStore();

  // Scan Session Store
  const {
    sessions,
    activeSessionId,
    loadSessionsFromStorage,
    getActiveSession,
    createNewSession,
    setActiveSession,
    addBarcodeToActiveSession,
    removeItemFromActiveSession,
    clearActiveSessionItems,
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

  // Tab & Input modes
  const [activeInputTab, setActiveInputTab] = useState<'camera' | 'manual'>('camera');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Camera state & Zoom (DEFAULT 2X)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isCameraPaused, setIsCameraPaused] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(2);
  const [scanFlash, setScanFlash] = useState<'success' | 'warning' | 'error' | null>(null);

  // Modals & Drawers
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [selectedOrderForDrawer, setSelectedOrderForDrawer] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Recent scan feedback banner
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{
    code: string;
    isDuplicate: boolean;
    timestamp: string;
  } | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCameraRunningRef = useRef<boolean>(false);
  const lastScanTimeRef = useRef<number>(0);
  const lastDuplicateScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Auto focus input
  useEffect(() => {
    if (activeInputTab === 'manual') {
      focusInput();
    }
  }, [activeInputTab]);

  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  };

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

  // Initialize camera
  useEffect(() => {
    if (activeInputTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [selectedCameraId, facingMode, activeInputTab]);

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
          handleIncomingBarcode(decodedText);
        },
        () => {},
      );

      setIsCameraActive(true);
      setIsCameraPaused(false);
      isCameraRunningRef.current = true;

      // Apply initial zoom 2x
      setTimeout(() => {
        applyZoom(2);
      }, 350);
    } catch (err) {
      console.warn('Cannot start camera:', err);
      setCameraError(
        'Không thể mở camera. Vui lòng cấp quyền truy cập Camera cho trình duyệt hoặc chuyển sang tab Nhập mã.',
      );
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
    if (!scannerRef.current) return;
    try {
      if (isCameraPaused) {
        scannerRef.current.resume();
        setIsCameraPaused(false);
      } else {
        scannerRef.current.pause();
        setIsCameraPaused(true);
      }
    } catch (err) {
      console.warn('Toggle pause camera failed:', err);
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !isCameraActive) return;
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

  // CORE BATCH SCANNING HANDLER: Captures code into active session without immediate order approval
  const handleIncomingBarcode = (rawText: string) => {
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
      // Prevent repeated duplicate alerts/sounds for the same barcode within 3 seconds
      const isSameDuplicateRecent =
        lastDuplicateScanRef.current.code === raw.toUpperCase() &&
        now - lastDuplicateScanRef.current.time < 3000;

      if (!isSameDuplicateRecent) {
        lastDuplicateScanRef.current = { code: raw.toUpperCase(), time: now };
        if (soundEnabled) playWarningSound();
        setScanFlash('warning');
        setTimeout(() => setScanFlash(null), 700);
        // Use fixed ID so duplicate warning replaces previous toast instead of stacking multiple rows
        toast.show({
          id: 'scan-duplicate-warning',
          type: 'warning',
          title: `Mã "${raw}" đã có trong phiên này!`,
          duration: 2200,
        });
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

  const handleManualScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    lastDuplicateScanRef.current = { code: '', time: 0 };
    handleIncomingBarcode(code);
    setBarcodeInput('');
    focusInput();
  };

  // Primary action: Confirm & Verify Batch against Orders
  const handleSubmitBatch = async () => {
    if (!activeSession || activeSession.items.length === 0) {
      toast.warning('Phiên quét chưa có mã nào để gửi đối soát');
      return;
    }

    const pendingCount = activeSession.items.filter((i) => i.status === 'PENDING').length;
    if (
      pendingCount === 0 &&
      activeSession.status === 'SUBMITTED' &&
      !confirm('Phiên này đã đối soát rồi. Bạn có muốn gửi đối soát lại không?')
    ) {
      return;
    }

    try {
      toast.info(`Đang gửi ${activeSession.items.length} mã lên hệ thống để đối soát đơn hàng...`);
      const whId = selectedWarehouseId || warehouses[0]?.id;
      const res = await submitSession(activeSession.id, whId);

      if (res.success) {
        if (soundEnabled) playSuccessSound();
        toast.success(
          `Đối soát hoàn tất: ${res.summary.verified} đơn thành công, ${res.summary.alreadyVerified} trùng, ${res.summary.notFound} không tìm thấy`,
        );
      }
    } catch (err: any) {
      if (soundEnabled) playErrorSound();
      toast.error('Lỗi khi gửi đối soát', err.message || 'Vui lòng thử lại');
    }
  };

  const handleCreateNewSessionClick = () => {
    const fresh = createNewSession(undefined, selectedWarehouseId || undefined);
    toast.success(`Đã tạo ${fresh.name}`);
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
        ? 'Đã quét trước'
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
    toast.success('Đã xuất danh sách mã quét');
  };

  // Filter items in session
  const displayedItems = (activeSession?.items || []).filter(
    (item) =>
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.orderId && item.orderId.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const pendingItemsCount = (activeSession?.items || []).filter((i) => i.status === 'PENDING').length;
  const verifiedItemsCount = (activeSession?.items || []).filter((i) => i.status === 'VERIFIED').length;
  const issuesItemsCount = (activeSession?.items || []).filter(
    (i) => i.status === 'NOT_FOUND' || i.status === 'ALREADY_VERIFIED' || i.status === 'ERROR',
  ).length;

  return (
    <div
      className={`w-full flex flex-col space-y-3 sm:space-y-4 animate-in fade-in duration-300 pb-36 sm:pb-40 ${
        isFocusMode ? 'fixed inset-0 z-50 bg-[#0c0e14] p-3 sm:p-5 overflow-y-auto' : ''
      }`}
    >
      {/* 1. TOP HEADER & SESSION SELECTOR */}
      <div className="flex items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#5865f2]/10 border border-[#5865f2]/20 text-[#5865f2] flex items-center justify-center shrink-0">
            <ScanLine size={19} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                Quét xuất hàng
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                Sẵn sàng
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate hidden sm:block">
              Gom mã trong phiên, sau đó bấm Xác nhận để đối soát đơn hàng.
            </p>
          </div>
        </div>

        {/* Mobile Fullscreen Button */}
        <button
          type="button"
          onClick={() => setIsFocusMode(!isFocusMode)}
          className="sm:hidden w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-white shrink-0"
          title={isFocusMode ? 'Thu nhỏ' : 'Toàn màn hình'}
        >
          {isFocusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* 2. ACTIVE SESSION STATUS CARD & STATS */}
      <div className="p-3 sm:p-4 rounded-lg bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#5865f2]/10 text-[#5865f2] flex items-center justify-center shrink-0 border border-[#5865f2]/20">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                  {activeSession?.name || 'Phiên quét'}
                </span>
                <span className="font-mono text-xs text-gray-400 font-bold">
                  ({activeSession?.sessionCode})
                </span>
                {/* Status icon only with color - no text label to break layout */}
                {activeSession?.status === 'DRAFT' ? (
                  <span
                    title="Đang quét dở"
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0"
                  >
                    <Clock size={11} className="stroke-[2.5]" />
                  </span>
                ) : (
                  <span
                    title="Đã đối soát"
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shrink-0"
                  >
                    <CheckCircle2 size={12} className="stroke-[2.5]" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
                <Clock size={11} className="shrink-0" />
                <span>
                  Bắt đầu lúc{' '}
                  {activeSession
                    ? new Date(activeSession.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--:--'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Session Switcher Dropdown */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="text-xs text-[#2563eb] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Đổi phiên khác</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="p-2 sm:p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <ScanLine size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 block truncate">
                Đã quét
              </span>
              <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-tight font-mono">
                {activeSession?.items.length || 0}
              </span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Clock size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 block truncate">
                Chờ đối soát
              </span>
              <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 leading-tight font-mono">
                {pendingItemsCount}
              </span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 size={14} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 block truncate">
                Thành công
              </span>
              <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 leading-tight font-mono">
                {verifiedItemsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE: Camera & Input on Left / Live List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1 min-h-0">
        {/* LEFT COLUMN: Camera & Scanner Controls (7 cols on PC) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          {/* Input Mode Selector Bar */}
          <div className="p-1 bg-gray-100 dark:bg-[#1a1e2b] rounded-lg border border-gray-200 dark:border-gray-800 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setActiveInputTab('camera')}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeInputTab === 'camera'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-white'
              }`}
            >
              <Camera size={14} />
              <span>Camera Barcode</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveInputTab('manual')}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeInputTab === 'manual'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-white'
              }`}
            >
              <Keyboard size={14} />
              <span>Máy quét USB / Nhập tay</span>
            </button>
          </div>

          {/* CAMERA VIEWPORT - EXPANDED & WIDENED ON MOBILE */}
          {activeInputTab === 'camera' && (
            <div
              className={`rounded-lg bg-black border overflow-hidden relative transition-all duration-300 ${
                scanFlash === 'success'
                  ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)] ring-2 ring-emerald-500/60'
                  : scanFlash === 'warning'
                  ? 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.4)] ring-2 ring-amber-500/60'
                  : scanFlash === 'error'
                  ? 'border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)] ring-2 ring-rose-500/60'
                  : 'border-gray-800'
              }`}
            >
              {/* CSS for camera display & laser beam */}
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

              {/* Viewport Box (Generous Height and Width) */}
              <div className="relative w-full h-[270px] sm:h-[320px] md:h-[350px] bg-black overflow-hidden flex items-center justify-center">
                {/* HTML5 QR Code Mount */}
                <div id="barcode-camera-reader" className="w-full h-full" />

                {/* TARGET VIEWFINDER BOX (WIDE FOR FAST MOBILE SCANNING) */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                  <div className="relative w-[84%] max-w-[340px] h-[130px] sm:h-[160px]">
                    {/* Glowing scanning laser beam */}
                    <div className="laser-sweep-beam-active absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent shadow-[0_0_12px_#3b82f6]" />

                    {/* 4 Glowing Corner Angles */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-[3.5px] border-l-[3.5px] border-[#3b82f6] rounded-tl-lg shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-[3.5px] border-r-[3.5px] border-[#3b82f6] rounded-tr-lg shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3.5px] border-l-[3.5px] border-[#3b82f6] rounded-bl-lg shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3.5px] border-r-[3.5px] border-[#3b82f6] rounded-br-lg shadow-[0_0_10px_rgba(59,130,246,0.6)]" />

                    {/* Centered Instruction Pill */}
                    <div className="absolute -bottom-7 inset-x-0 flex justify-center">
                      <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-medium text-white shadow-md border border-white/10">
                        Đưa mã vận đơn vào khung
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating Top Overlays */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
                  {/* Left: Camera Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white text-[11px] font-medium shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <Camera size={12} className="text-emerald-400" />
                    <span className="truncate max-w-[130px]">
                      {facingMode === 'environment' ? 'Camera sau' : 'Camera trước'}
                    </span>
                  </div>

                  {/* Right: Quick Action Controls */}
                  <div className="flex items-center gap-1.5">
                    {/* Zoom Toggle Button */}
                    <button
                      type="button"
                      onClick={handleToggleZoom}
                      className="w-7 h-7 rounded-full bg-[#2563eb] text-white border border-blue-400/40 flex items-center justify-center font-mono text-[11px] font-bold shadow-sm active:scale-95 transition-all cursor-pointer"
                      title={`Thu phóng: ${zoom}x. Bấm để đổi`}
                    >
                      {zoom}x
                    </button>

                    {/* Flashlight Torch */}
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`w-7 h-7 rounded-full flex items-center justify-center border backdrop-blur-md transition-all active:scale-95 cursor-pointer shadow-sm ${
                        torchOn
                          ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                          : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                      }`}
                      title={torchOn ? 'Tắt đèn Flash' : 'Bật đèn Flash'}
                    >
                      {torchOn ? <Zap size={13} className="fill-current" /> : <ZapOff size={13} />}
                    </button>

                    {/* Flip Camera */}
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="w-7 h-7 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 active:scale-95 flex items-center justify-center backdrop-blur-md transition-all cursor-pointer shadow-sm"
                      title="Đổi camera trước/sau"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                {/* Error overlay if camera blocked */}
                {cameraError && (
                  <div className="absolute inset-0 bg-black/90 p-5 flex flex-col items-center justify-center text-center z-30 space-y-3">
                    <AlertTriangle size={32} className="text-amber-500" />
                    <p className="text-xs text-gray-300 max-w-sm">{cameraError}</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3.5 py-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-semibold cursor-pointer"
                    >
                      Thử lại camera
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Camera Toolbar (Balanced 3 equal buttons) */}
              <div className="grid grid-cols-3 gap-1.5 p-2 bg-gray-900 border-t border-gray-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700 active:scale-95 transition-all cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Đổi camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md border transition-all cursor-pointer active:scale-95 ${
                    soundEnabled
                      ? 'border-blue-500/40 bg-blue-500/20 text-blue-400'
                      : 'border-gray-700 bg-gray-800 text-gray-400'
                  }`}
                >
                  {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                  <span>{soundEnabled ? 'Âm thanh bật' : 'Âm thanh tắt'}</span>
                </button>
                <button
                  type="button"
                  onClick={togglePauseCamera}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md border transition-all cursor-pointer active:scale-95 ${
                    isCameraPaused
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700'
                  }`}
                >
                  {isCameraPaused ? <Play size={13} /> : <Pause size={13} />}
                  <span>{isCameraPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                </button>
              </div>
            </div>
          )}

          {/* MANUAL BARCODE INPUT BOX */}
          <div className="p-3.5 rounded-lg bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Keyboard size={14} className="text-gray-400" />
                Nhập mã thủ công / Máy quét súng USB
              </span>
              <span className="text-[10px] text-gray-400">Nhấn Enter để thêm</span>
            </div>

            <form onSubmit={handleManualScanSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Nhập mã vận đơn hoặc mã đơn hàng..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#1a1e2b] border border-gray-200 dark:border-gray-700/80 rounded-lg text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                />
              </div>
              <button
                type="submit"
                disabled={!barcodeInput.trim()}
                className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <span>Thêm</span>
                <span className="text-[10px]">↵</span>
              </button>
            </form>
          </div>

          {/* LIVE SCAN FEEDBACK BANNER */}
          {lastScannedFeedback && (
            <div
              className={`p-3 rounded-lg border flex items-center justify-between gap-2.5 transition-all animate-in fade-in ${
                lastScannedFeedback.isDuplicate
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    lastScannedFeedback.isDuplicate
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {lastScannedFeedback.isDuplicate ? (
                    <AlertTriangle size={15} />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold">
                    {lastScannedFeedback.isDuplicate
                      ? 'Mã đã có trong phiên (Trùng lặp)'
                      : 'Đã thêm mã vào phiên quét'}
                  </div>
                  <div className="font-mono text-xs font-bold truncate">
                    {lastScannedFeedback.code}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 shrink-0 font-mono">
                {lastScannedFeedback.timestamp}
              </span>
            </div>
          )}

          {/* PROMINENT ACTION: SUBMIT & VERIFY BATCH */}
          <div className="p-3.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs sm:text-sm">Xác nhận & Cập nhật đơn hàng</h4>
                <p className="text-[11px] text-blue-100 mt-0.5">
                  Gửi toàn bộ danh sách {activeSession?.items.length || 0} mã trong phiên lên hệ thống đối soát.
                </p>
              </div>
              <Sparkles size={20} className="text-yellow-300 opacity-80 shrink-0 hidden sm:block" />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={!activeSession || activeSession.items.length === 0 || isVerifyingBatch}
                onClick={handleSubmitBatch}
                className="flex-1 py-2.5 px-4 rounded-lg bg-white text-[#2563eb] hover:bg-blue-50 active:scale-[0.98] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isVerifyingBatch ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Đang đối soát đơn hàng...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    <span>
                      Gửi đối soát ngay ({activeSession?.items.length || 0} mã)
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleExportCurrentSession}
                disabled={!activeSession || activeSession.items.length === 0}
                className="p-2.5 rounded-lg bg-white/20 hover:bg-white/30 text-white disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                title="Xuất danh sách mã ra file CSV"
              >
                <Download size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SCANNED ITEMS LIST IN ACTIVE SESSION (5 cols on PC) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="p-3.5 rounded-lg bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 flex-1 flex flex-col min-h-0 space-y-3 shadow-sm">
            {/* Header: Title & Clear */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Danh sách mã trong phiên
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#5865f2]/10 text-[#5865f2] font-mono">
                  {activeSession?.items.length || 0} mã
                </span>
              </div>

              {activeSession && activeSession.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Bạn có chắc chắn muốn xóa tất cả mã trong phiên này?')) {
                      clearActiveSessionItems();
                      toast.info('Đã xóa tất cả mã trong phiên');
                    }
                  }}
                  className="text-xs text-rose-500 hover:text-rose-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Xóa hết</span>
                </button>
              )}
            </div>

            {/* Search filter within session */}
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm mã vận đơn trong phiên..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-[#1a1e2b] border border-gray-200 dark:border-gray-700/80 rounded-lg text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/20"
              />
            </div>

            {/* Scanned Items Scroll List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar min-h-[260px] max-h-[500px]">
              {displayedItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 space-y-2">
                  <Package size={36} className="mx-auto text-gray-500 opacity-40" />
                  <p className="font-medium text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'Không tìm thấy mã nào phù hợp' : 'Chưa có mã quét nào trong phiên này'}
                  </p>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    Hãy đưa mã vận đơn vào trước Camera hoặc quét bằng máy quét súng để thêm vào danh sách.
                  </p>
                </div>
              ) : (
                displayedItems.map((item, index) => {
                  const isVerified = item.status === 'VERIFIED';
                  const isAlreadyVerified = item.status === 'ALREADY_VERIFIED';
                  const isNotFound = item.status === 'NOT_FOUND';
                  const isPending = item.status === 'PENDING';

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-[#1a1e2b] border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2.5 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* STT Index */}
                        <span className="font-mono text-xs font-bold text-gray-400 w-5 text-right shrink-0">
                          #{displayedItems.length - index}
                        </span>

                        {/* Status Icon */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            isVerified
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : isAlreadyVerified
                              ? 'bg-amber-500/10 text-amber-500'
                              : isNotFound
                              ? 'bg-rose-500/10 text-rose-500'
                              : 'bg-blue-500/10 text-blue-500'
                          }`}
                        >
                          {isVerified ? (
                            <CheckCircle2 size={15} />
                          ) : isAlreadyVerified ? (
                            <AlertTriangle size={15} />
                          ) : isNotFound ? (
                            <XCircle size={15} />
                          ) : (
                            <Clock size={15} />
                          )}
                        </div>

                        {/* Barcode & Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              onClick={() => handleCopyCode(item.code)}
                              className="font-mono font-bold text-xs text-gray-900 dark:text-white truncate cursor-pointer hover:text-[#2563eb]"
                              title="Bấm để sao chép"
                            >
                              {item.code}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {item.scannedAt}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate mt-0.5">
                            <span className="truncate">
                              {item.message || (isPending ? 'Đang gom trong phiên (Chưa gửi)' : 'Đã đối soát')}
                            </span>
                            {item.orderId && (
                              <button
                                type="button"
                                onClick={() => handleOpenOrderDetail(item.orderId)}
                                className="text-[#2563eb] hover:underline font-semibold ml-1 shrink-0"
                              >
                                Xem đơn →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge & Delete item */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isVerified
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : isAlreadyVerified
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : isNotFound
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {isVerified
                            ? 'Thành công'
                            : isAlreadyVerified
                            ? 'Đã quét trước'
                            : isNotFound
                            ? 'Không tìm thấy'
                            : 'Chờ đối soát'}
                        </span>

                        {/* Quick Delete Single Barcode */}
                        <button
                          type="button"
                          onClick={() => removeItemFromActiveSession(item.id)}
                          className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Xóa mã này khỏi phiên"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary Strip */}
            <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between shrink-0">
              <span>
                {pendingItemsCount} chờ đối soát • {verifiedItemsCount} thành công
              </span>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-[#2563eb] hover:underline font-semibold text-xs"
              >
                Xem tất cả phiên ({sessions.length})
              </button>
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
    </div>
  );
};
