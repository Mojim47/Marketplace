// ═══════════════════════════════════════════════════════════════════════════
// Zod Validation Pipe - NestJS Pipe for Zod Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { ValidationError } from '@nextgen/errors';
import { ZodError, type ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, _metadata: ArgumentMetadata) {
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        throw ValidationError.schemaValidationFailed(errorMessages);
      }
      // Unknown validation error - still a validation issue, not internal
      throw ValidationError.schemaValidationFailed([
        { field: 'unknown', message: 'Schema validation failed' },
      ]);
    }
  }
}
