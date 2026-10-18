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
import { PurchaseReceiptsService } from './purchase-receipts.service';
import {
  CreatePurchaseReceiptDto,
  UpdatePurchaseReceiptDto,
  PurchaseReceiptFilterDto,
} from './dto/purchase-receipt.dto';
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

@ApiTags('Purchase Receipts (Nhập kho & Công nợ)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/purchase-receipts')
export class PurchaseReceiptsController {
  constructor(private readonly receiptsService: PurchaseReceiptsService) {}

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách phiếu nhập kho' })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query() filter: PurchaseReceiptFilterDto,
  ) {
    return this.receiptsService.findAll(tenantId, filter);
  }

  @Get('next-code')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy mã phiếu nhập kho tiếp theo tự động' })
  async getNextCode(@CurrentTenantId() tenantId: string) {
    const code = await this.receiptsService.generateUniqueReceiptCode(tenantId);
    return { code };
  }

  @Get(':id')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy chi tiết một phiếu nhập kho kèm phân bổ thanh toán' })
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.receiptsService.findOne(tenantId, id);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Tạo phiếu nhập kho, tăng tồn kho và ghi nhận công nợ' })
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseReceiptDto,
  ) {
    return this.receiptsService.create(tenantId, user.id, dto);
  }

  @Patch(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Cập nhật thông tin phiếu nhập kho (hạn nợ, ghi chú, chiết khấu)' })
  async update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseReceiptDto,
  ) {
    return this.receiptsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Hủy phiếu nhập kho và đảo ngược số lượng tồn kho' })
  async delete(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.receiptsService.delete(tenantId, id);
  }
}
