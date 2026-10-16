import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { PurchaseReceiptsService } from './purchase-receipts.service';
import { PurchaseReceiptsController } from './purchase-receipts.controller';
import { SupplierPaymentsService } from './supplier-payments.service';
import { SupplierPaymentsController } from './supplier-payments.controller';
import { PurchaseReturnsService } from './purchase-returns.service';
import { PurchaseReturnsController } from './purchase-returns.controller';

@Module({
  controllers: [
    SuppliersController,
    PurchaseReceiptsController,
    SupplierPaymentsController,
    PurchaseReturnsController,
  ],
  providers: [
    SuppliersService,
    PurchaseReceiptsService,
    SupplierPaymentsService,
    PurchaseReturnsService,
  ],
  exports: [
    SuppliersService,
    PurchaseReceiptsService,
    SupplierPaymentsService,
    PurchaseReturnsService,
  ],
})
export class SuppliersModule {}
