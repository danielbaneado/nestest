import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import type { Solicitud } from './solicitud.dao.js';

export enum TipoEventoHistorial {
  CREACION = 'CREACION',
  ESTADO = 'ESTADO',
  ASIGNACION = 'ASIGNACION',
}

@Entity()
@Index(['solicitudId', 'fechaEvento'])
export class SolicitudHistorial {
  @ApiProperty({ description: 'Identificador único del evento', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ID de la solicitud relacionada', example: 1 })
  @Column({ name: 'solicitud_id' })
  solicitudId: number;

  @ApiProperty({ description: 'Tipo de evento', enum: TipoEventoHistorial, example: TipoEventoHistorial.CREACION })
  @Column({
    type: 'enum',
    enum: TipoEventoHistorial,
  })
  tipoEvento: TipoEventoHistorial;

  @ApiProperty({ description: 'Valor previo al cambio (cuando aplica)', required: false, nullable: true, example: 'PENDIENTE' })
  @Column({ type: 'varchar', nullable: true })
  valorAnterior: string | null;

  @ApiProperty({ description: 'Nuevo valor aplicado', required: false, nullable: true, example: 'EN_GESTION' })
  @Column({ type: 'varchar', nullable: true })
  valorNuevo: string | null;

  @ApiProperty({ description: 'Usuario que ejecutó la acción', example: 'supervisor1' })
  @Column({ type: 'varchar' })
  usuarioActor: string;

  @ApiProperty({ description: 'Fecha y hora del evento' })
  @CreateDateColumn({ name: 'fecha_evento' })
  fechaEvento: Date;

  @ManyToOne('Solicitud', 'historial', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitud_id' })
  solicitud: Solicitud;
}