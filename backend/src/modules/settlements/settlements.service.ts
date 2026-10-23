import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RecordSettlementDto } from './dto/settlement.dto';
import { SettlementStatus, FinancialStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenantId: string, page = 1, limit = 50, shopId?: string, allowedShopIds?: string[] | null) {
    const skip = (page - 1) * limit;
    const where: any = {
      tenantId,
      ...(shopId && shopId !== 'ALL' ? { shopId } : {}),
    };

    if (allowedShopIds) {
      if (shopId && shopId !== 'ALL') {
        if (!allowedShopIds.includes(shopId)) {
          return { items: [], total: 0, page, limit };
        }
      } else {
        where.shopId = { in: allowedShopIds };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        include: {
          shop: { select: { id: true, code: true, name: true } },
          order: {
            select: {
              id: true,
              externalOrderId: true,
              internalOrderCode: true,
              totalAmount: true,
              cogsTotal: true,
            },
          },
        },
        orderBy: { settlementDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.settlement.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async recordSettlement(tenantId: string, userId: string, dto: RecordSettlementDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, tenantId, shopId: dto.shopId },
    });

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng trong Workspace');
    }

    const settlementDate = dto.settlementDate ? new Date(dto.settlementDate) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.upsert({
        where: {
          tenantId_shopId_orderId: {
            tenantId,
            shopId: dto.shopId,
            orderId: dto.orderId,
          },
        },
        update: {
          actualReceivedAmount: dto.actualReceivedAmount,
          commissionFee: dto.commissionFee ?? 0,
          serviceFee: dto.serviceFee ?? 0,
          transactionFee: dto.transactionFee ?? 0,
          settlementDate,
          status: SettlementStatus.RECONCILED,
          note: dto.note,
        },
        create: {
          tenantId,
          shopId: dto.shopId,
          orderId: dto.orderId,
          actualReceivedAmount: dto.actualReceivedAmount,
          commissionFee: dto.commissionFee ?? 0,
          serviceFee: dto.serviceFee ?? 0,
          transactionFee: dto.transactionFee ?? 0,
          settlementDate,
          status: SettlementStatus.RECONCILED,
          note: dto.note,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          financialStatus: FinancialStatus.SETTLED,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'SETTLEMENT_RECORDED',
        entityType: 'Settlement',
        entityId: settlement.id,
        newValues: { orderId: order.id, actualReceivedAmount: dto.actualReceivedAmount },
      });

      return settlement;
    });
  }
}
