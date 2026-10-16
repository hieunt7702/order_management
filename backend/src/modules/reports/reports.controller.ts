import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { DashboardFilterDto } from './dto/report.dto';
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
}
