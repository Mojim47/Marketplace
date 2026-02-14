import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, AuthService, LoginDto, RegisterDto } from './auth.service';
import {
  type ForgotPasswordDto,
  type ResetPasswordDto,
  SMSResponseDto,
  type SendVerificationCodeDto,
  type VerifySMSCodeDto,
} from './dto/sms.dto';
import {
  type Disable2FADto,
  Enable2FAResponseDto,
  TwoFactorStatusDto,
  type Verify2FADto,
  type VerifyBackupCodeDto,
} from './dto/totp.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { SMSVerificationService } from './sms-verification.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly smsVerificationService: SMSVerificationService
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '���� �����' })
  @ApiResponse({ status: 200, description: '���� ����' })
  @ApiResponse({ status: 401, description: '������� ���� �������' })
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: '��� ��� ����� ����' })
  @ApiResponse({ status: 201, description: '��� ��� ����' })
  @ApiResponse({ status: 409, description: '����� ����� ���� ����' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  // ???????????????????????????????????????????????????????????????????????????
  // 2FA/TOTP Endpoints
  // Requirements: 2.1, 2.2, 2.3, 2.4
  // ???????????????????????????????????????????????????????????????????????????

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '�������� ����� ���� �� �������' })
  @ApiResponse({
    status: 200,
    description: '���� ���� � ����� �������',
    type: Enable2FAResponseDto,
  })
  @ApiResponse({ status: 401, description: '����� ���� ����' })
  @ApiResponse({ status: 409, description: '2FA ����� ���� ���' })
  async enable2FA(@Request() req: any): Promise<Enable2FAResponseDto> {
    return this.authService.enable2FA(req.user.sub);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� �� TOTP ���� ʘ��� �������� 2FA' })
  @ApiResponse({ status: 200, description: '2FA �� ������ ���� ��' })
  @ApiResponse({ status: 401, description: '�� �������' })
  async verify2FASetup(
    @Request() req: any,
    @Body() dto: Verify2FADto
  ): Promise<{ success: boolean }> {
    return this.authService.verify2FASetup(req.user.sub, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����������� ����� ���� �� �������' })
  @ApiResponse({ status: 200, description: '2FA ������� ��' })
  @ApiResponse({ status: 401, description: '��� ���� ������' })
  async disable2FA(@Request() req: any, @Body() dto: Disable2FADto): Promise<{ success: boolean }> {
    return this.authService.disable2FA(req.user.sub, dto.password, dto.totpCode);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '������ ����� 2FA' })
  @ApiResponse({ status: 200, description: '����� 2FA', type: TwoFactorStatusDto })
  async get2FAStatus(@Request() req: any): Promise<TwoFactorStatusDto> {
    return this.authService.get2FAStatus(req.user.sub);
  }

  @Post('2fa/backup-code/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� �� �������' })
  @ApiResponse({ status: 200, description: '�� ������� ����� ���' })
  @ApiResponse({ status: 401, description: '�� ������� �������' })
  async verifyBackupCode(
    @Request() req: any,
    @Body() dto: VerifyBackupCodeDto
  ): Promise<{ valid: boolean }> {
    // This endpoint might be called during login flow, so we need userId from body or token
    const userId = req.user?.sub || req.body?.userId;
    if (!userId) {
      return { valid: false };
    }
    return this.authService.verifyBackupCode(userId, dto.backupCode);
  }

  @Post('2fa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� ���� ����� �������' })
  @ApiResponse({ status: 200, description: '����� ������� ����' })
  @ApiResponse({ status: 401, description: '��� ���� ������' })
  async regenerateBackupCodes(
    @Request() req: any,
    @Body() dto: { password: string }
  ): Promise<{ backupCodes: string[] }> {
    return this.authService.regenerateBackupCodes(req.user.sub, dto.password);
  }

  // ???????????????????????????????????????????????????????????????????????????
  // SMS Verification Endpoints
  // Requirements: 5.1, 5.2, 5.3, 5.4
  // ???????????????????????????????????????????????????????????????????????????

  @Post('sms/send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� �� ����� �����' })
  @ApiResponse({ status: 200, description: '�� ����� ��', type: SMSResponseDto })
  @ApiResponse({ status: 400, description: '����� ������ �������' })
  @ApiResponse({ status: 429, description: '����� ������ʝ�� ��� �� �� ����' })
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto): Promise<SMSResponseDto> {
    return this.smsVerificationService.sendVerificationCode(
      dto.mobile,
      dto.purpose || 'verify_mobile'
    );
  }

  @Post('sms/verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� �� �����' })
  @ApiResponse({ status: 200, description: '����� �����', type: SMSResponseDto })
  @ApiResponse({ status: 400, description: '�� �������' })
  async verifySMSCode(@Body() dto: VerifySMSCodeDto): Promise<SMSResponseDto> {
    return this.smsVerificationService.verifyCode(dto.mobile, dto.code);
  }

  @Post('sms/register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� �� ����� ��ʝ���' })
  @ApiResponse({ status: 200, description: '�� ����� ��', type: SMSResponseDto })
  @ApiResponse({ status: 409, description: '����� ������ ����� ��� ���' })
  async sendRegistrationCode(@Body() dto: SendVerificationCodeDto): Promise<SMSResponseDto> {
    return this.smsVerificationService.sendRegistrationCode(dto.mobile);
  }

  @Post('sms/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� �� ������� ��� ����' })
  @ApiResponse({ status: 200, description: '�� ����� ��', type: SMSResponseDto })
  async sendForgotPasswordCode(@Body() dto: ForgotPasswordDto): Promise<SMSResponseDto> {
    return this.smsVerificationService.sendPasswordRecoveryCode(dto.mobile);
  }

  @Post('sms/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '�������� ��� ���� �� �� �����' })
  @ApiResponse({ status: 200, description: '��� ���� ����� ���' })
  @ApiResponse({ status: 400, description: '�� �������' })
  async resetPasswordWithSMS(@Body() dto: ResetPasswordDto): Promise<SMSResponseDto> {
    // First verify the code
    const verifyResult = await this.smsVerificationService.verifyCode(
      dto.mobile,
      dto.code,
      'forgot_password'
    );

    if (!verifyResult.success) {
      return verifyResult;
    }

    // Find user and update password
    const user = await this.authService.prisma.user.findFirst({
      where: { mobile: dto.mobile },
    });

    if (!user) {
      return {
        success: false,
        message: '����� ���� ���',
      };
    }

    // Hash and update password
    const passwordHash = await this.authService.hashPassword(dto.newPassword);
    await this.authService.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return {
      success: true,
      message: '��� ���� �� ������ ����� ���',
    };
  }

  @Post('sms/verify-mobile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� �� ����� ������ ����' })
  @ApiResponse({ status: 200, description: '�� ����� ��', type: SMSResponseDto })
  @ApiResponse({ status: 409, description: '����� ������ ���� ����� ���� ������� ���' })
  async sendMobileVerificationCode(
    @Request() req: any,
    @Body() dto: SendVerificationCodeDto
  ): Promise<SMSResponseDto> {
    return this.smsVerificationService.sendMobileVerificationCode(req.user.sub, dto.mobile);
  }

  @Post('sms/confirm-mobile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '����� � ���������� ����� ������' })
  @ApiResponse({ status: 200, description: '������ ����� ��', type: SMSResponseDto })
  @ApiResponse({ status: 400, description: '�� �������' })
  async confirmMobileVerification(
    @Request() req: any,
    @Body() dto: VerifySMSCodeDto
  ): Promise<SMSResponseDto> {
    return this.smsVerificationService.verifyAndUpdateMobile(req.user.sub, dto.mobile, dto.code);
  }
}
