import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Solicitud } from './dao/solicitud.dao.js';
import { SolicitudHistorial, TipoEventoHistorial } from './dao/solicitud-historial.dao.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';
import { AsignarSolicitudDto } from './dto/asignar-solicitud.dto.js';
import { FiltrarSolicitudesDto, PaginatedResult } from './dto/filtrar-solicitudes.dto.js';
import { HistorialEventoDto } from './dto/historial.dto.js';
import { EstadoSolicitud } from './estado-solicitud.enum.js';
import { IN_MEMORY_USERS_BY_USERNAME, InMemoryUser } from '../common/in-memory-users.js';
import { UserRoles } from '../common/enums/domain.enums.js';

export interface CurrentUser {
  username: string;
  role: string;
}

/** Valid transitions: PENDIENTE -> EN_GESTION -> RESUELTA */
const TRANSITIONS: Record<EstadoSolicitud, EstadoSolicitud | null> = {
  [EstadoSolicitud.PENDIENTE]: EstadoSolicitud.EN_GESTION,
  [EstadoSolicitud.EN_GESTION]: EstadoSolicitud.RESUELTA,
  [EstadoSolicitud.RESUELTA]: null,
};

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(Solicitud)
    private solicitudRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudHistorial)
    private historialRepository: Repository<SolicitudHistorial>,
    private dataSource: DataSource,
  ) {}

  private validateAsesor(username: string): InMemoryUser {
    const user = IN_MEMORY_USERS_BY_USERNAME.get(username);
    if (!user) {
      throw new NotFoundException(`Usuario ${username} no encontrado`);
    }
    if (user.role !== UserRoles.ASESOR) {
      throw new ForbiddenException(`El usuario ${username} no tiene rol de asesor`);
    }
    return user;
  }

  private canAssign(user: CurrentUser): boolean {
    return user.role === UserRoles.ADMIN || user.role === UserRoles.SUPERVISOR;
  }

  private async createHistorialEvent(
    solicitudId: number,
    tipoEvento: TipoEventoHistorial,
    valorAnterior: string | null,
    valorNuevo: string | null,
    usuarioActor: string,
  ): Promise<void> {
    const historial = this.historialRepository.create({
      solicitudId,
      tipoEvento,
      valorAnterior,
      valorNuevo,
      usuarioActor,
    });
    await this.historialRepository.save(historial);
  }

  async create(createSoli: CreateSolicitudDto, user: CurrentUser): Promise<Solicitud> {
    // RN-01: el estado inicial siempre es PENDIENTE
    // RN-07: si el solicitante es asesor, se asigna a sí mismo; si es supervisor/admin, queda sin asignar
    let asesor: string | null = null;
    if (user.role === UserRoles.ASESOR) {
      asesor = user.username;
    }

    // RN-09: crear solicitud y evento de historial en la misma transacción
    return this.dataSource.transaction(async (manager) => {
      const solicitudRepo = manager.getRepository(Solicitud);
      const historialRepo = manager.getRepository(SolicitudHistorial);

      const solicitud = solicitudRepo.create({
        ...createSoli,
        asesor,
        estado: EstadoSolicitud.PENDIENTE,
      });

      const savedSolicitud = await solicitudRepo.save(solicitud);

      // RN-09: registrar evento CREACION con valor inicial PENDIENTE
      const historial = historialRepo.create({
        solicitudId: savedSolicitud.id,
        tipoEvento: TipoEventoHistorial.CREACION,
        valorAnterior: null,
        valorNuevo: EstadoSolicitud.PENDIENTE,
        usuarioActor: user.username,
      });
      await historialRepo.save(historial);

      return savedSolicitud;
    });
  }

  async findAll(user: CurrentUser, filtros?: FiltrarSolicitudesDto): Promise<PaginatedResult<Solicitud>> {
    const page = filtros?.page ?? 1;
    const limit = filtros?.limit ?? 10;

    const queryBuilder = this.solicitudRepository.createQueryBuilder('solicitud');

    // RN-02 / RN-08: el asesor solo ve sus propias solicitudes (filtrado en BD).
    if (user.role === UserRoles.ASESOR) {
      queryBuilder.andWhere('solicitud.asesor = :username', { username: user.username });
    }

    // Filtros adicionales (RN-08)
    if (filtros) {
      if (filtros.estado) {
        queryBuilder.andWhere('solicitud.estado = :estado', { estado: filtros.estado });
      }

      if (filtros.asesor) {
        // RN-08: los filtros no pueden ampliar los permisos del usuario.
        // Si es asesor, ya se filtró arriba por su propio username.
        if (user.role !== UserRoles.ASESOR) {
          queryBuilder.andWhere('solicitud.asesor = :asesor', { asesor: filtros.asesor });
        }
      }

      if (filtros.cliente) {
        queryBuilder.andWhere('solicitud.cliente ILIKE :cliente', { cliente: `%${filtros.cliente}%` });
      }

      if (filtros.desde && filtros.hasta) {
        const desde = new Date(filtros.desde);
        const hasta = new Date(filtros.hasta);
        queryBuilder.andWhere('solicitud.creadaEn BETWEEN :desde AND :hasta', { desde, hasta });
      } else if (filtros.desde) {
        const desde = new Date(filtros.desde);
        queryBuilder.andWhere('solicitud.creadaEn >= :desde', { desde });
      } else if (filtros.hasta) {
        const hasta = new Date(filtros.hasta);
        queryBuilder.andWhere('solicitud.creadaEn <= :hasta', { hasta });
      }
    }

    // Ordenar por fecha de creación descendente para consistencia
    queryBuilder.orderBy('solicitud.creadaEn', 'DESC');

    // Paginación en base de datos
    const total = await queryBuilder.getCount();
    const totalPages = Math.ceil(total / limit);
    const items = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: number, user: CurrentUser): Promise<Solicitud> {
    const solicitud = await this.solicitudRepository.findOne({ where: { id } });
    if (!solicitud) {
      throw new NotFoundException(`Soli con ID ${id} no encontrada`);
    }
    // RN-02: un asesor solo puede ver solicitudes de su responsabilidad.
    if (user.role === UserRoles.ASESOR && solicitud.asesor !== user.username) {
      throw new ForbiddenException('No tiene permiso para ver esta solicitud');
    }
    return solicitud;
  }

  async updateEstado(id: number, updateEstadoDto: UpdateEstadoDto, user: CurrentUser): Promise<Solicitud> {
    // RN-09: cambio de estado y historial en la misma transacción
    return this.dataSource.transaction(async (manager) => {
      const solicitudRepo = manager.getRepository(Solicitud);
      const historialRepo = manager.getRepository(SolicitudHistorial);

      const solicitud = await solicitudRepo.findOne({ where: { id } });
      if (!solicitud) {
        throw new NotFoundException(`Soli con ID ${id} no encontrada`);
      }

      // RN-03: solo supervisor o admin pueden cambiar estado.
      if (user.role === UserRoles.ASESOR) {
        // El asesor solo puede cambiar el estado de su propia solicitud.
        if (solicitud.asesor !== user.username) {
          throw new ForbiddenException('No tiene permiso para modificar esta solicitud');
        }
      }

      const newState = updateEstadoDto.estado;
      // RN-03: transiciones válidas PENDIENTE -> EN_GESTION -> RESUELTA.
      const allowedNext = TRANSITIONS[solicitud.estado];
      if (allowedNext === null) {
        throw new ForbiddenException(
          `No se permite cambiar el estado de una solicitud ${solicitud.estado}`,
        );
      }
      if (newState !== allowedNext) {
        throw new ForbiddenException(
          `Transición inválida: de ${solicitud.estado} a ${newState}. Transición permitida: ${allowedNext}`,
        );
      }

      const valorAnterior = solicitud.estado;
      solicitud.estado = newState;
      const savedSolicitud = await solicitudRepo.save(solicitud);

      // RN-09: registrar evento ESTADO en historial
      const historial = historialRepo.create({
        solicitudId: savedSolicitud.id,
        tipoEvento: TipoEventoHistorial.ESTADO,
        valorAnterior,
        valorNuevo: newState,
        usuarioActor: user.username,
      });
      await historialRepo.save(historial);

      return savedSolicitud;
    });
  }

  async asignar(id: number, asignarDto: AsignarSolicitudDto, user: CurrentUser): Promise<Solicitud> {
    // RN-09: asignación y historial en la misma transacción
    return this.dataSource.transaction(async (manager) => {
      const solicitudRepo = manager.getRepository(Solicitud);
      const historialRepo = manager.getRepository(SolicitudHistorial);

      // RN-07: solo admin y supervisor pueden asignar
      if (!this.canAssign(user)) {
        throw new ForbiddenException('No tiene permiso para asignar solicitudes');
      }

      const solicitud = await solicitudRepo.findOne({ where: { id } });
      if (!solicitud) {
        throw new NotFoundException(`Soli con ID ${id} no encontrada`);
      }

      // RN-07: no se puede reasignar una solicitud RESUELTA
      if (solicitud.estado === EstadoSolicitud.RESUELTA) {
        throw new ConflictException('No se puede asignar una solicitud en estado RESUELTA');
      }

      // RN-07: el usuario asignado debe existir y tener rol asesor
      this.validateAsesor(asignarDto.asesorId);

      const valorAnterior = solicitud.asesor ?? 'sin asignar';
      // RN-07: reasignar no cambia automáticamente el estado
      solicitud.asesor = asignarDto.asesorId;
      const savedSolicitud = await solicitudRepo.save(solicitud);

      // RN-09: registrar evento ASIGNACION en historial
      const historial = historialRepo.create({
        solicitudId: savedSolicitud.id,
        tipoEvento: TipoEventoHistorial.ASIGNACION,
        valorAnterior,
        valorNuevo: asignarDto.asesorId,
        usuarioActor: user.username,
      });
      await historialRepo.save(historial);

      return savedSolicitud;
    });
  }

  async getHistorial(id: number, user: CurrentUser): Promise<HistorialEventoDto[]> {
    // Primero verificar que la solicitud existe y el usuario tiene acceso
    const _solicitud = await this.findOne(id, user);

    // RN-09: Solo admin y supervisor pueden consultar el historial de cualquier solicitud.
    // Un asesor puede consultar el historial de solicitudes que tiene asignadas actualmente.
    // El método findOne ya valida que el asesor solo ve sus solicitudes.

    const historial = await this.historialRepository.find({
      where: { solicitudId: id },
      order: { fechaEvento: 'ASC' },
    });

    return historial.map((h) => ({
      id: h.id,
      solicitudId: h.solicitudId,
      tipoEvento: h.tipoEvento,
      valorAnterior: h.valorAnterior,
      valorNuevo: h.valorNuevo,
      usuarioActor: h.usuarioActor,
      fechaEvento: h.fechaEvento,
    }));
  }
}