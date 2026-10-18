import { Injectable, Logger } from '@nestjs/common';
import { InventoryMovementType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClearDataDto } from './dto/clear-data.dto';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async clearTenantData(tenantId: string, userId: string, dto: ClearDataDto) {
    const hasSpecificFlags =
      dto.clearOrders !== undefined ||
      dto.clearPurchaseReceipts !== undefined ||
      dto.clearCashflow !== undefined ||
      dto.clearInventory !== undefined;

    // Nếu không truyền cờ cụ thể nào, mặc định xóa toàn bộ dữ liệu giao dịch
    const clearOrders = hasSpecificFlags ? Boolean(dto.clearOrders) : true;
    const clearPurchaseReceipts = hasSpecificFlags ? Boolean(dto.clearPurchaseReceipts) : true;
    const clearCashflow = hasSpecificFlags ? Boolean(dto.clearCashflow) : true;
    const clearInventory = hasSpecificFlags ? Boolean(dto.clearInventory) : true;
    const { clearProducts = false, clearSuppliers = false } = dto;

    this.logger.warn(
      `Tenant ${tenantId} requested clear data: Orders=${clearOrders}, PurchaseReceipts=${clearPurchaseReceipts}, Cashflow=${clearCashflow}, Inventory=${clearInventory}, Products=${clearProducts}, Suppliers=${clearSuppliers}`,
    );

    const counts: Record<string, number> = {};

    await this.prisma.$transaction(async (tx) => {
      // 1. DÒNG TIỀN & THU CHI
      if (clearCashflow) {
        const delRecon = await tx.orderReconciliationRecord.deleteMany({ where: { tenantId } });
        counts.orderReconciliations = delRecon.count;

        const delCashTransfers = await tx.cashTransfer.deleteMany({ where: { tenantId } });
        counts.cashTransfers = delCashTransfers.count;

        const delCashTx = await tx.cashTransaction.deleteMany({ where: { tenantId } });
        counts.cashTransactions = delCashTx.count;

        await tx.cashAccount.updateMany({
          where: { tenantId },
          data: { currentBalance: 0 },
        });
      }

      // 2. MUA HÀNG, PHIẾU NHẬP, CÔNG NỢ NCC & MƯỢN TRẢ HÀNG
      if (clearPurchaseReceipts || clearSuppliers) {
        await tx.supplierProductBorrowItem.deleteMany({ where: { tenantId } });
        await tx.supplierProductBorrow.deleteMany({ where: { tenantId } });

        const delAllocations = await tx.paymentAllocation.deleteMany({ where: { tenantId } });
        counts.paymentAllocations = delAllocations.count;

        const delReturnItems = await tx.purchaseReturnItem.deleteMany({ where: { tenantId } });
        counts.purchaseReturnItems = delReturnItems.count;

        const delReturns = await tx.purchaseReturn.deleteMany({ where: { tenantId } });
        counts.purchaseReturns = delReturns.count;

        const delPayments = await tx.supplierPayment.deleteMany({ where: { tenantId } });
        counts.supplierPayments = delPayments.count;

        const delReceiptItems = await tx.purchaseReceiptItem.deleteMany({ where: { tenantId } });
        counts.purchaseReceiptItems = delReceiptItems.count;

        const delReceipts = await tx.purchaseReceipt.deleteMany({ where: { tenantId } });
        counts.purchaseReceipts = delReceipts.count;

        // Xóa sổ cái liên quan đến nhập hàng & trả hàng NCC & mượn trả
        const delPRLedgers = await tx.inventoryLedger.deleteMany({
          where: {
            tenantId,
            OR: [
              { referenceType: { in: ['PURCHASE_RECEIPT', 'PURCHASE_RETURN', 'PRODUCT_BORROW', 'BORROW_RETURN', 'IMPORT'] } },
              { movementType: { in: [InventoryMovementType.RECEIVE, InventoryMovementType.PURCHASE_RETURN] } },
            ],
          },
        });
        counts.purchaseLedgers = delPRLedgers.count;
      }

      // 3. ĐƠN HÀNG, QUÉT KHO, KIỆN HÀNG & HÀNG HOÀN
      if (clearOrders) {
        const delOrderReturnItems = await tx.orderReturnItem.deleteMany({ where: { tenantId } });
        counts.orderReturnItems = delOrderReturnItems.count;

        const delOrderReturns = await tx.orderReturn.deleteMany({ where: { tenantId } });
        counts.orderReturns = delOrderReturns.count;

        const delSettlements = await tx.settlement.deleteMany({ where: { tenantId } });
        counts.settlements = delSettlements.count;

        const delScanEvents = await tx.scanEvent.deleteMany({ where: { tenantId } });
        counts.scanEvents = delScanEvents.count;

        const delPkgItems = await tx.packageItem.deleteMany({ where: { tenantId } });
        counts.packageItems = delPkgItems.count;

        const delPkgs = await tx.package.deleteMany({ where: { tenantId } });
        counts.packages = delPkgs.count;

        const delOrderItems = await tx.orderItem.deleteMany({ where: { tenantId } });
        counts.orderItems = delOrderItems.count;

        const delOrders = await tx.order.deleteMany({ where: { tenantId } });
        counts.orders = delOrders.count;

        const delImportErrors = await tx.importRowError.deleteMany({ where: { tenantId } });
        counts.importRowErrors = delImportErrors.count;

        const delImportJobs = await tx.importJob.deleteMany({ where: { tenantId } });
        counts.importJobs = delImportJobs.count;

        if (!clearCashflow) {
          await tx.orderReconciliationRecord.deleteMany({ where: { tenantId } });
        }

        // Xóa toàn bộ sổ cái liên quan đến đơn hàng, quét kiện và xuất/giữ hàng
        const delOrdLedgers = await tx.inventoryLedger.deleteMany({
          where: {
            tenantId,
            OR: [
              { referenceType: { in: ['ORDER', 'ORDER_RETURN', 'DISPATCH', 'PACKAGE', 'SCAN_REVERSAL'] } },
              {
                movementType: {
                  in: [
                    InventoryMovementType.DISPATCH,
                    InventoryMovementType.RESERVE,
                    InventoryMovementType.RELEASE,
                    InventoryMovementType.RETURN_RECEIVE,
                    InventoryMovementType.RETURN_DAMAGE,
                  ],
                },
              },
            ],
          },
        });
        counts.orderLedgers = delOrdLedgers.count;
      }

      // 4. ĐỒNG BỘ LẠI TỒN KHO & SỔ CÁI
      if (clearInventory || (clearOrders && clearPurchaseReceipts) || clearProducts) {
        // Xóa sạch toàn bộ sổ cái biến động kho
        const delLedgers = await tx.inventoryLedger.deleteMany({ where: { tenantId } });
        counts.inventoryLedgers = delLedgers.count;

        if (clearProducts) {
          const delBalances = await tx.inventoryBalance.deleteMany({ where: { tenantId } });
          counts.inventoryBalances = delBalances.count;
        } else {
          await tx.inventoryBalance.updateMany({
            where: { tenantId },
            data: {
              onHand: 0,
              reserved: 0,
              damaged: 0,
              pendingInspection: 0,
              inboundReturning: 0,
            },
          });
        }
      } else if (clearPurchaseReceipts) {
        // Chỉ xóa nhập hàng -> đặt lại tồn thực tế onHand = 0
        await tx.inventoryBalance.updateMany({
          where: { tenantId },
          data: { onHand: 0 },
        });
      } else if (clearOrders) {
        // Chỉ xóa đơn hàng -> giải phóng toàn bộ số lượng giữ và hoàn chờ kiểm
        await tx.inventoryBalance.updateMany({
          where: { tenantId },
          data: {
            reserved: 0,
            damaged: 0,
            pendingInspection: 0,
            inboundReturning: 0,
          },
        });
      }

      // 5. Idempotency records
      await tx.idempotencyRecord.deleteMany({ where: { tenantId } });

      // 6. DANH MỤC SẢN PHẨM & SKU (Nếu chọn)
      if (clearProducts) {
        const delMappings = await tx.listingMapping.deleteMany({ where: { tenantId } });
        counts.listingMappings = delMappings.count;

        const delBalances = await tx.inventoryBalance.deleteMany({ where: { tenantId } });
        counts.inventoryBalances = delBalances.count;

        const delVariants = await tx.productVariant.deleteMany({ where: { tenantId } });
        counts.productVariants = delVariants.count;

        const delProducts = await tx.product.deleteMany({ where: { tenantId } });
        counts.products = delProducts.count;
      }

      // 7. NHÀ CUNG CẤP (Nếu chọn)
      if (clearSuppliers) {
        const delSuppliers = await tx.supplier.deleteMany({ where: { tenantId } });
        counts.suppliers = delSuppliers.count;
      }
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'SYSTEM_CLEAR_DATA',
      entityType: 'System',
      entityId: tenantId,
      newValues: {
        dto,
        counts,
      },
    });

    return {
      success: true,
      message: 'Đã xóa dữ liệu đã chọn thành công!',
      counts,
    };
  }
}
