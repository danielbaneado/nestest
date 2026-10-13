import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Solicitud } from './dao/solicitud.dao.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';
import { AsignarSolicitudDto } from './dto/asignar-solicitud.dto.js';
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

  async create(createSoli: CreateSolicitudDto, user: CurrentUser): Promise<Solicitud> {
    // RN-01: el estado inicial siempre es PENDIENTE
    // RN-07: si el solicitante es asesor, se asigna a sí mismo; si es supervisor/admin, queda sin asignar
    let asesor: string | null = null;
    if (user.role === UserRoles.ASESOR) {
      asesor = user.username;
    }

    const solicitud = this.solicitudRepository.create({
      ...createSoli,
      asesor,
      estado: EstadoSolicitud.PENDIENTE,
    });

    return this.solicitudRepository.save(solicitud);
  }

  async findAll(user: CurrentUser): Promise<Solicitud[]> {
    // RN-02: el asesor solo ve sus propias solicitudes (filtrado en BD).
    if (user.role === UserRoles.ASESOR) {
      return this.solicitudRepository.find({ where: { asesor: user.username } });
    }
    // admin y supervisor ven todo.
    return this.solicitudRepository.find();
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
    const solicitud = await this.solicitudRepository.findOne({ where: { id } });
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

    solicitud.estado = newState;
    return this.solicitudRepository.save(solicitud);
  }

  async asignar(id: number, asignarDto: AsignarSolicitudDto, user: CurrentUser): Promise<Solicitud> {
    // RN-07: solo admin y supervisor pueden asignar
    if (!this.canAssign(user)) {
      throw new ForbiddenException('No tiene permiso para asignar solicitudes');
    }

    const solicitud = await this.solicitudRepository.findOne({ where: { id } });
    if (!solicitud) {
      throw new NotFoundException(`Soli con ID ${id} no encontrada`);
    }

    // RN-07: no se puede reasignar una solicitud RESUELTA
    if (solicitud.estado === EstadoSolicitud.RESUELTA) {
      throw new ConflictException('No se puede asignar una solicitud en estado RESUELTA');
    }

    // RN-07: el usuario asignado debe existir y tener rol asesor
    this.validateAsesor(asignarDto.asesorId);

    // RN-07: reasignar no cambia automáticamente el estado
    solicitud.asesor = asignarDto.asesorId;

    // TODO: RN-09: registrar en historial (se implementará en RN-09)
    
    return this.solicitudRepository.save(solicitud);
  }
}