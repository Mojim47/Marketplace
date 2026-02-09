/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Global Exception Filter - Catches all errors and normalizes responses
 * ═══════════════════════════════════════════════════════════════════════════
 */
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
export declare class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger;
  catch(exception: unknown, host: ArgumentsHost): void;
  private buildErrorResponse;
  private handleHttpException;
  private createInternalErrorResponse;
  private logError;
}
//# sourceMappingURL=exception-filter.d.ts.map
