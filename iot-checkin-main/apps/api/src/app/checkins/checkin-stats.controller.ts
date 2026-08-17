import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CheckinStatsService } from './checkin-stats.service';
import { Roles } from '../auth/roles.decorator';
import { User } from '../auth/user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CheckinStatsResponse } from 'libs';

@Controller('checkins-stats')
export class CheckinStatsController {
  constructor(private readonly statsService: CheckinStatsService) {}

  @Get()
  async getStatistics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @User() user: AuthenticatedUser,
    @Query('locationId') locationId?: string,
  ): Promise<CheckinStatsResponse> {
    return this.statsService.getSummaryStats(startDate, endDate, user.id, user.role, locationId);
  }

  @Get('export')
  async exportExcel(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @User() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('locationId') locationId?: string,
  ) {
    const buffer = await this.statsService.exportExcel(startDate, endDate, user.id, user.role, locationId);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Checkin_Stats_${startDate}_${endDate}.xlsx`);
    
    res.send(buffer);
  }
}
