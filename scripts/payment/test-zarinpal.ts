#!/usr/bin/env ts-node

// ═══════════════════════════════════════════════════════════════════════════
// ZarinPal Integration Test Script
// ═══════════════════════════════════════════════════════════════════════════

import { ConfigService } from '@nestjs/config';
import { ZarinPalService } from '../../libs/payment/src/zarinpal.service';
import { MetricsService } from '../../libs/monitoring/src/metrics.service';

interface TestResult {
  test: string;
  success: boolean;
  duration: number;
  data?: any;
  error?: string;
}

class ZarinPalTester {
  private zarinpalService: ZarinPalService;
  private results: TestResult[] = [];

  constructor() {
    // Mock dependencies for testing
    const configService = {
      get: (key: string) => {
        const config: Record<string, any> = {
          ZARINPAL_MERCHANT_ID: process.env.ZARINPAL_MERCHANT_ID || 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          ZARINPAL_SANDBOX: true,
          ZARINPAL_CALLBACK_URL: process.env.ZARINPAL_CALLBACK_URL || 'http://localhost:3001/api/v3/payments/zarinpal/callback',
        };
        return config[key];
      },
    } as ConfigService;

    const metricsService = {
      recordOrderEvent: () => {},
    } as MetricsService;

    this.zarinpalService = new ZarinPalService(configService, metricsService);
  }

  async runTests(): Promise<void> {
    console.log('🔍 Testing ZarinPal Integration...\n');

    const tests = [
      { name: 'Configuration Validation', test: () => this.testConfiguration() },
      { name: 'Payment Creation', test: () => this.testPaymentCreation() },
      { name: 'Payment Verification (Mock)', test: () => this.testPaymentVerification() },
      { name: 'Error Handling', test: () => this.testErrorHandling() },
      { name: 'Signature Generation', test: () => this.testSignatureGeneration() },
    ];

    for (const { name, test } of tests) {
      try {
        const result = await this.executeTest(name, test);
        this.results.push(result);
        this.logResult(result);
      } catch (error) {
        const result: TestResult = {
          test: name,
          success: false,
          duration: 0,
          error: error.message,
        };
        this.results.push(result);
        this.logResult(result);
      }
    }

    this.printSummary();
  }

  private async executeTest(testName: string, testFunction: () => Promise<any>): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const data = await testFunction();
      const duration = Date.now() - startTime;
      
      return {
        test: testName,
        success: true,
        duration,
        data,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        test: testName,
        success: false,
        duration,
        error: error.message,
      };
    }
  }

  private async testConfiguration(): Promise<any> {
    // Test configuration validation
    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    const callbackUrl = process.env.ZARINPAL_CALLBACK_URL;

    if (!merchantId) {
      throw new Error('ZARINPAL_MERCHANT_ID not configured');
    }

    if (merchantId.length !== 36) {
      throw new Error('Invalid merchant ID format');
    }

    if (!callbackUrl) {
      throw new Error('ZARINPAL_CALLBACK_URL not configured');
    }

    return {
      merchantId: merchantId.substring(0, 8) + '...',
      callbackUrl,
      sandbox: true,
    };
  }

  private async testPaymentCreation(): Promise<any> {
    const context = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      roles: ['USER'],
    };

    const paymentRequest = {
      amount: 10000, // 10,000 Rials
      description: 'تست پرداخت ZarinPal',
      orderId: 'test-order-123',
      mobile: '09123456789',
      email: 'test@example.com',
    };

    const result = await this.zarinpalService.createPayment(context, paymentRequest);

    if (!result.success) {
      throw new Error(`Payment creation failed: ${result.error}`);
    }

    return {
      success: result.success,
      authority: result.authority?.substring(0, 10) + '...',
      paymentUrl: result.paymentUrl ? 'Generated' : 'Missing',
    };
  }

  private async testPaymentVerification(): Promise<any> {
    // Mock verification test (since we can't complete actual payment in test)
    const context = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      roles: ['USER'],
    };

    try {
      const result = await this.zarinpalService.verifyPayment(context, {
        authority: 'A00000000000000000000000000000000000',
        amount: 10000,
      });

      // In sandbox mode, this should fail with a specific error
      return {
        expectedFailure: !result.success,
        error: result.error,
      };
    } catch (error) {
      return {
        expectedFailure: true,
        error: error.message,
      };
    }
  }

  private async testErrorHandling(): Promise<any> {
    const context = {
      tenantId: 'test-tenant',
      userId: 'test-user',
      roles: ['USER'],
    };

    // Test with invalid amount (too small)
    const result = await this.zarinpalService.createPayment(context, {
      amount: 500, // Less than minimum 1000 Rials
      description: 'Invalid amount test',
      orderId: 'test-invalid',
    });

    if (result.success) {
      throw new Error('Expected failure for invalid amount');
    }

    return {
      errorHandled: !result.success,
      errorMessage: result.error,
    };
  }

  private async testSignatureGeneration(): Promise<any> {
    const testData = {
      amount: 10000,
      authority: 'test-authority',
      status: 'OK',
    };

    const secret = 'test-secret';
    const signature = this.zarinpalService.generateSignature(testData, secret);

    if (!signature || signature.length !== 64) {
      throw new Error('Invalid signature generated');
    }

    // Test signature validation
    const isValid = this.zarinpalService.validateWebhookSignature(testData, signature, secret);

    if (!isValid) {
      throw new Error('Signature validation failed');
    }

    return {
      signatureGenerated: true,
      signatureLength: signature.length,
      validationPassed: isValid,
    };
  }

  private logResult(result: TestResult): void {
    const statusIcon = result.success ? '✅' : '❌';
    const duration = result.duration < 1000 ? 
      `${result.duration}ms` : 
      `${(result.duration / 1000).toFixed(2)}s`;

    console.log(`${statusIcon} ${result.test.padEnd(30)} ${duration.padStart(8)} ${result.success ? '- PASSED' : `- FAILED: ${result.error}`}`);
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => r.success === false).length;
    const total = this.results.length;

    console.log('\n📊 ZarinPal Integration Test Summary:');
    console.log(`   ✅ Passed: ${passed}/${total}`);
    console.log(`   ❌ Failed: ${failed}/${total}`);

    const overallStatus = failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED';
    console.log(`\n🎯 Overall Status: ${overallStatus}`);

    if (failed === 0) {
      console.log('\n🎉 ZarinPal integration is working correctly!');
      console.log('\n📝 Next steps:');
      console.log('   1. Configure production merchant ID');
      console.log('   2. Set up webhook endpoint');
      console.log('   3. Test with real payments in sandbox');
    } else {
      console.log('\n🔧 Issues found. Please check the failed tests above.');
    }

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ZarinPalTester();
  tester.runTests().catch(console.error);
}

export { ZarinPalTester };