import { Controller, Get, Query, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { DashboardFilterDto, PurchaseReportFilterDto, OrderReconciliationReportFilterDto } from './dto/report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';
import { Request } from 'express';

@ApiTags('Reports & Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({
    summary: 'Lấy các chỉ số tổng quan Dashboard (GMV, doanh thu, xuất kho, top sản phẩm, cảnh báo tồn thấp)',
  })
  async getDashboard(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Query() filter: DashboardFilterDto,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.reportsService.getDashboardSummary(tenantId, allowedShopIds, filter);
  }

  @Get('purchases')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({
    summary: 'Báo cáo tổng hợp nhập hàng: phân tích theo cửa hàng, thời gian, nhà cung cấp, cơ cấu SKU',
  })
  async getPurchaseReport(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Query() filter: PurchaseReportFilterDto,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.reportsService.getPurchaseReport(tenantId, allowedShopIds, filter);
  }

  @Get('order-reconciliation')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({
    summary: 'Báo cáo đối soát đơn hàng: so khớp số lượng đơn hàng đi vs số lượng sản phẩm nhập kho theo sản phẩm hệ thống',
  })
  async getOrderReconciliationReport(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Query() filter: OrderReconciliationReportFilterDto,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.reportsService.getOrderReconciliationReport(tenantId, allowedShopIds, filter);
  }

  @Get('order-reconciliation/shop-orders')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({
    summary: 'Báo cáo đối soát danh sách đơn hàng theo cửa hàng (gồm 38 đơn, đơn ảo, tiền COD, doanh thu nhập tay)',
  })
  async getShopOrdersReport(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Query() filter: OrderReconciliationReportFilterDto,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.reportsService.getShopOrdersReport(tenantId, allowedShopIds, filter);
  }

  @Get('order-reconciliation/:variantId/transactions')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({
    summary: 'Chi tiết các lần nhập kho và đơn hàng xuất đi của 1 sản phẩm / SKU hệ thống',
  })
  async getOrderReconciliationTransactions(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Param('variantId') variantId: string,
    @Query() filter: OrderReconciliationReportFilterDto,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.reportsService.getOrderReconciliationTransactions(tenantId, allowedShopIds, variantId, filter);
  }
}

