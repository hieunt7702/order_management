import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateShopDto, UpdateShopDto } from './dto/shop.dto';

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, allowedShopIds: string[] | null) {
    return this.prisma.shop.findMany({
      where: {
        tenantId,
        ...(allowedShopIds ? { id: { in: allowedShopIds } } : {}),
      },
      include: {
        defaultWarehouse: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { id, tenantId },
      include: {
        defaultWarehouse: true,
      },
    });

    if (!shop) {
      throw new NotFoundException('Không tìm thấy Shop trong Workspace này');
    }

    return shop;
  }

  async create(tenantId: string, dto: CreateShopDto) {
    // Check if code exists in tenant
    const existingCode = await this.prisma.shop.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: dto.code,
        },
      },
    });
    if (existingCode) {
      throw new ConflictException(`Mã shop "${dto.code}" đã tồn tại trong Workspace`);
    }

    // If externalShopId provided, check composite unique
    if (dto.externalShopId) {
      const existingExternal = await this.prisma.shop.findUnique({
        where: {
          tenantId_platform_externalShopId: {
            tenantId,
            platform: dto.platform || 'SHOPEE',
            externalShopId: dto.externalShopId,
          },
        },
      });
      if (existingExternal) {
        throw new ConflictException('External Shop ID này đã được liên kết trong Workspace');
      }
    }

    // Verify default warehouse belongs to SAME tenant
    if (dto.defaultWarehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: dto.defaultWarehouseId, tenantId },
      });
      if (!warehouse) {
        throw new BadRequestException('Kho hàng mặc định không thuộc Workspace hiện tại');
      }
    }

    return this.prisma.shop.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        platform: dto.platform || 'SHOPEE',
        externalShopId: dto.externalShopId,
        defaultWarehouseId: dto.defaultWarehouseId,
      },
      include: {
        defaultWarehouse: true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateShopDto) {
    await this.findOne(tenantId, id);

    if (dto.defaultWarehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: dto.defaultWarehouseId, tenantId },
      });
      if (!warehouse) {
        throw new BadRequestException('Kho hàng mặc định không thuộc Workspace hiện tại');
      }
    }

    return this.prisma.shop.update({
      where: { id },
      data: {
        name: dto.name,
        defaultWarehouseId: dto.defaultWarehouseId,
        status: dto.status,
      },
      include: {
        defaultWarehouse: true,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            orders: true,
            settlements: true,
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException('Không tìm thấy Shop trong Workspace này');
    }

    if (shop._count.orders > 0 || shop._count.settlements > 0) {
      await this.prisma.shop.update({
        where: { id },
        data: { status: 'INACTIVE' },
      });
      return { success: true, message: 'Shop đã có dữ liệu đơn hàng/đối soát, đã chuyển trạng thái ngừng hoạt động' };
    }

    await this.prisma.shop.delete({
      where: { id },
    });

    return { success: true, message: 'Đã xóa Shop thành công' };
  }
}

