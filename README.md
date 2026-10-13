# nestest

API REST con NestJS para la gestión de solicitudes comerciales de una empresa.

## Requisitos previos

- Node.js >= 20
- npm o yarn

## Configuración

1. Copia el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

2. Edita `.env` y configura al menos una clave en `API_KEYS` (múltiples claves separadas por coma):

```
API_KEYS=clave1,clave2
```

## Instalación y ejecución

```bash
npm install
npm run start:dev
```

La aplicación se ejecuta en `http://localhost:5002/api`.

## Documentación Swagger

La documentación interactiva está disponible en:

```
http://localhost:5002/api/docs
```

## Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/solicitudes` | Registrar una solicitud |
| GET | `/api/solicitudes` | Listar solicitudes del usuario |
| GET | `/api/solicitudes/:id` | Consultar una solicitud por ID |
| PATCH | `/api/solicitudes/:id/estado` | Cambiar estado de una solicitud |

### Encabezados requeridos

- `x-api-key`: clave de la API (configurada en `API_KEYS`)
- `x-user`: nombre de usuario de prueba (`admin1`, `supervisor1`, `asesor1`, etc.)

## Ejemplo de uso

```bash
# Registrar una solicitud como asesor
curl -X POST http://localhost:5002/api/solicitudes \
  -H "x-api-key: clave1" \
  -H "x-user: asesor1" \
  -H "Content-Type: application/json" \
  -d '{"cliente":"Juan"," descripcion":"Consulta de producto"}'

# Listar solicitudes como supervisor
curl http://localhost:5002/api/solicitudes \
  -H "x-api-key: clave1" \
  -H "x-user: supervisor1"
```

## Roles de prueba

| Usuario | Rol |
|---------|-----|
| `admin1`, `admin2` | admin |
| `supervisor1`, `supervisor2` | supervisor |
| `asesor1`, `asesor2` | asesor |

Los usuarios de prueba se definen en memoria en `src/common/in-memory-users.ts`, con usuarios para cada rol del enum `UserRoles` (`src/common/enums/domain.enums.ts`). La documentación Swagger (`/api/docs`) lista los usuarios válidos en el esquema `User Identity`.

## Despliegue con Docker

Requiere Docker y Docker Compose.

1. Asegúrate de tener el archivo `.env` (si no lo tienes, cópialo de `.env.example`):

```bash
cp .env.example .env
```

2. Levanta la aplicación y la base de datos:

```bash
docker compose up -d --build
```

3. Verifica el estado:

```bash
docker compose ps
docker compose logs -f app
```

La API queda disponible en `http://localhost:5002/api` y la documentación Swagger en `http://localhost:5002/api/docs`.

Notas:

- El servicio `app` se conecta a Postgres mediante el nombre de servicio `postgres` dentro de la red de Docker (`DB_HOST` se sobreescribe automáticamente), mientras que `DB_PORT` del `.env` se usa solo para el mapeo al host.
- Las credenciales de la base de datos, `API_KEYS` y los límites de CPU/memoria (`APP_CPU_LIMIT`, `APP_MEM_LIMIT`, `DB_CPU_LIMIT`, `DB_MEM_LIMIT`) se toman del archivo `.env`.
- Los datos de Postgres persisten en el volumen `pgdata`. Para eliminarlos: `docker compose down -v`.
- Si necesitas restringir CORS en producción, agrega `CORS_ORIGIN=https://tu-dominio.com` al `.env`.

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run start:dev` | Ejecutar en modo desarrollo con hot-reload |
| `npm run build` | Compilar el proyecto |
| `npm run test` | Ejecutar pruebas unitarias |
| `npm run test:e2e` | Ejecutar pruebas e2e |
| `npm run lint` | Ejecutar linter |

## Estructura del proyecto

```
src/
├── common/
│   ├── decorators/    # Roles, CurrentUser
│   ├── enums/         # Enumeraciones del dominio
│   ├── filters/       # Filtro de excepciones global
│   ├── guards/        # ApiKeyGuard, UserRoleGuard
│   └── interceptors/  # TransformInterceptor
├── config/            # Configuración, Swagger, CORS
├── database.ts        # Módulo TypeORM
├── health/            # Health check
└── solicitudes/       # Módulo de solicitudes comerciales
```