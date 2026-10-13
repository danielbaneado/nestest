import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { INestApplication, Logger } from "@nestjs/common";
import { describeInMemoryUsers } from "../common/in-memory-users.js";

const logger = new Logger('Swagger');

export const swaggerConfiguration = (app: INestApplication): void => {

    const config = new DocumentBuilder()
        .setTitle('API de Gestión de Solicitudes Comerciales')
        .setDescription('API REST para registrar, consultar y gestionar solicitudes de contacto con clientes. Requiere header `x-api-key` y `x-user`.')
        .setVersion('1.0')
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'API Key')
        .addApiKey({
            type: 'apiKey',
            name: 'x-user',
            in: 'header',
            description: `Identidad del usuario de prueba (definida en memoria, un usuario por rol: admin, supervisor, asesor). Válidos: ${describeInMemoryUsers()}`,
        }, 'User Identity')
        .build()

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document)

    logger.log(`Docs available at http://localhost:5002/api/docs`)
}
