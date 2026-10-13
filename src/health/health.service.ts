import { Injectable } from '@nestjs/common';
import { HealthResponseDto } from './dto/health-response.dto.js';
import { HealthDao } from './dao/health.dao.js';

@Injectable()
export class HealthService {
    public constructor(
        private readonly healthDao: HealthDao
    ) {}
    public getHealth(): HealthResponseDto{
        return {
            status: "ok",
            timestamp: new Date().toISOString(),
            application: this.healthDao.getApplicationName(),
            version: this.healthDao.getApplicationVersion()
        }
    }
}
