import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Solicitud } from './solicitudes/dao/solicitud.dao.js';
import { SolicitudHistorial } from './solicitudes/dao/solicitud-historial.dao.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'nestest',
      entities: [Solicitud, SolicitudHistorial],
      synchronize: true,
      migrations: [`${import.meta.dirname}/migrations/*{.ts,.js}`],
    }),
  ],
})
export class DatabaseModule {}