import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../Card';
import { ArrowRight } from 'lucide-react';

export interface TopProductItem {
  name: string;
  count: number;
}

export interface TopProductsProps {
  products: TopProductItem[];
}

export const TopProducts: React.FC<TopProductsProps> = ({ products }) => {
  const navigate = useNavigate();
  const maxCount = products.length > 0 ? products[0].count : 1;

  return (
    <Card className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 rounded p-5 h-full flex flex-col">
      <h3 className="text-[14px] font-bold text-gray-900 dark:text-white mb-5">
        Top 5 sản phẩm bán chạy
      </h3>

      <div className="flex-1 flex flex-col gap-4">
        {products.map((product, index) => {
          const percentage = (product.count / maxCount) * 100;
          return (
            <div key={index} className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 w-3">
                {index + 1}
              </span>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1.5">
                  <span
                    className="text-[11px] text-gray-700 dark:text-gray-300 truncate max-w-[120px] lg:max-w-[150px]"
                    title={product.name}
                  >
                    {product.name}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    {product.count}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 dark:bg-[#2a313e] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#3b82f6] rounded"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {products.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-gray-400 dark:text-gray-500">
              Chưa có dữ liệu
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={() => navigate('/products')}
          className="text-[12px] text-[#5865f2] font-medium flex items-center gap-1 hover:text-[#4752c4] transition-colors cursor-pointer"
        >
          Xem tất cả sản phẩm <ArrowRight size={12} />
        </button>
      </div>
    </Card>
  );
};
