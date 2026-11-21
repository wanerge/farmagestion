# Guía de despliegue — FarmaGestión

Esta guía cubre los pasos manuales 5 a 9 de `docs/specs/04-preparacion-entorno.md` §5, el precalentamiento previo a la demo y la ejecución manual del E2E del hito **H1** contra producción.

> **Regla de seguridad:** Nunca pegues valores secretos en el repositorio ni en chats. Todos los valores sensibles se cargan directamente en los paneles de Vercel y Render desde tu gestor de contraseñas (o en variables temporales de tu terminal / `.env` ignorado por git).

---

## Prerrequisitos ya completados

- Repositorio `farmagestion` en GitHub con la rama `main` actualizada.
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

*(Nota: `apps/portal-paciente` y `apps/panel-empleados` versionan sus tipos OpenAPI en `src/lib/api/schema.d.ts`, por lo que compilan en Vercel sin necesitar acceso a `contracts/` fuera del Root Directory.)*

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

*(Notas: `PORT` lo inyecta Render automáticamente; `APP_SCHEDULING_ENABLED` tiene valor por defecto `true` en `application.yml`, por lo que no requiere configurarse en Render.)*

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

*(No cargues `DIRECT_URL` en Vercel; esa solo se usa desde tu máquina local para migraciones y semilla Prisma.)*

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

## Paso 9 · Migraciones y semillas de base de datos

- **`farma_db`:** se migra y siembra automáticamente con **Flyway** (`V1` a `V4`) cuando arranca `farmagestion-api` en Render. Incluye las 3 sedes, los 30 medicamentos, parámetros, inventario inicial y usuarios de demostración (contraseña `Farma2026!`, ver `README.md`).
- **`eps_db`:** se migra y siembra manualmente desde tu máquina local usando `DATABASE_URL` (`EPS_POOLED`) y `DIRECT_URL` (`EPS_DIRECT` de Neon):

```bash
cd apps/simulador-eps
# Exporta DATABASE_URL=<EPS_POOLED> y DIRECT_URL=<EPS_DIRECT> en tu sesión temporal (sin guardarlos en git)
npx prisma migrate deploy
npx prisma db seed
```

En PowerShell:

```powershell
cd apps/simulador-eps
$env:DATABASE_URL="<EPS_POOLED>"
$env:DIRECT_URL="<EPS_DIRECT>"
npx prisma migrate deploy
npx prisma db seed
```

Después, abre `https://farmagestion-simulador-eps.vercel.app`, inicia sesión con `DEMO_ADMIN_PASSWORD`, entra a la pestaña **Demo** y pulsa **Cargar datos demo** (crea de forma idempotente los 5 pacientes ficticios `CC 1000000001`–`1000000005` y las 8 fórmulas de ejemplo).

---

## Paso 10 · Precalentar servicios antes de la demo

Render (plan gratuito) duerme `farmagestion-api` tras 15 minutos sin tráfico (~1 minuto de arranque en frío) y Neon pausa el cómputo tras 5 minutos. Antes de una demo o de correr el E2E, ejecuta:

```bash
./scripts/precalentar.sh
```

El script consulta `/api/v1/health` de `simulador-eps` y `farmagestion-api` con reintentos (por defecto 30 intentos cada 5 s) usando las URLs reales de `docs/entorno.md`. Para entorno local usa `./scripts/precalentar.sh --local`.

---

## Paso 11 · Correr la prueba E2E de Hito H1 contra producción (pasos manuales)

> **Nota:** Esta ejecución prueba el flujo real completo de **H1** en producción (emite 1 fórmula sintética de 2 unidades de `MED-0001` para `CC 1000000001`, crea un pedido `RECOGER` con reserva y turno en `SEDE-CENTRO`, lo prepara y entrega con `farmaceutico.centro@farmagestion.demo`, y espera hasta 95 s a que el job `ReintentarOutbox` marque la fórmula como `DISPENSADA` en el simulador).

1. **Instala dependencias y navegador Chromium de Playwright (solo la primera vez):**

   ```bash
   cd e2e
   npm install
   npx playwright install chromium
   cd ..
   ```

2. **Confirma que las migraciones y semillas del Paso 9 están aplicadas** en `farma_db` (Flyway automático en Render) y `eps_db` (`prisma migrate deploy` + `prisma db seed`).

3. **Precalienta los servicios en producción** hasta que ambos `/api/v1/health` respondan `200`:

   ```bash
   ./scripts/precalentar.sh
   ```

   *(En Windows puedes ejecutarlo desde Git Bash: `"C:\Program Files\Git\bin\bash.exe" ./scripts/precalentar.sh`.)*

4. **Ejecuta el E2E apuntando a las URLs de producción** (toma `E2E_SIMULADOR_PASSWORD` de tu gestor de contraseñas; no la guardes en el repositorio):

   **En Bash / Git Bash / macOS / Linux:**

   ```bash
   E2E_SIMULADOR_URL="https://farmagestion-simulador-eps.vercel.app" \
   E2E_PORTAL_URL="https://farmagestion-portal.vercel.app" \
   E2E_PANEL_URL="https://farmagestion-panel.vercel.app" \
   E2E_API_URL="https://farmagestion-api.onrender.com" \
   E2E_SIMULADOR_PASSWORD="<tu DEMO_ADMIN_PASSWORD>" \
   npm --prefix e2e test
   ```

   **En Windows PowerShell:**

   ```powershell
   $env:E2E_SIMULADOR_URL = "https://farmagestion-simulador-eps.vercel.app"
   $env:E2E_PORTAL_URL = "https://farmagestion-portal.vercel.app"
   $env:E2E_PANEL_URL = "https://farmagestion-panel.vercel.app"
   $env:E2E_API_URL = "https://farmagestion-api.onrender.com"
   $env:E2E_SIMULADOR_PASSWORD = "<tu DEMO_ADMIN_PASSWORD>"
   npm --prefix e2e test
   Remove-Item Env:E2E_SIMULADOR_PASSWORD
   ```

5. **Verifica el resultado:**
   - Playwright debe reportar `1 passed` en `tests/h1-flujo-completo.spec.ts`.
   - Si falla un paso, revisa el reporte HTML local con `npm --prefix e2e run report` (contiene trazas y capturas del punto de fallo).
   - Opcionalmente, tras verificar H1, puedes reiniciar los datos demo del simulador desde la pestaña **Demo → Reiniciar demo** antes de presentar la sustentación.
