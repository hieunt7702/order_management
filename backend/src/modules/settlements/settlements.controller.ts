import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { SettlementsService } from './settlements.service';
import { RecordSettlementDto } from './dto/settlement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId, CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';

@ApiTags('Settlements & Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Lấy danh sách các bản ghi đối soát tài chính' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'shopId', required: false, type: String })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('shopId') shopId?: string,
  ) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.settlementsService.findAll(
      tenantId,
      parseInt(page, 10),
      parseInt(limit, 10),
      shopId,
      allowedShopIds,
    );
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Ghi nhận đối soát tiền thực nhận từ sàn Shopee cho đơn hàng' })
  async recordSettlement(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordSettlementDto,
  ) {
    return this.settlementsService.recordSettlement(tenantId, user.id, dto);
  }
}
