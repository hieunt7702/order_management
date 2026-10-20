import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { getImportedFiles } from '../../utils/storage';
import { RefreshCw } from 'lucide-react';
import { Select } from '../ui/Select';
import { SystemDatePicker } from '../ui/SystemDatePicker';

export const DashboardFilter: React.FC = () => {
  const {
    dataSource,
    selectedFileId,
    setDataSource,
    setSelectedFileId,
    dateRange,
    setDateRange,
  } = useAppStore();
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    const loadFiles = async () => {
      const dbFiles = await getImportedFiles();
      setFiles(dbFiles);
    };
    loadFiles();
  }, []);

  const updateTime = new Date().toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const fileOptions = [
    { value: 'all', label: 'Tất cả dữ liệu' },
    ...files.map((f) => ({ value: f.id, label: `File: ${f.fileName}` })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* File / Data Source Selector */}
      <div className="relative bg-white dark:bg-[#1c212a] border border-gray-200 dark:border-gray-800 rounded flex flex-col justify-center min-w-[170px] h-[36px] px-3 z-20">
        <span className="text-[9px] text-gray-500 font-medium absolute top-0.5 left-3">
          Nguồn dữ liệu
        </span>
        <Select
          options={fileOptions}
          value={dataSource === 'all' ? 'all' : selectedFileId || 'all'}
          onChange={(val) => {
            if (val === 'all') {
              setDataSource('all');
            } else {
              setDataSource('file');
              setSelectedFileId(String(val));
            }
          }}
          className="text-xs text-gray-700 dark:text-gray-300 w-full pt-2"
        />
      </div>

      {/* Date Range Selector */}
      <SystemDatePicker
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        onChange={(start, end) => setDateRange(start, end)}
        size="sm"
        className="w-[240px]"
        placeholder="Khoảng thời gian..."
      />

      {/* Last Updated */}
      <div className="bg-white dark:bg-[#1c212a] border border-gray-200 dark:border-gray-800 rounded px-3 h-[36px] flex items-center gap-3 z-10">
        <div className="flex flex-col justify-center">
          <span className="text-[9px] text-gray-500 font-medium">
            Cập nhật lúc
          </span>
          <span className="text-[11px] text-gray-700 dark:text-gray-300 font-medium">
            {updateTime}
          </span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors cursor-pointer"
          title="Tải lại"
        >
          <RefreshCw
            size={13}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          />
        </button>
      </div>
    </div>
  );
};
