import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SolicitudesService, CurrentUser } from './solicitudes.service.js';
import { Solicitud } from './dao/solicitud.dao.js';
import { EstadoSolicitud } from './estado-solicitud.enum.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';

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
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    // create() de TypeORM devuelve la entidad con los datos recibidos
    repo.create.mockImplementation((data) => ({ ...data }));
    // save() devuelve la entidad persistida
    repo.save.mockImplementation(async (entity) => ({ id: 1, ...entity }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        { provide: getRepositoryToken(Solicitud), useValue: repo },
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

  // ---------------------------------------------------------------- RN-02
  describe('findAll (RN-02)', () => {
    it('el asesor filtra en la consulta a BD por su propio usuario', async () => {
      const own = [build()];
      repo.find.mockResolvedValue(own);

      const result = await service.findAll(asesor1);

      expect(repo.find).toHaveBeenCalledTimes(1);
      expect(repo.find).toHaveBeenCalledWith({ where: { asesor: 'asesor1' } });
      expect(result).toBe(own);
    });

    it.each([
      ['supervisor', supervisor],
      ['admin', admin],
    ])('el rol %s consulta todas las solicitudes sin filtro', async (_r, user) => {
      const all = [build(), build({ id: 2, asesor: 'asesor2' })];
      repo.find.mockResolvedValue(all);

      const result = await service.findAll(user);

      expect(repo.find).toHaveBeenCalledWith();
      expect(result).toBe(all);
    });

    it('devuelve lista vacía si no hay solicitudes', async () => {
      repo.find.mockResolvedValue([]);

      await expect(service.findAll(asesor1)).resolves.toEqual([]);
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
});
