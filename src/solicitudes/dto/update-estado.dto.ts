import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EstadoSolicitud } from '../estado-solicitud.enum.js';

export class UpdateEstadoDto {
  @ApiProperty({
    description: 'Nuevo estado de la solicitud',
    enum: EstadoSolicitud,
    example: EstadoSolicitud.EN_GESTION,
  })
  @IsEnum(EstadoSolicitud)
  estado: EstadoSolicitud;
}