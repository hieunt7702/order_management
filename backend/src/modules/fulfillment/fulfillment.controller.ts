import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { FulfillmentService } from './fulfillment.service';
import { ScanBarcodeDto, ReverseDispatchDto, ScanHistoryFilterDto, BatchVerifyScanDto } from './dto/fulfillment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenantId, CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MembershipRole } from '@prisma/client';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { Request } from 'express';

@ApiTags('Fulfillment & Scanning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/fulfillment')
export class FulfillmentController {
  constructor(private readonly fulfillmentService: FulfillmentService) {}

  @Post('scan')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Khóa idempotency chống quét lặp tầng request' })
  @ApiOperation({
    summary: 'Quét barcode (mã đơn, mã vận đơn, mã kiện) xác nhận xuất kho và giảm tồn kho thực tế',
  })
  async scanBarcode(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ScanBarcodeDto,
    @Req() req: Request,
  ) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    return this.fulfillmentService.verifyDispatch(tenantId, user.id, dto, idempotencyKey);
  }

  @Post('batch-verify')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.WAREHOUSE)
  @ApiOperation({
    summary: 'Xác nhận đối soát hàng loạt danh sách các mã đã quét trong phiên xuất kho',
  })
  async batchVerify(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BatchVerifyScanDto,
  ) {
    return this.fulfillmentService.batchVerifyDispatch(tenantId, user.id, dto);
  }

  @Post('reverse')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Hoàn tác thao tác quét xuất kho khi nhân viên quét nhầm kiện' })
  async reverseDispatch(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReverseDispatchDto,
  ) {
    return this.fulfillmentService.reverseDispatch(tenantId, user.id, dto);
  }

  @Get('history')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.WAREHOUSE,
    MembershipRole.ACCOUNTANT,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lấy lịch sử các lần quét xuất kho (ScanEvents & Packages đã xác nhận)' })
  async getScanHistory(
    @CurrentTenantId() tenantId: string,
    @Query() filter: ScanHistoryFilterDto,
  ) {
    return this.fulfillmentService.getScanHistory(tenantId, filter);
  }
}

