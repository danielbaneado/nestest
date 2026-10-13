import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { EstadoSolicitud } from '../estado-solicitud.enum.js';

@Entity()
export class Solicitud {
  @ApiProperty({ description: 'Identificador único', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Nombre del cliente', example: 'Juan Pérez' })
  @Column()
  cliente: string;

  @ApiProperty({ description: 'Motivo de la solicitud', example: 'Consulta sobre el servicio' })
  @Column()
  descripcion: string;

  @ApiProperty({ description: 'Asesor responsable', example: 'asesor1', required: false, nullable: true })
  @Column({ type: 'varchar', nullable: true })
  asesor: string | null;

  @ApiProperty({ description: 'Estado actual', enum: EstadoSolicitud, example: EstadoSolicitud.PENDIENTE })
  @Column({
    type: 'enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn()
  creadaEn: Date;

  @ApiProperty({ description: 'Fecha de última modificación' })
  @UpdateDateColumn()
  actualizadaEn: Date;
}