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
import { SuppliersService } from './suppliers.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierFilterDto,
} from './dto/supplier.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';

@ApiTags('Suppliers & AP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get('debt-reports')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Báo cáo tổng quan công nợ NCC, hạn nợ, hoàn trả tiền cá nhân' })
  async getDebtReports(@CurrentTenantId() tenantId: string) {
    return this.suppliersService.getDebtReports(tenantId);
  }

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Danh sách nhà cung cấp kèm số dư công nợ theo thời gian thực' })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query() filter: SupplierFilterDto,
  ) {
    return this.suppliersService.findAll(tenantId, filter);
  }

  @Get('next-code')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy mã nhà cung cấp tiếp theo tự động' })
  async getNextCode(@CurrentTenantId() tenantId: string) {
    const code = await this.suppliersService.generateNextSupplierCode(tenantId);
    return { code };
  }

  @Get(':id')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Chi tiết nhà cung cấp và số dư công nợ hiện tại' })
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.suppliersService.findOne(tenantId, id);
  }

  @Get(':id/statement')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({
    summary: 'Sao kê dòng thời gian 360° công nợ NCC (nhập hàng, trả nợ, trả hàng, hoàn tiền)',
  })
  async getStatement(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.suppliersService.getStatement(tenantId, id, startDate, endDate);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Tạo mới nhà cung cấp' })
  async create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.suppliersService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Cập nhật thông tin nhà cung cấp' })
  async update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Xóa hoặc ngừng hoạt động nhà cung cấp' })
  async delete(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.suppliersService.delete(tenantId, id);
  }
}
