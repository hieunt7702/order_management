import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';

import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShopsService } from './shops.service';
import { CreateShopDto, UpdateShopDto } from './dto/shop.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ShopGuard } from '../../common/guards/shop.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';
import { Request } from 'express';

@ApiTags('Shops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, ShopGuard)
@Controller('api/v1/shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách các Shop thuộc Workspace (kèm lọc theo phân quyền user)' })
  async findAll(@CurrentTenantId() tenantId: string, @Req() req: Request) {
    const allowedShopIds = (req as any).allowedShopIds;
    return this.shopsService.findAll(tenantId, allowedShopIds);
  }

  @Get('next-code')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy mã shop tự sinh tiếp theo không trùng lặp' })
  async getNextCode(@CurrentTenantId() tenantId: string) {
    const code = await this.shopsService.generateNextShopCode(tenantId);
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
  @ApiOperation({ summary: 'Lấy chi tiết một Shop' })
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.shopsService.findOne(tenantId, id);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Tạo mới một Shop' })
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateShopDto) {
    return this.shopsService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin Shop' })
  async update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShopDto,
  ) {
    return this.shopsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Xóa hoặc ngừng hoạt động Shop' })
  async delete(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.shopsService.delete(tenantId, id);
  }
}

