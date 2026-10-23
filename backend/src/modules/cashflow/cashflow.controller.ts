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
import { CashflowService } from './cashflow.service';
import { ReconciliationService } from './reconciliation.service';
import {
  CreateCashAccountDto,
  UpdateCashAccountDto,
  CreateCashCategoryDto,
  UpdateCashCategoryDto,
  CreateCashTransactionDto,
  CreateInternalTransferDto,
  CashflowFilterDto,
  ReconciliationFilterDto,
  BatchImportSettlementDto,
} from './dto/cashflow.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentTenantId,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { MembershipRole, CashCategoryType } from '@prisma/client';

@ApiTags('Cashflow & Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('api/v1/cashflow')
export class CashflowController {
  constructor(
    private readonly cashflowService: CashflowService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  // -------------------------------------------------------------
  // 1. TỔNG QUAN TIỀN
  // -------------------------------------------------------------
  @Get('overview')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Tổng quan số dư tài khoản, dòng tiền, nợ NCC, tiền sàn chờ đối soát' })
  async getOverview(
    @CurrentTenantId() tenantId: string,
    @Query('shopId') shopId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.cashflowService.getOverview(tenantId, { shopId, startDate, endDate });
  }

  // -------------------------------------------------------------
  // 2. TÀI KHOẢN TIỀN
  // -------------------------------------------------------------
  @Get('accounts')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Danh sách các tài khoản tiền mặt, ngân hàng, ví sàn Shopee' })
  async getAccounts(@CurrentTenantId() tenantId: string) {
    return this.cashflowService.getAccounts(tenantId);
  }

  @Get('accounts/:id/transactions')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Lịch sử giao dịch nạp rút, biến động số dư của một tài khoản' })
  async getAccountTransactions(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Query() filter: CashflowFilterDto,
  ) {
    return this.cashflowService.getTransactions(tenantId, { ...filter, accountId: id });
  }

  @Post('accounts')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Tạo tài khoản tiền mới' })
  async createAccount(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateCashAccountDto,
  ) {
    return this.cashflowService.createAccount(tenantId, dto);
  }

  @Patch('accounts/:id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Cập nhật tài khoản tiền' })
  async updateAccount(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCashAccountDto,
  ) {
    return this.cashflowService.updateAccount(tenantId, id, dto);
  }

  // -------------------------------------------------------------
  // 3. DANH MỤC THU / CHI
  // -------------------------------------------------------------
  @Get('categories')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Danh mục các khoản thu chi' })
  async getCategories(
    @CurrentTenantId() tenantId: string,
    @Query('type') type?: CashCategoryType,
  ) {
    return this.cashflowService.getCategories(tenantId, type);
  }

  @Post('categories')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Tạo khoản mục thu chi mới' })
  async createCategory(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateCashCategoryDto,
  ) {
    return this.cashflowService.createCategory(tenantId, dto);
  }

  @Patch('categories/:id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Cập nhật tên hoặc ngừng sử dụng khoản mục' })
  async updateCategory(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCashCategoryDto,
  ) {
    return this.cashflowService.updateCategory(tenantId, id, dto);
  }

  @Delete('categories/:id')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Xóa khoản mục (chỉ khi chưa có giao dịch)' })
  async deleteCategory(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.cashflowService.deleteCategory(tenantId, id);
  }

  // -------------------------------------------------------------
  // 4. SỔ THU CHI & GIAO DỊCH
  // -------------------------------------------------------------
  @Get('transactions')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Sổ thu chi - Danh sách giao dịch có lọc nâng cao' })
  async getTransactions(
    @CurrentTenantId() tenantId: string,
    @Query() filter: CashflowFilterDto,
  ) {
    return this.cashflowService.getTransactions(tenantId, filter);
  }

  @Post('transactions/check-duplicate')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
  )
  @ApiOperation({ summary: 'Kiểm tra cảnh báo trùng số tiền / mã UNC trước khi lưu' })
  async checkDuplicate(
    @CurrentTenantId() tenantId: string,
    @Body()
    body: {
      amount: number;
      transactionDate?: string;
      counterpartyName?: string;
      referenceCode?: string;
    },
  ) {
    return this.cashflowService.checkDuplicateWarning(tenantId, body);
  }

  @Post('transactions')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
  )
  @ApiOperation({ summary: 'Tạo phiếu thu/chi (Hỗ trợ Lưu nháp hoặc Xác nhận ngay)' })
  async createTransaction(
    @CurrentTenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCashTransactionDto,
  ) {
    return this.cashflowService.createTransaction(tenantId, userId, dto);
  }

  @Post('transactions/:id/confirm')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Xác nhận phiếu nháp thành chính thức (cập nhật số dư)' })
  async confirmTransaction(
    @CurrentTenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.cashflowService.confirmTransaction(tenantId, userId, id);
  }

  @Post('transactions/:id/cancel')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Hủy phiếu thu chi (đảo số dư an toàn và ghi chú lý do)' })
  async cancelTransaction(
    @CurrentTenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.cashflowService.cancelTransaction(tenantId, userId, id, reason);
  }

  @Post('transfers')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Chuyển tiền nội bộ giữa các tài khoản (Không tính trùng doanh thu/chi phí)' })
  async createInternalTransfer(
    @CurrentTenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInternalTransferDto,
  ) {
    return this.cashflowService.createInternalTransfer(tenantId, userId, dto);
  }

  // -------------------------------------------------------------
  // 5. ĐỐI SOÁT TIỀN ĐƠN HÀNG SHOPEE
  // -------------------------------------------------------------
  @Get('reconciliation')
  @Roles(
    MembershipRole.OWNER,
    MembershipRole.ADMIN,
    MembershipRole.ACCOUNTANT,
    MembershipRole.WAREHOUSE,
    MembershipRole.VIEWER,
  )
  @ApiOperation({ summary: 'Bảng đối soát tài chính đơn Shopee (4 cột tiền)' })
  async getReconciliation(
    @CurrentTenantId() tenantId: string,
    @Query() filter: ReconciliationFilterDto,
  ) {
    return this.reconciliationService.getReconciliationList(tenantId, filter);
  }

  @Post('reconciliation/import-settlement')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Import file quyết toán/thu nhập Shopee để ghép tiền và phí thực tế' })
  async importSettlement(
    @CurrentTenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: BatchImportSettlementDto,
  ) {
    return this.reconciliationService.batchImportSettlement(tenantId, userId, dto);
  }

  @Post('reconciliation/sync-orders')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Đồng bộ tạo bản ghi đối soát cho các đơn Shopee mới' })
  async syncOrders(
    @CurrentTenantId() tenantId: string,
    @Body('shopId') shopId?: string,
  ) {
    return this.reconciliationService.syncMissingOrders(tenantId, shopId);
  }
}
