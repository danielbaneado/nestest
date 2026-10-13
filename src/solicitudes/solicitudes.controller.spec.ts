import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SolicitudesController } from './solicitudes.controller.js';
import { SolicitudesService } from './solicitudes.service.js';
import { Solicitud } from './dao/solicitud.dao.js';
import { EstadoSolicitud } from './estado-solicitud.enum.js';
import { FiltrarSolicitudesDto, PaginatedResult } from './dto/filtrar-solicitudes.dto.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';
import { UserRoleGuard } from '../common/guards/user-role.guard.js';
import { ConfigService } from '../config/config.service.js';

const asesor1 = { username: 'asesor1', role: 'asesor' };
const admin = { username: 'admin1', role: 'admin' };

const mockService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  updateEstado: vi.fn(),
};

const mockRepo = {};

describe('SolicitudesController', () => {
  let controller: SolicitudesController;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockService.create.mockImplementation((dto, user) => ({
      id: 1,
      ...dto,
      asesor: user.username,
      estado: EstadoSolicitud.PENDIENTE,
    }));
    mockService.findAll.mockResolvedValue([]);
    mockService.findOne.mockResolvedValue({ id: 1, estado: EstadoSolicitud.PENDIENTE });
    mockService.updateEstado.mockImplementation((id, dto) => ({
      id,
      estado: dto.estado,
    }));

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudesController],
      providers: [
        { provide: SolicitudesService, useValue: mockService },
        { provide: getRepositoryToken(Solicitud), useValue: mockRepo },
        Reflector,
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: ApiKeyGuard, useValue: { canActivate: () => true } },
        { provide: UserRoleGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get<SolicitudesController>(SolicitudesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('pasa el DTO y el usuario al service', async () => {
      const dto = { cliente: 'Juan', descripcion: 'Consulta' };

      await controller.create(dto as any, asesor1);

      expect(mockService.create).toHaveBeenCalledWith(dto, asesor1);
    });

    it('retorna lo que devuelva el service', async () => {
      const expected = { id: 5, cliente: 'Maria', asesor: 'asesor1', estado: EstadoSolicitud.PENDIENTE };
      mockService.create.mockResolvedValue(expected);

      const result = await controller.create({ cliente: 'Maria', descripcion: 'X' } as any, asesor1);

      expect(result).toBe(expected);
    });
  });

  describe('findAll', () => {
    it('pasa los filtros y el usuario al service', async () => {
      const filtros: FiltrarSolicitudesDto = {};
      await controller.findAll(filtros, asesor1);
      expect(mockService.findAll).toHaveBeenCalledWith(asesor1, filtros);
    });

    it('retorna el resultado paginado del service', async () => {
      const paginatedResult: PaginatedResult<any> = {
        items: [{ id: 1 }, { id: 2 }],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      };
      mockService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({}, admin);
      expect(result).toBe(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('convierte el param a number y pasa el usuario', async () => {
      await controller.findOne(7 as any, admin);

      expect(mockService.findOne).toHaveBeenCalledWith(7, admin);
    });

    it('retorna la solicitud del service', async () => {
      const sol = { id: 3, estado: EstadoSolicitud.EN_GESTION };
      mockService.findOne.mockResolvedValue(sol);

      const result = await controller.findOne(3 as any, admin);
      expect(result).toBe(sol);
    });
  });

  describe('updateEstado', () => {
    it('pasa id, DTO y usuario al service', async () => {
      const dto = { estado: EstadoSolicitud.EN_GESTION };
      await controller.updateEstado(2 as any, dto as any, asesor1);

      expect(mockService.updateEstado).toHaveBeenCalledWith(2, dto, asesor1);
    });

    it('retorna la solicitud actualizada', async () => {
      const updated = { id: 2, estado: EstadoSolicitud.RESUELTA };
      mockService.updateEstado.mockResolvedValue(updated);

      const result = await controller.updateEstado(
        2 as any,
        { estado: EstadoSolicitud.RESUELTA } as any,
        admin,
      );
      expect(result).toBe(updated);
    });
  });
});