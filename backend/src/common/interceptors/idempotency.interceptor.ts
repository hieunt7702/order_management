import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const idempotencyKey = request.headers['idempotency-key'] as string;
    const tenantId = request.tenantId;

    if (!idempotencyKey || !tenantId) {
      return next.handle();
    }

    const payload = JSON.stringify(request.body || {});
    const requestHash = createHash('sha256')
      .update(`${request.method}:${request.url}:${payload}`)
      .digest('hex');

    // Check existing record
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key đã được sử dụng với payload hoặc đường dẫn khác.',
        );
      }

      this.logger.log(`Idempotent hit for key: ${idempotencyKey} on tenant: ${tenantId}`);
      response.status(existing.responseStatus);
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap(async (data) => {
        try {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          await this.prisma.idempotencyRecord.create({
            data: {
              tenantId,
              idempotencyKey,
              requestHash,
              requestPath: request.url,
              responseStatus: response.statusCode,
              responseBody: data as any,
              expiresAt,
            },
          });
        } catch (err) {
          this.logger.warn(`Failed to store idempotency record: ${(err as Error).message}`);
        }
      }),
    );
  }
}
