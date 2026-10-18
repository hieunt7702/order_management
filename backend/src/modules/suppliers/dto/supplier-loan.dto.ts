import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { SupplierLoanType, SupplierLoanStatus } from '@prisma/client';

export class CreateSupplierLoanDto {
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @IsString()
  @IsOptional()
  loanCode?: string;

  @IsEnum(SupplierLoanType)
  @IsOptional()
  type?: SupplierLoanType;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsNumber()
  @IsOptional()
  interestRate?: number;

  @IsString()
  @IsOptional()
  loanDate?: string;

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  fundSource?: 'CASH_FUND' | 'BANK_ACCOUNT';

  @IsString()
  @IsOptional()
  fundAccountId?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  referenceCode?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateSupplierLoanRepaymentDto {
  @IsString()
  @IsNotEmpty()
  loanId!: string;

  @IsString()
  @IsOptional()
  repaymentCode?: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  @IsOptional()
  repaymentDate?: string;

  @IsString()
  @IsOptional()
  payerName?: string;

  @IsString()
  @IsOptional()
  fundSource?: 'CASH_FUND' | 'BANK_ACCOUNT';

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  referenceCode?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

export class SupplierLoanFilterDto {
  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsEnum(SupplierLoanType)
  @IsOptional()
  type?: SupplierLoanType;

  @IsEnum(SupplierLoanStatus)
  @IsOptional()
  status?: SupplierLoanStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
