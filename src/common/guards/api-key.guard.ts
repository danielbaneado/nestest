import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '../../config/config.service.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('API key missing');
    }

    const apiKeys = this.configService.get('API_KEYS');
    if (!apiKeys) {
      throw new UnauthorizedException('API keys not configured');
    }

    const validKeys = apiKeys
      .split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0);

    if (!validKeys.includes(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}