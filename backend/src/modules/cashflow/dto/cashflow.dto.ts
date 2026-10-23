import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CashAccountType,
  CashCategoryType,
  CashTransactionType,
  CashTransactionStatus,
  OrderReconciliationStatus,
} from '@prisma/client';

export class CreateCashAccountDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(CashAccountType)
  type!: CashAccountType;

  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsNumber()
  @IsOptional()
  initialBalance?: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateCashAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateCashCategoryDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(CashCategoryType)
  type!: CashCategoryType;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateCashCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ReceiptAllocationDto {
  @IsString()
  @IsNotEmpty()
  receiptId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateCashTransactionDto {
  @IsEnum(CashTransactionType)
  type!: CashTransactionType;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsOptional()
  transactionDate?: string;

  @IsString()
  @IsOptional()
  shopId?: string;

  @IsBoolean()
  @IsOptional()
  isCommonExpense?: boolean;

  @IsString()
  @IsOptional()
  fromAccountId?: string;

  @IsString()
  @IsOptional()
  toAccountId?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsEnum(CashTransactionStatus)
  @IsOptional()
  status?: CashTransactionStatus;

  @IsString()
  @IsOptional()
  counterpartyName?: string;

  @IsString()
  @IsOptional()
  performedByName?: string;

  @IsString()
  @IsOptional()
  referenceCode?: string;

  @IsString()
  @IsOptional()
  voucherImage?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  relatedEntityType?: string;

  @IsString()
  @IsOptional()
  relatedEntityId?: string;

  // Optional supplier POs allocation
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ReceiptAllocationDto)
  allocations?: ReceiptAllocationDto[];
}

export class CreateInternalTransferDto {
  @IsString()
  @IsNotEmpty()
  fromAccountId!: string;

  @IsString()
  @IsNotEmpty()
  toAccountId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsNumber()
  @IsOptional()
  feeAmount?: number;

  @IsString()
  @IsOptional()
  transferDate?: string;

  @IsString()
  @IsOptional()
  referenceCode?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CashflowFilterDto {
  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}

export class ReconciliationFilterDto {
  @IsString()
  @IsOptional()
  shopId?: string;

  @IsString()
  @IsOptional()
  reconciliationStatus?: OrderReconciliationStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}

export class ImportSettlementRowDto {
  @IsString()
  @IsNotEmpty()
  externalOrderId!: string;

  @IsNumber()
  @IsOptional()
  orderItemAmount?: number;

  @IsNumber()
  @IsOptional()
  buyerPaidAmount?: number;

  @IsNumber()
  @IsOptional()
  actualPayout?: number;

  @IsNumber()
  @IsOptional()
  commissionFee?: number;

  @IsNumber()
  @IsOptional()
  serviceFee?: number;

  @IsNumber()
  @IsOptional()
  transactionFee?: number;

  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @IsNumber()
  @IsOptional()
  adjustmentAmount?: number;

  @IsString()
  @IsOptional()
  settledAt?: string;

  @IsOptional()
  rawPlatformData?: any;
}

export class BatchImportSettlementDto {
  @IsString()
  @IsNotEmpty()
  shopId!: string;

  @IsString()
  @IsOptional()
  creditToAccountId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSettlementRowDto)
  rows!: ImportSettlementRowDto[];
}
