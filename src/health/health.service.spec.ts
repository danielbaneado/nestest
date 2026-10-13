import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service.js';
import { HealthDao } from './dao/health.dao.js';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService, HealthDao],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});