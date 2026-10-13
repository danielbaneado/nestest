import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiOperation,
  ApiSecurity,
  ApiConflictResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SolicitudesService } from './solicitudes.service.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';
import { AsignarSolicitudDto } from './dto/asignar-solicitud.dto.js';
import { FiltrarSolicitudesDto, PaginatedResult } from './dto/filtrar-solicitudes.dto.js';
import { HistorialEventoDto } from './dto/historial.dto.js';
import { Solicitud } from './dao/solicitud.dao.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';
import { UserRoleGuard } from '../common/guards/user-role.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Solicitudes')
@Controller('solicitudes')
@ApiSecurity('API Key')
@ApiSecurity('User Identity')
@UseGuards(ApiKeyGuard, UserRoleGuard)
export class SolicitudesController {
  constructor(private solicitudesService: SolicitudesService) {}

  @Post()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Registrar una solicitud comercial',
    description: 'Crea una nueva solicitud. El estado inicial siempre es PENDIENTE. Si la crea un asesor, queda asignada a ese asesor. Si la crea un supervisor o administrador, queda sin asignación hasta que sea asignada explícitamente.',
  })
  @ApiCreatedResponse({
    description: 'Solicitud creada correctamente',
    type: Solicitud,
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiUnauthorizedResponse({ description: 'Falta x-api-key o clave inválida' })
  @ApiForbiddenResponse({ description: 'Rol no autorizado' })
  async create(
    @Body() createSolicitudDto: CreateSolicitudDto,
    @CurrentUser() user: any,
  ): Promise<Solicitud> {
    // RN-01: cualquier usuario con rol válido puede registrar.
    return this.solicitudesService.create(createSolicitudDto, user);
  }

  @Get()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Listar solicitudes con filtros y paginación',
    description: 'Admin y supervisor ven todas las solicitudes. Asesor solo ve sus propias solicitudes. Soporta filtros por estado, asesor, cliente, rango de fechas y paginación.',
  })
  @ApiOkResponse({
    description: 'Lista paginada de solicitudes permitidas',
    schema: {
      example: {
        success: true,
        data: {
          items: [
            {
              id: 1,
              cliente: 'Ferretería El Norte',
              descripcion: 'Coordinar visita de seguimiento',
              asesor: 'asesor1',
              estado: 'PENDIENTE',
              creadaEn: '2026-10-13T10:00:00.000Z',
              actualizadaEn: '2026-10-13T10:00:00.000Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      },
    },
  })
  @ApiQuery({ name: 'estado', enum: ['PENDIENTE', 'EN_GESTION', 'RESUELTA'], required: false, description: 'Filtrar por estado' })
  @ApiQuery({ name: 'asesor', required: false, description: 'Filtrar por ID del asesor asignado' })
  @ApiQuery({ name: 'cliente', required: false, description: 'Búsqueda parcial por nombre del cliente (insensible a mayúsculas/minúsculas)' })
  @ApiQuery({ name: 'desde', required: false, description: 'Fecha inicio (ISO 8601) para filtrar por creadaEn' })
  @ApiQuery({ name: 'hasta', required: false, description: 'Fecha fin (ISO 8601) para filtrar por creadaEn' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Número de página (mínimo 1)' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Elementos por página (máximo 100)' })
  @ApiUnauthorizedResponse({ description: 'Falta x-api-key o clave inválida' })
  @ApiForbiddenResponse({ description: 'Rol no autorizado' })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos' })
  async findAll(
    @Query() filtros: FiltrarSolicitudesDto,
    @CurrentUser() user: any,
  ): Promise<PaginatedResult<Solicitud>> {
    // RN-02 / RN-08: el asesor solo ve sus propias solicitudes (filtrado en BD).
    // RN-08: filtros, paginación y restricciones de acceso.
    return this.solicitudesService.findAll(user, filtros);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar una solicitud por ID',
    description: 'Un asesor solo puede ver solicitudes que le pertenezcan. Conocer el ID no otorga acceso a solicitudes ajenas.',
  })
  @ApiOkResponse({ description: 'Solicitud encontrada', type: Solicitud })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  @ApiForbiddenResponse({ description: 'Sin permiso' })
  @ApiUnauthorizedResponse({ description: 'Falta x-api-key o clave inválida' })
  async findOne(@Param('id') id: number, @CurrentUser() user: any): Promise<Solicitud> {
    // RN-02: el conocimiento del id no debe permitir el acceso a un asesor que no sea responsable.
    return this.solicitudesService.findOne(id, user);
  }

  @Patch(':id/estado')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Cambiar el estado de una solicitud',
    description: 'Solo supervisor o admin pueden cambiar cualquier solicitud. Asesor solo en su propia solicitud. Transiciones: PENDIENTE→EN_GESTION, EN_GESTION→RESUELTA.',
  })
  @ApiOkResponse({ description: 'Estado actualizado', type: Solicitud })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiForbiddenResponse({ description: 'Sin permiso o transición inválida' })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  @ApiUnauthorizedResponse({ description: 'Falta x-api-key o clave inválida' })
  async updateEstado(
    @Param('id') id: number,
    @Body() updateEstadoDto: UpdateEstadoDto,
    @CurrentUser() user: any,
  ): Promise<Solicitud> {
    // RN-03: solo supervisor/admin pueden cambiar estado; asesor solo en su propia solicitud.
    return this.solicitudesService.updateEstado(id, updateEstadoDto, user);
  }

  @Patch(':id/asignacion')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Asignar o reasignar una solicitud a un asesor',
    description: 'Solo admin y supervisor pueden asignar. El asesor debe existir y tener rol asesor. Una solicitud RESUELTA no puede reasignarse.',
  })
  @ApiOkResponse({ description: 'Solicitud asignada correctamente', type: Solicitud })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiUnauthorizedResponse({ description: 'Falta x-api-key o clave inválida' })
  @ApiForbiddenResponse({ description: 'Sin permiso (solo admin/supervisor) o asesor inválido' })
  @ApiNotFoundResponse({ description: 'Solicitud o asesor no encontrado' })
  @ApiConflictResponse({ description: 'La solicitud está en estado RESUELTA y no puede reasignarse' })
  async asignar(
    @Param('id') id: number,
    @Body() asignarDto: AsignarSolicitudDto,
    @CurrentUser() user: any,
  ): Promise<Solicitud> {
    // RN-07: solo admin y supervisor pueden asignar
    return this.solicitudesService.asignar(id, asignarDto, user);
  }

  @Get(':id/historial')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar historial de auditoría de una solicitud',
    description: 'Admin y supervisor pueden ver el historial de cualquier solicitud. Asesor solo puede ver el historial de solicitudes que tiene asignadas actualmente.',
  })
  @ApiOkResponse({
    description: 'Historial de eventos de la solicitud',
    type: [HistorialEventoDto],
  })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada' })
  @ApiForbiddenResponse({ description: 'Sin permiso para consultar el historial de esta solicitud' })
  @ApiUnauthorizedResponse({ description: 'Falta x-api-key o clave inválida' })
  async getHistorial(@Param('id') id: number, @CurrentUser() user: any): Promise<HistorialEventoDto[]> {
    // RN-09: validar acceso a la solicitud antes de devolver historial
    return this.solicitudesService.getHistorial(id, user);
  }
}