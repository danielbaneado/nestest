import { UserRoles } from './enums/domain.enums.js';

export interface InMemoryUser {
  username: string;
  role: UserRoles;
}

export const IN_MEMORY_USERS: readonly InMemoryUser[] = [
  { username: 'admin1', role: UserRoles.ADMIN },
  { username: 'admin2', role: UserRoles.ADMIN },
  { username: 'supervisor1', role: UserRoles.SUPERVISOR },
  { username: 'supervisor2', role: UserRoles.SUPERVISOR },
  { username: 'asesor1', role: UserRoles.ASESOR },
  { username: 'asesor2', role: UserRoles.ASESOR },
];

export const IN_MEMORY_USERS_BY_USERNAME: ReadonlyMap<string, InMemoryUser> =
  new Map(IN_MEMORY_USERS.map((user) => [user.username, user]));

export const describeInMemoryUsers = (): string =>
  IN_MEMORY_USERS.map((user) => `${user.username} (${user.role})`).join(', ');
