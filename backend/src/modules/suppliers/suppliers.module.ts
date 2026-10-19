import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { PurchaseReceiptsService } from './purchase-receipts.service';
import { PurchaseReceiptsController } from './purchase-receipts.controller';
import { SupplierPaymentsService } from './supplier-payments.service';
import { SupplierPaymentsController } from './supplier-payments.controller';
import { PurchaseReturnsService } from './purchase-returns.service';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { SupplierLoansService } from './supplier-loans.service';
import { SupplierLoansController } from './supplier-loans.controller';
import { SupplierProductBorrowsService } from './supplier-product-borrows.service';
import { SupplierProductBorrowsController } from './supplier-product-borrows.controller';
import { SupplierTransfersService } from './supplier-transfers.service';
import { SupplierTransfersController } from './supplier-transfers.controller';

@Module({
  controllers: [
    SuppliersController,
    PurchaseReceiptsController,
    SupplierPaymentsController,
    PurchaseReturnsController,
    SupplierLoansController,
    SupplierProductBorrowsController,
    SupplierTransfersController,
  ],
  providers: [
    SuppliersService,
    PurchaseReceiptsService,
    SupplierPaymentsService,
    PurchaseReturnsService,
    SupplierLoansService,
    SupplierProductBorrowsService,
    SupplierTransfersService,
  ],
  exports: [
    SuppliersService,
    PurchaseReceiptsService,
    SupplierPaymentsService,
    PurchaseReturnsService,
    SupplierLoansService,
    SupplierProductBorrowsService,
    SupplierTransfersService,
  ],
})
export class SuppliersModule {}
