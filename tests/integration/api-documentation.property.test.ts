/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NextGen Marketplace - API Documentation Property Tests
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Property 24: API Documentation Completeness
 * Validates: Requirements 8.4, 8.5
 *
 * For any API endpoint, the OpenAPI specification should include:
 * - Request schema
 * - Response schema
 * - At least one example
 * - Error codes with Persian descriptions
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';
import * as fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import * as yaml from 'yaml';

const logger = new Logger('APIDocumentationTest');

// Types for OpenAPI specification
interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  paths: Record<string, PathItem>;
  components: {
    schemas: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  'x-error-codes'?: Record<string, ErrorCodeDefinition>;
}

interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
}

interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  requestBody?: RequestBody;
  responses: Record<string, ResponseObject>;
  parameters?: ParameterObject[];
}

interface RequestBody {
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
}

interface MediaTypeObject {
  schema?: SchemaObject | { $ref: string };
  example?: unknown;
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject | { $ref: string };
  $ref?: string;
  enum?: string[];
  description?: string;
}

interface ParameterObject {
  name: string;
  in: string;
  required?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  description?: string;
}

interface ErrorCodeDefinition {
  message: string;
  messageEn: string;
  httpStatus: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Setup
// ═══════════════════════════════════════════════════════════════════════════

let openApiSpec: OpenAPISpec;
let endpoints: Array<{ path: string; method: string; operation: OperationObject }>;

beforeAll(() => {
  const specPath = path.resolve(__dirname, '../../contracts/api.openapi.yaml');
  const specContent = fs.readFileSync(specPath, 'utf-8');
  openApiSpec = yaml.parse(specContent) as OpenAPISpec;

  // Extract all endpoints
  endpoints = [];
  for (const [pathKey, pathItem] of Object.entries(openApiSpec.paths)) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
    for (const method of methods) {
      const operation = pathItem[method];
      if (operation) {
        endpoints.push({ path: pathKey, method, operation });
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Property 24: API Documentation Completeness
// Feature: production-readiness-audit
// Validates: Requirements 8.4, 8.5
// ═══════════════════════════════════════════════════════════════════════════

describe('Property 24: API Documentation Completeness', () => {
  /**
   * Property 24.1: Every endpoint must have a response schema
   * For any API endpoint, at least one response must have a schema defined
   */
  it('should have response schema for all endpoints', () => {
    fc.assert(
      fc.property(fc.constantFrom(...endpoints), (endpoint) => {
        const { path: endpointPath, method, operation } = endpoint;
        const responses = operation.responses;

        // Check that at least one response has content with schema
        const hasResponseSchema = Object.entries(responses).some(([statusCode, response]) => {
          if (statusCode === '204') {
            return true; // No content responses are valid
          }
          if (!response.content) {
            return false;
          }

          return Object.values(response.content).some(
            (mediaType) => mediaType.schema !== undefined
          );
        });

        if (!hasResponseSchema) {
          logger.warn(`Missing response schema: ${method.toUpperCase()} ${endpointPath}`);
        }

        return hasResponseSchema;
      }),
      { numRuns: endpoints.length }
    );
  });

  /**
   * Property 24.2: POST/PUT endpoints must have request body schema
   * For any POST or PUT endpoint, a request body with schema must be defined
   */
  it('should have request body schema for POST/PUT endpoints', () => {
    const postPutEndpoints = endpoints.filter((e) => e.method === 'post' || e.method === 'put');

    if (postPutEndpoints.length === 0) {
      return; // Skip if no POST/PUT endpoints
    }

    fc.assert(
      fc.property(fc.constantFrom(...postPutEndpoints), (endpoint) => {
        const { path: endpointPath, method, operation } = endpoint;

        // Some endpoints like logout don't need request body
        const noBodyEndpoints = ['/auth/logout', '/auth/2fa/setup'];
        if (noBodyEndpoints.some((p) => endpointPath.includes(p))) {
          return true;
        }

        const hasRequestBody = operation.requestBody !== undefined;
        const hasSchema =
          hasRequestBody &&
          operation.requestBody?.content !== undefined &&
          Object.values(operation.requestBody?.content).some(
            (mediaType) => mediaType.schema !== undefined
          );

        if (!hasSchema && !noBodyEndpoints.includes(endpointPath)) {
          logger.warn(`Missing request body schema: ${method.toUpperCase()} ${endpointPath}`);
        }

        return hasSchema || noBodyEndpoints.some((p) => endpointPath.includes(p));
      }),
      { numRuns: postPutEndpoints.length }
    );
  });

  /**
   * Property 24.3: Every endpoint must have at least one example
   * For any API endpoint, at least one response or request should have an example
   * Exception: DELETE endpoints with 204 response don't need examples
   */
  it('should have at least one example for all endpoints', () => {
    fc.assert(
      fc.property(fc.constantFrom(...endpoints), (endpoint) => {
        const { path: endpointPath, method, operation } = endpoint;

        // DELETE endpoints with only 204 response don't need examples
        if (method === 'delete') {
          const responseKeys = Object.keys(operation.responses);
          if (responseKeys.length === 1 && responseKeys[0] === '204') {
            return true;
          }
          // Also allow if all non-error responses are 204
          const nonErrorResponses = responseKeys.filter(
            (k) => !k.startsWith('4') && !k.startsWith('5')
          );
          if (nonErrorResponses.length === 1 && nonErrorResponses[0] === '204') {
            return true;
          }
        }

        // Check for examples in request body
        let hasRequestExample = false;
        if (operation.requestBody?.content) {
          hasRequestExample = Object.values(operation.requestBody.content).some(
            (mediaType) => mediaType.example !== undefined
          );
        }

        // Check for examples in responses
        let hasResponseExample = false;
        for (const response of Object.values(operation.responses)) {
          if (response.content) {
            hasResponseExample = Object.values(response.content).some(
              (mediaType) => mediaType.example !== undefined
            );
            if (hasResponseExample) {
              break;
            }
          }
        }

        // Check for examples in parameters
        let hasParameterExample = false;
        if (operation.parameters) {
          hasParameterExample = operation.parameters.some((param) => param.example !== undefined);
        }

        const hasExample = hasRequestExample || hasResponseExample || hasParameterExample;

        if (!hasExample) {
          logger.warn(`Missing example: ${method.toUpperCase()} ${endpointPath}`);
        }

        return hasExample;
      }),
      { numRuns: endpoints.length }
    );
  });

  /**
   * Property 24.4: Every endpoint must have summary and description
   * For any API endpoint, both summary and description must be present
   */
  it('should have summary and description for all endpoints', () => {
    fc.assert(
      fc.property(fc.constantFrom(...endpoints), (endpoint) => {
        const { path: endpointPath, method, operation } = endpoint;

        const hasSummary = operation.summary !== undefined && operation.summary.length > 0;
        const hasDescription =
          operation.description !== undefined && operation.description.length > 0;

        if (!hasSummary) {
          logger.warn(`Missing summary: ${method.toUpperCase()} ${endpointPath}`);
        }
        if (!hasDescription) {
          logger.warn(`Missing description: ${method.toUpperCase()} ${endpointPath}`);
        }

        return hasSummary && hasDescription;
      }),
      { numRuns: endpoints.length }
    );
  });

  /**
   * Property 24.5: Every endpoint must have an operationId
   * For any API endpoint, operationId must be defined for SDK generation
   */
  it('should have operationId for all endpoints', () => {
    fc.assert(
      fc.property(fc.constantFrom(...endpoints), (endpoint) => {
        const { path: endpointPath, method, operation } = endpoint;

        const hasOperationId =
          operation.operationId !== undefined && operation.operationId.length > 0;

        if (!hasOperationId) {
          logger.warn(`Missing operationId: ${method.toUpperCase()} ${endpointPath}`);
        }

        return hasOperationId;
      }),
      { numRuns: endpoints.length }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Property 24 (continued): Error Codes with Persian Descriptions
// Validates: Requirements 8.5
// ═══════════════════════════════════════════════════════════════════════════

describe('Property 24: Error Codes with Persian Descriptions', () => {
  /**
   * Property 24.6: All error codes must have Persian descriptions
   * For any error code defined, both Persian and English messages must exist
   */
  it('should have Persian and English messages for all error codes', () => {
    const errorCodes = openApiSpec['x-error-codes'];

    if (!errorCodes) {
      throw new Error('x-error-codes section not found in OpenAPI spec');
    }

    const errorCodeEntries = Object.entries(errorCodes);

    fc.assert(
      fc.property(fc.constantFrom(...errorCodeEntries), ([code, definition]) => {
        const hasPersianMessage = definition.message !== undefined && definition.message.length > 0;
        const hasEnglishMessage =
          definition.messageEn !== undefined && definition.messageEn.length > 0;
        const hasHttpStatus =
          definition.httpStatus !== undefined &&
          definition.httpStatus >= 100 &&
          definition.httpStatus < 600;

        if (!hasPersianMessage) {
          logger.warn(`Missing Persian message for error code: ${code}`);
        }
        if (!hasEnglishMessage) {
          logger.warn(`Missing English message for error code: ${code}`);
        }
        if (!hasHttpStatus) {
          logger.warn(`Invalid HTTP status for error code: ${code}`);
        }

        return hasPersianMessage && hasEnglishMessage && hasHttpStatus;
      }),
      { numRuns: errorCodeEntries.length }
    );
  });

  /**
   * Property 24.7: Error codes must follow naming convention
   * For any error code, it must follow the pattern: CATEGORY_NNN (category can be 2-4 chars)
   */
  it('should follow naming convention for all error codes', () => {
    const errorCodes = openApiSpec['x-error-codes'];

    if (!errorCodes) {
      throw new Error('x-error-codes section not found in OpenAPI spec');
    }

    // Pattern allows 2-4 character category codes followed by underscore and 3 digits
    const errorCodePattern = /^[A-Z0-9]{2,4}_\d{3}$/;
    const errorCodeKeys = Object.keys(errorCodes);

    fc.assert(
      fc.property(fc.constantFrom(...errorCodeKeys), (code) => {
        const matchesPattern = errorCodePattern.test(code);

        if (!matchesPattern) {
          logger.warn(`Error code doesn't match pattern CATEGORY_NNN: ${code}`);
        }

        return matchesPattern;
      }),
      { numRuns: errorCodeKeys.length }
    );
  });

  /**
   * Property 24.8: Required error categories must be present
   * The spec must include error codes for all required categories
   */
  it('should include all required error categories', () => {
    const errorCodes = openApiSpec['x-error-codes'];

    if (!errorCodes) {
      throw new Error('x-error-codes section not found in OpenAPI spec');
    }

    const requiredCategories = [
      'AUTH',
      'VAL',
      'RBAC',
      'USR',
      'PRD',
      'ORD',
      'INV',
      'PAY',
      'DB',
      'SYS',
    ];
    const errorCodeKeys = Object.keys(errorCodes);

    fc.assert(
      fc.property(fc.constantFrom(...requiredCategories), (category) => {
        const hasCategory = errorCodeKeys.some((code) => code.startsWith(`${category}_`));

        if (!hasCategory) {
          logger.warn(`Missing error codes for category: ${category}`);
        }

        return hasCategory;
      }),
      { numRuns: requiredCategories.length }
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Additional Documentation Quality Properties
// ═══════════════════════════════════════════════════════════════════════════

describe('Property 24: Documentation Quality', () => {
  /**
   * Property 24.9: All referenced schemas must exist
   * For any $ref in the spec, the referenced schema must be defined
   */
  it('should have all referenced schemas defined', () => {
    const schemas = openApiSpec.components?.schemas || {};
    const schemaNames = Object.keys(schemas);

    // Collect all $ref references
    const refs: string[] = [];
    const collectRefs = (obj: unknown): void => {
      if (obj === null || obj === undefined) {
        return;
      }
      if (typeof obj !== 'object') {
        return;
      }

      if (Array.isArray(obj)) {
        obj.forEach(collectRefs);
        return;
      }

      const record = obj as Record<string, unknown>;
      if ('$ref' in record && typeof record.$ref === 'string') {
        refs.push(record.$ref);
      }

      Object.values(record).forEach(collectRefs);
    };

    collectRefs(openApiSpec.paths);

    // Extract schema names from refs
    const referencedSchemas = refs
      .filter((ref) => ref.startsWith('#/components/schemas/'))
      .map((ref) => ref.replace('#/components/schemas/', ''));

    const uniqueRefs = [...new Set(referencedSchemas)];

    if (uniqueRefs.length === 0) {
      return; // No refs to check
    }

    fc.assert(
      fc.property(fc.constantFrom(...uniqueRefs), (schemaName) => {
        const exists = schemaNames.includes(schemaName);

        if (!exists) {
          logger.warn(`Referenced schema not found: ${schemaName}`);
        }

        return exists;
      }),
      { numRuns: uniqueRefs.length }
    );
  });

  /**
   * Property 24.10: Security schemes must be properly defined
   * For any endpoint requiring authentication, security scheme must be defined
   */
  it('should have security schemes properly defined', () => {
    const securitySchemes = openApiSpec.components?.securitySchemes || {};

    // Check that required security schemes exist
    const requiredSchemes = ['BearerAuth', 'ApiKeyAuth'];

    fc.assert(
      fc.property(fc.constantFrom(...requiredSchemes), (schemeName) => {
        const exists = schemeName in securitySchemes;
        const scheme = securitySchemes[schemeName];

        if (!exists) {
          logger.warn(`Missing security scheme: ${schemeName}`);
          return false;
        }

        const hasType = scheme.type !== undefined;
        const hasDescription = scheme.description !== undefined;

        if (!hasType) {
          logger.warn(`Security scheme missing type: ${schemeName}`);
        }
        if (!hasDescription) {
          logger.warn(`Security scheme missing description: ${schemeName}`);
        }

        return hasType && hasDescription;
      }),
      { numRuns: requiredSchemes.length }
    );
  });

  /**
   * Property 24.11: OpenAPI version must be 3.x
   * The spec must use OpenAPI 3.x for modern features
   */
  it('should use OpenAPI 3.x specification', () => {
    expect(openApiSpec.openapi).toBeDefined();
    expect(openApiSpec.openapi.startsWith('3.')).toBe(true);
  });

  /**
   * Property 24.12: Info section must be complete
   * The spec must have complete info section with title, description, version
   */
  it('should have complete info section', () => {
    expect(openApiSpec.info).toBeDefined();
    expect(openApiSpec.info.title).toBeDefined();
    expect(openApiSpec.info.title.length).toBeGreaterThan(0);
    expect(openApiSpec.info.description).toBeDefined();
    expect(openApiSpec.info.description.length).toBeGreaterThan(0);
    expect(openApiSpec.info.version).toBeDefined();
    expect(openApiSpec.info.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
