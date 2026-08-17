import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CheckinsModule } from './checkins/checkins.module';
import { DevicesModule } from './devices/devices.module';
import { FingerprintsModule } from './fingerprints/fingerprints.module';
import { LocationsModule } from './locations/locations.module';
import { MqttModule } from './mqtt/mqtt.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/api/src/.env', 'apps/api/src/.env.local'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        url: configService.get<string>('DATABASE_URL'),
        type: 'postgres',
        autoLoadEntities: true,
        synchronize: true, // Enable automatic table generation for dev
      }),
    }),
    AuthModule,
    UsersModule,
    LocationsModule,
    CheckinsModule,
    DevicesModule,
    FingerprintsModule,
    MqttModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

