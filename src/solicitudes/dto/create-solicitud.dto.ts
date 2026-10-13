import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSolicitudDto {
  @ApiProperty({
    description: 'Nombre del cliente',
    example: 'Juan Pérez',
  })
  @IsString()
  @IsNotEmpty()
  cliente: string;

  @ApiProperty({
    description: 'Motivo de la solicitud',
    example: 'Consulta sobre el servicio de soporte',
  })
  @IsString()
  @IsNotEmpty()
  descripcion: string;
}