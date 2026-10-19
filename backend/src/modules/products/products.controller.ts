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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  CreateVariantDto,
  UpdateProductDto,
  CreateListingMappingDto,
  BulkListingMappingDto,
  UpdateVariantDto,
} from './dto/product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';

@ApiTags('Products & Listings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách sản phẩm và SKU nội bộ' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll(tenantId, parseInt(page, 10), parseInt(limit, 10), search);
  }

  @Get('mappings')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy danh sách liên kết listing sàn và SKU nội bộ (Listing Mappings)' })
  @ApiQuery({ name: 'shopId', required: false, type: String })
  async findMappings(
    @CurrentTenantId() tenantId: string,
    @Query('shopId') shopId?: string,
  ) {
    return this.productsService.findListingMappings(tenantId, shopId);
  }

  @Post('mappings')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Tạo hoặc cập nhật liên kết SKU sàn với SKU nội bộ' })
  async createMapping(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateListingMappingDto,
  ) {
    return this.productsService.createListingMapping(tenantId, dto);
  }

  @Post('mappings/bulk')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Gom nhiều sản phẩm sàn khác nhau về cùng 1 SKU kho nội bộ' })
  async bulkMapping(
    @CurrentTenantId() tenantId: string,
    @Body() dto: BulkListingMappingDto,
  ) {
    return this.productsService.bulkListingMapping(tenantId, dto);
  }

  @Delete('mappings/:id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Xóa liên kết mapping SKU sàn' })
  async deleteMapping(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.deleteListingMapping(tenantId, id);
  }

  @Get('variants')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy tất cả biến thể sản phẩm nội bộ để ánh xạ SKU' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAllVariants(
    @CurrentTenantId() tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '1000',
    @Query('search') search?: string,
  ) {
    return this.productsService.findAllVariants(
      tenantId,
      parseInt(page, 10) || 1,
      parseInt(limit, 10) || 1000,
      search,
    );
  }

  @Get('next-code')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy mã sản phẩm tự sinh tiếp theo không trùng lặp' })
  async getNextCode(@CurrentTenantId() tenantId: string) {
    const code = await this.productsService.generateNextProductCode(tenantId);
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
  @ApiOperation({ summary: 'Lấy chi tiết một sản phẩm kèm các biến thể' })
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.productsService.findOne(tenantId, id);
  }

  @Post()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Tạo mới sản phẩm cha kèm các biến thể SKU nội bộ' })
  async create(@CurrentTenantId() tenantId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(tenantId, dto);
  }

  @Patch('variants/:variantId')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Cập nhật biến thể SKU nội bộ (giá vốn, giá bán, barcode, ngưỡng tồn)' })
  async updateVariant(
    @CurrentTenantId() tenantId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(tenantId, variantId, dto);
  }

  @Delete('variants/:variantId')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Xóa hoặc lưu trữ biến thể SKU nội bộ' })
  async deleteVariant(
    @CurrentTenantId() tenantId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.productsService.deleteVariant(tenantId, variantId);
  }

  @Post(':id/variants')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Thêm biến thể mới vào sản phẩm đã có' })
  async addVariant(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.productsService.addVariant(tenantId, id, dto);
  }

  @Patch(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin sản phẩm (mã, tên, mô tả, trạng thái)' })
  async updateProduct(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Xóa hoặc lưu trữ sản phẩm' })
  async deleteProduct(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.deleteProduct(tenantId, id);
  }
}

