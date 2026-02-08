import {
  IsString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  MinLength,
  MaxLength,
  IsStrongPassword,
  ValidateNested
} from 'class-validator'
import { Transform, Type } from 'class-transformer'

// ============================================
// AUTH DTOs
// ============================================
export class LoginDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string
}

export class RegisterDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(2)
  name!: string

  @IsString()
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1
  })
  password!: string

  @IsString()
  tenantName!: string

  @IsString()
  tenantSlug!: string
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string

  @IsString()
  @IsStrongPassword()
  newPassword!: string
}

// ============================================
// TENANT DTOs
// ============================================
export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  slug!: string

  @IsEmail()
  ownerEmail!: string

  @IsEnum(['starter', 'professional', 'enterprise'])
  @IsOptional()
  plan?: 'starter' | 'professional' | 'enterprise';

  @IsOptional()
  settings?: Record<string, any>;
}

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['starter', 'professional', 'enterprise'])
  @IsOptional()
  plan?: 'starter' | 'professional' | 'enterprise';

  @IsOptional()
  settings?: Record<string, any>;
}

// ============================================
// VENDOR DTOs
// ============================================
export class CreateVendorDto {
  @IsString()
  @MinLength(2)
  businessName!: string

  @IsEmail()
  ownerEmail!: string

  @IsString()
  @IsOptional()
  ownerName?: string;

  @IsString()
  @IsOptional()
  bankAccount?: string;

  @IsString()
  @IsOptional()
  taxId?: string;

  @IsNumber()
  @IsOptional()
  commissionRate?: number;
}

export class UpdateVendorDto {
  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  bankAccount?: string;

  @IsEnum(['active', 'suspended', 'inactive'])
  @IsOptional()
  status?: string;

  @IsNumber()
  @IsOptional()
  commissionRate?: number;
}

// ============================================
// PRODUCT DTOs
// ============================================
export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  sku!: string

  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  price!: number

  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  costPrice!: number

  @IsNumber()
  @IsOptional()
  stock?: number;

  @IsString()
  category!: string

  @IsString()
  @IsOptional()
  subcategory?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsEnum(['NONE', 'FACE', 'WORLD', 'FOOT', 'WRIST'])
  @IsOptional()
  arType?: 'NONE' | 'FACE' | 'WORLD' | 'FOOT' | 'WRIST';

  @IsString()
  @IsOptional()
  arModelUrl?: string;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsNumber()
  @IsOptional()
  price?: number

  @IsNumber()
  @IsOptional()
  stock?: number;

  @IsEnum(['draft', 'active', 'inactive', 'archived'])
  @IsOptional()
  status?: string;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsEnum(['NONE', 'FACE', 'WORLD', 'FOOT', 'WRIST'])
  @IsOptional()
  arType?: 'NONE' | 'FACE' | 'WORLD' | 'FOOT' | 'WRIST';

  @IsString()
  @IsOptional()
  arModelUrl?: string;
}

// ============================================
// ORDER DTOs
// ============================================
export class CreateOrderItemDto {
  @IsString()
  productId!: string

  @IsNumber()
  quantity!: number

  @IsNumber()
  price!: number
}

export class CreateOrderDto {
  @IsString()
  customerId!: string

  @IsEmail()
  customerEmail!: string

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[]

  @IsNumber()
  @IsOptional()
  discountAmount?: number

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateOrderDto {
  @IsEnum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsEnum(['pending', 'completed', 'failed', 'refunded'])
  @IsOptional()
  paymentStatus?: string;

  @IsString()
  @IsOptional()
  shippingAddress?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

// ============================================
// FEATURE FLAG DTOs
// ============================================
export class EnableFeatureDto {
  @IsString()
  featureKey!: string
}

export class DisableFeatureDto {
  @IsString()
  featureKey!: string
}

export class SetFeatureLimitsDto {
  @IsString()
  featureKey!: string

  limits!: Record<string, number>
}

// ============================================
// PAGINATION DTOs
// ============================================
export class PaginationDto {
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  skip?: number = 0

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  take?: number = 10

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc'
}

export class FilterDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(['pending', 'active', 'inactive', 'suspended'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  category?: string;
}

// ============================================
// RESPONSE DTOs
// ============================================
export class PaginatedResponseDto<T> {
  data!: T[]
  total!: number
  skip!: number
  take!: number
}

export class SuccessResponseDto<T> {
  success!: boolean
  data!: T
  timestamp!: Date
}

export class ErrorResponseDto {
  success!: false
  error!: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  timestamp!: Date
}

// ============================================
// AUDIT LOG DTOs
// ============================================
export class AuditLogFilterDto extends PaginationDto {
  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  entity?: string;

  @IsString()
  @IsOptional()
  adminId?: string;
}

// ============================================
// SUPPORT TICKET DTOs
// ============================================
export class CreateSupportTicketDto {
  @IsString()
  @MinLength(5)
  title!: string

  @IsString()
  @MinLength(10)
  description!: string

  @IsEnum(['low', 'normal', 'high', 'urgent'])
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  vendorId?: string;
}

export class UpdateSupportTicketDto {
  @IsEnum(['open', 'in-progress', 'resolved', 'closed'])
  @IsOptional()
  status?: string;

  @IsEnum(['low', 'normal', 'high', 'urgent'])
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  assignedTo?: string;
}
