import { IsOptional, IsEnum, IsString, IsInt, Min, Max, IsDateString, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface, registerDecorator, ValidationOptions } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EstadoSolicitud } from '../estado-solicitud.enum.js';

@ValidatorConstraint({ name: 'IsDateRangeValid', async: false })
export class IsDateRangeValidConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as any;
    if (obj.desde && obj.hasta) {
      const desde = new Date(obj.desde);
      const hasta = new Date(obj.hasta);
      if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
        return false;
      }
      return desde <= hasta;
    }
    return true;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'La fecha "desde" no puede ser posterior a la fecha "hasta"';
  }
}

export function IsDateRangeValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsDateRangeValidConstraint,
    });
  };
}

export class FiltrarSolicitudesDto {
  @ApiProperty({
    description: 'Filtrar por estado de la solicitud',
    enum: EstadoSolicitud,
    example: EstadoSolicitud.PENDIENTE,
    required: false,
  })
  @IsOptional()
  @IsEnum(EstadoSolicitud, { message: 'El estado debe ser PENDIENTE, EN_GESTION o RESUELTA' })
  estado?: EstadoSolicitud;

  @ApiProperty({
    description: 'Filtrar por identificador del asesor asignado',
    example: 'asesor1',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El asesor debe ser una cadena de texto' })
  asesor?: string;

  @ApiProperty({
    description: 'Búsqueda parcial por nombre del cliente (insensible a mayúsculas/minúsculas)',
    example: 'ferretería',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El cliente debe ser una cadena de texto' })
  cliente?: string;

  @ApiProperty({
    description: 'Fecha de inicio del intervalo (ISO 8601) sobre el campo creadaEn',
    example: '2026-10-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha "desde" debe tener formato ISO 8601 válido' })
  desde?: string;

  @ApiProperty({
    description: 'Fecha de fin del intervalo (ISO 8601) sobre el campo creadaEn',
    example: '2026-10-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha "hasta" debe tener formato ISO 8601 válido' })
  hasta?: string;

  @ApiProperty({
    description: 'Número de página (basado en 1)',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página debe ser mayor o igual a 1' })
  page?: number = 1;

  @ApiProperty({
    description: 'Cantidad de elementos por página (máximo 100)',
    example: 10,
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite debe ser mayor o igual a 1' })
  @Max(100, { message: 'El límite no puede superar 100' })
  limit?: number = 10;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}