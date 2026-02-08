/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Persian Validation Pipes
 * ???????????????????????????????????????????????????????????????????????????
 * 
 * NestJS pipes for validating Persian/Iranian data formats.
 * Uses validators from libs/localization for:
 * - Iranian mobile numbers
 * - National ID (òœ „·Ì)
 * - Bank card numbers
 * - IBAN (‘»«)
 * - Postal codes
 * 
 * @module @nextgen/api/shared/localization/pipes
 * Requirements: 3.3, 3.4, 3.5
 */

import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { persianValidators, ValidationResult } from '@nextgen/localization';

/**
 * Base class for Persian validation pipes
 */
abstract class BasePersianValidationPipe implements PipeTransform<string, string> {
  protected abstract validate(value: string): ValidationResult;
  protected abstract fieldName: string;

  transform(value: string, metadata: ArgumentMetadata): string {
    if (value === undefined || value === null || value === '') {
      return value;
    }

    const result = this.validate(String(value));
    
    if (!result.valid) {
      throw new BadRequestException(result.error || `${this.fieldName} ‰«„⁄ »— «” `);
    }

    // Return normalized value if available
    return result.normalized || String(value);
  }
}

/**
 * Pipe for validating Iranian mobile numbers
 * 
 * @example
 * ```typescript
 * @Post('register')
 * register(@Body('mobile', IranianMobilePipe) mobile: string) {
 *   // mobile is validated and normalized (e.g., "09123456789")
 * }
 * ```
 */
@Injectable()
export class IranianMobilePipe extends BasePersianValidationPipe {
  protected fieldName = '‘„«—Â „Ê»«Ì·';

  protected validate(value: string): ValidationResult {
    return persianValidators.validateMobile(value);
  }
}

/**
 * Pipe for validating Iranian National ID (òœ „·Ì)
 * 
 * @example
 * ```typescript
 * @Post('verify')
 * verify(@Body('nationalId', NationalIdPipe) nationalId: string) {
 *   // nationalId is validated and normalized
 * }
 * ```
 */
@Injectable()
export class NationalIdPipe extends BasePersianValidationPipe {
  protected fieldName = 'òœ „·Ì';

  protected validate(value: string): ValidationResult {
    return persianValidators.validateNationalId(value);
  }
}

/**
 * Pipe for validating Iranian bank card numbers
 * 
 * @example
 * ```typescript
 * @Post('payment')
 * payment(@Body('cardNumber', BankCardPipe) cardNumber: string) {
 *   // cardNumber is validated using Luhn algorithm
 * }
 * ```
 */
@Injectable()
export class BankCardPipe extends BasePersianValidationPipe {
  protected fieldName = '‘„«—Â ò«— ';

  protected validate(value: string): ValidationResult {
    return persianValidators.validateBankCard(value);
  }
}

/**
 * Pipe for validating Iranian IBAN (‘»«)
 * 
 * @example
 * ```typescript
 * @Post('transfer')
 * transfer(@Body('iban', IBANPipe) iban: string) {
 *   // iban is validated and normalized (e.g., "IR123456789012345678901234")
 * }
 * ```
 */
@Injectable()
export class IBANPipe extends BasePersianValidationPipe {
  protected fieldName = '‘„«—Â ‘»«';

  protected validate(value: string): ValidationResult {
    return persianValidators.validateIBAN(value);
  }
}

/**
 * Pipe for validating Iranian postal codes
 * 
 * @example
 * ```typescript
 * @Post('address')
 * address(@Body('postalCode', PostalCodePipe) postalCode: string) {
 *   // postalCode is validated and normalized
 * }
 * ```
 */
@Injectable()
export class PostalCodePipe extends BasePersianValidationPipe {
  protected fieldName = 'òœ Å” Ì';

  protected validate(value: string): ValidationResult {
    return persianValidators.validatePostalCode(value);
  }
}

/**
 * Pipe for validating Iranian landline phone numbers
 * 
 * @example
 * ```typescript
 * @Post('contact')
 * contact(@Body('phone', LandlinePipe) phone: string) {
 *   // phone is validated and normalized
 * }
 * ```
 */
@Injectable()
export class LandlinePipe extends BasePersianValidationPipe {
  protected fieldName = '‘„«—Â  ·›‰ À«» ';

  protected validate(value: string): ValidationResult {
    return persianValidators.validateLandline(value);
  }
}

/**
 * Pipe for validating Persian text (no English characters)
 * 
 * @example
 * ```typescript
 * @Post('comment')
 * comment(@Body('text', PersianTextPipe) text: string) {
 *   // text is validated to contain only Persian characters
 * }
 * ```
 */
@Injectable()
export class PersianTextPipe extends BasePersianValidationPipe {
  protected fieldName = '„ ‰ ›«—”Ì';

  protected validate(value: string): ValidationResult {
    return persianValidators.validatePersianText(value);
  }
}

/**
 * Pipe for validating company registration numbers (‘„«—Â À» )
 * 
 * @example
 * ```typescript
 * @Post('company')
 * company(@Body('registrationNumber', CompanyRegistrationPipe) regNumber: string) {
 *   // regNumber is validated and normalized
 * }
 * ```
 */
@Injectable()
export class CompanyRegistrationPipe extends BasePersianValidationPipe {
  protected fieldName = '‘„«—Â À» ';

  protected validate(value: string): ValidationResult {
    return persianValidators.validateCompanyRegistration(value);
  }
}

/**
 * Pipe for validating economic codes (òœ «ﬁ ’«œÌ)
 * 
 * @example
 * ```typescript
 * @Post('business')
 * business(@Body('economicCode', EconomicCodePipe) economicCode: string) {
 *   // economicCode is validated and normalized
 * }
 * ```
 */
@Injectable()
export class EconomicCodePipe extends BasePersianValidationPipe {
  protected fieldName = 'òœ «ﬁ ’«œÌ';

  protected validate(value: string): ValidationResult {
    return persianValidators.validateEconomicCode(value);
  }
}
