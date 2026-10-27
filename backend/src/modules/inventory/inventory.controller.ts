import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { ReceiveStockDto, AdjustStockDto } from './dto/inventory.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId, CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@ApiTags('Inventory & Ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('balances')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy số dư tồn kho theo SKU và kho (onHand, reserved, available, cảnh báo tồn thấp)' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getBalances(
    @CurrentTenantId() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.getBalances(tenantId, warehouseId, search);
  }

  @Get('variant/:variantId/summary')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy 5 chỉ số tồn kho cốt lõi của biến thể SKU (Thực tế, Đạt chuẩn bán, Giữ chỗ, Có thể bán thêm, Đang hoàn về, Hàng lỗi)' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  async getVariantSummary(
    @CurrentTenantId() tenantId: string,
    @Param('variantId') variantId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.getVariantInventorySummary(tenantId, variantId, warehouseId);
  }

  @Get('ledger')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Xem lịch sử sổ cái biến động kho bất biến (Inventory Ledger) kèm tồn trước -> sau' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  @ApiQuery({ name: 'variantId', required: false, type: String })
  @ApiQuery({ name: 'sku', required: false, type: String })
  @ApiQuery({ name: 'movementType', required: false, type: String })
  @ApiQuery({ name: 'stockState', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getLedger(
    @CurrentTenantId() tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('warehouseId') warehouseId?: string,
    @Query('variantId') variantId?: string,
    @Query('sku') sku?: string,
    @Query('movementType') movementType?: any,
    @Query('stockState') stockState?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.inventoryService.getLedger(tenantId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      warehouseId,
      variantId,
      sku,
      movementType,
      stockState,
      search,
      startDate,
      endDate,
    });
  }

  @Post('receive')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Khóa idempotency chống nhập lặp' })
  @ApiOperation({ summary: 'Nhập kho hàng hóa (Tăng onHand và ghi bút toán RECEIVE)' })
  async receiveStock(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReceiveStockDto,
  ) {
    return this.inventoryService.receiveStock(tenantId, user.id, dto);
  }

  @Post('adjust')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Khóa idempotency chống điều chỉnh lặp' })
  @ApiOperation({ summary: 'Điều chỉnh tồn kho có lý do kiểm kê (Ghi bút toán ADJUST)' })
  async adjustStock(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adjustStock(tenantId, user.id, dto);
  }

  @Get('reconciliation')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Kiểm tra đối soát chênh lệch giữa số dư thực tế và tổng phát sinh sổ cái' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  async reconcile(
    @CurrentTenantId() tenantId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.reconcileBalances(tenantId, warehouseId);
  }

  @Post('heal-multiplier-discrepancies')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Tự động chữa lành các bút toán xuất kho bị lệch hệ số multiplier và tính lại tồn kho lũy kế' })
  async healMultiplierDiscrepancies(
    @CurrentTenantId() tenantId: string,
    @Body() body?: { variantId?: string; warehouseId?: string },
  ) {
    if (body?.variantId) {
      await this.inventoryService.healVariantDispatchedLedgerEntries(tenantId, body.variantId, body.warehouseId);
      await this.inventoryService.healCancelledOrdersRestock(tenantId, body.variantId, body.warehouseId);
    } else {
      await this.inventoryService.healAllDispatchedLedgerEntries(tenantId);
      await this.inventoryService.healCancelledOrdersRestock(tenantId);
    }
    return { success: true, message: 'Đã hoàn tất đối soát và chữa lành số lượng xuất kho cùng chuỗi tồn kho lũy kế' };
  }
}
