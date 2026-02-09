/**
 * ???????????????????????????????????????????????????????????????????????????
 * NextGen Marketplace - Shared Localization Module
 * ???????????????????????????????????????????????????????????????????????????
 *
 * Central localization module that integrates all Persian/Farsi localization
 * services from libs/localization for the Iranian market.
 *
 * Features:
 * - Jalali (Persian) date conversion and formatting
 * - Persian number formatting and conversion
 * - Iranian currency formatting (Rial/Toman)
 * - Persian validators (mobile, national ID, bank card, IBAN, postal code)
 * - Persian translations
 *
 * @module @nextgen/api/shared/localization
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Import localization services from libs/localization
import {
  PERSIAN_MONTHS,
  PERSIAN_WEEKDAYS,
  PERSIAN_WEEKDAYS_SHORT,
  iranianCurrency,
  jalaliConverter,
  persianNumbers,
  persianValidators,
  translations,
} from '@nextgen/localization';

// Re-export types for convenience
export type { JalaliDate, JalaliDateTime, DateFormatOptions } from '@nextgen/localization';
export type { CurrencyUnit, CurrencyFormatOptions } from '@nextgen/localization';
export type { NumberFormatOptions } from '@nextgen/localization';
export type { ValidationResult } from '@nextgen/localization';
export type {
  TranslationKey,
  TranslationNamespace,
  TranslationOptions,
} from '@nextgen/localization';

// Re-export constants
export { PERSIAN_MONTHS, PERSIAN_WEEKDAYS, PERSIAN_WEEKDAYS_SHORT };

// Import pipes
import {
  BankCardPipe,
  CompanyRegistrationPipe,
  EconomicCodePipe,
  IBANPipe,
  IranianMobilePipe,
  LandlinePipe,
  NationalIdPipe,
  PersianTextPipe,
  PostalCodePipe,
} from './pipes';

// Re-export pipes
export {
  IranianMobilePipe,
  NationalIdPipe,
  BankCardPipe,
  IBANPipe,
  PostalCodePipe,
  LandlinePipe,
  PersianTextPipe,
  CompanyRegistrationPipe,
  EconomicCodePipe,
} from './pipes';

// Provider tokens
export const LOCALIZATION_TOKENS = {
  JALALI_CONVERTER: 'JALALI_CONVERTER',
  PERSIAN_NUMBERS: 'PERSIAN_NUMBERS',
  IRANIAN_CURRENCY: 'IRANIAN_CURRENCY',
  PERSIAN_VALIDATORS: 'PERSIAN_VALIDATORS',
  TRANSLATIONS: 'TRANSLATIONS',
} as const;

// Localization module configuration interface
export interface LocalizationModuleConfig {
  defaultCurrencyUnit?: 'rial' | 'toman';
  defaultLocale?: string;
  usePersianDigits?: boolean;
}

@Global()
@Module({})
export class LocalizationModule {
  /**
   * Register the localization module with default configuration
   */
  static forRoot(config?: Partial<LocalizationModuleConfig>): DynamicModule {
    return {
      module: LocalizationModule,
      imports: [ConfigModule],
      providers: [
        // Jalali Converter Provider
        {
          provide: LOCALIZATION_TOKENS.JALALI_CONVERTER,
          useFactory: () => {
            return jalaliConverter;
          },
        },

        // Persian Numbers Provider
        {
          provide: LOCALIZATION_TOKENS.PERSIAN_NUMBERS,
          useFactory: () => {
            return persianNumbers;
          },
        },

        // Iranian Currency Provider
        {
          provide: LOCALIZATION_TOKENS.IRANIAN_CURRENCY,
          useFactory: (configService: ConfigService) => {
            const defaultUnit =
              config?.defaultCurrencyUnit ||
              configService.get<'rial' | 'toman'>('DEFAULT_CURRENCY_UNIT', 'toman');
            iranianCurrency.setDefaultUnit(defaultUnit);
            return iranianCurrency;
          },
          inject: [ConfigService],
        },

        // Persian Validators Provider
        {
          provide: LOCALIZATION_TOKENS.PERSIAN_VALIDATORS,
          useFactory: () => {
            return persianValidators;
          },
        },

        // Translations Provider
        {
          provide: LOCALIZATION_TOKENS.TRANSLATIONS,
          useFactory: (configService: ConfigService) => {
            const locale = config?.defaultLocale || configService.get('DEFAULT_LOCALE', 'fa');
            translations.setLocale(locale);
            return translations;
          },
          inject: [ConfigService],
        },

        // Pipes
        IranianMobilePipe,
        NationalIdPipe,
        BankCardPipe,
        IBANPipe,
        PostalCodePipe,
        LandlinePipe,
        PersianTextPipe,
        CompanyRegistrationPipe,
        EconomicCodePipe,
      ],
      exports: [
        LOCALIZATION_TOKENS.JALALI_CONVERTER,
        LOCALIZATION_TOKENS.PERSIAN_NUMBERS,
        LOCALIZATION_TOKENS.IRANIAN_CURRENCY,
        LOCALIZATION_TOKENS.PERSIAN_VALIDATORS,
        LOCALIZATION_TOKENS.TRANSLATIONS,
        // Pipes
        IranianMobilePipe,
        NationalIdPipe,
        BankCardPipe,
        IBANPipe,
        PostalCodePipe,
        LandlinePipe,
        PersianTextPipe,
        CompanyRegistrationPipe,
        EconomicCodePipe,
      ],
    };
  }

  /**
   * Register the localization module asynchronously with configuration factory
   */
  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<LocalizationModuleConfig> | LocalizationModuleConfig;
    inject?: any[];
  }): DynamicModule {
    return {
      module: LocalizationModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'LOCALIZATION_MODULE_CONFIG',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        // Jalali Converter Provider
        {
          provide: LOCALIZATION_TOKENS.JALALI_CONVERTER,
          useFactory: () => {
            return jalaliConverter;
          },
        },

        // Persian Numbers Provider
        {
          provide: LOCALIZATION_TOKENS.PERSIAN_NUMBERS,
          useFactory: () => {
            return persianNumbers;
          },
        },

        // Iranian Currency Provider
        {
          provide: LOCALIZATION_TOKENS.IRANIAN_CURRENCY,
          useFactory: (config: LocalizationModuleConfig) => {
            if (config.defaultCurrencyUnit) {
              iranianCurrency.setDefaultUnit(config.defaultCurrencyUnit);
            }
            return iranianCurrency;
          },
          inject: ['LOCALIZATION_MODULE_CONFIG'],
        },

        // Persian Validators Provider
        {
          provide: LOCALIZATION_TOKENS.PERSIAN_VALIDATORS,
          useFactory: () => {
            return persianValidators;
          },
        },

        // Translations Provider
        {
          provide: LOCALIZATION_TOKENS.TRANSLATIONS,
          useFactory: (config: LocalizationModuleConfig) => {
            if (config.defaultLocale) {
              translations.setLocale(config.defaultLocale);
            }
            return translations;
          },
          inject: ['LOCALIZATION_MODULE_CONFIG'],
        },

        // Pipes
        IranianMobilePipe,
        NationalIdPipe,
        BankCardPipe,
        IBANPipe,
        PostalCodePipe,
        LandlinePipe,
        PersianTextPipe,
        CompanyRegistrationPipe,
        EconomicCodePipe,
      ],
      exports: [
        LOCALIZATION_TOKENS.JALALI_CONVERTER,
        LOCALIZATION_TOKENS.PERSIAN_NUMBERS,
        LOCALIZATION_TOKENS.IRANIAN_CURRENCY,
        LOCALIZATION_TOKENS.PERSIAN_VALIDATORS,
        LOCALIZATION_TOKENS.TRANSLATIONS,
        // Pipes
        IranianMobilePipe,
        NationalIdPipe,
        BankCardPipe,
        IBANPipe,
        PostalCodePipe,
        LandlinePipe,
        PersianTextPipe,
        CompanyRegistrationPipe,
        EconomicCodePipe,
      ],
    };
  }
}
