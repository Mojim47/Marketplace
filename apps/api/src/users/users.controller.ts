import { Controller, Get, Logger, Request, UnauthorizedException } from '@nestjs/common';
import type { UserEntity, UsersService } from './users.service';

@Controller('v1/users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user profile
   * Requires JWT authentication
   */
  @Get('me')
  // @UseGuards(JwtAuthGuard) // Will be added after creating the guard
  async getProfile(@Request() req: any): Promise<UserEntity> {
    this.logger.log(`Fetching profile for user: ${req.user?.sub}`);

    if (!req.user?.sub) {
      throw new UnauthorizedException('User not authenticated');
    }

    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
