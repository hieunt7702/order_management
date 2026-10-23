import React, { useState } from 'react';
import { Card } from '../ui/Card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

export interface ChartDataPoint {
  date: string;
  revenue: number;
  purchaseAmount?: number;
  orderCount?: number;
  receiptCount?: number;
  fullDate?: string;
}

export interface RevenueChartProps {
  data: ChartDataPoint[];
  isLoading?: boolean;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, isLoading }) => {
  const [viewMode, setViewMode] = useState<'amount' | 'count'>('amount');

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[180px]">
          <p className="text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800 pb-1">
            Ngày {label}
          </p>
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-bold text-gray-900 dark:text-white">
                {viewMode === 'amount'
                  ? `${Number(entry.value).toLocaleString('vi-VN')} đ`
                  : `${entry.value} ${entry.dataKey === 'orderCount' ? 'đơn' : 'phiếu'}`}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (val: any) => {
    const num = Number(val);
    if (num === 0) return '0';
    if (viewMode === 'count') return String(num);
    if (num >= 1000000) return `${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return String(num);
  };

  const hasData =
    data &&
    data.length > 0 &&
    data.some((d) => d.revenue > 0 || (d.purchaseAmount || 0) > 0 || (d.orderCount || 0) > 0);

  return (
    <Card className="bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 rounded p-4 h-full flex flex-col shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp size={16} className="text-[#5865f2]" />
            <span>Xu hướng Tiền đi hàng & Nhập kho</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Diễn biến giá trị xuất bán và chi phí nhập hàng theo ngày
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-gray-100 dark:bg-[#12141a] p-0.5 rounded border border-gray-200 dark:border-gray-800 text-[11px]">
          <button
            type="button"
            onClick={() => setViewMode('amount')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              viewMode === 'amount'
                ? 'bg-white dark:bg-[#202533] text-[#5865f2] dark:text-indigo-300 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            Số tiền (VNĐ)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('count')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              viewMode === 'count'
                ? 'bg-white dark:bg-[#202533] text-emerald-600 dark:text-emerald-400 shadow-2xs'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            Số lượng đơn/phiếu
          </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[260px] flex items-center justify-center">
        {isLoading ? (
          <div className="text-xs text-gray-400 animate-pulse">Đang tải biểu đồ xu hướng...</div>
        ) : !hasData ? (
          <div className="text-center py-8 text-xs text-gray-400">
            <TrendingUp size={28} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            Chưa có phát sinh giao dịch trong khoảng thời gian này
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(156, 163, 175, 0.15)"
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                tickFormatter={formatYAxis}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
              />
              {viewMode === 'amount' ? (
                <>
                  <Line
                    type="monotone"
                    name="Tiền đi hàng"
                    dataKey="revenue"
                    stroke="#5865f2"
                    strokeWidth={2.5}
                    dot={{ fill: '#5865f2', strokeWidth: 1.5, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    name="Tiền nhập hàng"
                    dataKey="purchaseAmount"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10b981', strokeWidth: 1.5, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </>
              ) : (
                <>
                  <Line
                    type="monotone"
                    name="Số đơn xuất"
                    dataKey="orderCount"
                    stroke="#5865f2"
                    strokeWidth={2.5}
                    dot={{ fill: '#5865f2', strokeWidth: 1.5, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    name="Số phiếu nhập"
                    dataKey="receiptCount"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ fill: '#10b981', strokeWidth: 1.5, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};
