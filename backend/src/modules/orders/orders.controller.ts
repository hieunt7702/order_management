import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  OrderFilterDto,
  CancelOrderDto,
  ReceiveReturnDto,
  CreateOrderDto,
  UpdateOrderDto,
  BulkDeleteOrdersDto,
  MarkVirtualOrderDto,
  BulkMarkVirtualOrdersDto,
  MarkDispatchedDto,
  BulkMarkDispatchedDto,
  ReverseDispatchedDto,
} from './dto/order.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId, CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';
import { Request } from 'express';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách đơn hàng có bộ lọc đa tiêu chí (shop, trạng thái, ngày, tìm kiếm)' })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Query() filter: OrderFilterDto,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.ordersService.findAll(tenantId, allowedShopIds, filter);
  }

  @Get('summary')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy số liệu tổng quan các trạng thái đơn hàng toàn hệ thống / shop' })
  async getSummary(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Query('shopId') shopId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.ordersService.getSummary(tenantId, allowedShopIds, { shopId, fromDate, toDate });
  }

  @Get(':id')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy chi tiết đơn hàng (line items, packages, lịch sử scan)' })
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.ordersService.findOne(tenantId, id);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Tạo mới đơn hàng thủ công' })
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(tenantId, user.id, dto);
  }

  @Patch(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Cập nhật thông tin đơn hàng' })
  async update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateOrder(tenantId, id, user.id, dto);
  }

  @Delete(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Xóa đơn hàng' })
  async delete(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.deleteOrder(tenantId, id, user.id);
  }

  @Post('bulk-delete')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Xóa nhiều đơn hàng hoặc xóa toàn bộ đơn hàng' })
  async bulkDelete(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkDeleteOrdersDto,
  ) {
    return this.ordersService.bulkDeleteOrders(tenantId, user.id, dto);
  }

  @Patch(':id/virtual')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Đánh dấu đơn hàng là đơn ảo và thiết lập có đi hàng thật hay không' })
  async markVirtual(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkVirtualOrderDto,
  ) {
    return this.ordersService.markVirtualOrder(tenantId, id, user.id, dto);
  }

  @Post('bulk-virtual')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Đánh dấu hàng loạt đơn hàng là đơn ảo hoặc khôi phục đơn thường' })
  async bulkMarkVirtual(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkMarkVirtualOrdersDto,
  ) {
    return this.ordersService.bulkMarkVirtualOrders(tenantId, user.id, dto);
  }

  @Post(':id/reserve')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Thực hiện giữ hàng (reserve) cho đơn hàng' })
  async reserveOrder(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.reserveOrder(tenantId, id, user.id);
  }

  @Post(':id/cancel')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Hủy đơn hàng (giải phóng giữ hàng nếu chưa xuất kho)' })
  async cancelOrder(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(tenantId, id, user.id, dto);
  }

  @Post(':id/receive-return')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Xác nhận nhập lại hàng hoàn thực tế vào kho cho đơn đã xuất' })
  async receiveReturn(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReceiveReturnDto,
  ) {
    return this.ordersService.receiveReturn(tenantId, id, user.id, dto);
  }

  @Post(':id/dispatch')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Đánh dấu đơn hàng là đã xuất kho / đã quét' })
  async markDispatched(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkDispatchedDto,
  ) {
    return this.ordersService.markDispatched(tenantId, id, user.id, dto);
  }

  @Post('bulk-dispatch')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Đánh dấu xuất kho / đã quét hàng loạt đơn hàng' })
  async bulkMarkDispatched(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkMarkDispatchedDto,
  ) {
    return this.ordersService.bulkMarkDispatched(tenantId, user.id, dto);
  }

  @Post(':id/reverse-dispatch')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Hoàn tác xuất kho đơn hàng (phục hồi tồn kho nếu là đơn thật)' })
  async reverseDispatched(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReverseDispatchedDto,
  ) {
    return this.ordersService.reverseDispatched(tenantId, id, user.id, dto);
  }
}
