import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { ClearDataDto } from './dto/clear-data.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId, CurrentUser } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';

@ApiTags('System')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Post('clear-data')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Clear toàn bộ dữ liệu giao dịch, đơn hàng, kho, tài chính của Tenant' })
  async clearData(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: ClearDataDto,
  ) {
    return this.systemService.clearTenantData(tenantId, user?.id || user?.sub, dto);
  }
}
