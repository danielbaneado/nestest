import { Injectable } from '@nestjs/common';

/**
 * DAO responsable de obtener información
 * relacionada con el estado de la aplicación.
 *
 * En este ejemplo no existe una base de datos.
 * El DAO representa la capa encargada de obtener
 * información externa o de infraestructura.
 *
 * @class HealthDao
 */
@Injectable()
export class HealthDao {
  /**
   * Obtiene el nombre de la aplicación.
   *
   * @returns {string} Nombre de la aplicación.
   */
  public getApplicationName(): string {
    return 'nestjs-health-api';
  }

  /**
   * Obtiene la versión actual de la aplicación.
   *
   * @returns {string} Versión de la aplicación.
   */
  public getApplicationVersion(): string {
    return '6.7';
  }
}