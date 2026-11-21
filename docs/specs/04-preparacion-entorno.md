# 04 · Preparación del entorno (antes del primer prompt)

> Objetivo: dejar cuentas, espacios y variables listos para que los prompts de `05-prompts-de-ejecucion.md` no tengan que preguntar ni inventar nada.
>
> Regla de oro: al agente le pasas **nombres, estructura y URLs**, nunca secretos. Los secretos los pegas tú directamente en los paneles de Render y Vercel y en tu `.env` local.

| Campo | Valor |
|---|---|
| Depende de | `00-arquitectura-y-contratos.md` §4 (arquitectura y despliegue) |
| Estado | Borrador v0.1 |

---

## 1. Versiones y decisiones fijas

| Componente | Decisión | Nota |
|---|---|---|
| Backend | Spring Boot **4.1 o superior** (la última GA que ofrezca `start.spring.io`), Java 21, Maven | No usar 3.5: su soporte abierto terminó el 30-jun-2026 (última versión 3.5.16). 4.0 llega a su fin de soporte el 31-dic-2026 |
| Dependencias Boot 4 | Generarlas con Spring Initializr, no a mano | Boot 4 renombró starters (por ejemplo `spring-boot-starter-webmvc`) y usa Jackson 3 |
| OpenAPI | springdoc-openapi **3.x** | La serie 3 es la compatible con Spring Boot 4 |
| Contenedor | `eclipse-temurin:21`, multi-stage | Ajustado a 512 MB de RAM |
| Frontends | Next.js (última estable, App Router), TypeScript, Tailwind | `npm`, un `package.json` y lockfile por app, **sin workspaces** |
| Node | LTS activo | `node -v` |
| Simulador | Prisma + `pdf-lib` | Prisma usa `DATABASE_URL` pooled y `DIRECT_URL` directa |
| Mapas | Leaflet + OpenStreetMap | Sin claves de API |
| Pruebas | JUnit + Testcontainers + WireMock (backend), Vitest (simulador), un smoke E2E con Playwright | |
| Postgres | La versión por defecto de Neon; en local, la misma versión mayor en Docker | El agente la confirma en P1 |

Decisiones abiertas de `00` §12, con el valor que asumen los prompts (cámbialo antes de empezar si no te sirve):

| Decisión | Valor por defecto |
|---|---|
| Correo como segundo canal de notificación | No (solo in-app) |
| Traslados entre sedes (RF-EMP-14) | No |
| Reparto de apps entre integrantes | Libre: cada prompt es independiente una vez hechos P1 y P2 |

## 2. Herramientas locales

| Herramienta | Para qué | Verificar |
|---|---|---|
| Git | Control de versiones | `git --version` |
| JDK 21 | Backend | `java -version` |
| Node LTS + npm | Frontends y simulador | `node -v` y `npm -v` |
| Docker Desktop (o Engine) | Postgres local, Testcontainers, probar la imagen | `docker version` |
| `psql` | Probar las cadenas de Neon | `psql --version` |
| Google Antigravity (IDE, con login de Google) | Ejecutar los prompts | Abre la carpeta del repositorio como espacio de trabajo |
| Opcionales: `gh`, `vercel`, `neonctl`, `render` | Automatizar y validar `render.yaml` | `--version` de cada una |

No instales Maven: el proyecto trae `mvnw`.

## 3. Cuentas y espacios de trabajo

**Una sola cuenta dueña del despliegue** en las tres plataformas, creada con el mismo login de GitHub. Los planes gratuitos pueden limitar la colaboración y los commits de terceros; verifícalo al conectar el repositorio y decide quién es el dueño antes de empezar.

**Región: todo en US East** para que los saltos entre servicios sean cortos.

| Plataforma | Región |
|---|---|
| Neon | AWS US East (N. Virginia) |
| Render | Virginia |
| Vercel (funciones) | `iad1` (Washington D.C.) |

La región de Neon se elige al crear el proyecto; cambiarla después implica migrar los datos.

### 3.1 GitHub

1. Crea el repositorio `farmagestion` (privado), rama `main`.
2. Sube a `docs/specs/` los 6 archivos (`00` a `05`).
3. Sube `AGENTS.md` (plantilla en `05` §2) y `docs/entorno.md` (plantilla en §6 de este documento).
4. Invita a los colaboradores.

**Qué creas tú y qué crea P1.** Antes de P1, el repositorio solo tiene esto:

```
farmagestion/
├── AGENTS.md                 # reglas permanentes para el agente (plantilla en 05 §2)
└── docs/
    ├── entorno.md            # nombres y URLs, sin secretos (plantilla en §6)
    └── specs/                # los 6 archivos .md
```

Después de P1, el agente agrega el resto:

```
farmagestion/
├── AGENTS.md
├── README.md
├── render.yaml               # receta de despliegue de la API en Render
├── docker-compose.yml        # Postgres local para desarrollo
├── docs/                     # specs, entorno, despliegue, decisiones, trazabilidad
├── contracts/                # contratos OpenAPI entre servicios
├── data/seed/                # catálogo de 30 medicamentos (JSON)
├── services/
│   └── farmagestion-api/     # backend Spring Boot (App 2 y App 3 comparten esta API)
└── apps/
    ├── simulador-eps/        # App 1 (Next.js, trae su propia API)
    ├── portal-paciente/      # App 2 (Next.js)
    └── panel-empleados/      # App 3 (Next.js)
```

Regla para no perderte: `apps/` son las pantallas y el simulador, `services/` es el backend, y `docs/` y `contracts/` no se despliegan. Cada carpeta de `apps/` y `services/` es un proyecto independiente que Vercel o Render despliegan por separado (por eso el *Root Directory* de §3.4).

### 3.2 Neon (se hace **antes** de P1)

1. Crea el proyecto `farmagestion` en AWS US East (N. Virginia), con la versión de Postgres por defecto.
2. En la rama por defecto crea dos roles, `eps_app` y `farma_app`, y dos bases: `eps_db` (dueño `eps_app`) y `farma_db` (dueño `farma_app`). Así la regla "sin acceso cruzado entre bases" también queda reforzada por permisos. Si esto te complica, el plan B es un solo rol con dos bases.
3. Para cada base copia **dos** cadenas desde el diálogo de conexión: la *pooled* (host con `-pooler`) y la *directa* (host sin `-pooler`). Guárdalas en un gestor de contraseñas. Son cuatro en total:

| Cadena | Base | Tipo | La usa |
|---|---|---|---|
| `EPS_POOLED` | `eps_db` | pooled | Simulador en Vercel (`DATABASE_URL`) |
| `EPS_DIRECT` | `eps_db` | directa | Migraciones del simulador desde tu máquina (`DIRECT_URL`) |
| `FARMA_DIRECT` | `farma_db` | directa | `farmagestion-api` en Render y en local (Flyway migra con ella) |
| `FARMA_POOLED` | `farma_db` | pooled | No se usa (el backend ya tiene pool propio). Guárdala por si cambia la decisión |

4. Prueba la conexión directa de cada base: `psql "<cadena>" -c "select 1"`.

**Cómo leer una cadena.** Las cuatro apuntan al mismo servidor de Neon, por eso el host se parece. Solo cambian tres cosas:

```
postgresql://<ROL>:<CONTRASEÑA>@<HOST>[-pooler].<resto del host>/<BASE>?sslmode=require
```

| Parte | Qué decide |
|---|---|
| `<ROL>` y `<CONTRASEÑA>` | Quién se conecta: `eps_app` o `farma_app` (cada rol tiene su contraseña) |
| `<BASE>` (al final, antes de `?`) | A qué base entra: `eps_db` o `farma_db` |
| `-pooler` en el host | Pooled (con el sufijo) o directa (sin él) |

**Qué cadena va en cada sitio:**

| Dónde | Variable | Cadena |
|---|---|---|
| Simulador en Vercel | `DATABASE_URL` | `EPS_POOLED` completa |
| Simulador, solo `.env` local (migraciones) | `DIRECT_URL` | `EPS_DIRECT` completa |
| API en Render | `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<HOST directo>/farma_db?sslmode=require` |
| API en Render | `SPRING_DATASOURCE_USERNAME` | `farma_app` |
| API en Render | `SPRING_DATASOURCE_PASSWORD` | La contraseña de `farma_app` |
| En ningún sitio por ahora | | `FARMA_POOLED` |

`<HOST directo>` es lo que queda entre `@` y `/farma_db` en `FARMA_DIRECT`. Java no lee la cadena `postgresql://` tal cual: la URL JDBC lleva solo host y base, y usuario y contraseña van en sus propias variables. Elimina `channel_binding=require` de lo que copies para JDBC.

Para trabajar en local no usas Neon: usas el Postgres de Docker que crea P1.

**Nunca pegues las cadenas ni las contraseñas en un chat, en un prompt ni en el repositorio.** Si ya lo hiciste, cambia la contraseña de cada rol en Neon (ver §4.5) y actualiza el gestor de contraseñas.

### 3.3 Render (se hace **después** de P1)

1. Crea la cuenta con GitHub y da acceso solo al repositorio `farmagestion`.
2. No crees el servicio a mano. P1 genera un Blueprint (`render.yaml` en la raíz). Entra a *New → Blueprint*, elige el repositorio y Render creará el servicio y te pedirá las variables marcadas como secretas (`sync: false`).
3. El Blueprint define: servicio web `farmagestion-api`, ejecución Docker, plan `free`, región `virginia`, `healthCheckPath: /api/v1/health`, despliegue automático desde `main` y un filtro de rutas (`services/farmagestion-api/**`) para que los cambios de frontends no consuman horas de build.
4. Cuando termine el primer despliegue, anota la URL `https://<servicio>.onrender.com` en `docs/entorno.md`.

### 3.4 Vercel (se hace **después** de P1)

1. Crea la cuenta con GitHub e instala la app de Vercel con acceso solo al repositorio.
2. Importa el repositorio **tres veces** (*Add New → Project*), una por app, cambiando el *Root Directory*:

| Proyecto Vercel | Root Directory |
|---|---|
| `farmagestion-simulador-eps` | `apps/simulador-eps` |
| `farmagestion-portal` | `apps/portal-paciente` |
| `farmagestion-panel` | `apps/panel-empleados` |

3. Framework: Next.js (se autodetecta). Rama de producción: `main`. Deja activo "omitir despliegue si el proyecto no cambió" (viene activado por defecto en monorepos).
4. En el proyecto del simulador confirma la región de funciones `iad1`. P1 también la fija en `apps/simulador-eps/vercel.json`.
5. Las variables de entorno las cargas en el paso 7 de §5, cuando ya conozcas todas las URLs.

## 4. Variables y secretos

Las variables `NEXT_PUBLIC_*` se incrustan en el navegador: nunca van secretos ahí, y al cambiarlas hay que **redesplegar** el frontend.

### 4.1 `farmagestion-api` (Render y local)

| Variable | Valor / origen | ¿Secreto? |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` en Render, `local` en tu máquina | No |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<host directo de farma_db>/farma_db?sslmode=require` | No |
| `SPRING_DATASOURCE_USERNAME` | `farma_app` | No |
| `SPRING_DATASOURCE_PASSWORD` | Contraseña del rol `farma_app` (Neon) | **Sí** |
| `JWT_SECRET` | `openssl rand -base64 48` | **Sí** |
| `EPS_SIMULADOR_URL` | URL del proyecto Vercel del simulador, sin barra final | No |
| `EPS_SIMULADOR_API_KEY` | **El mismo valor** que `FARMA_SERVICE_API_KEY` | **Sí** |
| `CORS_ALLOWED_ORIGINS` | URLs del portal y del panel, separadas por coma, sin barra final | No |

`PORT` lo define Render automáticamente; la aplicación debe leerlo (`server.port=${PORT:8080}`).

### 4.2 `simulador-eps` (Vercel y local)

| Variable | Valor / origen | ¿Secreto? |
|---|---|---|
| `DATABASE_URL` | `EPS_POOLED` | **Sí** |
| `DIRECT_URL` | `EPS_DIRECT`. Solo en tu `.env` local, para migrar; no se carga en Vercel | **Sí** |
| `FARMA_SERVICE_API_KEY` | `openssl rand -hex 32` | **Sí** |
| `DEMO_ADMIN_PASSWORD` | La eliges tú | **Sí** |
| `SESSION_SECRET` | `openssl rand -base64 32` | **Sí** |

### 4.3 `portal-paciente` y `panel-empleados` (Vercel y local)

| Variable | Valor / origen | ¿Secreto? |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL de Render de `farmagestion-api`, sin barra final | No |

### 4.4 Local

| Servicio | Valor local |
|---|---|
| Postgres | Docker Compose con `eps_db` y `farma_db` (lo crea P1). Usuario y contraseña de desarrollo, nunca los de Neon |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/farma_db` |
| `EPS_SIMULADOR_URL` | `http://localhost:3000` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3001,http://localhost:3002` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` |
| Puertos | simulador 3000, portal 3001, panel 3002, API 8080 |

### 4.5 Dónde vive cada secreto

| Lugar | Qué guarda |
|---|---|
| Panel de Render | Secretos de la API |
| Panel de Vercel | Secretos del simulador |
| `.env` / `.env.local` (ignorados por git) | Valores locales |
| Gestor de contraseñas | Las 4 cadenas de Neon y los secretos generados |
| Repositorio | Solo `.env.example` con nombres y valores de ejemplo |

Si un secreto se filtra (commit, captura, chat), se rota: en Neon se restablece la contraseña del rol afectado, y los demás se regeneran. Después se actualiza el valor en los paneles y en el gestor.

## 5. Orden de creación

Hay dos dependencias circulares: la API necesita las URLs de Vercel (CORS y simulador) y los frontends necesitan la URL de Render. Se resuelven creando primero los proyectos de Vercel y después Render, y cargando al final las variables que faltan.

**Antes de P1**

1. Herramientas locales (§2) verificadas.
2. Repositorio en GitHub con las specs, `AGENTS.md` y `docs/entorno.md` (§3.1).
3. Neon: proyecto, roles, bases y las 4 cadenas, con `select 1` probado (§3.2).
4. Secretos generados y guardados en el gestor (`JWT_SECRET`, `FARMA_SERVICE_API_KEY`, `SESSION_SECRET`, `DEMO_ADMIN_PASSWORD`).

**Ejecuta P1** (esqueleto, `render.yaml`, `docs/despliegue.md`) y súbelo a `main`.

**Después de P1**

5. Vercel: crea los 3 proyectos (§3.4). Cada uno despliega su página mínima. Anota las 3 URLs en `docs/entorno.md`.
6. Render: crea el Blueprint y pega las variables de §4.1 (`EPS_SIMULADOR_URL` y `CORS_ALLOWED_ORIGINS` salen del paso 5). Anota la URL de Render.
7. Vercel: carga las variables de §4.2 en el simulador y `NEXT_PUBLIC_API_URL` (con la URL del paso 6) en portal y panel. **Redespliega** los tres.
8. Verifica los 4 `/health` (hito H0 de `00` §13). La API tardará cerca de un minuto en responder la primera vez.
9. Migra `eps_db` desde tu máquina: `npx prisma migrate deploy` con `DIRECT_URL`. `farma_db` se migra sola: Flyway corre al arrancar la API.

Después sigue con P2 en adelante.

## 6. Plantilla de `docs/entorno.md` (sin secretos)

Este es el archivo que "le pasas" a los prompts. Contiene solo datos no sensibles.

```markdown
# Entorno — FarmaGestión

## Plataformas
| Plataforma | Cuenta dueña | Región |
|---|---|---|
| GitHub | <usuario> | — |
| Neon | <correo> | aws-us-east-1 (N. Virginia) |
| Render | <correo> | virginia |
| Vercel | <correo> | iad1 |

## Neon
- Proyecto: farmagestion
- Bases: eps_db (rol eps_app), farma_db (rol farma_app)
- Cadenas: guardadas en el gestor de contraseñas (EPS_POOLED, EPS_DIRECT, FARMA_DIRECT, FARMA_POOLED)

## Servicios y URLs
| Servicio | Plataforma | Nombre | URL real |
|---|---|---|---|
| simulador-eps | Vercel | farmagestion-simulador-eps | <completar> |
| portal-paciente | Vercel | farmagestion-portal | <completar> |
| panel-empleados | Vercel | farmagestion-panel | <completar> |
| farmagestion-api | Render | farmagestion-api | <completar> |

## Variables (solo nombres; los valores están en los paneles)
- API (Render): SPRING_PROFILES_ACTIVE, SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD, JWT_SECRET, EPS_SIMULADOR_URL, EPS_SIMULADOR_API_KEY, CORS_ALLOWED_ORIGINS
- Simulador (Vercel): DATABASE_URL, FARMA_SERVICE_API_KEY, DEMO_ADMIN_PASSWORD, SESSION_SECRET
- Portal y Panel (Vercel): NEXT_PUBLIC_API_URL
- Local solamente: DIRECT_URL

## Decisiones tomadas
- Correo: no. Traslados: no.
- Dueño del despliegue: <nombre>
```

## 7. Verificación antes del primer prompt

- [ ] `java -version` muestra 21 y `docker version` responde.
- [ ] El repositorio tiene `docs/specs/00` a `05`, `AGENTS.md` y `docs/entorno.md`.
- [ ] Neon tiene las bases `eps_db` y `farma_db` con sus roles.
- [ ] `psql "<FARMA_DIRECT>" -c "select 1"` y `psql "<EPS_DIRECT>" -c "select 1"` funcionan.
- [ ] Las 4 cadenas y los 4 secretos generados están en el gestor de contraseñas.
- [ ] Render y Vercel ven el repositorio (aparece al importar).
- [ ] Ningún secreto está escrito en `docs/entorno.md` ni en el repositorio.

## 8. Qué implican los planes gratuitos

| Plataforma | Límite relevante | Efecto en el proyecto |
|---|---|---|
| Render | El servicio se apaga tras 15 min sin tráfico y tarda cerca de 1 min en despertar. 512 MB de RAM. 750 horas gratuitas por mes y workspace | Antes de la demo, despierta la API con `/api/v1/health`. La JVM se ajusta a 512 MB en el Dockerfile. Las tareas programadas no corren mientras está apagada (por eso son idempotentes, `00` §11) |
| Neon | El cómputo se pausa a los 5 min sin consultas. Almacenamiento limitado por proyecto | La primera consulta tras la pausa es lenta (`connection-timeout` de 30 s). Los datos demo caben de sobra |
| Vercel (Hobby) | Límite de despliegues por día (100 en 24 h según su documentación) | Agrupa los commits: un `push` por tarea, no por cambio. Un monorepo con 3 proyectos puede consumir varios despliegues por commit |

Verifica estas cifras en tu panel: los planes gratuitos cambian.

## 9. Fuentes consultadas

- Spring Boot 3.5.16, fin del soporte abierto: https://spring.io/blog/2026/06/25/spring-boot-3-5-16-available-now/
- Calendario de versiones de Spring Boot: https://endoflife.date/api/spring-boot.json
- Neon, cadena pooled y directa: https://neon.com/faqs/find-pooled-connection-string-dashboard
- Neon con Prisma: https://neon.tech/docs/guides/prisma
- Render, especificación de Blueprint: https://render.com/docs/blueprint-spec
- Vercel, monorepos: https://vercel.com/docs/monorepos
