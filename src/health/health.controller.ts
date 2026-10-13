import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';
import { HealthResponseDto } from './dto/health-response.dto.js';
import { ApiTags, ApiOkResponse, ApiNotFoundResponse, ApiInternalServerErrorResponse } from '@nestjs/swagger';

@ApiTags("Health")
@Controller('health')
export class HealthController {
    public constructor(
        private readonly healthService: HealthService
    ){}
    @Get()
    @ApiOkResponse({
        description: "Status de salud piola",
        type: [HealthResponseDto]
    })
    @ApiNotFoundResponse({
        description: "Errol 500",
        example: {
            statusCode: 404,
            message: "Not found",
            error: "Health info not found"
        }
    })
    @ApiInternalServerErrorResponse({
        description: "Errol 500",
        example: {
            statusCode: 500,
            message: "quiniento no ve",
            error: "quiniento no ve"
        }
    })
    getHealth(): HealthResponseDto {
        return this.healthService.getHealth()
    }
}
