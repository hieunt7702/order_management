import { create } from 'zustand';
import type { User, Tenant, Membership } from '../types';

const AUTH_STORAGE_KEY = 'shopee_auth_session';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentTenant: Tenant | null;
  memberships: Membership[];
  setAuth: (data: {
    user: User;
    accessToken: string;
    refreshToken: string;
    currentTenant: Tenant;
    memberships?: Membership[];
  }) => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  switchTenant: (tenantId: string) => void;
  logout: () => void;
}

const getInitialState = (): Pick<
  AuthState,
  'user' | 'accessToken' | 'refreshToken' | 'currentTenant' | 'memberships'
> => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to parse auth state:', err);
  }
  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    currentTenant: null,
    memberships: [],
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...getInitialState(),

  setAuth: (data) => {
    const newState = {
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      currentTenant: data.currentTenant,
      memberships: data.memberships || [],
    };
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
      console.warn('Failed to save auth state to localStorage', e);
    }
    set(newState);
  },

  setTokens: (accessToken: string, refreshToken?: string) => {
    const current = get();
    const nextRefreshToken = refreshToken || current.refreshToken;
    const updated = {
      ...current,
      accessToken,
      refreshToken: nextRefreshToken,
    };
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {}
    set({ accessToken, refreshToken: nextRefreshToken });
  },

  switchTenant: (tenantId: string) => {
    const current = get();
    const target = current.memberships.find((m) => m.tenantId === tenantId);
    if (target) {
      const updatedTenant: Tenant = {
        id: target.tenantId,
        code: target.tenantCode,
        name: target.tenantName,
        role: target.role,
      };
      const updated = {
        ...current,
        currentTenant: updatedTenant,
      };
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      set({ currentTenant: updatedTenant });
    }
  },

  logout: () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {}
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      currentTenant: null,
      memberships: [],
    });
  },
}));
