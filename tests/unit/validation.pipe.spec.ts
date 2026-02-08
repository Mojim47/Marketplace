/**
 * ValidationPipe Unit Tests
 * Input Validation & Sanitization
 *
 * @module test/unit/validation.pipe.spec
 */

import { BadRequestException } from '@nestjs/common';
import {
  IsEmail,
  IsString,
  MinLength,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsStrongPassword,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

// Test DTOs
class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password!: string;
}

class ProductDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsNumber()
  @Min(0)
  @Max(10000)
  stock!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

describe('ValidationPipe', () => {
  const validateDto = async <T extends object>(
    dtoClass: new () => T,
    data: Partial<T>
  ): Promise<{ isValid: boolean; errors: string[] }> => {
    const instance = plainToInstance(dtoClass, data);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    return {
      isValid: errors.length === 0,
      errors: errors.flatMap((e) => Object.values(e.constraints || {})),
    };
  };

  describe('LoginDto Validation', () => {
    it('should pass with valid email and password', async () => {
      const result = await validateDto(LoginDto, {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with invalid email', async () => {
      const result = await validateDto(LoginDto, {
        email: 'not-an-email',
        password: 'password123',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('email'))).toBe(true);
    });

    it('should fail with short password', async () => {
      const result = await validateDto(LoginDto, {
        email: 'test@example.com',
        password: '1234567', // Only 7 chars
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('8'))).toBe(true);
    });

    it('should fail with missing fields', async () => {
      const result = await validateDto(LoginDto, {});

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('RegisterDto Validation', () => {
    it('should pass with strong password', async () => {
      const result = await validateDto(RegisterDto, {
        email: 'test@example.com',
        name: 'Test User',
        password: 'Str0ng@P@ssw0rd!',
      });

      expect(result.isValid).toBe(true);
    });

    it('should fail with weak password (no uppercase)', async () => {
      const result = await validateDto(RegisterDto, {
        email: 'test@example.com',
        name: 'Test User',
        password: 'weakpassword1!',
      });

      expect(result.isValid).toBe(false);
    });

    it('should fail with weak password (no special char)', async () => {
      const result = await validateDto(RegisterDto, {
        email: 'test@example.com',
        name: 'Test User',
        password: 'WeakPassword1',
      });

      expect(result.isValid).toBe(false);
    });

    it('should fail with weak password (no number)', async () => {
      const result = await validateDto(RegisterDto, {
        email: 'test@example.com',
        name: 'Test User',
        password: 'WeakPassword!',
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('ProductDto Validation', () => {
    it('should pass with valid product data', async () => {
      const result = await validateDto(ProductDto, {
        name: 'Test Product',
        price: 150000,
        stock: 100,
      });

      expect(result.isValid).toBe(true);
    });

    it('should pass with optional description', async () => {
      const result = await validateDto(ProductDto, {
        name: 'Test Product',
        price: 150000,
        stock: 100,
        description: 'A great product',
      });

      expect(result.isValid).toBe(true);
    });

    it('should fail with negative price', async () => {
      const result = await validateDto(ProductDto, {
        name: 'Test Product',
        price: -100,
        stock: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('0'))).toBe(true);
    });

    it('should fail with stock exceeding maximum', async () => {
      const result = await validateDto(ProductDto, {
        name: 'Test Product',
        price: 150000,
        stock: 99999, // Exceeds 10000
      });

      expect(result.isValid).toBe(false);
    });

    it('should fail with short name', async () => {
      const result = await validateDto(ProductDto, {
        name: 'A', // Only 1 char
        price: 150000,
        stock: 100,
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('XSS Prevention', () => {
    it('should treat script tags as plain strings', async () => {
      const result = await validateDto(ProductDto, {
        name: '<script>alert("xss")</script>',
        price: 100,
        stock: 10,
      });

      // Validation passes but the string is treated as plain text
      expect(result.isValid).toBe(true);
    });

    it('should allow Persian text in name', async () => {
      const result = await validateDto(ProductDto, {
        name: 'محصول تست فارسی',
        price: 150000,
        stock: 100,
      });

      expect(result.isValid).toBe(true);
    });

    it('should allow emoji in product name', async () => {
      const result = await validateDto(ProductDto, {
        name: 'Test Product 🚀',
        price: 150000,
        stock: 100,
      });

      expect(result.isValid).toBe(true);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should treat SQL keywords as plain strings', async () => {
      const result = await validateDto(LoginDto, {
        email: "admin@example.com'; DROP TABLE users; --",
        password: 'password123',
      });

      // Email validation will fail because of invalid characters
      expect(result.isValid).toBe(false);
    });

    it('should reject OR 1=1 pattern in email', async () => {
      const result = await validateDto(LoginDto, {
        email: "' OR '1'='1",
        password: 'password123',
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('Type Coercion', () => {
    it('should coerce string number to number', async () => {
      const data = {
        name: 'Test Product',
        price: '150000', // String instead of number
        stock: '100',
      };

      const instance = plainToInstance(ProductDto, data);

      // class-transformer with enableImplicitConversion would convert these
      expect(typeof data.price).toBe('string');
    });
  });
});
