import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRoleGuard } from './user-role.guard.js';
import { Roles } from '../decorators/roles.decorator.js';

class TestController {
  @Roles('admin', 'supervisor')
  soloGestion() {}

  @Roles('admin', 'supervisor', 'asesor')
  todos() {}

  sinRoles() {}
}

@Roles('admin')
class AdminOnlyController {
  heredaDeClase() {}

  @Roles('asesor')
  sobreescribe() {}
}

type Req = { headers: Record<string, unknown>; user?: unknown };

const contextFor = (
  cls: new () => object,
  handlerName: string,
  headers: Record<string, unknown>,
) => {
  const request: Req = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (cls.prototype as any)[handlerName],
    getClass: () => cls,
  } as unknown as ExecutionContext;
  return { context, request };
};

describe('UserRoleGuard', () => {
  let guard: UserRoleGuard;

  beforeEach(() => {
    guard = new UserRoleGuard(new Reflector());
  });

  describe('identidad del usuario (x-user)', () => {
    it('rechaza con 403 si falta el encabezado x-user', () => {
      const { context } = contextFor(TestController, 'todos', {});

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow('Missing x-user header');
    });

    it.each(['hacker', 'Admin1', 'ADMIN1', 'admin', 'asesor3', ' admin1'])(
      'rechaza con 403 un usuario inexistente (%j)',
      (user) => {
        const { context } = contextFor(TestController, 'todos', { 'x-user': user });

        expect(() => guard.canActivate(context)).toThrow('Invalid user');
      },
    );

    it('no confía en un rol enviado por el cliente (x-role / role)', () => {
      const { context, request } = contextFor(TestController, 'soloGestion', {
        'x-user': 'asesor1',
        'x-role': 'admin',
        role: 'admin',
      });

      // Se deniega (false → 403) y el rol efectivo sigue siendo el definido en memoria.
      expect(guard.canActivate(context)).toBe(false);
      expect(request.user).toEqual({ username: 'asesor1', role: 'asesor' });
    });
  });

  describe('usuarios de prueba definidos en memoria', () => {
    it.each([
      ['admin1', 'admin'],
      ['admin2', 'admin'],
      ['supervisor1', 'supervisor'],
      ['supervisor2', 'supervisor'],
      ['asesor1', 'asesor'],
      ['asesor2', 'asesor'],
    ])('%s se resuelve con rol %s y se adjunta a request.user', (username, role) => {
      const { context, request } = contextFor(TestController, 'todos', {
        'x-user': username,
      });

      expect(guard.canActivate(context)).toBe(true);
      expect(request.user).toEqual({ username, role });
    });
  });

  describe('autorización por rol (@Roles)', () => {
    it.each([
      ['admin1', true],
      ['supervisor1', true],
      ['asesor1', false],
    ])('endpoint de gestión (admin, supervisor): %s → %s', (username, allowed) => {
      const { context } = contextFor(TestController, 'soloGestion', {
        'x-user': username,
      });

      expect(guard.canActivate(context)).toBe(allowed);
    });

    it('con un rol no autorizado devuelve false (Nest lo traduce a 403) pero igual adjunta el usuario', () => {
      const { context, request } = contextFor(TestController, 'soloGestion', {
        'x-user': 'asesor1',
      });

      expect(guard.canActivate(context)).toBe(false);
      expect(request.user).toEqual({ username: 'asesor1', role: 'asesor' });
    });

    it('hereda los roles declarados a nivel de clase', () => {
      const admin = contextFor(AdminOnlyController, 'heredaDeClase', { 'x-user': 'admin1' });
      const asesor = contextFor(AdminOnlyController, 'heredaDeClase', { 'x-user': 'asesor1' });

      expect(guard.canActivate(admin.context)).toBe(true);
      expect(guard.canActivate(asesor.context)).toBe(false);
    });

    it('los roles del método tienen prioridad sobre los de la clase', () => {
      const asesor = contextFor(AdminOnlyController, 'sobreescribe', { 'x-user': 'asesor1' });
      const admin = contextFor(AdminOnlyController, 'sobreescribe', { 'x-user': 'admin1' });

      expect(guard.canActivate(asesor.context)).toBe(true);
      expect(guard.canActivate(admin.context)).toBe(false);
    });
  });

  describe('endpoints sin @Roles', () => {
    it('permite el acceso sin validar x-user ni adjuntar usuario', () => {
      const { context, request } = contextFor(TestController, 'sinRoles', {});

      expect(guard.canActivate(context)).toBe(true);
      expect(request.user).toBeUndefined();
    });
  });
});
