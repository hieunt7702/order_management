import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { requestContextStorage } from '../utils/request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const tenantId = request.tenantId || 'no-tenant';
    const userId = request.user?.id || 'anonymous';
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    request.headers['x-request-id'] = requestId;

    const rawIp =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      request.ip ||
      request.socket?.remoteAddress ||
      '127.0.0.1';
    const ipAddress = rawIp === '::1' ? '127.0.0.1' : rawIp.replace(/^::ffff:/, '');
    const userAgent = (request.headers['user-agent'] as string) || undefined;

    const start = Date.now();

    return new Observable((subscriber) => {
      requestContextStorage.run(
        { ipAddress, userAgent, userId, tenantId, requestId },
        () => {
          next
            .handle()
            .pipe(
              tap(() => {
                const duration = Date.now() - start;
                const statusCode = context.switchToHttp().getResponse().statusCode;
                this.logger.log(
                  `[${requestId}] ${method} ${url} ${statusCode} +${duration}ms - ip:${ipAddress} tenant:${tenantId} user:${userId}`,
                );
              }),
            )
            .subscribe(subscriber);
        },
      );
    });
  }
}
