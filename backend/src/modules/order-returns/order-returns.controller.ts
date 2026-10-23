import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { OrderReturnsService } from './order-returns.service';
import {
  CreateOrderReturnDto,
  OrderReturnFilterDto,
} from './dto/order-return.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentTenantId,
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';

@ApiTags('Order Returns (Nhận hoàn & Kiểm tra hàng về kho)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/order-returns')
export class OrderReturnsController {
  constructor(private readonly orderReturnsService: OrderReturnsService) {}

  @Get('queue')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({
    summary: 'Danh sách chờ nhận hàng hoàn (Đơn hàng Shopee báo hoàn cần kho quét nhận và kiểm tra)',
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'shopId', required: false, type: String })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  async getReturnQueue(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('shopId') shopId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.orderReturnsService.getReturnQueue(tenantId, search, shopId, warehouseId, allowedShopIds);
  }

  @Post('inspect')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({
    summary:
      'Xác nhận nhận hàng hoàn, phân loại hàng bán được vs hàng lỗi, tăng tồn kho và ghi sổ cái bất biến',
  })
  async inspectAndReceive(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderReturnDto,
  ) {
    return this.orderReturnsService.inspectAndReceive(tenantId, user.id, dto);
  }

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lịch sử các phiếu kiểm tra nhận hàng hoàn' })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Query() filter: OrderReturnFilterDto,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.orderReturnsService.findAll(tenantId, filter, allowedShopIds);
  }

  @Get(':id')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Chi tiết một phiếu nhận hoàn kèm ảnh và tình trạng kiểm tra' })
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.orderReturnsService.findOne(tenantId, id);
  }
}
