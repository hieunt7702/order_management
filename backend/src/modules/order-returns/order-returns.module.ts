import { Module } from '@nestjs/common';
import { OrderReturnsService } from './order-returns.service';
import { OrderReturnsController } from './order-returns.controller';

@Module({
  controllers: [OrderReturnsController],
  providers: [OrderReturnsService],
  exports: [OrderReturnsService],
})
export class OrderReturnsModule {}
