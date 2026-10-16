import { Module } from '@nestjs/common';
import { CashflowService } from './cashflow.service';
import { ReconciliationService } from './reconciliation.service';
import { CashflowController } from './cashflow.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CashflowController],
  providers: [CashflowService, ReconciliationService],
  exports: [CashflowService, ReconciliationService],
})
export class CashflowModule {}
