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
