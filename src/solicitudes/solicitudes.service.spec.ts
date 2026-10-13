import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SolicitudesService, CurrentUser } from './solicitudes.service.js';
import { Solicitud } from './dao/solicitud.dao.js';
import { SolicitudHistorial } from './dao/solicitud-historial.dao.js';
import { EstadoSolicitud } from './estado-solicitud.enum.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';
import { FiltrarSolicitudesDto } from './dto/filtrar-solicitudes.dto.js';
import { TipoEventoHistorial } from './dao/solicitud-historial.dao.js';

const asesor1: CurrentUser = { username: 'asesor1', role: 'asesor' };
const asesor2: CurrentUser = { username: 'asesor2', role: 'asesor' };
const supervisor: CurrentUser = { username: 'supervisor1', role: 'supervisor' };
const admin: CurrentUser = { username: 'admin1', role: 'admin' };

const build = (overrides: Partial<Solicitud> = {}): Solicitud =>
  ({
    id: 1,
    cliente: 'Juan Pérez',
    descripcion: 'Consulta de producto',
    asesor: 'asesor1',
    estado: EstadoSolicitud.PENDIENTE,
    creadaEn: new Date('2026-10-01T10:00:00Z'),
    actualizadaEn: new Date('2026-10-01T10:00:00Z'),
    ...overrides,
  }) as Solicitud;

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  const repo = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const historialRepo = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
  };
  const dataSource = {
    transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    // create() de TypeORM devuelve la entidad con los datos recibidos
    repo.create.mockImplementation((data) => ({ ...data }));
    // save() devuelve la entidad persistida
    repo.save.mockImplementation(async (entity) => ({ id: 1, ...entity }));
    historialRepo.create.mockImplementation((data) => ({ ...data }));
    historialRepo.save.mockImplementation(async (entity) => ({ id: 1, ...entity }));
    // dataSource.transaction ejecuta el callback con un manager que tiene los repositorios
    dataSource.transaction.mockImplementation(async (callback) => {
      const manager = {
        getRepository: vi.fn((entity) => {
          if (entity === Solicitud) return repo;
          if (entity === SolicitudHistorial) return historialRepo;
          return {};
        }),
      };
      return callback(manager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        { provide: getRepositoryToken(Solicitud), useValue: repo },
        { provide: getRepositoryToken(SolicitudHistorial), useValue: historialRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(SolicitudesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------- RN-01
  describe('create (RN-01)', () => {
    const dto: CreateSolicitudDto = {
      cliente: 'Juan Pérez',
      descripcion: 'Consulta de producto',
    };

    it('asigna al asesor que registra y deja el estado en PENDIENTE', async () => {
      const result = await service.create(dto, asesor1);

      expect(repo.create).toHaveBeenCalledWith({
        cliente: 'Juan Pérez',
        descripcion: 'Consulta de producto',
        asesor: 'asesor1',
        estado: EstadoSolicitud.PENDIENTE,
      });
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        asesor: 'asesor1',
        estado: EstadoSolicitud.PENDIENTE,
      });
    });

    it.each([
      ['supervisor', supervisor],
      ['admin', admin],
    ])('permite registrar al rol %s y queda SIN asignación (asesor=null)', async (_r, user) => {
      const result = await service.create(dto, user);

      expect(result.asesor).toBeNull();
      expect(result.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('ignora un estado enviado por el cliente: siempre PENDIENTE', async () => {
      const malicious = {
        ...dto,
        estado: EstadoSolicitud.RESUELTA,
      } as unknown as CreateSolicitudDto;

      const result = await service.create(malicious, asesor1);

      expect(result.estado).toBe(EstadoSolicitud.PENDIENTE);
    });

    it('ignora un asesor enviado por el cliente: siempre el usuario autenticado (si es asesor)', async () => {
      const malicious = {
        ...dto,
        asesor: 'asesor2',
      } as unknown as CreateSolicitudDto;

      const result = await service.create(malicious, asesor1);

      expect(result.asesor).toBe('asesor1');
    });

    it('devuelve lo que persiste el repositorio', async () => {
      const persisted = build({ id: 42 });
      repo.save.mockResolvedValue(persisted);

      await expect(service.create(dto, asesor1)).resolves.toBe(persisted);
    });
  });

  // ---------------------------------------------------------------- RN-02 / RN-08
  describe('findAll (RN-02, RN-08)', () => {
    const solicitudes = [
      build({ id: 1, cliente: 'Cliente A', asesor: 'asesor1', estado: EstadoSolicitud.PENDIENTE, creadaEn: new Date('2026-10-01T10:00:00Z') }),
      build({ id: 2, cliente: 'Cliente B', asesor: 'asesor1', estado: EstadoSolicitud.EN_GESTION, creadaEn: new Date('2026-10-02T10:00:00Z') }),
      build({ id: 3, cliente: 'Cliente C', asesor: 'asesor2', estado: EstadoSolicitud.RESUELTA, creadaEn: new Date('2026-10-03T10:00:00Z') }),
    ];

    it('el asesor filtra en la consulta a BD por su propio usuario (sin filtros adicionales)', async () => {
      const own = [solicitudes[0], solicitudes[1]];
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(own.length),
        getMany: vi.fn().mockResolvedValue(own),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(asesor1);

      expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(qb.andWhere).toHaveBeenCalledWith('solicitud.asesor = :username', { username: 'asesor1' });
      expect(result.items).toBe(own);
      expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
    });

    it('el rol supervisor consulta todas las solicitudes sin filtro de asesor', async () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(solicitudes.length),
        getMany: vi.fn().mockResolvedValue(solicitudes),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(supervisor);

      expect(qb.andWhere).not.toHaveBeenCalledWith('solicitud.asesor = :username', expect.anything());
      expect(result.items.length).toBe(3);
      expect(result.pagination.total).toBe(3);
    });

    it('aplica filtro por estado', async () => {
      const filtered = [solicitudes[0]];
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(filtered.length),
        getMany: vi.fn().mockResolvedValue(filtered),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const filtros: FiltrarSolicitudesDto = { estado: EstadoSolicitud.PENDIENTE };
      const result = await service.findAll(admin, filtros);

      expect(qb.andWhere).toHaveBeenCalledWith('solicitud.estado = :estado', { estado: EstadoSolicitud.PENDIENTE });
      expect(result.items.length).toBe(1);
    });

    it('aplica filtro por asesor (solo admin/supervisor)', async () => {
      const filtered = [solicitudes[0], solicitudes[1]];
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(filtered.length),
        getMany: vi.fn().mockResolvedValue(filtered),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const filtros: FiltrarSolicitudesDto = { asesor: 'asesor1' };
      const result = await service.findAll(admin, filtros);

      expect(qb.andWhere).toHaveBeenCalledWith('solicitud.asesor = :asesor', { asesor: 'asesor1' });
      expect(result.items.length).toBe(2);
    });

    it('el asesor NO puede usar el filtro asesor para ver solicitudes ajenas', async () => {
      const own = [solicitudes[0], solicitudes[1]];
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(own.length),
        getMany: vi.fn().mockResolvedValue(own),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const filtros: FiltrarSolicitudesDto = { asesor: 'asesor2' };
      const result = await service.findAll(asesor1, filtros);

      // Solo se debe llamar andWhere con el filtro de asesor del usuario autenticado
      const asesorCalls = qb.andWhere.mock.calls.filter(call => call[0].includes('asesor'));
      expect(asesorCalls.length).toBe(1);
      expect(asesorCalls[0][0]).toBe('solicitud.asesor = :username');
      expect(asesorCalls[0][1]).toEqual({ username: 'asesor1' });
      expect(result.items.length).toBe(2);
    });

    it('aplica búsqueda parcial por cliente (ILIKE)', async () => {
      const filtered = [solicitudes[0]];
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(filtered.length),
        getMany: vi.fn().mockResolvedValue(filtered),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const filtros: FiltrarSolicitudesDto = { cliente: 'cliente a' };
      const result = await service.findAll(admin, filtros);

      expect(qb.andWhere).toHaveBeenCalledWith('solicitud.cliente ILIKE :cliente', { cliente: '%cliente a%' });
      expect(result.items.length).toBe(1);
    });

    it('aplica filtro por rango de fechas (desde y hasta)', async () => {
      const filtered = [solicitudes[0], solicitudes[1]];
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(filtered.length),
        getMany: vi.fn().mockResolvedValue(filtered),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const filtros: FiltrarSolicitudesDto = {
        desde: '2026-10-01T00:00:00Z',
        hasta: '2026-10-02T23:59:59Z',
      };
      const result = await service.findAll(admin, filtros);

      expect(qb.andWhere).toHaveBeenCalledWith('solicitud.creadaEn BETWEEN :desde AND :hasta', expect.any(Object));
      expect(result.items.length).toBe(2);
    });

    it('aplica paginación con page y limit', async () => {
      const all = solicitudes;
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(all.length),
        getMany: vi.fn().mockResolvedValue([all[0]]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const filtros: FiltrarSolicitudesDto = { page: 1, limit: 1 };
      const result = await service.findAll(admin, filtros);

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(1);
      expect(result.pagination).toEqual({ page: 1, limit: 1, total: 3, totalPages: 3 });
    });

    it('usa valores por defecto page=1 y limit=10 cuando no se envían', async () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0),
        getMany: vi.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin);

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('ordena por fecha de creación descendente', async () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0),
        getMany: vi.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(admin);

      expect(qb.orderBy).toHaveBeenCalledWith('solicitud.creadaEn', 'DESC');
    });
  });

  describe('findOne (RN-02)', () => {
    it('busca por id en la base de datos', async () => {
      repo.findOne.mockResolvedValue(build({ id: 7 }));

      await service.findOne(7, admin);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 7 } });
    });

    it('lanza NotFoundException si la solicitud no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(99, admin)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.findOne(99, admin)).rejects.toThrow(/99/);
    });

    it('el asesor responsable puede ver su solicitud', async () => {
      const solicitud = build({ asesor: 'asesor1' });
      repo.findOne.mockResolvedValue(solicitud);

      await expect(service.findOne(1, asesor1)).resolves.toBe(solicitud);
    });

    it('un asesor NO puede ver la solicitud de otro aunque conozca el id', async () => {
      repo.findOne.mockResolvedValue(build({ asesor: 'asesor1' }));

      await expect(service.findOne(1, asesor2)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it.each([
      ['supervisor', supervisor],
      ['admin', admin],
    ])('el rol %s puede ver solicitudes de cualquier asesor', async (_r, user) => {
      const solicitud = build({ asesor: 'asesor2' });
      repo.findOne.mockResolvedValue(solicitud);

      await expect(service.findOne(1, user)).resolves.toBe(solicitud);
    });

    it('responde NotFound (no Forbidden) cuando no existe, incluso para un asesor', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(1, asesor2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------- RN-03
  describe('updateEstado (RN-03)', () => {
    describe('existencia', () => {
      it('lanza NotFoundException si la solicitud no existe y no guarda nada', async () => {
        repo.findOne.mockResolvedValue(null);

        await expect(
          service.updateEstado(5, { estado: EstadoSolicitud.EN_GESTION }, admin),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(repo.save).not.toHaveBeenCalled();
      });
    });

    describe('permisos', () => {
      it('un asesor NO puede cambiar el estado de una solicitud ajena', async () => {
        const ajena = build({ asesor: 'asesor1' });
        repo.findOne.mockResolvedValue(ajena);

        await expect(
          service.updateEstado(1, { estado: EstadoSolicitud.EN_GESTION }, asesor2),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.save).not.toHaveBeenCalled();
        expect(ajena.estado).toBe(EstadoSolicitud.PENDIENTE);
      });

      it('el chequeo de propiedad tiene prioridad sobre la validación de la transición', async () => {
        repo.findOne.mockResolvedValue(
          build({ asesor: 'asesor1', estado: EstadoSolicitud.RESUELTA }),
        );

        await expect(
          service.updateEstado(1, { estado: EstadoSolicitud.PENDIENTE }, asesor2),
        ).rejects.toThrow('No tiene permiso para modificar esta solicitud');
      });

      it('un asesor puede cambiar el estado de su propia solicitud', async () => {
        repo.findOne.mockResolvedValue(build({ asesor: 'asesor1' }));

        const result = await service.updateEstado(
          1,
          { estado: EstadoSolicitud.EN_GESTION },
          asesor1,
        );

        expect(result.estado).toBe(EstadoSolicitud.EN_GESTION);
        expect(repo.save).toHaveBeenCalledTimes(1);
      });

      it.each([
        ['supervisor', supervisor],
        ['admin', admin],
      ])('el rol %s puede cambiar el estado de cualquier solicitud', async (_r, user) => {
        repo.findOne.mockResolvedValue(build({ asesor: 'asesor2' }));

        const result = await service.updateEstado(
          1,
          { estado: EstadoSolicitud.EN_GESTION },
          user,
        );

        expect(result.estado).toBe(EstadoSolicitud.EN_GESTION);
      });
    });

    describe('transiciones válidas', () => {
      it('PENDIENTE → EN_GESTION', async () => {
        repo.findOne.mockResolvedValue(build({ estado: EstadoSolicitud.PENDIENTE }));

        const result = await service.updateEstado(
          1,
          { estado: EstadoSolicitud.EN_GESTION },
          supervisor,
        );

        expect(result.estado).toBe(EstadoSolicitud.EN_GESTION);
        expect(repo.save).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1, estado: EstadoSolicitud.EN_GESTION }),
        );
      });

      it('EN_GESTION → RESUELTA', async () => {
        repo.findOne.mockResolvedValue(build({ estado: EstadoSolicitud.EN_GESTION }));

        const result = await service.updateEstado(
          1,
          { estado: EstadoSolicitud.RESUELTA },
          supervisor,
        );

        expect(result.estado).toBe(EstadoSolicitud.RESUELTA);
      });

      it('recorre el ciclo completo PENDIENTE → EN_GESTION → RESUELTA', async () => {
        const solicitud = build();
        repo.findOne.mockResolvedValue(solicitud);

        await service.updateEstado(1, { estado: EstadoSolicitud.EN_GESTION }, asesor1);
        await service.updateEstado(1, { estado: EstadoSolicitud.RESUELTA }, asesor1);

        expect(solicitud.estado).toBe(EstadoSolicitud.RESUELTA);
        expect(repo.save).toHaveBeenCalledTimes(2);
      });

      it('solo modifica el estado: no altera cliente, descripcion ni asesor', async () => {
        repo.findOne.mockResolvedValue(build());

        const result = await service.updateEstado(
          1,
          { estado: EstadoSolicitud.EN_GESTION },
          admin,
        );

        expect(result).toMatchObject({
          cliente: 'Juan Pérez',
          descripcion: 'Consulta de producto',
          asesor: 'asesor1',
        });
      });
    });

    describe('transiciones inválidas', () => {
      it.each([
        [EstadoSolicitud.PENDIENTE, EstadoSolicitud.RESUELTA, 'salto directo'],
        [EstadoSolicitud.PENDIENTE, EstadoSolicitud.PENDIENTE, 'mismo estado'],
        [EstadoSolicitud.EN_GESTION, EstadoSolicitud.PENDIENTE, 'retroceso'],
        [EstadoSolicitud.EN_GESTION, EstadoSolicitud.EN_GESTION, 'mismo estado'],
      ])('%s → %s se rechaza (%s)', async (actual, nuevo) => {
        repo.findOne.mockResolvedValue(build({ estado: actual }));

        await expect(
          service.updateEstado(1, { estado: nuevo }, admin),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.save).not.toHaveBeenCalled();
      });

      it('el mensaje de PENDIENTE → RESUELTA es comprensible e indica la transición permitida', async () => {
        repo.findOne.mockResolvedValue(build({ estado: EstadoSolicitud.PENDIENTE }));

        await expect(
          service.updateEstado(1, { estado: EstadoSolicitud.RESUELTA }, admin),
        ).rejects.toThrow(
          'Transición inválida: de PENDIENTE a RESUELTA. Transición permitida: EN_GESTION',
        );
      });

      it.each([
        EstadoSolicitud.PENDIENTE,
        EstadoSolicitud.EN_GESTION,
        EstadoSolicitud.RESUELTA,
      ])('una solicitud RESUELTA no se puede reabrir ni cambiar (→ %s)', async (nuevo) => {
        repo.findOne.mockResolvedValue(build({ estado: EstadoSolicitud.RESUELTA }));

        await expect(
          service.updateEstado(1, { estado: nuevo }, admin),
        ).rejects.toThrow(
          'No se permite cambiar el estado de una solicitud RESUELTA',
        );
        expect(repo.save).not.toHaveBeenCalled();
      });

      it('un asesor dueño tampoco puede saltarse el flujo', async () => {
        repo.findOne.mockResolvedValue(build({ asesor: 'asesor1' }));

        await expect(
          service.updateEstado(1, { estado: EstadoSolicitud.RESUELTA }, asesor1),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });
  });

  // ---------------------------------------------------------------- RN-07
  describe('asignar (RN-07)', () => {
    const asignarDto = { asesorId: 'asesor2' };

    describe('permisos', () => {
      it('un asesor NO puede asignar (403)', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE });
        repo.findOne.mockResolvedValue(solicitud);

        await expect(
          service.asignar(1, asignarDto, asesor1),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.save).not.toHaveBeenCalled();
      });

      it('un supervisor SÍ puede asignar', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE, asesor: null });
        repo.findOne.mockResolvedValue(solicitud);

        const result = await service.asignar(1, asignarDto, supervisor);

        expect(result.asesor).toBe('asesor2');
        expect(repo.save).toHaveBeenCalledTimes(1);
      });

      it('un admin SÍ puede asignar', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE, asesor: 'asesor1' });
        repo.findOne.mockResolvedValue(solicitud);

        const result = await service.asignar(1, asignarDto, admin);

        expect(result.asesor).toBe('asesor2');
      });
    });

    describe('existencia de la solicitud', () => {
      it('lanza NotFoundException si la solicitud no existe', async () => {
        repo.findOne.mockResolvedValue(null);

        await expect(
          service.asignar(99, asignarDto, supervisor),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(repo.save).not.toHaveBeenCalled();
      });
    });

    describe('validación del asesor destino', () => {
      it('lanza NotFoundException si el asesorId no existe', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE });
        repo.findOne.mockResolvedValue(solicitud);

        await expect(
          service.asignar(1, { asesorId: 'usuario_inexistente' }, supervisor),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(repo.save).not.toHaveBeenCalled();
      });

      it('lanza ForbiddenException si el usuario destino no es asesor (es admin)', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE });
        repo.findOne.mockResolvedValue(solicitud);

        await expect(
          service.asignar(1, { asesorId: 'admin1' }, supervisor),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.save).not.toHaveBeenCalled();
      });

      it('lanza ForbiddenException si el usuario destino no es asesor (es supervisor)', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE });
        repo.findOne.mockResolvedValue(solicitud);

        await expect(
          service.asignar(1, { asesorId: 'supervisor1' }, supervisor),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(repo.save).not.toHaveBeenCalled();
      });
    });

    describe('reglas de negocio', () => {
      it('lanza ConflictException si la solicitud está en estado RESUELTA', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.RESUELTA });
        repo.findOne.mockResolvedValue(solicitud);

        await expect(
          service.asignar(1, asignarDto, supervisor),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(repo.save).not.toHaveBeenCalled();
      });

      it('reasignar no cambia el estado de la solicitud', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.EN_GESTION, asesor: 'asesor1' });
        repo.findOne.mockResolvedValue(solicitud);

        const result = await service.asignar(1, asignarDto, supervisor);

        expect(result.estado).toBe(EstadoSolicitud.EN_GESTION);
        expect(result.asesor).toBe('asesor2');
      });

      it('permite asignar una solicitud sin asesor previo (null)', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE, asesor: null });
        repo.findOne.mockResolvedValue(solicitud);

        const result = await service.asignar(1, asignarDto, supervisor);

        expect(result.asesor).toBe('asesor2');
      });

      it('permite reasignar de un asesor a otro', async () => {
        const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE, asesor: 'asesor1' });
        repo.findOne.mockResolvedValue(solicitud);

        const result = await service.asignar(1, asignarDto, supervisor);

        expect(result.asesor).toBe('asesor2');
      });
    });
  });

  // ---------------------------------------------------------------- RN-09
  describe('create (RN-09: historial CREACION)', () => {
    const dto: CreateSolicitudDto = {
      cliente: 'Juan Pérez',
      descripcion: 'Consulta de producto',
    };

    it('registra evento CREACION con valor inicial PENDIENTE en la transacción', async () => {
      await service.create(dto, asesor1);

      // Verificar que se guardó la solicitud
      expect(repo.save).toHaveBeenCalledTimes(1);
      const savedSolicitud = repo.save.mock.calls[0][0];
      expect(savedSolicitud.estado).toBe(EstadoSolicitud.PENDIENTE);

      // Verificar que se registró el historial
      expect(historialRepo.save).toHaveBeenCalledTimes(1);
      const historialEvent = historialRepo.save.mock.calls[0][0];
      expect(historialEvent.tipoEvento).toBe(TipoEventoHistorial.CREACION);
      expect(historialEvent.valorAnterior).toBeNull();
      expect(historialEvent.valorNuevo).toBe(EstadoSolicitud.PENDIENTE);
      expect(historialEvent.usuarioActor).toBe('asesor1');
    });
  });

  describe('updateEstado (RN-09: historial ESTADO)', () => {
    it('registra evento ESTADO con valorAnterior y valorNuevo en la transacción', async () => {
      const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE, asesor: 'asesor1' });
      repo.findOne.mockResolvedValue(solicitud);

      await service.updateEstado(1, { estado: EstadoSolicitud.EN_GESTION }, supervisor);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(historialRepo.save).toHaveBeenCalledTimes(1);
      const historialEvent = historialRepo.save.mock.calls[0][0];
      expect(historialEvent.tipoEvento).toBe(TipoEventoHistorial.ESTADO);
      expect(historialEvent.valorAnterior).toBe(EstadoSolicitud.PENDIENTE);
      expect(historialEvent.valorNuevo).toBe(EstadoSolicitud.EN_GESTION);
      expect(historialEvent.usuarioActor).toBe('supervisor1');
    });
  });

  describe('asignar (RN-09: historial ASIGNACION)', () => {
    const asignarDto = { asesorId: 'asesor2' };

    it('registra evento ASIGNACION con valorAnterior y valorNuevo en la transacción', async () => {
      const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE, asesor: 'asesor1' });
      repo.findOne.mockResolvedValue(solicitud);

      await service.asignar(1, asignarDto, supervisor);

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(historialRepo.save).toHaveBeenCalledTimes(1);
      const historialEvent = historialRepo.save.mock.calls[0][0];
      expect(historialEvent.tipoEvento).toBe(TipoEventoHistorial.ASIGNACION);
      expect(historialEvent.valorAnterior).toBe('asesor1');
      expect(historialEvent.valorNuevo).toBe('asesor2');
      expect(historialEvent.usuarioActor).toBe('supervisor1');
    });

    it('registra valorAnterior como "sin asignar" cuando la solicitud no tenía asesor', async () => {
      const solicitud = build({ id: 1, estado: EstadoSolicitud.PENDIENTE, asesor: null });
      repo.findOne.mockResolvedValue(solicitud);

      await service.asignar(1, asignarDto, supervisor);

      const historialEvent = historialRepo.save.mock.calls[0][0];
      expect(historialEvent.valorAnterior).toBe('sin asignar');
      expect(historialEvent.valorNuevo).toBe('asesor2');
    });
  });

  describe('getHistorial (RN-09)', () => {
    it('lanza NotFoundException si la solicitud no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getHistorial(99, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('un asesor NO puede ver el historial de una solicitud ajena', async () => {
      repo.findOne.mockResolvedValue(build({ asesor: 'asesor1' }));

      await expect(service.getHistorial(1, asesor2)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un asesor SÍ puede ver el historial de su propia solicitud', async () => {
      const solicitud = build({ id: 1, asesor: 'asesor1' });
      repo.findOne.mockResolvedValue(solicitud);

      const historial = [
        { id: 1, solicitudId: 1, tipoEvento: TipoEventoHistorial.CREACION, valorAnterior: null, valorNuevo: 'PENDIENTE', usuarioActor: 'asesor1', fechaEvento: new Date() },
        { id: 2, solicitudId: 1, tipoEvento: TipoEventoHistorial.ESTADO, valorAnterior: 'PENDIENTE', valorNuevo: 'EN_GESTION', usuarioActor: 'asesor1', fechaEvento: new Date() },
      ];
      historialRepo.find.mockResolvedValue(historial);

      const result = await service.getHistorial(1, asesor1);

      expect(result).toHaveLength(2);
      expect(result[0].tipoEvento).toBe(TipoEventoHistorial.CREACION);
      expect(result[1].tipoEvento).toBe(TipoEventoHistorial.ESTADO);
    });

    it('admin puede ver el historial de cualquier solicitud', async () => {
      const solicitud = build({ id: 1, asesor: 'asesor2' });
      repo.findOne.mockResolvedValue(solicitud);

      const historial = [
        { id: 1, solicitudId: 1, tipoEvento: TipoEventoHistorial.CREACION, valorAnterior: null, valorNuevo: 'PENDIENTE', usuarioActor: 'supervisor1', fechaEvento: new Date() },
      ];
      historialRepo.find.mockResolvedValue(historial);

      const result = await service.getHistorial(1, admin);

      expect(result).toHaveLength(1);
    });

    it('supervisor puede ver el historial de cualquier solicitud', async () => {
      const solicitud = build({ id: 1, asesor: 'asesor2' });
      repo.findOne.mockResolvedValue(solicitud);

      const historial = [
        { id: 1, solicitudId: 1, tipoEvento: TipoEventoHistorial.CREACION, valorAnterior: null, valorNuevo: 'PENDIENTE', usuarioActor: 'supervisor1', fechaEvento: new Date() },
      ];
      historialRepo.find.mockResolvedValue(historial);

      const result = await service.getHistorial(1, supervisor);

      expect(result).toHaveLength(1);
    });

    it('ordena el historial por fechaEvento ASC', async () => {
      const solicitud = build({ id: 1, asesor: 'asesor1' });
      repo.findOne.mockResolvedValue(solicitud);

      const historial = [
        { id: 1, solicitudId: 1, tipoEvento: TipoEventoHistorial.CREACION, valorAnterior: null, valorNuevo: 'PENDIENTE', usuarioActor: 'asesor1', fechaEvento: new Date('2026-10-01T10:00:00Z') },
        { id: 2, solicitudId: 1, tipoEvento: TipoEventoHistorial.ESTADO, valorAnterior: 'PENDIENTE', valorNuevo: 'EN_GESTION', usuarioActor: 'asesor1', fechaEvento: new Date('2026-10-01T11:00:00Z') },
      ];
      historialRepo.find.mockResolvedValue(historial);

      await service.getHistorial(1, asesor1);

      expect(historialRepo.find).toHaveBeenCalledWith({
        where: { solicitudId: 1 },
        order: { fechaEvento: 'ASC' },
      });
    });
  });
});
