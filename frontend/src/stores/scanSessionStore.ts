import { create } from 'zustand';
import { fulfillmentApi } from '../services/fulfillmentApi';

export interface SessionItem {
  id: string;
  code: string;
  scannedAt: string;
  rawDate: string;
  status: 'PENDING' | 'VERIFIED' | 'ALREADY_VERIFIED' | 'NOT_FOUND' | 'ERROR';
  orderId?: string;
  internalOrderCode?: string;
  carrierName?: string;
  shopName?: string;
  packageCode?: string;
  packageId?: string;
  message?: string;
}

export interface ScanSession {
  id: string;
  sessionCode: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: 'DRAFT' | 'SUBMITTED';
  items: SessionItem[];
  warehouseId?: string;
  submittedAt?: string;
  stats: {
    total: number;
    verified: number;
    alreadyVerified: number;
    notFound: number;
    failed: number;
  };
}

interface ScanSessionState {
  sessions: ScanSession[];
  activeSessionId: string | null;
  isVerifyingBatch: boolean;

  // Actions
  getActiveSession: () => ScanSession | null;
  createNewSession: (name?: string, warehouseId?: string) => ScanSession;
  setActiveSession: (sessionId: string) => void;
  addBarcodeToActiveSession: (code: string) => { isDuplicate: boolean; item?: SessionItem; session: ScanSession };
  removeItemFromActiveSession: (itemId: string) => void;
  clearActiveSessionItems: () => void;
  deleteSession: (sessionId: string) => void;
  submitSession: (sessionId: string, warehouseId?: string) => Promise<{ success: boolean; session: ScanSession; summary: any }>;
  loadSessionsFromStorage: () => void;
}

const STORAGE_KEY = 'shopee_scan_sessions_v2';
const ACTIVE_SESSION_KEY = 'shopee_active_scan_session_v2';

const calculateStats = (items: SessionItem[]) => {
  return {
    total: items.length,
    verified: items.filter((i) => i.status === 'VERIFIED').length,
    alreadyVerified: items.filter((i) => i.status === 'ALREADY_VERIFIED').length,
    notFound: items.filter((i) => i.status === 'NOT_FOUND').length,
    failed: items.filter((i) => i.status === 'ERROR').length,
  };
};

const saveToLocalStorage = (sessions: ScanSession[], activeId: string | null) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    if (activeId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeId);
    }
  } catch (err) {
    console.warn('Cannot persist scan sessions to localStorage:', err);
  }
};

const createDefaultSession = (index = 1, warehouseId?: string): ScanSession => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const randCode = Math.floor(1000 + Math.random() * 9000);
  const id = `ses_${Date.now()}_${randCode}`;

  return {
    id,
    sessionCode: `PQ-${randCode}`,
    name: `Phiên quét #${index} (${timeStr} ${dateStr})`,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    status: 'DRAFT',
    items: [],
    warehouseId,
    stats: {
      total: 0,
      verified: 0,
      alreadyVerified: 0,
      notFound: 0,
      failed: 0,
    },
  };
};

export const useScanSessionStore = create<ScanSessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isVerifyingBatch: false,

  loadSessionsFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
      let loadedSessions: ScanSession[] = [];

      if (stored) {
        loadedSessions = JSON.parse(stored);
      }

      if (loadedSessions.length === 0) {
        const initial = createDefaultSession(1);
        loadedSessions = [initial];
        set({ sessions: loadedSessions, activeSessionId: initial.id });
        saveToLocalStorage(loadedSessions, initial.id);
        return;
      }

      const activeExists = loadedSessions.some((s) => s.id === activeId);
      const chosenActiveId = activeExists
        ? activeId
        : loadedSessions.find((s) => s.status === 'DRAFT')?.id || loadedSessions[0].id;

      set({ sessions: loadedSessions, activeSessionId: chosenActiveId });
      saveToLocalStorage(loadedSessions, chosenActiveId);
    } catch {
      const initial = createDefaultSession(1);
      set({ sessions: [initial], activeSessionId: initial.id });
      saveToLocalStorage([initial], initial.id);
    }
  },

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || null;
  },

  createNewSession: (name?: string, warehouseId?: string) => {
    const { sessions } = get();
    const newSession = createDefaultSession(sessions.length + 1, warehouseId);
    if (name) {
      newSession.name = name;
    }

    const updatedSessions = [newSession, ...sessions];
    set({ sessions: updatedSessions, activeSessionId: newSession.id });
    saveToLocalStorage(updatedSessions, newSession.id);
    return newSession;
  },

  setActiveSession: (sessionId: string) => {
    const { sessions } = get();
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      set({ activeSessionId: sessionId });
      saveToLocalStorage(sessions, sessionId);
    }
  },

  addBarcodeToActiveSession: (code: string) => {
    const { sessions, activeSessionId } = get();
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      const active = sessions.find((s) => s.id === activeSessionId) || sessions[0];
      return { isDuplicate: false, session: active };
    }

    let active = sessions.find((s) => s.id === activeSessionId);
    let updatedSessions = [...sessions];

    if (!active) {
      active = createDefaultSession(sessions.length + 1);
      updatedSessions = [active, ...sessions];
    }

    // Check if code is already in this session
    const isDuplicate = active.items.some((item) => item.code.toUpperCase() === cleanCode);

    if (isDuplicate) {
      return { isDuplicate: true, session: active };
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newItem: SessionItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      code: cleanCode,
      scannedAt: timeFormatted,
      rawDate: now.toISOString(),
      status: 'PENDING',
      message: 'Chưa đối soát',
    };

    const newItems = [newItem, ...active.items];
    const updatedActive: ScanSession = {
      ...active,
      items: newItems,
      updatedAt: now.toISOString(),
      stats: calculateStats(newItems),
    };

    const finalSessions = updatedSessions.map((s) => (s.id === updatedActive.id ? updatedActive : s));

    set({ sessions: finalSessions, activeSessionId: updatedActive.id });
    saveToLocalStorage(finalSessions, updatedActive.id);

    return { isDuplicate: false, item: newItem, session: updatedActive };
  },

  removeItemFromActiveSession: (itemId: string) => {
    const { sessions, activeSessionId } = get();
    const active = sessions.find((s) => s.id === activeSessionId);
    if (!active) return;

    const newItems = active.items.filter((i) => i.id !== itemId);
    const updatedActive: ScanSession = {
      ...active,
      items: newItems,
      updatedAt: new Date().toISOString(),
      stats: calculateStats(newItems),
    };

    const updatedSessions = sessions.map((s) => (s.id === updatedActive.id ? updatedActive : s));
    set({ sessions: updatedSessions });
    saveToLocalStorage(updatedSessions, activeSessionId);
  },

  clearActiveSessionItems: () => {
    const { sessions, activeSessionId } = get();
    const active = sessions.find((s) => s.id === activeSessionId);
    if (!active) return;

    const updatedActive: ScanSession = {
      ...active,
      items: [],
      updatedAt: new Date().toISOString(),
      stats: { total: 0, verified: 0, alreadyVerified: 0, notFound: 0, failed: 0 },
    };

    const updatedSessions = sessions.map((s) => (s.id === updatedActive.id ? updatedActive : s));
    set({ sessions: updatedSessions });
    saveToLocalStorage(updatedSessions, activeSessionId);
  },

  deleteSession: (sessionId: string) => {
    const { sessions, activeSessionId } = get();
    const remaining = sessions.filter((s) => s.id !== sessionId);

    let nextActiveId = activeSessionId;
    if (activeSessionId === sessionId) {
      if (remaining.length > 0) {
        nextActiveId = remaining[0].id;
      } else {
        const fresh = createDefaultSession(1);
        set({ sessions: [fresh], activeSessionId: fresh.id });
        saveToLocalStorage([fresh], fresh.id);
        return;
      }
    }

    set({ sessions: remaining, activeSessionId: nextActiveId });
    saveToLocalStorage(remaining, nextActiveId);
  },

  submitSession: async (sessionId: string, warehouseId?: string) => {
    const { sessions } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.items.length === 0) {
      return { success: false, session: session || ({} as any), summary: null };
    }

    set({ isVerifyingBatch: true });

    try {
      const codes = session.items.map((i) => i.code);
      const whId = warehouseId || session.warehouseId;

      // Call backend batch-verify API
      const res: any = await fulfillmentApi.batchVerify(codes, whId, 'WEB_BATCH_SCAN', session.name);

      const itemsMap = new Map<string, any>();
      if (res?.items && Array.isArray(res.items)) {
        res.items.forEach((item: any) => {
          itemsMap.set(item.code.toUpperCase(), item);
        });
      }

      // Update session items with real results from backend
      const updatedItems: SessionItem[] = session.items.map((item) => {
        const backendResult = itemsMap.get(item.code.toUpperCase());
        if (!backendResult) {
          return item;
        }

        let status: SessionItem['status'] = 'PENDING';
        if (backendResult.result === 'VERIFIED') status = 'VERIFIED';
        else if (backendResult.result === 'ALREADY_VERIFIED') status = 'ALREADY_VERIFIED';
        else if (backendResult.result === 'NOT_FOUND') status = 'NOT_FOUND';
        else status = 'ERROR';

        return {
          ...item,
          status,
          orderId: backendResult.orderId,
          internalOrderCode: backendResult.internalOrderCode,
          carrierName: backendResult.carrierName,
          shopName: backendResult.shopName,
          packageCode: backendResult.packageCode,
          packageId: backendResult.packageId,
          message: backendResult.message,
        };
      });

      const updatedSession: ScanSession = {
        ...session,
        items: updatedItems,
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: calculateStats(updatedItems),
      };

      const updatedSessions = sessions.map((s) => (s.id === sessionId ? updatedSession : s));
      set({ sessions: updatedSessions, isVerifyingBatch: false });
      saveToLocalStorage(updatedSessions, sessionId);

      return {
        success: true,
        session: updatedSession,
        summary: {
          total: res?.total || codes.length,
          verified: res?.verifiedCount || updatedSession.stats.verified,
          alreadyVerified: res?.alreadyVerifiedCount || updatedSession.stats.alreadyVerified,
          notFound: res?.notFoundCount || updatedSession.stats.notFound,
          failed: res?.failedCount || updatedSession.stats.failed,
        },
      };
    } catch (err) {
      console.error('Batch verify error:', err);
      set({ isVerifyingBatch: false });
      throw err;
    }
  },
}));
