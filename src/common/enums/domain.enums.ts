export enum UserRoles {
  ADMIN= 'admin',
  SUPERVISOR= 'supervisor',
  ASESOR= "asesor"
}

export enum AccountStatus {
  ACTIVE= 'active',
  INACTIVE= 'inactive',
}

export const enumValues = <T extends Record<string, string>>(e: T): Array<T[keyof T]> =>
  Object.values(e) as Array<T[keyof T]>;
