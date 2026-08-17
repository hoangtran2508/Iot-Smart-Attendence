import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../../entities/location.entity';
import { User } from '../../entities/user.entity';
import { LocationFactoryService } from './location.factory.service';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Location, User])],
  controllers: [LocationsController],
  providers: [LocationsService, LocationFactoryService],
  exports: [LocationsService, TypeOrmModule],
})
export class LocationsModule {}
