import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierPaymentsService } from './supplier-payments.service';
import {
  CreateSupplierPaymentDto,
  SupplierPaymentFilterDto,
} from './dto/supplier-payment.dto';
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

@ApiTags('Supplier Payments (Thanh toán & Phân bổ công nợ NCC)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/supplier-payments')
export class SupplierPaymentsController {
  constructor(private readonly paymentsService: SupplierPaymentsService) {}

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách các khoản thanh toán / chi trả cho NCC' })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query() filter: SupplierPaymentFilterDto,
  ) {
    return this.paymentsService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Xem chi tiết một phiếu chi và danh sách phân bổ' })
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.paymentsService.findOne(tenantId, id);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({
    summary:
      'Lập phiếu chi trả nợ NCC (1 phiếu trả nhiều lần, 1 lần trả nhiều phiếu, tiền ứng trước, tiền cá nhân)',
  })
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupplierPaymentDto,
  ) {
    return this.paymentsService.create(tenantId, user.id, dto);
  }

  @Patch(':id/reimburse')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Xác nhận shop đã hoàn trả tiền cá nhân chi hộ' })
  async markReimbursed(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    return this.paymentsService.markReimbursed(tenantId, id, note);
  }

  @Delete(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Hủy phiếu chi và khôi phục lại công nợ các phiếu nhập' })
  async delete(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.paymentsService.delete(tenantId, id);
  }
}
