import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch() // sin argumentos: atrapa TODO
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // getResponse() puede ser string u objeto { statusCode, message, error }.
    // Con ValidationPipe, `message` es un array de strings.
    let message: string | string[] = 'Internal server error';
    if (isHttpException) {
      const res = exception.getResponse();
      message =
        typeof res === 'string' ? res : ((res as any).message ?? exception.message);
    }

    // Los 5xx se loguean con stack; los 4xx son errores del cliente, basta un warn
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${status}`);
    }

    httpAdapter.reply(
      ctx.getResponse(),
      {
        statusCode: status,
        message, // nunca filtramos detalles internos en los 500
        path: httpAdapter.getRequestUrl(request),
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }
}