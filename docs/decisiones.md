# Registro de decisiones menores — FarmaGestión

Decisiones técnicas menores que no alteran contratos (`00 §9`), modelo de datos (`00 §6`), reglas de negocio ni estados.

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-11-21 | Spring Boot `4.2.0` (última GA en `start.spring.io`) con Java 21 | Cumple `04 §1` ("4.1 o superior, la última GA que ofrezca `start.spring.io`") |
| 2026-11-21 | `springdoc-openapi-starter-webmvc-ui` `3.2.0` y `wiremock-standalone` `3.13.1` | Últimas versiones estables compatibles con Spring Boot 4 y Java 21 |
| 2026-11-21 | Imagen `postgres:18-alpine` en `docker-compose.yml` y Testcontainers | Coincide con la versión mayor de Postgres creada en Neon (Postgres 18) |
| 2026-11-21 | Paquete base `co.farmagestion.api` con subpaquete `common.web` para infraestructura transversal (`HealthController`, `GlobalExceptionHandler`, `SecurityConfig`) | Mantiene limpios los 10 paquetes de módulos de negocio definidos en `00 §4.2` |
| 2026-11-21 | `Dockerfile` multi-stage con `eclipse-temurin:21-jdk-alpine` / `21-jre-alpine`, `sed -i 's/\r$//' mvnw` y `MaxRAMPercentage=65.0`, `UseSerialGC`, `Xss256k` | Imagen ligera para el plan free de Render (512 MB RAM) y resistente a fines de línea CRLF en Windows |
| 2026-11-21 | `render.yaml` con `autoDeploy: true`, `branch: main`, `dockerfilePath` y `dockerContext` explícitos sin `rootDir` | Cumple la especificación de Render Blueprint y el requisito de P1 §6 |
| 2026-11-21 | `@tailwindcss/postcss` + `next build --webpack` en las tres apps Next.js 16 | `@tailwindcss/turbopack` falla en Windows al iniciar su subproceso PostCSS en rutas con espacios; webpack + `@tailwindcss/postcss` compila de forma estable en local y en Vercel |
| 2026-11-21 | Entidad `Parametro` ubicada en `co.farmagestion.api.common.domain` y referencias entre módulos modeladas por `UUID` en JPA | Mantiene el aislamiento entre módulos del monolito modular (`00 §4.1`) sin acoplar entidades entre paquetes |
| 2026-11-21 | Prisma 6 (`^6`) en `apps/simulador-eps` con `DATABASE_URL` + `DIRECT_URL` en `schema.prisma` y `CHECK` constraints en `migration.sql` | Soporte estable y nativo de `directUrl` para Neon y Vercel serverless según `04 §1` |
| 2026-11-21 | Contraseña de demostración `Farma2026!` (hash BCrypt) para todos los usuarios semilla de `farma_db` | Cumple `00 §14` con usuarios determinísticos documentados en `README.md` |
| 2026-11-21 | Claim `cargo` adicional en el JWT de `EMPLEADO` (mapeado a `CARGO_<cargo>` junto con `ROLE_<rol>`) y clave HMAC-SHA256 derivada de los bytes UTF-8 de `JWT_SECRET` (>= 32 bytes) | Permite aplicar la matriz de permisos de `03 §3` sin consultas a BD por petición y acepta tanto el secreto local como `openssl rand -base64 48` |
| 2026-11-21 | Parámetro opcional `?sedeId=` en `/api/v1/gestion/inventario/**` (en `EMPLEADO`, cualquier sede distinta a la del token responde `403 SEDE_NO_AUTORIZADA`; en `ADMIN`, permite filtrar el listado y es obligatorio en escrituras/kárdex) | Cumple `RN-09` y `CA-EMP-01` manteniendo una interfaz uniforme para empleados y administradores |
| 2026-11-21 | Puerto opcional `AjusteReservaExcedenteHandler` en `inventario` para conectar `RN-EMP-07` en P6; en P5 todo ajuste negativo que deje `físico < reservado` responde `409 AJUSTE_INVALIDO_RESERVA` | Evita acoplar `inventario` al módulo `pedidos` (aún sin implementar en P5) y cumple `CA-EMP-03` |
| 2026-11-21 | Búsqueda insensible a mayúsculas y tildes mediante `translate(lower(...), 'áéíóúü', 'aeiouu')` en PostgreSQL | Soporta consultas como `losartán` y `losartan` (`CA-PAC-01`) sin exigir la extensión `unaccent` en Neon ni Docker |
| 2026-11-21 | `@Order(Ordered.HIGHEST_PRECEDENCE)` en `GlobalExceptionHandler` | Evita que `ProblemDetailsExceptionHandler` de Spring Boot 4 intercepte errores de validación sin el campo estable `code` exigido por `00 §5` |
