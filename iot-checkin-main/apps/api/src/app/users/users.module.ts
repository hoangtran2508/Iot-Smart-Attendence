import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../../entities/user.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { UserFactoryService } from './user.factory.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserDevice])],
  controllers: [UsersController],
  providers: [UsersService, UserFactoryService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule { }
