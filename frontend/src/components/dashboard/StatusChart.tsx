import React from 'react';
import { Card } from '../ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';

export interface StatusMetrics {
  completedCount: number;
  deliveringCount: number;
  readyToShipCount?: number;
  cancelledCount: number;
  returnedCount: number;
}

export interface StatusChartProps {
  metrics: StatusMetrics;
  isLoading?: boolean;
}

export const StatusChart: React.FC<StatusChartProps> = ({ metrics, isLoading }) => {
  const data = [
    { name: 'Hoàn thành', value: metrics.completedCount || 0, color: '#10b981' },
    { name: 'Đang giao', value: metrics.deliveringCount || 0, color: '#3b82f6' },
    { name: 'Chờ giao', value: metrics.readyToShipCount || 0, color: '#f59e0b' },
    { name: 'Đã hủy', value: metrics.cancelledCount || 0, color: '#ef4444' },
    { name: 'Hoàn tiền', value: metrics.returnedCount || 0, color: '#8b5cf6' },
  ].filter((item) => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
      return (
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 p-2.5 rounded-lg shadow-xl flex items-center gap-2.5 text-xs">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <div>
            <div className="text-gray-700 dark:text-gray-300 font-medium">
              {entry.name}
            </div>
            <div className="text-gray-900 dark:text-white font-bold">
              {entry.value} đơn ({pct}%)
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded p-3 sm:p-4 h-full flex flex-col shadow-xs">
      <div className="mb-3 sm:mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 sm:gap-2">
          <PieChartIcon size={16} className="text-emerald-500 shrink-0" />
          <span>Tỷ lệ trạng thái đơn hàng</span>
        </h3>
        <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
          Cơ cấu phân bổ đơn theo trạng thái xử lý Shopee
        </p>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 min-h-[220px] sm:min-h-[260px]">
        {isLoading ? (
          <div className="text-xs text-gray-400 animate-pulse">Đang tải tỷ lệ...</div>
        ) : total === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            <PieChartIcon size={28} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            Chưa có đơn hàng trong kỳ này
          </div>
        ) : (
          <>
            {/* Donut Chart */}
            <div className="relative w-[160px] h-[160px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {total}
                </span>
                <span className="text-[10px] text-gray-400">Tổng đơn</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 w-full flex flex-col justify-center gap-2 max-w-[200px]">
              {data.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-gray-600 dark:text-gray-400 truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {item.value}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
