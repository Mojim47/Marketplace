import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Get, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, LoginDto, RegisterDto, AuthResponse } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Verify2FADto, Disable2FADto, VerifyBackupCodeDto, Enable2FAResponseDto, TwoFactorStatusDto } from './dto/totp.dto';
import { SendVerificationCodeDto, VerifySMSCodeDto, ForgotPasswordDto, ResetPasswordDto, SMSResponseDto } from './dto/sms.dto';
import { SMSVerificationService } from './sms-verification.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly smsVerificationService: SMSVerificationService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'æÑæÏ ˜ÇÑÈÑ' })
  @ApiResponse({ status: 200, description: 'æÑæÏ ãæİŞ' })
  @ApiResponse({ status: 401, description: 'ÇØáÇÚÇÊ æÑæÏ äÇãÚÊÈÑ' })
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'ËÈÊ äÇã ˜ÇÑÈÑ ÌÏíÏ' })
  @ApiResponse({ status: 201, description: 'ËÈÊ äÇã ãæİŞ' })
  @ApiResponse({ status: 409, description: '˜ÇÑÈÑ ŞÈáÇğ æÌæÏ ÏÇÑÏ' })
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
  @ApiOperation({ summary: 'İÚÇáÓÇÒí ÇÍÑÇÒ åæíÊ Ïæ ãÑÍáåÇí' })
  @ApiResponse({ status: 200, description: '˜áíÏ ãÎİí æ ˜ÏåÇí ÔÊíÈÇä', type: Enable2FAResponseDto })
  @ApiResponse({ status: 401, description: 'ÇÍÑÇÒ åæíÊ äÔÏå' })
  @ApiResponse({ status: 409, description: '2FA ŞÈáÇğ İÚÇá ÔÏå' })
  async enable2FA(@Request() req: any): Promise<Enable2FAResponseDto> {
    return this.authService.enable2FA(req.user.sub);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÊÇííÏ ˜Ï TOTP ÈÑÇí Ê˜ãíá İÚÇáÓÇÒí 2FA' })
  @ApiResponse({ status: 200, description: '2FA ÈÇ ãæİŞíÊ İÚÇá ÔÏ' })
  @ApiResponse({ status: 401, description: '˜Ï äÇãÚÊÈÑ' })
  async verify2FASetup(@Request() req: any, @Body() dto: Verify2FADto): Promise<{ success: boolean }> {
    return this.authService.verify2FASetup(req.user.sub, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÛíÑİÚÇáÓÇÒí ÇÍÑÇÒ åæíÊ Ïæ ãÑÍáåÇí' })
  @ApiResponse({ status: 200, description: '2FA ÛíÑİÚÇá ÔÏ' })
  @ApiResponse({ status: 401, description: 'ÑãÒ ÚÈæÑ äÇÏÑÓÊ' })
  async disable2FA(@Request() req: any, @Body() dto: Disable2FADto): Promise<{ success: boolean }> {
    return this.authService.disable2FA(req.user.sub, dto.password, dto.totpCode);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ÏÑíÇİÊ æÖÚíÊ 2FA' })
  @ApiResponse({ status: 200, description: 'æÖÚíÊ 2FA', type: TwoFactorStatusDto })
  async get2FAStatus(@Request() req: any): Promise<TwoFactorStatusDto> {
    return this.authService.get2FAStatus(req.user.sub);
  }

  @Post('2fa/backup-code/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÊÇííÏ ˜Ï ÔÊíÈÇä' })
  @ApiResponse({ status: 200, description: '˜Ï ÔÊíÈÇä ãÚÊÈÑ ÇÓÊ' })
  @ApiResponse({ status: 401, description: '˜Ï ÔÊíÈÇä äÇãÚÊÈÑ' })
  async verifyBackupCode(
    @Request() req: any,
    @Body() dto: VerifyBackupCodeDto,
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
  @ApiOperation({ summary: 'ÊæáíÏ ãÌÏÏ ˜ÏåÇí ÔÊíÈÇä' })
  @ApiResponse({ status: 200, description: '˜ÏåÇí ÔÊíÈÇä ÌÏíÏ' })
  @ApiResponse({ status: 401, description: 'ÑãÒ ÚÈæÑ äÇÏÑÓÊ' })
  async regenerateBackupCodes(
    @Request() req: any,
    @Body() dto: { password: string },
  ): Promise<{ backupCodes: string[] }> {
    return this.authService.regenerateBackupCodes(req.user.sub, dto.password);
  }

  // ???????????????????????????????????????????????????????????????????????????
  // SMS Verification Endpoints
  // Requirements: 5.1, 5.2, 5.3, 5.4
  // ???????????????????????????????????????????????????????????????????????????

  @Post('sms/send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÇÑÓÇá ˜Ï ÊÇííÏ íÇã˜í' })
  @ApiResponse({ status: 200, description: '˜Ï ÇÑÓÇá ÔÏ', type: SMSResponseDto })
  @ApiResponse({ status: 400, description: 'ÔãÇÑå ãæÈÇíá äÇãÚÊÈÑ' })
  @ApiResponse({ status: 429, description: 'ÊÚÏÇÏ ÏÑÎæÇÓÊåÇ ÈíÔ ÇÒ ÍÏ ãÌÇÒ' })
  async sendVerificationCode(@Body() dto: SendVerificationCodeDto): Promise<SMSResponseDto> {
    return this.smsVerificationService.sendVerificationCode(dto.mobile, dto.purpose || 'verify_mobile');
  }

  @Post('sms/verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÊÇííÏ ˜Ï íÇã˜í' })
  @ApiResponse({ status: 200, description: 'äÊíÌå ÊÇííÏ', type: SMSResponseDto })
  @ApiResponse({ status: 400, description: '˜Ï äÇãÚÊÈÑ' })
  async verifySMSCode(@Body() dto: VerifySMSCodeDto): Promise<SMSResponseDto> {
    return this.smsVerificationService.verifyCode(dto.mobile, dto.code);
  }

  @Post('sms/register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÇÑÓÇá ˜Ï ÊÇííÏ ËÈÊäÇã' })
  @ApiResponse({ status: 200, description: '˜Ï ÇÑÓÇá ÔÏ', type: SMSResponseDto })
  @ApiResponse({ status: 409, description: 'ÔãÇÑå ãæÈÇíá ŞÈáÇğ ËÈÊ ÔÏå' })
  async sendRegistrationCode(@Body() dto: SendVerificationCodeDto): Promise<SMSResponseDto> {
    return this.smsVerificationService.sendRegistrationCode(dto.mobile);
  }

  @Post('sms/forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÇÑÓÇá ˜Ï ÈÇÒíÇÈí ÑãÒ ÚÈæÑ' })
  @ApiResponse({ status: 200, description: '˜Ï ÇÑÓÇá ÔÏ', type: SMSResponseDto })
  async sendForgotPasswordCode(@Body() dto: ForgotPasswordDto): Promise<SMSResponseDto> {
    return this.smsVerificationService.sendPasswordRecoveryCode(dto.mobile);
  }

  @Post('sms/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÈÇÒäÔÇäí ÑãÒ ÚÈæÑ ÈÇ ˜Ï íÇã˜í' })
  @ApiResponse({ status: 200, description: 'ÑãÒ ÚÈæÑ ÊÛííÑ ˜ÑÏ' })
  @ApiResponse({ status: 400, description: '˜Ï äÇãÚÊÈÑ' })
  async resetPasswordWithSMS(@Body() dto: ResetPasswordDto): Promise<SMSResponseDto> {
    // First verify the code
    const verifyResult = await this.smsVerificationService.verifyCode(dto.mobile, dto.code, 'forgot_password');
    
    if (!verifyResult.success) {
      return verifyResult;
    }

    // Find user and update password
    const user = await this.authService['prisma'].user.findFirst({
      where: { mobile: dto.mobile },
    });

    if (!user) {
      return {
        success: false,
        message: '˜ÇÑÈÑ íÇİÊ äÔÏ',
      };
    }

    // Hash and update password
    const passwordHash = await this.authService.hashPassword(dto.newPassword);
    await this.authService['prisma'].user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return {
      success: true,
      message: 'ÑãÒ ÚÈæÑ ÈÇ ãæİŞíÊ ÊÛííÑ ˜ÑÏ',
    };
  }

  @Post('sms/verify-mobile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÇÑÓÇá ˜Ï ÊÇííÏ ãæÈÇíá ÌÏíÏ' })
  @ApiResponse({ status: 200, description: '˜Ï ÇÑÓÇá ÔÏ', type: SMSResponseDto })
  @ApiResponse({ status: 409, description: 'ÔãÇÑå ãæÈÇíá ÊæÓØ ˜ÇÑÈÑ ÏíÑí ÇÓÊİÇÏå ÔÏå' })
  async sendMobileVerificationCode(
    @Request() req: any,
    @Body() dto: SendVerificationCodeDto,
  ): Promise<SMSResponseDto> {
    return this.smsVerificationService.sendMobileVerificationCode(req.user.sub, dto.mobile);
  }

  @Post('sms/confirm-mobile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ÊÇííÏ æ ÈåÑæÒÑÓÇäí ÔãÇÑå ãæÈÇíá' })
  @ApiResponse({ status: 200, description: 'ãæÈÇíá ÊÇííÏ ÔÏ', type: SMSResponseDto })
  @ApiResponse({ status: 400, description: '˜Ï äÇãÚÊÈÑ' })
  async confirmMobileVerification(
    @Request() req: any,
    @Body() dto: VerifySMSCodeDto,
  ): Promise<SMSResponseDto> {
    return this.smsVerificationService.verifyAndUpdateMobile(req.user.sub, dto.mobile, dto.code);
  }
}
