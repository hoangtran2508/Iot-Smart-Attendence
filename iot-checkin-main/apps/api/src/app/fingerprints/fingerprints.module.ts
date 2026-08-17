import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fingerprint } from '../../entities/fingerprint.entity';
import { Location } from '../../entities/location.entity';
import { PendingEnrollment } from '../../entities/pending-enrollment.entity';
import { Device } from '../../entities/device.entity';
import { MqttModule } from '../mqtt/mqtt.module';
import { FingerprintsController } from './fingerprints.controller';
import { FingerprintsService } from './fingerprints.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Fingerprint, PendingEnrollment, Location, Device]),
    MqttModule,
  ],
  controllers: [FingerprintsController],
  providers: [FingerprintsService],
  exports: [FingerprintsService, TypeOrmModule],
})
export class FingerprintsModule {}
