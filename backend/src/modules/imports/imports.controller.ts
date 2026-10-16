import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { UploadImportDto, ConfirmImportDto } from './dto/import.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId, CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';

@ApiTags('Shopee Import Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('upload')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải lên file Excel/CSV đơn hàng Shopee để kiểm tra và phân tích' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        shopId: { type: 'string', example: 'shop-uuid' },
        warehouseId: { type: 'string', example: 'warehouse-uuid' },
      },
      required: ['file', 'shopId'],
    },
  })
  async uploadFile(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 25 * 1024 * 1024 }), // 25MB
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadImportDto,
  ) {
    return this.importsService.uploadFile(tenantId, user.id, file, dto);
  }

  @Get(':id/preview')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Xem trước thống kê kết quả phân tích file (đơn hợp lệ, SKU chưa mapping)' })
  async getPreview(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.importsService.getPreview(tenantId, id);
  }

  @Post(':id/confirm')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({ summary: 'Xác nhận áp dụng import đơn hàng vào hệ thống theo batch' })
  async confirmImport(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmImportDto,
  ) {
    return this.importsService.confirmImport(tenantId, id, user.id, dto);
  }
}
