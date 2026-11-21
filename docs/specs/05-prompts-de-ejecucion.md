# 05 · Prompts de ejecución

> Los prompts son cortos a propósito: las specs `00` a `04` son la fuente de verdad y los prompts solo dicen **qué leer, qué construir y cuándo está terminado**. Si un prompt empieza a repetir lo que dice una spec, la spec es la que debe corregirse.

| Campo | Valor |
|---|---|
| Depende de | `00` a `04` y `docs/entorno.md` |
| Agente | Google Antigravity, con la carpeta raíz del monorepo abierta como espacio de trabajo |
| Estado | Borrador v0.1 |

---

## 1. Cómo usarlos

Para cada prompt, en este orden:

1. **Conversación nueva** (contexto limpio). Antigravity carga `AGENTS.md` solo, sin que lo menciones, y no arrastra ruido del prompt anterior.
2. Deja el agente en modo **Planning**. En los prompts **P5 y P6** (los más delicados) revisa el plan antes de aprobar la ejecución.
3. Pega el prompt tal cual. Los números de sección (`00 §8`, `03 §4`) apuntan a las specs del repositorio.
4. Cuando termine, confirma el criterio de "Terminado cuando". Si no se cumple, no pases al siguiente.
5. Pega el **prompt R** (revisión) en la misma sesión. Solo lee, no cambia código.
6. Haz commit y un solo `push` por prompt (Vercel Hobby limita los despliegues por día).
7. Actualiza `docs/trazabilidad.md` (lo crea P1) con los RF y CA cubiertos.

Orden y relación con los hitos de `00` §13:

| Prompt | Contenido | Hito |
|---|---|---|
| P1 | Esqueleto, Docker local, `render.yaml`, guía de despliegue | H0 |
| *(manual)* | Crear los proyectos en Vercel y Render y cargar variables (`04` §5, pasos 5 a 9) | H0 |
| P2 | Esquema de datos y semillas | H0 |
| P3 | Simulador EPS: API de servicio | H1 |
| P4 | Simulador EPS: interfaz, PDF y demo | H1 |
| P5 | Backend: seguridad, catálogo, inventario | H1 |
| P6 | Backend: fórmulas, pedidos, turnos, integración | H1 |
| P7 | Panel de empleados | H1 y H2 |
| P8 | Portal del paciente | H1 y H2 |
| P9 | E2E y verificación en producción | H2 |
| P10 | Domicilios y rutas | H3 |
| P11 | Reportes y administración | H3 |
| P12 | Cierre: trazabilidad, guion de sustentación | H3 |

P3 y P4 (simulador) pueden hacerse en paralelo con P5 y P6 (backend) por personas distintas; P7 y P8 necesitan el contrato OpenAPI que deja P6.

## 1.1 Configuración de Antigravity (una sola vez)

| Ajuste | Valor | Motivo |
|---|---|---|
| Terminal execution policy | **Request review** | El agente pide tu aprobación antes de cada comando. Evita que borre, instale o ejecute algo no previsto |
| Modo del agente | Planning | Planifica antes de ejecutar, es el modo por defecto |
| Carpeta abierta | La raíz de `farmagestion/` | Así carga `AGENTS.md` y ve `docs/specs/` |

Modelos sugeridos por prompt. Es una guía de criterio, no una medición: ajústala a tu cuota.

| Prompts | Modelo | Nota |
|---|---|---|
| P1, P3, P4, P7, P8, P10, P11 | Gemini 4 Neon | Modelo intermedio de Google, orientado a programación. Si quieres que otro modelo haga las ediciones, usa el Orchestrator con Neon planificando e Hydrogen ejecutando |
| P5, P6 | Un solo modelo fuerte, sin Orchestrator: Claude Opus 5.5, o Gemini 4 Neon con el máximo esfuerzo de razonamiento | Reserva, estados y outbox son lo más delicado; evita cambiar de modelo a mitad de prompt |
| P2, P9, P12 | Gemini 4 Neon o Claude Sonnet 5.5 | Tareas más acotadas |
| Prompt R | Un modelo de **otra familia** distinta a la que construyó | Una segunda opinión detecta huecos que el mismo modelo pasa por alto |
| Evitar | GPT-OSS 120B y Gemini 3.8 Flash en P5 y P6; Gemini 4 Carbon aparece no disponible | |

## 2. `AGENTS.md` (pegar en la raíz del repositorio)

Es el contexto permanente: evita repetirlo en cada prompt. Antigravity lo carga siempre activo, sin configuración adicional, y no lleva encabezado YAML.

```markdown
# FarmaGestión — instrucciones para el agente

## Fuente de verdad
- Las specs en `docs/specs/` mandan. Precedencia: `00` > spec del producto (`01`, `02`, `03`) > el prompt.
- Los datos de entorno no sensibles están en `docs/entorno.md`. Las variables y su origen, en `docs/specs/04`.
- Si el prompt contradice una spec, detente y avisa. No resuelvas el conflicto en silencio.

## Alcance
- Construye solo lo que piden las specs y el prompt. No agregues funcionalidades, pantallas ni dependencias que no estén justificadas por un RF o un CA.
- Lo que está en "Fuera" de cada spec y las limitaciones de `00` §2 no se implementan.

## Cuándo preguntar y cuándo decidir
- Pregunta antes de decidir si afecta un contrato (`00` §9), el modelo de datos (`00` §6), una regla de negocio o un estado.
- Los detalles menores (nombres internos, estructura de carpetas, estilos) los decides tú y los anotas en una línea en `docs/decisiones.md` (fecha, decisión, motivo).

## Stack y convenciones
- Backend: Spring Boot 4.1+, Java 21, Maven, Flyway, springdoc 3.x. Frontends: Next.js (App Router), TypeScript, Tailwind, un package.json por app, sin workspaces.
- Convenciones de `00` §5: UUID, `timestamptz` en UTC, snake_case español en BD, camelCase español en JSON, prefijo `/api/v1`, errores `problem+json` con `code` estable.
- Textos de interfaz y documentación en español.
- Todo cambio de estado y de stock deja traza (RN-08).

## Seguridad
- Nunca escribas secretos en el repositorio, en logs ni en documentación. Usa variables de entorno y deja `.env.example` con valores de ejemplo.
- No pidas valores reales de secretos. Indica el nombre de la variable y dónde se carga.
- No ejecutes comandos de despliegue ni escribas en Neon, Render o Vercel. Prepara archivos e instrucciones en `docs/despliegue.md`.
- Pruebas y desarrollo van contra el Postgres local de Docker, nunca contra Neon.

## Calidad
- Cada CA de la spec que implementes debe tener una prueba automática, nombrada con su ID (por ejemplo `CA_EMP_04`).
- Un cambio termina cuando compila, las pruebas pasan y el criterio "Terminado cuando" del prompt se cumple.
- Commits pequeños, mensajes con formato Conventional Commits en español.

## Comandos
(P1 completa esta sección: levantar Postgres local, correr cada servicio, pruebas, build.)
```

## 3. Prompts

### P1 · Esqueleto, entorno local y despliegue base

```text
Lee AGENTS.md, docs/entorno.md y docs/specs/00-arquitectura-y-contratos.md (§4 y §5) y docs/specs/04-preparacion-entorno.md (§1 y §4).

Crea el esqueleto del monorepo según 00 §4.3. Sin lógica de negocio.

1. services/farmagestion-api: proyecto Maven generado con Spring Initializr (usa la GA más reciente, mínimo 4.1; Java 21). Dependencias: web, security, data-jpa, validation, actuator, postgresql, flyway, oauth2-resource-server, springdoc-openapi 3.x, y para pruebas Testcontainers (postgresql) y WireMock. Verifica los ids de dependencias y las versiones contra start.spring.io en lugar de escribirlas de memoria.
   - Paquetes vacíos por módulo según 00 §4.2.
   - GET /api/v1/health sin autenticación.
   - application.yml con perfiles local y prod; todo valor sensible por variable de entorno (04 §4.1); server.port=${PORT:8080}; HikariCP con maximum-pool-size 5 y connection-timeout 30000; errores problem+json.
2. Dockerfile de la API: multi-stage, JDK 21 para compilar, JRE 21 para ejecutar, usuario no root, ajustado a 512 MB de RAM (MaxRAMPercentage, SerialGC, Xss reducido).
3. apps/simulador-eps, apps/portal-paciente, apps/panel-empleados: Next.js (App Router, TypeScript, Tailwind), cada una con su package.json y lockfile. Página de inicio mínima. El simulador expone GET /api/v1/health y tiene apps/simulador-eps/vercel.json con la región iad1.
4. docker-compose.yml en la raíz: Postgres local con las bases eps_db y farma_db (script de inicialización). Puertos de 04 §4.4.
5. .env.example en cada servicio con todas las variables de 04 §4 (el simulador incluye SESSION_SECRET), .gitignore, README con los comandos para levantar todo en local.
6. render.yaml en la raíz: un servicio web farmagestion-api, runtime docker, plan free, region virginia, healthCheckPath /api/v1/health, dockerfilePath y dockerContext explícitos (sin depender de rootDir), buildFilter con services/farmagestion-api/**, autoDeploy desde main, variables secretas con sync: false. Valida el archivo contra la especificación de Blueprint de Render.
7. docs/despliegue.md: pasos 5 a 9 de 04 §5 con los valores exactos de nombres de variable a pegar en cada panel (sin valores secretos).
8. docs/decisiones.md y docs/trazabilidad.md (tabla vacía: RF, CA, prueba, estado).
9. Completa la sección "Comandos" de AGENTS.md.

Terminado cuando:
- docker compose up deja Postgres con las dos bases.
- ./mvnw verify pasa y npm run build pasa en las tres apps.
- La imagen de la API construida localmente responde 200 en /api/v1/health con docker run -m 512m.
- No hay ningún secreto en el repositorio.
```

### P2 · Esquema de datos y semillas

```text
Lee AGENTS.md y docs/specs/00 §6 (modelo), §6.3 (parámetros) y §14 (semilla).

1. data/seed/catalogo-medicamentos.json: 30 medicamentos genéricos con códigos MED-0001 a MED-0030 (nombre, principio activo, presentación).
2. farma_db, migraciones Flyway en services/farmagestion-api:
   - V1: esquema completo de 00 §6.2 (PK uuid, FK, únicos, checks, índices en FK y en pedido(estado, sede_id), turno(sede_id, fecha), movimiento_inventario(medicamento_id, created_at)).
   - V2: tabla de parámetros con los valores de 00 §6.3.
   - V3: semilla de 00 §14 (sedes, catálogo desde el JSON, inventario con algunos agotados y bajo mínimo, usuarios con contraseña de demostración en BCrypt).
   - Entidades JPA sin lógica de negocio y hibernate ddl-auto en validate.
3. eps_db, en apps/simulador-eps: esquema Prisma de 00 §6.1, migración inicial y seed (catálogo desde el mismo JSON y 4 médicos). Prisma Client con DATABASE_URL; migraciones con DIRECT_URL.

No agregues endpoints.

Terminado cuando:
- Las migraciones se aplican desde cero en el Postgres local de Docker.
- El arranque de la API con ddl-auto=validate no falla.
- Un test comprueba los checks: físico >= reservado, y dispensada <= autorizada.
```

### P3 · Simulador EPS: API de servicio

```text
Lee AGENTS.md, docs/specs/01-spec-simulador-eps.md (§4 RF-EPS-03 a 10, §5, §6.1, §8) y docs/specs/00 §9.

1. Primero escribe contracts/eps-simulador.openapi.yaml con el contrato de 00 §9 (incluidos los errores y sus códigos).
2. Implementa en apps/simulador-eps los cuatro endpoints de 01 §6.1:
   - Middleware de X-API-Key.
   - Dispensación con Idempotency-Key y transacción única (RN-EPS-06).
   - Errores problem+json con los códigos de 00 §9.3.
   - Código de fórmula FRM-{año}-{6 dígitos} generado con una secuencia de base de datos.
   - El estado VENCIDA se calcula por fecha al consultar (RF-EPS-08).
3. El endpoint /pdf responde 501 por ahora (lo hace P4).
4. Pruebas automáticas (Vitest, base local) para CA-EPS-02 a CA-EPS-08. Las fórmulas de prueba se crean con Prisma, no hay endpoint de emisión todavía.

Terminado cuando:
- Las pruebas pasan.
- Las respuestas reales validan contra contracts/eps-simulador.openapi.yaml.
```

### P4 · Simulador EPS: interfaz, PDF y datos demo

```text
Lee AGENTS.md y docs/specs/01-spec-simulador-eps.md (§4 RF-EPS-01 a 08 y 11 a 12, §6.2, §7, CA-EPS-01 y CA-EPS-09).

Implementa en apps/simulador-eps:
- Login del operador con DEMO_ADMIN_PASSWORD (cookie httpOnly firmada con SESSION_SECRET).
- API interna /api/admin/* de 01 §6.2.
- Pantallas de 01 §7: pacientes, emitir fórmula, listado, detalle, demo.
- PDF de la fórmula con pdf-lib en el endpoint /pdf, con la marca "DOCUMENTO SIMULADO — SIN VALIDEZ CLÍNICA" (L2 de 00).
- Carga y reinicio de datos demo, idempotentes y con confirmación.
Interfaz en español, responsive, sin librerías de componentes pesadas.

Terminado cuando:
- Pasan CA-EPS-01 y CA-EPS-09.
- Puedes emitir una fórmula desde la UI y consultarla con curl usando la API key.
```

### P5 · Backend: seguridad, catálogo e inventario

```text
Lee AGENTS.md, docs/specs/00 (§5, §6.2, RN-01, RN-07 a RN-10), docs/specs/03 (§3, RF-EMP-01, 03 a 07, 25; CA-EMP-01 a 03 y 08) y docs/specs/02 (RF-PAC-01 a 05).

Implementa en services/farmagestion-api los módulos auth, catalogo e inventario:
- Registro de paciente y login. JWT HS256 de 2 h con claims sub, rol y sedeId, validado con oauth2-resource-server y secreto HMAC. BCrypt. Roles y alcance por sede (RN-09). CORS solo desde CORS_ALLOWED_ORIGINS.
- Catálogo público, sedes y disponibilidad por niveles (RN-10).
- Inventario: listado, entradas, ajustes, kárdex y stock mínimo, con las rutas de 03 §6 y 02 §6.
- Servicio interno de reserva, liberación y dispensación con SELECT ... FOR UPDATE ordenado por medicamento_id (RN-01). Cada movimiento escribe el kárdex (RN-08).
- Alerta de stock mínimo una sola vez por cruce (RN-07), usando un evento de dominio. Las notificaciones reales llegan en P6: aquí basta con publicar el evento.
- Pruebas con Testcontainers para CA-EMP-01 a 03 y 08, y un test de concurrencia: al menos 20 hilos pidiendo 5 unidades; nunca se reserva más de lo disponible.

Terminado cuando:
- ./mvnw verify pasa.
- Swagger UI muestra los endpoints de /auth, /catalogo e /gestion/inventario.
- El test de concurrencia pasa de forma repetida (córrelo 10 veces).
```

### P6 · Backend: fórmulas, pedidos, turnos e integración

```text
Lee AGENTS.md, docs/specs/00 (§7, §8, §9, §10, §11), docs/specs/02 (RF-PAC-06 a 18, §5, §6; CA-PAC-02 a 09 y 11) y docs/specs/03 (RF-EMP-08 a 13, 15 a 17, 26, 27; RN-EMP-01 a 04; CA-EMP-04 a 07, 09 y 10).

Implementa en farmagestion-api los módulos:
- formulas: adaptador al simulador con RestClient (timeout de 10 s, X-API-Key), copia local formula_ref y refresco (RN-04).
- pedidos: creación con reserva atómica y manejo de parciales (RN-02, RN-03), máquina de estados con pedido_historial, transición inválida -> 409 TRANSICION_INVALIDA.
- turnos: franjas, cupos y códigos (RN-PAC-05).
- notificaciones: puerto Notificador y adaptador in-app, que consume los eventos de dominio (incluida la alerta de stock de P5).
- integracion: outbox y reintentos con espera creciente (RN-06).
- Tareas programadas de 00 §11, idempotentes, y evaluación perezosa del vencimiento (RN-05).
Para las pruebas simula el simulador con WireMock a partir de contracts/eps-simulador.openapi.yaml.
Al terminar exporta el OpenAPI a contracts/farmagestion-api.openapi.json.

No implementes domicilios ni reportes (P10 y P11).

Terminado cuando:
- Pasan las pruebas de todos los CA listados, incluido CA-EMP-07 (simulador caído -> outbox -> reintento exitoso).
- Existe contracts/farmagestion-api.openapi.json.
```

### P7 · Panel de empleados

```text
Lee AGENTS.md, docs/specs/03 (§3, RF-EMP-01 a 13, 15 a 18, 25 y 26, §7 salvo Domicilios, Reportes y Administración, CA-EMP-04) y contracts/farmagestion-api.openapi.json.

Implementa apps/panel-empleados:
- Login, guardas por rol y tablero.
- Inventario con filtros, entradas, ajustes y kárdex.
- Bandeja de pedidos con acciones según el estado y el rol.
- Turnos con "Llamar siguiente" y pantalla pública /sala/[sede].
- Notificaciones.
Cliente tipado generado con openapi-typescript desde el contrato. Manejo global de errores problem+json. Si una petición pasa de 5 s, mostrar "Despertando el servicio…". Interfaz en español y responsive.

Terminado cuando: con la API, el simulador y la semilla en local, completas desde la UI el flujo de CA-EMP-04 (tomar, listo, entregar).
```

### P8 · Portal del paciente

```text
Lee AGENTS.md, docs/specs/02 (§4 salvo RF-PAC-12, §5, §7, §8) y contracts/farmagestion-api.openapi.json.

Implementa apps/portal-paciente sin la modalidad DOMICILIO (la hace P10):
- Búsqueda pública de medicamentos y sedes con mapa Leaflet.
- Registro e inicio de sesión.
- Vincular y ver fórmulas, descarga de PDF y matriz de disponibilidad.
- Nuevo pedido RECOGER con franjas y manejo de 409 STOCK_INSUFICIENTE (aceptar parcial o cancelar).
- Detalle del pedido con línea de tiempo, cancelación e historial.
- Notificaciones por consulta cada 20 s.
- PWA: manifiesto e iconos.
Mobile-first, cliente tipado con openapi-typescript, manejo de problem+json y estado "Despertando el servicio…" (como en P7).

Terminado cuando: con simulador, API y portal en local, cumples manualmente CA-PAC-02, 04, 05, 06, 08 y 12.
```

### P9 · E2E y verificación en producción

```text
Lee AGENTS.md, docs/entorno.md, docs/despliegue.md y 00 §10 y §13 (hito H1).

1. Escribe una prueba E2E con Playwright, en e2e/, del flujo completo de H1: emitir fórmula en el simulador -> el paciente la vincula en el portal -> crea un pedido RECOGER con reserva y turno -> el empleado lo toma, lo marca listo y lo entrega -> la fórmula queda dispensada en el simulador. Parametrizada por URLs (variables E2E_*), de modo que corra contra local y contra producción.
2. Escribe scripts/precalentar.sh: llama a los /health de la API y del simulador con reintentos hasta que respondan (para usar antes de la demo).
3. Revisa que docs/despliegue.md siga correcto con lo implementado (variables nuevas, orden de pasos).
No cambies código de producto salvo errores que la prueba revele; si los hay, lístalos antes de corregirlos.

Terminado cuando:
- El E2E pasa en local con docker compose.
- Existe la lista de los pasos manuales para correrlo contra producción.
```

### P10 · Domicilios y rutas

```text
Lee AGENTS.md, docs/specs/00 §7.1 y §7.4, docs/specs/03 (RF-EMP-19 a 24, el heurístico de ruta de §5, RN-EMP-05 y 06, CA-EMP-11 a 13) y docs/specs/02 (RF-PAC-12, CA-PAC-10).

Trabaja en este orden, con un commit por paso:
1. Backend: módulo domicilios (rutas, paradas, heurístico de vecino más cercano con Haversine y una pasada de 2-opt), endpoints de 03 §6, intentos de entrega y cancelación al agotarlos. Pruebas de CA-EMP-11 a 13. Actualiza contracts/farmagestion-api.openapi.json.
2. Panel: pantalla Domicilios (mapa, selección, armado y reorden de ruta, inicio) y "Mi ruta" para el domiciliario.
3. Portal: modalidad DOMICILIO en Nuevo pedido, con dirección y selección de ubicación en el mapa; el seguimiento muestra EN_RUTA.

Terminado cuando: cumples CA-EMP-11, 12, 13 y CA-PAC-10, y el E2E de P9 sigue pasando.
```

### P11 · Reportes y administración

```text
Lee AGENTS.md, docs/specs/03 (RF-EMP-27 a 34, §6 secciones Reportes y Administración, CA-EMP-14).

Implementa en el backend los endpoints de reportes y administración (sedes, empleados, catálogo, parámetros, outbox con reintento manual) con sus consultas agregadas. Luego las pantallas del panel: reportes con gráficos (Recharts) y exportación de la tabla a CSV, y administración visible solo para ADMIN. Al crear un medicamento se generan los registros de inventario en cero por sede activa (RF-EMP-32). Actualiza el contrato OpenAPI.

Terminado cuando: CA-EMP-14 pasa y un empleado no ADMIN recibe 403 en /admin/*.
```

### P12 · Cierre y sustentación

```text
Lee AGENTS.md y todas las specs.

1. Completa docs/trazabilidad.md: cada RF y CA de 01, 02 y 03 con su prueba y su estado (cumplido, parcial, pendiente, fuera de alcance). Señala lo parcial o pendiente sin maquillarlo.
2. Escribe docs/sustentacion.md: guion de demostración de 8 minutos que recorra el flujo del problema (paciente con fórmula -> reserva y turno -> entrega -> trazabilidad) con los usuarios semilla, las limitaciones declaradas (00 §2), las decisiones de arquitectura y sus motivos, y la lista de verificación previa (precalentar servicios, datos demo, usuarios).
3. Genera docs/arquitectura.md con los diagramas Mermaid de 00 (contexto, ER, secuencias, estados) y una tabla "problema del diagnóstico -> qué funcionalidad lo resuelve".
4. Actualiza el README con la URL de cada servicio, los usuarios de demostración y cómo correr todo en local.
No cambies código de producto.

Terminado cuando: un compañero puede levantar el proyecto en local solo con el README y ensayar la demo con docs/sustentacion.md.
```

### Prompt R · Revisión (después de cada prompt, misma sesión)

```text
Revisa lo que acabas de implementar contra las specs. No modifiques código.

1. Lista cada RF, RN y CA que el prompt debía cubrir y marca: cubierto con prueba, cubierto sin prueba, parcial o ausente.
2. Señala cualquier desviación de los contratos (00 §9), del modelo de datos (00 §6) o de las convenciones (00 §5).
3. Señala dependencias, archivos o funcionalidades que agregaste y no estaban en las specs.
4. Indica qué dudas quedaron sin resolver y qué decisiones menores tomaste (deben estar en docs/decisiones.md).
Responde en una tabla corta y cierra con la lista de lo que falta para cumplir el "Terminado cuando".
```
