import { useState, useEffect } from 'react';

// Generate a random UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Get or create HWID
export function getHWID(): string {
  let hwid = localStorage.getItem('app_hwid');
  if (!hwid) {
    hwid = generateUUID();
    localStorage.setItem('app_hwid', hwid);
  }
  return hwid;
}

export interface UseAuthResult {
  hwid: string;
  isAuthorized: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useAuth(): UseAuthResult {
  const [hwid, setHwid] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentHwid = getHWID();
        setHwid(currentHwid);

        const csvUrl = (import.meta as any).env?.VITE_GOOGLE_SHEET_CSV_URL;
        if (!csvUrl) {
          throw new Error('Thiếu cấu hình VITE_GOOGLE_SHEET_CSV_URL trong file .env');
        }

        // Fetch CSV data
        const response = await fetch(csvUrl);
        if (!response.ok) {
          throw new Error('Không thể kết nối tới Google Sheet (Lỗi mạng hoặc File không công khai)');
        }

        const csvText = await response.text();

        // Simple CSV parser
        const lines = csvText.split('\n');
        let authorized = false;

        // Skip header line (index 0)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Split by comma. Expected: HWID, Status, Name, ...
          const columns = line.split(',');
          if (columns.length >= 2) {
            const sheetHwid = columns[0].trim();
            const status = columns[1].trim();

            if (sheetHwid === currentHwid && status === 'ACTIVE') {
              authorized = true;
              break;
            }
          }
        }

        setIsAuthorized(authorized);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Auth check error:', err);
        setError(err.message || 'Lỗi xác thực');
        setIsAuthorized(false);
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  return { hwid, isAuthorized, isLoading, error };
}
