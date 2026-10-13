import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
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
} from '@nestjs/swagger';
import { SolicitudesService } from './solicitudes.service.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { UpdateEstadoDto } from './dto/update-estado.dto.js';
import { AsignarSolicitudDto } from './dto/asignar-solicitud.dto.js';
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
    summary: 'Listar solicitudes',
    description: 'Admin y supervisor ven todas las solicitudes. Asesor solo ve sus propias solicitudes.',
  })
  @ApiOkResponse({ description: 'Lista de solicitudes permitidas', type: [Solicitud] })
  @ApiUnauthorizedResponse({ description: 'Falta x-api-key o clave inválida' })
  @ApiForbiddenResponse({ description: 'Rol no autorizado' })
  async findAll(@CurrentUser() user: any): Promise<Solicitud[]> {
    // RN-02: el asesor solo ve sus propias solicitudes (filtrado en BD).
    return this.solicitudesService.findAll(user);
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
}