import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './health/health.module.js';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from './config/config.module.js';
import { ConfigService } from './config/config.service.js';
import { Config } from './config/config.keys.js';
import { DatabaseModule } from './database.js';
import { SolicitudesModule } from './solicitudes/solicitudes.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    SolicitudesModule,
    ObserveModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        appKey: configService.get('OBSERVE_APP_KEY') || 'observe',
        appSecret: configService.get('OBSERVE_APP_SECRET') || 'observe',
        serviceId: configService.get('OBSERVE_APP_NAME') || 'nestest',
      }),
    }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {
  static appPort: number | string;

  constructor(private readonly _configService: ConfigService) {
    AppModule.appPort = this._configService.get(Config.APP_PORT);
  }
}