import React from 'react';
import { Card } from '../Card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Select } from '../ui/Select';

export interface ChartDataPoint {
  date: string;
  revenue: number;
  rawDate?: string;
}

export interface RevenueChartProps {
  data: ChartDataPoint[];
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 p-3 rounded shadow-lg">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">
            Ngày {label}
          </p>
          <p className="text-[#3b82f6] font-bold text-sm">
            {Number(payload[0].value).toLocaleString('vi-VN')} đ
          </p>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (tickItem: any) => {
    const val = Number(tickItem);
    if (val === 0) return '0';
    if (val >= 1000000) return val / 1000000 + 'M';
    if (val >= 1000) return val / 1000 + 'K';
    return String(val);
  };

  return (
    <Card className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[14px] font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          Doanh thu theo ngày
          <span
            className="w-3.5 h-3.5 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center text-[9px] text-gray-400 dark:text-gray-500 cursor-help"
            title="Doanh thu từ các đơn hoàn thành và đang giao"
          >
            ?
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <Select
            value="DAY"
            onChange={() => {}}
            options={[
              { value: 'DAY', label: 'Theo ngày' },
              { value: 'WEEK', label: 'Theo tuần' },
              { value: 'MONTH', label: 'Theo tháng' },
            ]}
            size="sm"
            className="w-28"
          />
        </div>
      </div>
      <div className="flex-1 w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(156, 163, 175, 0.2)"
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
