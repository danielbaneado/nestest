import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { HealthDao } from './dao/health.dao.js';

@Module({
  controllers: [HealthController],
  providers: [HealthService, HealthDao]
})
export class HealthModule {}
