import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { ScanBarcodeDto, ReverseDispatchDto } from './dto/fulfillment.dto';
import {
  ScanResult,
  PackageStatus,
  PlatformOrderStatus,
  FulfillmentStatus,
  VerificationStatus,
  InventoryMovementType,
} from '@prisma/client';

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  normalizeCode(code: string): string {
    if (!code) return '';
    return code.trim().replace(/[\r\n\t]/g, '');
  }

  async verifyDispatch(
    tenantId: string,
    userId: string,
    dto: ScanBarcodeDto,
    idempotencyKey?: string,
  ) {
    const rawCode = dto.code;
    const normalizedCode = this.normalizeCode(rawCode);

    if (!normalizedCode) {
      throw new BadRequestException('Mã quét không hợp lệ');
    }

    let targetPackage: any = null;

    if (dto.packageId) {
      targetPackage = await this.prisma.package.findFirst({
        where: { id: dto.packageId, tenantId },
        include: {
          order: {
            include: {
              shop: true,
              orderItems: { include: { variant: true } },
              packages: true,
            },
          },
          packageItems: {
            include: { orderItem: { include: { variant: true } } },
          },
        },
      });

      if (!targetPackage) {
        return {
          result: ScanResult.NOT_FOUND,
          message: 'Không tìm thấy kiện hàng được chỉ định trong Workspace',
        };
      }
    } else {
      // Find candidate packages within tenant
      const candidates = await this.prisma.package.findMany({
        where: {
          tenantId,
          OR: [
            { packageCode: normalizedCode },
            { trackingCode: normalizedCode },
            { order: { externalOrderId: normalizedCode } },
            { order: { internalOrderCode: normalizedCode } },
          ],
        },
        include: {
          order: {
            include: {
              shop: true,
              orderItems: { include: { variant: true } },
              packages: true,
            },
          },
          packageItems: {
            include: { orderItem: { include: { variant: true } } },
          },
        },
      });

      if (candidates.length === 0) {
        // Log failed scan
        await this.prisma.scanEvent.create({
          data: {
            tenantId,
            rawCode,
            normalizedCode,
            scanResult: ScanResult.NOT_FOUND,
            deviceId: dto.deviceId,
            performedByUserId: userId,
            idempotencyKey,
          },
        });

        return {
          result: ScanResult.NOT_FOUND,
          message: 'Không tìm thấy đơn hàng hoặc kiện hàng nào khớp với mã quét trong Workspace',
        };
      }

      // AMBIGUOUS CODE CHECK: multiple packages match
      if (candidates.length > 1) {
        await this.prisma.scanEvent.create({
          data: {
            tenantId,
            rawCode,
            normalizedCode,
            scanResult: ScanResult.AMBIGUOUS_CODE,
            deviceId: dto.deviceId,
            performedByUserId: userId,
            idempotencyKey,
          },
        });

        return {
          result: ScanResult.AMBIGUOUS_CODE,
          message: `Mã quét khớp với ${candidates.length} kiện hàng. Vui lòng chọn kiện hàng cần xác nhận.`,
          candidates: candidates.map((c) => ({
            packageId: c.id,
            packageCode: c.packageCode,
            trackingCode: c.trackingCode,
            externalOrderId: c.order.externalOrderId,
            shopName: c.order.shop.name,
            carrierName: c.carrierName,
            status: c.status,
          })),
        };
      }

      targetPackage = candidates[0];
    }

    const order = targetPackage.order;
    const warehouseId = dto.warehouseId || order.shop.defaultWarehouseId;

    // Check if already dispatched (Double-layer protection: layer 2 check)
    if (targetPackage.status === PackageStatus.DISPATCHED) {
      await this.prisma.scanEvent.create({
        data: {
          tenantId,
          shopId: order.shopId,
          warehouseId,
          orderId: order.id,
          packageId: targetPackage.id,
          rawCode,
          normalizedCode,
          scanResult: ScanResult.ALREADY_VERIFIED,
          deviceId: dto.deviceId,
          performedByUserId: userId,
          idempotencyKey,
        },
      });

      return {
        result: ScanResult.ALREADY_VERIFIED,
        message: 'Kiện hàng này đã được xác nhận xuất kho trước đó',
        packageId: targetPackage.id,
        packageCode: targetPackage.packageCode,
        trackingCode: targetPackage.trackingCode,
        verifiedAt: targetPackage.verifiedAt,
        verifiedByUserId: targetPackage.verifiedByUserId,
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        package: {
          id: targetPackage.id,
          packageCode: targetPackage.packageCode,
          trackingCode: targetPackage.trackingCode,
          carrierName: targetPackage.carrierName,
          status: targetPackage.status,
          verifiedAt: targetPackage.verifiedAt,
        },
        order: {
          id: order.id,
          externalOrderId: order.externalOrderId,
          internalOrderCode: order.internalOrderCode,
          totalPackages: order.packages?.length || 1,
          verifiedPackages: order.packages?.filter((p: any) => p.status === PackageStatus.DISPATCHED)?.length || 1,
          verificationStatus: order.verificationStatus,
        },
      };
    }

    // Check order conditions
    if (order.platformStatus === PlatformOrderStatus.CANCELLED) {
      await this.prisma.scanEvent.create({
        data: {
          tenantId,
          shopId: order.shopId,
          warehouseId,
          orderId: order.id,
          packageId: targetPackage.id,
          rawCode,
          normalizedCode,
          scanResult: ScanResult.INVALID_ORDER_STATUS,
          deviceId: dto.deviceId,
          performedByUserId: userId,
          idempotencyKey,
          errorMessage: 'Đơn hàng đã bị hủy trên sàn',
        },
      });

      return {
        result: ScanResult.INVALID_ORDER_STATUS,
        message: 'Đơn hàng đã bị hủy trên sàn Shopee, không thể xuất kho',
      };
    }

    if (order.fulfillmentStatus === FulfillmentStatus.UNMAPPED) {
      await this.prisma.scanEvent.create({
        data: {
          tenantId,
          shopId: order.shopId,
          warehouseId,
          orderId: order.id,
          packageId: targetPackage.id,
          rawCode,
          normalizedCode,
          scanResult: ScanResult.UNMAPPED_SKU,
          deviceId: dto.deviceId,
          performedByUserId: userId,
          idempotencyKey,
          errorMessage: 'Đơn hàng chứa SKU chưa mapping',
        },
      });

      return {
        result: ScanResult.UNMAPPED_SKU,
        message: 'Đơn hàng này có SKU chưa được mapping nội bộ. Vui lòng mapping trước khi xuất kho.',
      };
    }

    if (!warehouseId) {
      throw new BadRequestException('Shop hoặc yêu cầu quét chưa chỉ định kho hàng xuất');
    }

    // Items to dispatch
    const itemsToDispatch = targetPackage.packageItems
      .filter((pi: any) => !!pi.orderItem.variantId)
      .map((pi: any) => ({
        variantId: pi.orderItem.variantId,
        quantity: pi.quantity,
      }));

    // EXECUTE DISPATCH TRANSACTION WITH ATOMIC ROW LOCKS
    return this.prisma.$transaction(async (tx) => {
      // Atomic state change: ensures only one worker/device can mark package as DISPATCHED
      const updateCount = await tx.package.updateMany({
        where: {
          id: targetPackage.id,
          status: { not: PackageStatus.DISPATCHED },
        },
        data: {
          status: PackageStatus.DISPATCHED,
          verifiedAt: new Date(),
          verifiedByUserId: userId,
        },
      });

      if (updateCount.count === 0) {
        // Concurrently verified by another worker
        return {
          result: ScanResult.ALREADY_VERIFIED,
          message: 'Kiện hàng vừa được xác nhận xuất kho bởi thiết bị khác',
        };
      }

      // Deduct stock and write immutable ledger
      if (itemsToDispatch.length > 0) {
        await this.inventoryService.dispatchStockForPackage(
          tx,
          tenantId,
          warehouseId,
          itemsToDispatch,
          order.id,
          targetPackage.id,
          userId,
        );
      }

      // Check if all packages in the order are now DISPATCHED
      const remainingUnverified = await tx.package.count({
        where: {
          orderId: order.id,
          status: { not: PackageStatus.DISPATCHED },
        },
      });

      const totalPackages = order.packages.length;
      const verifiedPackages = totalPackages - remainingUnverified;
      const allVerified = remainingUnverified === 0;

      await tx.order.update({
        where: { id: order.id },
        data: {
          verificationStatus: allVerified
            ? VerificationStatus.VERIFIED
            : VerificationStatus.PARTIALLY_VERIFIED,
          fulfillmentStatus: allVerified
            ? FulfillmentStatus.DISPATCHED
            : order.fulfillmentStatus,
        },
      });

      // Log successful scan event
      await tx.scanEvent.create({
        data: {
          tenantId,
          shopId: order.shopId,
          warehouseId,
          orderId: order.id,
          packageId: targetPackage.id,
          rawCode,
          normalizedCode,
          scanResult: ScanResult.VERIFIED,
          deviceId: dto.deviceId,
          performedByUserId: userId,
          idempotencyKey,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'SCAN_VERIFY_DISPATCH',
        entityType: 'Package',
        entityId: targetPackage.id,
        newValues: {
          packageCode: targetPackage.packageCode,
          orderId: order.id,
          allVerified,
          verifiedPackages,
          totalPackages,
        },
      });

      return {
        result: ScanResult.VERIFIED,
        message: allVerified
          ? 'Xác nhận xuất kho hoàn tất thành công cho toàn bộ đơn hàng!'
          : `Xác nhận kiện hàng thành công (${verifiedPackages}/${totalPackages} kiện đã quét)`,
        package: {
          id: targetPackage.id,
          packageCode: targetPackage.packageCode,
          trackingCode: targetPackage.trackingCode,
          status: PackageStatus.DISPATCHED,
          verifiedAt: new Date(),
        },
        order: {
          id: order.id,
          externalOrderId: order.externalOrderId,
          internalOrderCode: order.internalOrderCode,
          totalPackages,
          verifiedPackages,
          verificationStatus: allVerified
            ? VerificationStatus.VERIFIED
            : VerificationStatus.PARTIALLY_VERIFIED,
        },
      };
    });
  }

  // REVERSAL USE CASE: In case of accidental scan
  async reverseDispatch(tenantId: string, userId: string, dto: ReverseDispatchDto) {
    const pkg = await this.prisma.package.findFirst({
      where: { id: dto.packageId, tenantId },
      include: {
        order: {
          include: {
            shop: true,
            packages: true,
          },
        },
        packageItems: {
          include: { orderItem: true },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException('Không tìm thấy kiện hàng');
    }

    if (pkg.status !== PackageStatus.DISPATCHED) {
      throw new BadRequestException('Kiện hàng chưa ở trạng thái xuất kho, không thể hoàn tác');
    }

    const order = pkg.order;
    const warehouseId = order.shop.defaultWarehouseId;
    if (!warehouseId) {
      throw new BadRequestException('Shop chưa được cấu hình Kho');
    }

    const itemsToRestore = pkg.packageItems
      .filter((pi: any) => !!pi.orderItem.variantId)
      .map((pi: any) => ({
        variantId: pi.orderItem.variantId,
        quantity: pi.quantity,
      }));

    return this.prisma.$transaction(async (tx) => {
      // Revert package status
      await tx.package.update({
        where: { id: pkg.id },
        data: {
          status: PackageStatus.READY,
          verifiedAt: null,
          verifiedByUserId: null,
        },
      });

      // Restore stock: increment onHand and reserved, write compensatory ledger
      for (const item of itemsToRestore) {
        await tx.inventoryBalance.update({
          where: {
            tenantId_warehouseId_variantId: {
              tenantId,
              warehouseId,
              variantId: item.variantId,
            },
          },
          data: {
            onHand: { increment: item.quantity },
            reserved: { increment: item.quantity },
          },
        });

        await tx.inventoryLedger.create({
          data: {
            tenantId,
            warehouseId,
            variantId: item.variantId,
            movementType: InventoryMovementType.ADJUST,
            deltaOnHand: item.quantity,
            deltaReserved: item.quantity,
            referenceType: 'SCAN_REVERSAL',
            referenceId: pkg.id,
            performedByUserId: userId,
            note: `Hoàn tác quét xuất kiện ${pkg.packageCode}: ${dto.reason}`,
          },
        });
      }

      // Re-evaluate order verification status
      const verifiedCount = await tx.package.count({
        where: {
          orderId: order.id,
          status: PackageStatus.DISPATCHED,
        },
      });

      const newVerificationStatus =
        verifiedCount === 0
          ? VerificationStatus.NOT_VERIFIED
          : VerificationStatus.PARTIALLY_VERIFIED;

      await tx.order.update({
        where: { id: order.id },
        data: {
          verificationStatus: newVerificationStatus,
          fulfillmentStatus: FulfillmentStatus.RESERVED,
          note: `${order.note || ''} [Hoàn tác quét kiện ${pkg.packageCode}: ${dto.reason}]`,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'SCAN_REVERSAL',
        entityType: 'Package',
        entityId: pkg.id,
        newValues: { reason: dto.reason },
      });

      return {
        message: 'Đã hoàn tác xuất kho kiện hàng thành công',
        packageId: pkg.id,
        newVerificationStatus,
      };
    });
  }

  async getScanHistory(
    tenantId: string,
    filter: { limit?: number; warehouseId?: string; result?: string },
  ) {
    const limit = Math.min(filter.limit ? Number(filter.limit) : 50, 100);
    const where: any = { tenantId };
    if (filter.warehouseId) {
      where.warehouseId = filter.warehouseId;
    }
    if (filter.result && Object.values(ScanResult).includes(filter.result as any)) {
      where.scanResult = filter.result as ScanResult;
    }

    const events = await this.prisma.scanEvent.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            externalOrderId: true,
            internalOrderCode: true,
            trackingCode: true,
            buyerUsername: true,
            platformStatus: true,
            verificationStatus: true,
            totalAmount: true,
            shippingCarrier: true,
            shop: { select: { id: true, name: true, code: true } },
            orderItems: {
              select: {
                id: true,
                productName: true,
                variationName: true,
                quantity: true,
              },
              take: 3,
            },
          },
        },
        package: {
          select: {
            id: true,
            packageCode: true,
            trackingCode: true,
            carrierName: true,
            status: true,
            verifiedAt: true,
          },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const verifiedPackages = await this.prisma.package.findMany({
      where: {
        tenantId,
        status: PackageStatus.DISPATCHED,
        ...(filter.warehouseId ? { order: { shop: { defaultWarehouseId: filter.warehouseId } } } : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            externalOrderId: true,
            internalOrderCode: true,
            trackingCode: true,
            buyerUsername: true,
            platformStatus: true,
            verificationStatus: true,
            totalAmount: true,
            shippingCarrier: true,
            shop: { select: { id: true, name: true, code: true } },
            orderItems: {
              select: {
                id: true,
                productName: true,
                variationName: true,
                quantity: true,
              },
              take: 3,
            },
          },
        },
      },
      orderBy: { verifiedAt: 'desc' },
      take: limit,
    });

    return {
      events,
      verifiedPackages,
      totalEvents: events.length,
      totalVerifiedPackages: verifiedPackages.length,
    };
  }

  async batchVerifyDispatch(
    tenantId: string,
    userId: string,
    dto: { codes: string[]; warehouseId?: string; deviceId?: string; sessionName?: string },
  ) {
    const rawCodes = dto.codes || [];
    const results: any[] = [];
    let verifiedCount = 0;
    let alreadyVerifiedCount = 0;
    let notFoundCount = 0;
    let failedCount = 0;

    for (const code of rawCodes) {
      const cleanCode = this.normalizeCode(code);
      if (!cleanCode) continue;

      try {
        const res: any = await this.verifyDispatch(tenantId, userId, {
          code: cleanCode,
          warehouseId: dto.warehouseId,
          deviceId: dto.deviceId || 'BATCH_SESSION',
        });

        if (res.result === ScanResult.VERIFIED) {
          verifiedCount++;
        } else if (res.result === ScanResult.ALREADY_VERIFIED) {
          alreadyVerifiedCount++;
        } else if (res.result === ScanResult.NOT_FOUND) {
          notFoundCount++;
        } else {
          failedCount++;
        }

        results.push({
          code: cleanCode,
          result: res.result,
          message: res.message,
          orderId: res.order?.externalOrderId || res.externalOrderId,
          internalOrderCode: res.order?.internalOrderCode,
          carrierName: res.package?.carrierName,
          shopName: res.package?.order?.shop?.name || res.order?.shop?.name,
          packageCode: res.package?.packageCode || res.packageCode,
          packageId: res.package?.id || res.packageId,
        });
      } catch (err: any) {
        failedCount++;
        results.push({
          code: cleanCode,
          result: 'ERROR',
          message: err.message || 'Lỗi xử lý xác nhận đơn hàng',
        });
      }
    }

    return {
      total: rawCodes.length,
      verifiedCount,
      alreadyVerifiedCount,
      notFoundCount,
      failedCount,
      items: results,
    };
  }
}


