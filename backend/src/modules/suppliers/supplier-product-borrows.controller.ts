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
import { SupplierProductBorrowsService } from './supplier-product-borrows.service';
import {
  CreateSupplierProductBorrowDto,
  ReturnSupplierProductBorrowDto,
  ConvertBorrowToPurchaseDto,
  SupplierProductBorrowFilterDto,
} from './dto/supplier-product-borrow.dto';
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

@ApiTags('Supplier Product Borrows (Mượn & Vay sản phẩm NCC)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/supplier-product-borrows')
export class SupplierProductBorrowsController {
  constructor(private readonly borrowsService: SupplierProductBorrowsService) {}

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách các phiếu mượn/cho mượn sản phẩm NCC' })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query() filter: SupplierProductBorrowFilterDto,
  ) {
    return this.borrowsService.findAll(tenantId, filter);
  }

  @Get(':id')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Xem chi tiết một phiếu mượn sản phẩm' })
  async findOne(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.borrowsService.findOne(tenantId, id);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Lập phiếu mượn sản phẩm từ NCC hoặc cho NCC mượn' })
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupplierProductBorrowDto,
  ) {
    return this.borrowsService.create(tenantId, user.id, dto);
  }

  @Post('return')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Xuất trả lại sản phẩm đã mượn cho NCC' })
  async returnItems(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReturnSupplierProductBorrowDto,
  ) {
    return this.borrowsService.returnItems(tenantId, user.id, dto);
  }

  @Post('convert-to-purchase')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Chuyển hàng đang mượn thành hàng mua đứt (sinh phiếu nhập kho & công nợ)' })
  async convertToPurchase(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConvertBorrowToPurchaseDto,
  ) {
    return this.borrowsService.convertToPurchase(tenantId, user.id, dto);
  }
}
