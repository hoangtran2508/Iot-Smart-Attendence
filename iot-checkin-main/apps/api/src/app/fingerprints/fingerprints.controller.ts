import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { FingerprintsService } from './fingerprints.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { User } from '../auth/user.decorator';

@Controller('locations/:locationId/fingerprints')
export class FingerprintsController {
  constructor(private readonly fingerprintsService: FingerprintsService) {}

  @Post('request-enroll')
  async requestEnroll(
    @Param('locationId') locationId: string,
    @User() user: AuthenticatedUser,
    @Body('userId') targetUserId?: string,
  ) {
    return this.fingerprintsService.requestEnroll(locationId, user.id, targetUserId);
  }

  @Get('enroll-status/:userId')
  async getEnrollStatus(
    @Param('locationId') locationId: string,
    @Param('userId') userId: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.fingerprintsService.getEnrollStatus(locationId, userId, user.id, user.role);
  }

  @Delete('enroll-status/:userId')
  async clearEnrollStatus(
    @Param('locationId') locationId: string,
    @Param('userId') userId: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.fingerprintsService.clearEnrollStatus(locationId, userId, user.id, user.role);
  }
}
