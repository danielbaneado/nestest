import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from "cookie-parser"
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from './app.module.js';
import { swaggerConfiguration } from './config/swagger.js';
import { corsOptions } from './config/cors.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.setGlobalPrefix('api');

  app.use(helmet());
  app.enableCors(corsOptions);
  app.use(cookieParser());

  app.useGlobalInterceptors(new TransformInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  swaggerConfiguration(app);

  await app.listen(AppModule.appPort);
  console.log(`🚀 Application running on port ${AppModule.appPort}`);
  console.log(`📚 Swagger docs available at http://localhost:${AppModule.appPort}/api/docs`);
}

await bootstrap();