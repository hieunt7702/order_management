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
import { PurchaseReturnsService } from './purchase-returns.service';
import {
  CreatePurchaseReturnDto,
  PurchaseReturnFilterDto,
} from './dto/purchase-return.dto';
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

@ApiTags('Purchase Returns (Trả hàng NCC & Giảm trừ công nợ)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/purchase-returns')
export class PurchaseReturnsController {
  constructor(private readonly returnsService: PurchaseReturnsService) {}

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách các phiếu xuất trả hàng nhà cung cấp' })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query() filter: PurchaseReturnFilterDto,
  ) {
    return this.returnsService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy chi tiết phiếu xuất trả hàng' })
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.returnsService.findOne(tenantId, id);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE, MembershipRole.ACCOUNTANT)
  @ApiOperation({
    summary: 'Tạo phiếu xuất trả hàng, trừ tồn kho và ghi nhận giảm trừ công nợ NCC',
  })
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseReturnDto,
  ) {
    return this.returnsService.create(tenantId, user.id, dto);
  }

  @Delete(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Hủy phiếu trả hàng và khôi phục lại tồn kho & công nợ' })
  async delete(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.returnsService.delete(tenantId, id);
  }
}
