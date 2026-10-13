import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Solicitud } from './dao/solicitud.dao.js';
import { SolicitudesService } from './solicitudes.service.js';
import { SolicitudesController } from './solicitudes.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Solicitud])],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
})
export class SolicitudesModule {}