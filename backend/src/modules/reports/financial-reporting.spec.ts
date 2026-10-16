import { ReportsService } from './reports.service';
import { PlatformOrderStatus } from '@prisma/client';

describe('Scenarios 19 & 21: Financial Aggregation & Performance (No duplicate revenue, No N+1)', () => {
  let reportsService: ReportsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      settlement: {
        aggregate: jest.fn(),
      },
      inventoryBalance: {
        findMany: jest.fn(),
      },
      orderItem: {
        groupBy: jest.fn(),
      },
      package: {
        count: jest.fn(),
      },
    };

    reportsService = new ReportsService(mockPrisma);
  });

  describe('Scenario 19: Báo cáo không nhân đôi doanh thu', () => {
    it('sử dụng SQL aggregate trực tiếp trên bảng Order thay vì SUM sau khi JOIN OrderItems', async () => {
      // Mock aggregate on Order table directly
      mockPrisma.order.groupBy.mockResolvedValue([
        { platformStatus: PlatformOrderStatus.COMPLETED, _count: { id: 5 } },
        { platformStatus: PlatformOrderStatus.READY_TO_SHIP, _count: { id: 3 } },
      ]);

      mockPrisma.order.aggregate
        .mockResolvedValueOnce({
          _sum: { totalAmount: 1800000 },
          _count: { id: 8 },
        }) // Total GMV
        .mockResolvedValueOnce({
          _sum: { totalAmount: 1200000, cogsTotal: 750000 },
        }); // Completed revenue & COGS

      mockPrisma.settlement.aggregate.mockResolvedValue({
        _sum: {
          actualReceivedAmount: 1100000,
          commissionFee: 60000,
          serviceFee: 24000,
          transactionFee: 16000,
        },
      });

      mockPrisma.inventoryBalance.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.package.count.mockResolvedValue(10);

      const dashboard = await reportsService.getDashboardSummary('tenant-1', null, {});

      // Verify that completedRevenue is exactly 1,200,000 and not multiplied by item rows
      expect(dashboard.financials.completedRevenue).toBe(1200000);
      expect(dashboard.financials.completedCogs).toBe(750000);
      expect(dashboard.financials.estimatedGrossProfit).toBe(1200000 - 750000);
      expect(dashboard.financials.actualSettled).toBe(1100000);
      expect(dashboard.financials.totalPlatformFees).toBe(100000);

      // Verify query was done via aggregate
      expect(mockPrisma.order.aggregate).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scenario 21: Query count không tăng tuyến tính theo số items (No N+1)', () => {
    it('dashboard tính toán toàn bộ chỉ số qua các câu query gộp (aggregate / groupBy), không query từng đơn', async () => {
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalAmount: 0 },
        _count: { id: 0 },
      });
      mockPrisma.settlement.aggregate.mockResolvedValue({
        _sum: { actualReceivedAmount: 0 },
      });
      mockPrisma.inventoryBalance.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.package.count.mockResolvedValue(0);

      await reportsService.getDashboardSummary('tenant-1', null, {});

      // Verify that the number of database queries is constant (O(1)) regardless of having 10 or 10,000 orders!
      // Total calls:
      // order.groupBy (status): 1
      // order.groupBy (verification): 1
      // order.aggregate (GMV): 1
      // order.aggregate (completed): 1
      // settlement.aggregate: 1
      // inventoryBalance.findMany: 1
      // orderItem.groupBy: 1
      // package.count: 2
      expect(mockPrisma.order.groupBy).toHaveBeenCalledTimes(2);
      expect(mockPrisma.order.aggregate).toHaveBeenCalledTimes(2);
      expect(mockPrisma.settlement.aggregate).toHaveBeenCalledTimes(1);
    });
  });
});
