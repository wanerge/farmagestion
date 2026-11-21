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
