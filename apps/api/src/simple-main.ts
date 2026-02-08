/**
 * NextGen Marketplace - Simple API Server
 * Minimal server for testing Postman collection
 */

import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Post, Body, Injectable, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Simple Health Controller
@Controller()
class HealthController {
  @Get('health')
  healthRoot() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'nextgen-api',
      version: '2.0.0',
    };
  }
}

// API v3 Health Controller
@Controller('api/v3')
class ApiHealthController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'nextgen-api',
      version: '2.0.0',
    };
  }
}

// Simple Auth Controller
@Controller('api/v3/auth')
class AuthController {
  private readonly logger = new Logger('AuthController');

  @Post('register')
  register(@Body() body: any) {
    this.logger.log(`Register attempt: ${body.email}`);
    return {
      success: true,
      message: '˜ÇÑÈÑ ÈÇ ãæÝÞíÊ ËÈÊ ÔÏ',
      data: {
        id: 'user_' + Date.now(),
        email: body.email,
        name: body.name,
      },
    };
  }

  @Post('login')
  login(@Body() body: any) {
    this.logger.log(`Login attempt: ${body.email}`);
    return {
      success: true,
      message: 'æÑæÏ ãæÝÞ',
      data: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test_token',
        refresh_token: 'refresh_' + Date.now(),
        expires_in: 900,
      },
    };
  }

  @Post('refresh')
  refresh(@Body() body: any) {
    return {
      success: true,
      data: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refreshed_token',
        expires_in: 900,
      },
    };
  }

  @Post('logout')
  logout() {
    return {
      success: true,
      message: 'ÎÑæÌ ãæÝÞ',
    };
  }
}

// Simple Products Controller
@Controller('api/v3/products')
class ProductsController {
  @Get()
  list() {
    return {
      success: true,
      data: [
        {
          id: 'prod_1',
          name: 'ãÍÕæá ÊÓÊ',
          price: 99.99,
          stock: 100,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };
  }

  @Post()
  create(@Body() body: any) {
    return {
      success: true,
      message: 'ãÍÕæá ÇíÌÇÏ ÔÏ',
      data: {
        id: 'prod_' + Date.now(),
        ...body,
      },
    };
  }
}

// Simple Orders Controller
@Controller('api/v3/orders')
class OrdersController {
  @Post()
  create(@Body() body: any) {
    return {
      success: true,
      message: 'ÓÝÇÑÔ ËÈÊ ÔÏ',
      data: {
        id: 'order_' + Date.now(),
        status: 'PENDING',
        items: body.items,
      },
    };
  }
}

// Simple Invoices Controller
@Controller('api/v3/invoices')
class InvoicesController {
  @Post()
  create(@Body() body: any) {
    return {
      success: true,
      message: 'ÝÇ˜ÊæÑ ÇíÌÇÏ ÔÏ',
      data: {
        id: 'inv_' + Date.now(),
        order_id: body.order_id,
        total: 99.99,
      },
    };
  }
}

// Simple Payments Controller
@Controller('api/v3/payments')
class PaymentsController {
  @Post()
  process(@Body() body: any) {
    return {
      success: true,
      message: 'ÑÏÇÎÊ ãæÝÞ',
      data: {
        id: 'pay_' + Date.now(),
        invoice_id: body.invoice_id,
        status: 'COMPLETED',
      },
    };
  }
}

// Simple Tax Controller
@Controller('api/v3/tax')
class TaxController {
  @Post('calculate')
  calculate(@Body() body: any) {
    const subtotal = body.items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0;
    const taxRate = 0.09; // 9% VAT
    const tax = subtotal * taxRate;
    
    return {
      success: true,
      data: {
        subtotal,
        tax_rate: taxRate,
        tax_amount: tax,
        total: subtotal + tax,
        jurisdiction: body.jurisdiction || 'IR',
      },
    };
  }
}

// App Module
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
  ],
  controllers: [
    HealthController,
    ApiHealthController,
    AuthController,
    ProductsController,
    OrdersController,
    InvoicesController,
    PaymentsController,
    TaxController,
  ],
})
class AppModule {}

// Bootstrap
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  const port = process.env.API_PORT || 3000;
  await app.listen(port, '0.0.0.0');
  
  logger.log(`? API Server running on http://localhost:${port}`);
  logger.log(`?? Health: http://localhost:${port}/api/v3/health`);
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
