Contexto

### Lo que se va a implementar ###
Ampliar la API de solicitudes comerciales para que el supervisor pueda asignar responsables
y priorizar el trabajo, los usuarios consulten información con filtros y paginación, y el sistema
conserve una trazabilidad verificable de los cambios.

2. Continuidad obligatoria con la etapa 1
Se parte de la solución anterior, que ya debe permitir registrar y consultar solicitudes, cambiar
estados con transiciones válidas y proteger endpoints mediante x-api-key y x-user.
Deben mantenerse las decisiones y componentes existentes cuando estén correctamente
implementados.
• No cambiar el dominio: siguen siendo solicitudes de seguimiento comercial de
asesores a clientes.
• Mantener los roles admin, supervisor y asesor, con usuarios de prueba definidos
en memoria.
• Conservar TypeORM y SQLite; el almacenamiento principal no puede trasladarse a
arreglos en memoria.
• Conservar el formato uniforme de respuestas exitosas, el Exception Filter y la
documentación Swagger.
• Las claves API continúan configurándose mediante variables de entorno; no se
permiten secretos en el código.
• No implementar JWT, interfaz gráfica ni integraciones externas.

3. Nuevas reglas de negocio
RN-07. Asignación de solicitudes
Se debe incorporar la posibilidad de asignar o reasignar una solicitud a un asesor existente
en el catálogo de usuarios de prueba.
• Solo los usuarios con rol admin y supervisor pueden asignar o reasignar solicitudes.
• El usuario asignado debe existir y tener el rol asesor. No se permite asignar a un
usuario inexistente, administrador o supervisor.
• Una solicitud nueva se registra a nombre del asesor que la crea, si el solicitante tiene
rol asesor. Si la registra un supervisor o administrador, debe quedar sin asignación
hasta que sea asignada explícitamente.
• Reasignar una solicitud no cambia automáticamente su estado.
• Una solicitud en estado RESUELTA no puede reasignarse. Debe responderse con un
error de conflicto de negocio.
• Toda asignación o reasignación debe registrarse en el historial.
RN-08. Consulta con filtros y paginación
El endpoint GET /solicitudes debe admitir parámetros opcionales para buscar resultados
sin cargar toda la tabla.
• estado: filtra por PENDIENTE, EN_GESTION o RESUELTA.
• asesor: filtra por identificador del asesor asignado.
• cliente: búsqueda parcial sin distinguir mayúsculas y minúsculas, cuando el motor
de base de datos lo permita.
• desde y hasta: intervalo de fechas sobre creadaEn, usando formato ISO 8601.
• page y limit: paginación basada en página, con valores predeterminados page=1 y
limit=10.
• Límite máximo: limit no puede superar 100. Los valores inválidos deben
rechazarse mediante validación. No se aceptan cero, negativos ni texto.
• La respuesta debe incluir los datos de la página y metadatos: page, limit, total y
totalPages.
• Los filtros no pueden ampliar los permisos del usuario. Un asesor solo consulta
solicitudes asignadas a sí mismo, aunque envíe asesor=otro_usuario.
• Si desde es posterior a hasta, la petición debe rechazarse como entrada inválida.
RN-09. Historial de auditoría
Cada cambio de estado y cada asignación o reasignación deben generar un registro
persistente de historial.
El historial debe permitir explicar qué cambió, quién lo cambió y cuándo.
• Crear una entidad SolicitudHistorial relacionada con Solicitud.
• Cada evento debe incluir los siguientes campos:
o id: identificador del evento.
o solicitudId: identificador de la solicitud relacionada.
o tipoEvento: tipo de evento, por ejemplo, ESTADO, ASIGNACION o CREACION.
o valorAnterior: valor previo al cambio, cuando corresponda.
o valorNuevo: nuevo valor aplicado.
o usuarioActor: usuario que ejecutó la acción.
o fechaEvento: fecha y hora del evento.
• Para la creación inicial de una solicitud, registrar un evento CREACION con el valor
inicial PENDIENTE.
• El historial es de solo lectura para los consumidores de la API. No se permite crear,
editar ni borrar eventos desde endpoints.
• Solo admin y supervisor pueden consultar el historial de cualquier solicitud. Un
asesor puede consultar el historial de solicitudes que tiene asignadas actualmente.
• Los cambios en la solicitud y la inserción del historial deben ejecutarse en una
misma transacción. Si una de las dos operaciones falla, ninguna debe quedar
aplicada.
RN-10. Control de concurrencia en cambios de estado
Puede ocurrir que dos usuarios intenten cambiar el estado de una misma solicitud casi al
mismo tiempo. La API debe evitar que una operación basada en información desactualizada
sobrescriba otra.
• Incorporar un campo version numérico o un mecanismo equivalente de control
optimista.
• La petición para cambiar el estado debe enviar la versión esperada de la solicitud.
• Si la versión enviada no coincide con la versión persistida, rechazar el cambio con
HTTP 409 Conflict y un mensaje que indique que el registro fue modificado por
otro usuario.
• Cuando el cambio se complete, incrementar la versión y registrar el evento de
historial en la misma transacción.
• No convertir un conflicto de concurrencia en HTTP 500.
RN-11. Reglas adicionales de integridad
• No permitir cadenas con solo espacios en cliente ni en descripcion. Aplicar
normalización de espacios en los campos de texto.
• La fecha hasta no puede ser anterior a desde.
• Un asesor no puede asignar, reasignar ni consultar solicitudes que no estén
asignadas a su usuario.
• Los filtros de consulta deben componerse con la restricción de permisos a nivel de
consulta TypeORM, no después de recuperar todos los registros.
• Los errores deben distinguir entre validación (400), falta de identidad o clave (401),
permisos insuficientes (403), recurso inexistente (404) y conflicto de negocio o
versión (409), según corresponda.

4. Endpoints nuevos y ampliados
Método Endpoint Función Acceso
GET /solicitudes Filtros, paginación y
consulta según rol
Todos los usuarios
válidos
PATCH /solicitudes/:id/asignacion Asignar o reasignar
un asesor
admin, supervisor
GET /solicitudes/:id/historial Consultar
trazabilidad
admin, supervisor;
asesor con acceso a la
solicitud
PATCH /solicitudes/:id/estado
Cambio de estado
con versión
esperada
Según las reglas de la
etapa 1 y RN-10
GET /solicitudes/:id Consultar detalle
respetando permisos
Según las reglas de la
etapa 1
POST /solicitudes Crear solicitud y
evento inicial
Todos los usuarios
válidos
Todos los endpoints funcionales deben conservar los mecanismos de protección definidos
en la primera etapa, incluidos x-api-key y x-user.

5. Ejemplos de contratos HTTP
5.1. Crear una solicitud
Método: POST
Endpoint: /solicitudes
Encabezados: x-api-key, x-user
Cuerpo de la petición:
{
 "cliente": "Ferretería El Norte",
 "descripcion": "Coordinar visita de seguimiento"
}
La API debe establecer el estado PENDIENTE y los campos administrados por el sistema.
Si crea la solicitud un asesor, esta queda asignada a ese asesor. Si la crea un supervisor o
administrador, queda sin asignación.
5.2. Filtrar y paginar solicitudes
Método: GET
Endpoint:
/solicitudes?estado=EN_GESTION&page=2&limit=10&cliente=norte&desde=2026-
10-01T00:00:00Z&hasta=2026-10-31T23:59:59Z
Encabezados: x-api-key, x-user
La API debe aplicar conjuntamente los filtros enviados, la paginación y las restricciones de
acceso del usuario.
5.3. Asignar una solicitud
Método: PATCH
Endpoint: /solicitudes/15/asignacion
Encabezados: x-api-key, x-user
Cuerpo de la petición:
{
 "asesorId": "asesor02"
}
La API debe verificar que el usuario que ejecuta la acción tenga permisos y que asesor02
exista y tenga el rol asesor.
5.4. Cambiar el estado con control de versión
Método: PATCH
Endpoint: /solicitudes/15/estado
Encabezados: x-api-key, x-user
Cuerpo de la petición:
{
 "estado": "EN_GESTION",
 "versionEsperada": 1
}
La API debe validar la transición de estado permitida y comprobar que la versión enviada
coincida con la versión actual de la solicitud.
5.5. Consultar historial
Método: GET
Endpoint: /solicitudes/15/historial
Encabezados: x-api-key, x-user
La API debe validar el acceso del usuario a la solicitud antes de devolver los eventos
históricos.

6. Contrato de respuesta
Se conserva el envoltorio uniforme de éxito de la primera etapa.
Para GET /solicitudes, el contenido de data debe incluir una colección y metadatos de
paginación. La estructura exacta puede adaptarse, pero debe documentarse y mantenerse
estable.
Ejemplo de respuesta exitosa:
{
 "success": true,
 "data": {
 "items": [],
 "pagination": {
 "page": 1,
 "limit": 10,
 "total": 0,
 "totalPages": 0
 }
 }
}
Ejemplo de error de conflicto:
{
 "success": false,
 "statusCode": 409,
 "message": "La solicitud fue modificada por otro usuario. Consulta la
versión actual.",
 "timestamp": "2026-10-13T11:00:00.000Z",
 "path": "/solicitudes/15/estado"
}
El formato de error debe mantener coherencia con el Exception Filter implementado en la
primera etapa.

7. Requisitos técnicos adicionales
• Diseñar DTO separados para filtros de consulta, asignación y cambio de estado con
versión esperada.
• Aplicar ValidationPipe global con whitelist y forbidNonWhitelisted para
rechazar propiedades no permitidas.
• Crear la entidad de historial y su relación con la solicitud.
• Definir índices razonables para estado, asesor asignado y creadaEn.
• Usar transacciones TypeORM para mantener la coherencia entre solicitud e
historial.
• Implementar paginación en base de datos, con límites para evitar consultas sin
control.
• Documentar en Swagger los parámetros de consulta, cuerpos, encabezados,
respuestas 400, 401, 403, 404 y 409, y los esquemas de respuesta.
• Actualizar el README con configuración, migración o creación del esquema,
ejecución, ejemplos curl y decisiones técnicas.
• Añadir pruebas automatizadas de servicios, controladores o e2e. Las reglas críticas
no pueden depender exclusivamente de pruebas manuales.

8. Escenarios mínimos de aceptación
Escenario 01. Asignación correcta
Un supervisor asigna una solicitud a un asesor existente.
Resultado esperado: operación exitosa y evento ASIGNACION persistido.
Escenario 02. Asignación inválida
Se intenta asignar una solicitud a un usuario inexistente o que no tiene rol asesor.
Resultado esperado: rechazo con código HTTP coherente y sin cambios en la solicitud.
Escenario 03. Intento de reasignación por un asesor
Un asesor intenta reasignar una solicitud.
Resultado esperado: HTTP 403 Forbidden.
Escenario 04. Reasignación de una solicitud resuelta
Se intenta reasignar una solicitud en estado RESUELTA.
Resultado esperado: HTTP 409 Conflict.
Escenario 05. Filtro que intenta evadir permisos
Un asesor consulta con el parámetro asesor=otro_usuario.
Resultado esperado: solo recibe sus propias solicitudes. El filtro no puede evadir las
restricciones de acceso.
Escenario 06. Paginación inválida
Se envía page=0, limit=-1 o limit=1000.
Resultado esperado: HTTP 400 Bad Request.
Escenario 07. Intervalo de fechas inválido
Se envía una fecha desde posterior a hasta.
Resultado esperado: HTTP 400 Bad Request.
Escenario 08. Cambio de estado con versión vigente
Se cambia el estado utilizando una versión esperada que coincide con la persistida.
Resultado esperado: estado, versión e historial actualizados correctamente.
Escenario 09. Cambio de estado con versión desactualizada
Se envía una versión esperada diferente de la versión persistida.
Resultado esperado: HTTP 409 Conflict, sin aplicar la modificación.
Escenario 10. Fallo al guardar el historial
Falla la escritura del historial durante una transición de estado.
Resultado esperado: rollback de la transacción. Ni el cambio de estado ni la actualización
de versión deben quedar aplicados.
Escenario 11. Consulta de historial ajeno
Un asesor intenta consultar el historial de una solicitud que no tiene asignada.
Resultado esperado: acceso denegado con una respuesta coherente con la política
documentada, por ejemplo, 403 o 404.
Escenario 12. Creación por un supervisor
Un supervisor registra una solicitud comercial.
Resultado esperado: estado PENDIENTE, sin asesor asignado y con evento CREACION
registrado.