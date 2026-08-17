import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../../entities/device.entity';
import { Location } from '../../entities/location.entity';
import { StationScanReport } from '../../entities/station-scan-report.entity';
import { MqttModule } from '../mqtt/mqtt.module';
import { DeviceFactoryService } from './device.factory.service';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, Location, StationScanReport]),
    MqttModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService, DeviceFactoryService],
  exports: [DevicesService, TypeOrmModule],
})
export class DevicesModule {}
