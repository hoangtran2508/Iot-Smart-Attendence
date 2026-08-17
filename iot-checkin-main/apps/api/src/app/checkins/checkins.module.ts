import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn } from '../../entities/checkin.entity';
import { CheckinKey } from '../../entities/checkin-key.entity';
import { Device } from '../../entities/device.entity';
import { Location } from '../../entities/location.entity';
import { User } from '../../entities/user.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { CheckinFactoryService } from './checkin.factory.service';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';
import { CheckinStatsController } from './checkin-stats.controller';
import { CheckinStatsService } from './checkin-stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([CheckIn, User, Location, CheckinKey, Device, UserDevice])],
  controllers: [CheckinsController, CheckinStatsController],
  providers: [CheckinsService, CheckinFactoryService, CheckinStatsService],
})
export class CheckinsModule {}
