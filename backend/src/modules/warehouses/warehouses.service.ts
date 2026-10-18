import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { WarehouseStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.warehouse.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
    });
    if (!wh) {
      throw new NotFoundException('Không tìm thấy kho hàng trong Workspace này');
    }
    return wh;
  }

  async generateNextWarehouseCode(tenantId: string): Promise<string> {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { tenantId, code: { startsWith: 'KHO' } },
      select: { code: true },
    });
    let maxNum = 0;
    for (const w of warehouses) {
      const match = w.code.match(/^KHO[-_]?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    let candidateNum = maxNum + 1;
    let candidateCode = `KHO-${String(candidateNum).padStart(2, '0')}`;
    while (
      await this.prisma.warehouse.findUnique({
        where: { tenantId_code: { tenantId, code: candidateCode } },
      })
    ) {
      candidateNum++;
      candidateCode = `KHO-${String(candidateNum).padStart(2, '0')}`;
    }
    return candidateCode;
  }

  async create(tenantId: string, dto: CreateWarehouseDto) {
    let finalCode = dto.code?.trim().toUpperCase();
    if (!finalCode) {
      finalCode = await this.generateNextWarehouseCode(tenantId);
    } else {
      const existing = await this.prisma.warehouse.findUnique({
        where: {
          tenantId_code: {
            tenantId,
            code: finalCode,
          },
        },
      });
      if (existing) {
        finalCode = await this.generateNextWarehouseCode(tenantId);
      }
    }

    const status =
      dto.isActive !== undefined
        ? dto.isActive
          ? WarehouseStatus.ACTIVE
          : WarehouseStatus.INACTIVE
        : WarehouseStatus.ACTIVE;

    return this.prisma.warehouse.create({
      data: {
        tenantId,
        code: finalCode,
        name: dto.name,
        address: dto.address,
        status,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateWarehouseDto) {
    await this.findOne(tenantId, id);

    let status = dto.status;
    if (status === undefined && dto.isActive !== undefined) {
      status = dto.isActive ? WarehouseStatus.ACTIVE : WarehouseStatus.INACTIVE;
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        ...(status !== undefined ? { status } : {}),
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            inventoryBalances: true,
            inventoryLedgers: true,
          },
        },
      },
    });

    if (!wh) {
      throw new NotFoundException('Không tìm thấy kho hàng trong Workspace này');
    }

    if (wh._count.inventoryBalances > 0 || wh._count.inventoryLedgers > 0) {
      await this.prisma.warehouse.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
      return { success: true, message: 'Kho đã có dữ liệu tồn kho/sổ cái, đã chuyển trạng thái ngừng hoạt động' };
    }

    await this.prisma.warehouse.delete({
      where: { id },
    });

    return { success: true, message: 'Đã xóa kho hàng thành công' };
  }
}

