import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierTransfersService } from './supplier-transfers.service';
import {
  CreateSupplierTransferDto,
  SupplierTransferFilterDto,
} from './dto/supplier-transfer.dto';
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

@ApiTags('Supplier Transfers (Chuyển tiền / Cấn trừ giữa 2 Nhà Cung Cấp)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/supplier-transfers')
export class SupplierTransfersController {
  constructor(private readonly transfersService: SupplierTransfersService) {}

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách các giao dịch chuyển tiền giữa 2 NCC' })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query() filter: SupplierTransferFilterDto,
  ) {
    return this.transfersService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Xem chi tiết phiếu chuyển tiền giữa 2 NCC' })
  async findOne(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.transfersService.findOne(tenantId, id);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Tạo giao dịch chuyển tiền từ NCC A sang NCC B' })
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupplierTransferDto,
  ) {
    return this.transfersService.create(tenantId, user.id, dto);
  }

  @Delete(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Hủy / Xóa giao dịch chuyển tiền giữa 2 NCC (hoàn tác phân bổ)' })
  async delete(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.transfersService.delete(tenantId, id, user.id);
  }
}
