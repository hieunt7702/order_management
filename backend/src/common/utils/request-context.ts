import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export class RequestContext {
  static current(): RequestContextStore | undefined {
    return requestContextStorage.getStore();
  }

  static getIp(): string | undefined {
    return this.current()?.ipAddress;
  }

  static getUserAgent(): string | undefined {
    return this.current()?.userAgent;
  }
}
