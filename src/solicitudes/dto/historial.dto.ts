import { ApiProperty } from '@nestjs/swagger';
import { TipoEventoHistorial } from '../dao/solicitud-historial.dao.js';

export class HistorialEventoDto {
  @ApiProperty({ description: 'Identificador del evento', example: 1 })
  id: number;

  @ApiProperty({ description: 'ID de la solicitud relacionada', example: 1 })
  solicitudId: number;

  @ApiProperty({ description: 'Tipo de evento', enum: TipoEventoHistorial, example: TipoEventoHistorial.CREACION })
  tipoEvento: TipoEventoHistorial;

  @ApiProperty({ description: 'Valor previo al cambio (cuando aplica)', required: false, nullable: true, example: 'PENDIENTE' })
  valorAnterior: string | null;

  @ApiProperty({ description: 'Nuevo valor aplicado', required: false, nullable: true, example: 'EN_GESTION' })
  valorNuevo: string | null;

  @ApiProperty({ description: 'Usuario que ejecutó la acción', example: 'supervisor1' })
  usuarioActor: string;

  @ApiProperty({ description: 'Fecha y hora del evento' })
  fechaEvento: Date;
}