import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Solicitud } from './dao/solicitud.dao.js';
import { SolicitudHistorial } from './dao/solicitud-historial.dao.js';
import { SolicitudesService } from './solicitudes.service.js';
import { SolicitudesController } from './solicitudes.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Solicitud, SolicitudHistorial])],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
})
export class SolicitudesModule {}