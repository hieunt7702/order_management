import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupplierLoansService } from './supplier-loans.service';
import {
  CreateSupplierLoanDto,
  CreateSupplierLoanRepaymentDto,
  SupplierLoanFilterDto,
} from './dto/supplier-loan.dto';
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

@ApiTags('Supplier Loans (Vay vốn & Cho vay với NCC)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/supplier-loans')
export class SupplierLoansController {
  constructor(private readonly loansService: SupplierLoansService) {}

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách các khoản vay / cho vay với NCC' })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query() filter: SupplierLoanFilterDto,
  ) {
    return this.loansService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Xem chi tiết một khoản vay và lịch sử trả nợ' })
  async findOne(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.loansService.findOne(tenantId, id);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Tạo mới một khoản vay vốn từ NCC hoặc cho NCC vay' })
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupplierLoanDto,
  ) {
    return this.loansService.create(tenantId, user.id, dto);
  }

  @Post('repay')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Ghi nhận đợt trả nợ hoặc thu hồi nợ vay' })
  async repay(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupplierLoanRepaymentDto,
  ) {
    return this.loansService.repay(tenantId, user.id, dto);
  }
}
