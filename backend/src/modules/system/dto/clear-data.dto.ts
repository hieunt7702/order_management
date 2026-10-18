import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClearDataDto {
  @ApiProperty({ description: 'Xóa toàn bộ đơn hàng Shopee & vận hành', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  clearOrders?: boolean;

  @ApiProperty({ description: 'Xóa phiếu nhập kho & công nợ nhà cung cấp', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  clearPurchaseReceipts?: boolean;

  @ApiProperty({ description: 'Xóa phiếu thu chi & sổ quỹ tài chính', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  clearCashflow?: boolean;

  @ApiProperty({ description: 'Xóa cả danh mục sản phẩm và phân loại SKU', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  clearProducts?: boolean;

  @ApiProperty({ description: 'Xóa cả danh mục nhà cung cấp', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  clearSuppliers?: boolean;
}
