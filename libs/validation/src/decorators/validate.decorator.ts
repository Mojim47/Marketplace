// ═══════════════════════════════════════════════════════════════════════════
// Validate Decorator - Decorator for Zod Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

import { UsePipes } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

export const ValidateBody = (schema: ZodSchema) => UsePipes(new ZodValidationPipe(schema));
export const ValidateQuery = (schema: ZodSchema) => UsePipes(new ZodValidationPipe(schema));
export const ValidateParams = (schema: ZodSchema) => UsePipes(new ZodValidationPipe(schema));