// ═══════════════════════════════════════════════════════════════════════════
// Zod Validation Pipe - NestJS Pipe for Zod Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@nextgen/errors';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
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
