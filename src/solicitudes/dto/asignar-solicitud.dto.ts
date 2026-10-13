import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AsignarSolicitudDto {
  @ApiProperty({
    description: 'Identificador del asesor a asignar',
    example: 'asesor2',
  })
  @IsString()
  @IsNotEmpty()
  asesorId: string;
}