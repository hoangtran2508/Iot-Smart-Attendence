import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckIn } from '../../entities/checkin.entity';
import { CheckinKey } from '../../entities/checkin-key.entity';
import { Device } from '../../entities/device.entity';
import { Fingerprint } from '../../entities/fingerprint.entity';
import { PendingEnrollment } from '../../entities/pending-enrollment.entity';
import { StationScanReport } from '../../entities/station-scan-report.entity';
import { Location } from '../../entities/location.entity';
import { MqttService } from './mqtt.service';
import { AuthModule } from '../auth/auth.module';
import { UserDevice } from '../../entities/user-device.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Device,
      PendingEnrollment,
      Fingerprint,
      CheckIn,
      CheckinKey,
      StationScanReport,
      Location,
      UserDevice,
    ]),
  ],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
