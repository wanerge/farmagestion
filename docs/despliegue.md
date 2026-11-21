# Guía de despliegue — FarmaGestión

Esta guía cubre los pasos manuales 5 a 9 de `docs/specs/04-preparacion-entorno.md` §5, después de subir **P1** a `main`.

> **Regla de seguridad:** Nunca pegues valores secretos en el repositorio ni en chats. Todos los valores sensibles se cargan directamente en los paneles de Vercel y Render desde tu gestor de contraseñas (o tu `.env` local ignorado por git).

---

## Prerrequisitos ya completados

- Repositorio `farmagestion` en GitHub con P1 en la rama `main`.
- Proyecto `farmagestion` en Neon (región `aws-us-east-1`, Postgres 18) con:
  - Base `eps_db` (rol `eps_app`) → cadenas `EPS_POOLED` y `EPS_DIRECT`.
  - Base `farma_db` (rol `farma_app`) → cadenas `FARMA_DIRECT` y `FARMA_POOLED`.
- Secretos generados y guardados en tu gestor: `JWT_SECRET`, `FARMA_SERVICE_API_KEY`, `SESSION_SECRET` y `DEMO_ADMIN_PASSWORD`.

---

## Paso 5 · Crear los 3 proyectos en Vercel

En [Vercel](https://vercel.com/) (*Add New → Project*), importa el repositorio `farmagestion` **tres veces**, una por app, cambiando el **Root Directory**:

| Proyecto Vercel | Root Directory | Framework | Rama | Región de funciones |
|---|---|---|---|---|
| `farmagestion-simulador-eps` | `apps/simulador-eps` | Next.js | `main` | `iad1` (fijada también en `apps/simulador-eps/vercel.json`) |
| `farmagestion-portal` | `apps/portal-paciente` | Next.js | `main` | Por defecto |
| `farmagestion-panel` | `apps/panel-empleados` | Next.js | `main` | Por defecto |

1. Deja activa la opción de omitir despliegues cuando no cambien archivos dentro del *Root Directory*.
2. Haz el primer despliegue mínimo (sin variables todavía) para obtener las 3 URLs públicas `https://...vercel.app` (sin barra final).
3. Anota esas 3 URLs en `docs/entorno.md`.

---

## Paso 6 · Crear el Blueprint en Render (`farmagestion-api`)

1. En [Render](https://dashboard.render.com/), entra a **New → Blueprint** y selecciona el repositorio `farmagestion` (rama `main`).
2. Render leerá `render.yaml` en la raíz (servicio Docker `farmagestion-api`, plan `free`, región `virginia`, `healthCheckPath: /api/v1/health`, filtro `services/farmagestion-api/**`).
3. Render te pedirá completar las variables marcadas con `sync: false`. Carga estos valores:

| Variable en Render | Qué pegar |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` *(ya viene en `render.yaml`)* |
| `SPRING_DATASOURCE_USERNAME` | `farma_app` *(ya viene en `render.yaml`)* |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://<HOST directo de farma_db>/farma_db?sslmode=require` *(sin usuario/contraseña ni `channel_binding=require`)* |
| `SPRING_DATASOURCE_PASSWORD` | Contraseña del rol `farma_app` en Neon |
| `JWT_SECRET` | Tu secreto `JWT_SECRET` (base64, ≥ 48 bytes) |
| `EPS_SIMULADOR_URL` | URL de `farmagestion-simulador-eps` en Vercel (sin barra final) |
| `EPS_SIMULADOR_API_KEY` | **El mismo valor** que `FARMA_SERVICE_API_KEY` |
| `CORS_ALLOWED_ORIGINS` | `<URL de farmagestion-portal>,<URL de farmagestion-panel>` (separadas por coma, sin espacios ni barra final) |

4. Espera a que termine el build de Docker y el healthcheck responda `200`.
5. Anota la URL `https://<servicio>.onrender.com` en `docs/entorno.md`.

---

## Paso 7 · Cargar variables en Vercel y redesplegar

### 7.1 `farmagestion-simulador-eps` (Settings → Environment Variables)

| Variable | Qué pegar |
|---|---|
| `DATABASE_URL` | Cadena `EPS_POOLED` completa de Neon (host con `-pooler`) |
| `FARMA_SERVICE_API_KEY` | **El mismo valor** que `EPS_SIMULADOR_API_KEY` en Render |
| `DEMO_ADMIN_PASSWORD` | Tu contraseña de operador demo |
| `SESSION_SECRET` | Tu secreto `SESSION_SECRET` (base64, ≥ 32 bytes) |

*(No cargues `DIRECT_URL` en Vercel; esa solo se usa desde tu máquina local para migraciones Prisma.)*

### 7.2 `farmagestion-portal` y `farmagestion-panel` (Settings → Environment Variables)

| Variable | Qué pegar |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL de Render de `farmagestion-api` (sin barra final) |

### 7.3 Redesplegar los 3 proyectos
Como `NEXT_PUBLIC_API_URL` se incrusta en tiempo de build, dispara un **Redeploy** en los tres proyectos de Vercel después de guardar las variables.

---

## Paso 8 · Verificar los 4 servicios (Hito H0)

Comprueba en tu navegador o con `curl`:

1. `GET <URL farmagestion-api>/api/v1/health` → `200 OK` *(puede tardar ~1 minuto si Render estaba dormido)*.
2. `GET <URL farmagestion-simulador-eps>/api/v1/health` → `200 OK`.
3. Abrir `<URL farmagestion-portal>` → carga la página inicial.
4. Abrir `<URL farmagestion-panel>` → carga la página inicial.

---

## Paso 9 · Migraciones de base de datos (a partir de P2)

- **`farma_db`:** se migra automáticamente con **Flyway** cuando arranca `farmagestion-api` en Render.
- **`eps_db`:** se migra manualmente desde tu máquina local usando `DIRECT_URL` (`EPS_DIRECT` de Neon) una vez que P2 cree el esquema Prisma:

```bash
cd apps/simulador-eps
# Configura DATABASE_URL=<EPS_POOLED> y DIRECT_URL=<EPS_DIRECT> en tu entorno temporal
npx prisma migrate deploy
```
