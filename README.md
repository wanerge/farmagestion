# FarmaGestión

Monorepo de la simulación funcional **FarmaGestión S.A.S.**: sistema integrado de gestión de inventario por sede, validación y consumo de fórmulas médicas simuladas, turnos por franja horaria, domicilios con planeación de rutas, reportes operativos y administración.

---

## URLs de producción

| Servicio | Plataforma | URL | Notas |
|---|---|---|---|
| **Simulador EPS** (App 1) | Vercel | https://farmagestion-simulador-eps.vercel.app | Salud: `/api/v1/health` · acceso operador con `DEMO_ADMIN_PASSWORD` |
| **Portal del paciente** (App 2) | Vercel | https://farmagestion-portal.vercel.app | PWA instalable; consulta pública y gestión de fórmulas/pedidos |
| **Panel de empleados** (App 3) | Vercel | https://farmagestion-panel.vercel.app | Operación por rol (`AUXILIAR`, `FARMACEUTICO`, `DOMICILIARIO`, `ADMIN`) y pantalla pública `/sala/SEDE-CENTRO` |
| **API FarmaGestión** (`farmagestion-api`) | Render (Docker) | https://farmagestion-api.onrender.com | Salud: `/api/v1/health` · OpenAPI/Swagger: `/swagger-ui.html` |

> **Arranque en frío:** Render (plan gratuito) duerme `farmagestion-api` tras 15 minutos sin tráfico (~1 minuto para despertar) y Neon pausa el cómputo tras 5 minutos. Antes de probar o presentar en producción, ejecuta `./scripts/precalentar.sh`.

---

## Estructura del repositorio

```text
farmagestion/
├── AGENTS.md                 # Reglas permanentes para el agente
├── docker-compose.yml        # PostgreSQL 18 local (bases eps_db y farma_db)
├── render.yaml               # Blueprint de Render para farmagestion-api
├── contracts/                # Contratos OpenAPI (eps-simulador y farmagestion-api)
├── data/seed/                # Catálogo semilla compartido (30 medicamentos)
├── docs/                     # Specs (00–05), arquitectura, trazabilidad, entorno, despliegue, decisiones
├── e2e/                      # Prueba E2E con Playwright del flujo completo (hito H1)
├── scripts/
│   └── precalentar.sh        # Precalentamiento de /api/v1/health (prod o --local)
├── services/
│   └── farmagestion-api/     # Backend Spring Boot 4.2 + Java 21 + Flyway (puerto 8080)
└── apps/
    ├── simulador-eps/        # App 1 · Simulador EPS Next.js + Prisma (puerto 3000)
    ├── portal-paciente/      # App 2 · Portal del paciente Next.js PWA (puerto 3001)
    └── panel-empleados/      # App 3 · Panel de empleados Next.js (puerto 3002)
```

---

## Usuarios de demostración

### 1. Usuarios de `farma_db` (Portal del paciente y Panel de empleados)

Se cargan automáticamente al arrancar `farmagestion-api` (migración Flyway `V3__semilla_inicial.sql`). Todos usan la contraseña de demostración **`Farma2026!`**:

| Rol / Cargo | Sede | Correo | Nombre | Documento |
|---|---|---|---|---|
| `ADMIN` | Todas | `admin@farmagestion.demo` | Laura Restrepo | — |
| `FARMACEUTICO` | `SEDE-CENTRO` | `farmaceutico.centro@farmagestion.demo` | Carlos Gómez | — |
| `AUXILIAR` | `SEDE-CENTRO` | `auxiliar.centro@farmagestion.demo` | Mariana López | — |
| `DOMICILIARIO` | `SEDE-CENTRO` | `domiciliario.centro@farmagestion.demo` | Andrés Mejía | — |
| `FARMACEUTICO` | `SEDE-BELLO` | `farmaceutico.bello@farmagestion.demo` | Juliana Zapata | — |
| `AUXILIAR` | `SEDE-BELLO` | `auxiliar.bello@farmagestion.demo` | Mateo Cárdenas | — |
| `DOMICILIARIO` | `SEDE-BELLO` | `domiciliario.bello@farmagestion.demo` | Sebastián Ríos | — |
| `FARMACEUTICO` | `SEDE-ITAGUI` | `farmaceutico.itagui@farmagestion.demo` | Valentina Ospina | — |
| `AUXILIAR` | `SEDE-ITAGUI` | `auxiliar.itagui@farmagestion.demo` | Daniel Henao | — |
| `DOMICILIARIO` | `SEDE-ITAGUI` | `domiciliario.itagui@farmagestion.demo` | Esteban Quintero | — |
| `PACIENTE` | — | `paciente1@farmagestion.demo` | Ana María Velásquez | `CC 1000000001` |
| `PACIENTE` | — | `paciente2@farmagestion.demo` | Jorge Luis Ramírez | `CC 1000000002` |
| `PACIENTE` | — | `paciente3@farmagestion.demo` | Sofía Giraldo | `CC 1000000003` |
| `PACIENTE` | — | `paciente4@farmagestion.demo` | Miguel Arango | `CC 1000000004` |
| `PACIENTE` | — | `paciente5@farmagestion.demo` | Camila Montoya | `CC 1000000005` |

### 2. Operador del Simulador EPS (`apps/simulador-eps`)

El simulador no usa correo de usuario: autentica al operador únicamente con la contraseña configurada en la variable de entorno **`DEMO_ADMIN_PASSWORD`** (en producción, cargada en Vercel; en local, definida en `apps/simulador-eps/.env`).

---

## Levantar todo en local

### Requisitos previos

- **Git**
- **JDK 21** (`java -version`) — no necesitas instalar Maven, el proyecto incluye `mvnw` / `mvnw.cmd`
- **Node.js LTS y npm** (`node -v`, `npm -v`)
- **Docker Desktop** (o Docker Engine) en ejecución (`docker version`)

### Paso 1 · Levantar PostgreSQL local (Docker)

Desde la raíz del repositorio:

```bash
docker compose up -d
```

Esto inicia PostgreSQL 18 en `localhost:5432` y crea automáticamente:
- `eps_db` (usuario `eps_app`, contraseña local `eps_dev_pass`)
- `farma_db` (usuario `farma_app`, contraseña local `farma_dev_pass`)

*(Para detenerlo: `docker compose down`; para borrar datos y empezar limpio: `docker compose down -v`.)*

### Paso 2 · Configurar variables de entorno locales

1. **`apps/simulador-eps/.env` (obligatorio):** copia `apps/simulador-eps/.env.example` a `apps/simulador-eps/.env`. Para que el simulador y la API se comuniquen sin cambiar la configuración por defecto de la API local, asegúrate de que `FARMA_SERVICE_API_KEY` coincida con `EPS_SIMULADOR_API_KEY` (`local-dev-api-key` por defecto en `application.yml`) y que `SESSION_SECRET` tenga al menos 16 caracteres (recomendado ≥ 32):

   ```dotenv
   DATABASE_URL=postgresql://eps_app:eps_dev_pass@localhost:5432/eps_db
   DIRECT_URL=postgresql://eps_app:eps_dev_pass@localhost:5432/eps_db
   FARMA_SERVICE_API_KEY=local-dev-api-key
   DEMO_ADMIN_PASSWORD=demo-local-2026
   SESSION_SECRET=secreto-sesion-local-de-al-menos-32-caracteres
   ```

   *(Valores de ejemplo exclusivos para desarrollo local; nunca los uses en producción ni subas `.env` a git.)*

2. **`services/farmagestion-api` (opcional en local):** el perfil `local` ya trae valores por defecto apuntando a `localhost:5432/farma_db`, `http://localhost:3000`, `EPS_SIMULADOR_API_KEY=local-dev-api-key` y `CORS_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3002`. Si prefieres sobreescribirlos, usa como guía `services/farmagestion-api/.env.example`.
3. **`apps/portal-paciente` y `apps/panel-empleados` (opcional en local):** ambos apuntan por defecto a `NEXT_PUBLIC_API_URL=http://localhost:8080`. Puedes copiar sus `.env.example` a `.env.local` si necesitas otro puerto o URL.

### Paso 3 · Instalar dependencias y migrar/sembrar `eps_db`

Cada aplicación tiene su propio `package.json` (sin workspaces):

```bash
# 1. Simulador EPS: dependencias, migraciones Prisma y semilla (30 medicamentos + 4 médicos)
cd apps/simulador-eps
npm install
npx prisma migrate deploy
npx prisma db seed
cd ../..

# 2. Portal del paciente
cd apps/portal-paciente && npm install && cd ../..

# 3. Panel de empleados
cd apps/panel-empleados && npm install && cd ../..
```

> **`farma_db`** no requiere migración manual: Flyway aplica `V1`–`V5` (esquema, parámetros, sedes, catálogo, inventario semilla y usuarios de demostración) automáticamente al arrancar `farmagestion-api`.

### Paso 4 · Iniciar los 4 servicios (en 4 terminales)

**Terminal 1 · Backend `farmagestion-api` (puerto `8080`):**

```bash
# macOS / Linux / Git Bash
cd services/farmagestion-api && ./mvnw spring-boot:run
```

```powershell
# Windows PowerShell
cd services\farmagestion-api; .\mvnw.cmd spring-boot:run
```

**Terminal 2 · App 1 · Simulador EPS (puerto `3000`):**

```bash
cd apps/simulador-eps && npm run dev
```

**Terminal 3 · App 2 · Portal del paciente (puerto `3001`):**

```bash
cd apps/portal-paciente && npm run dev
```

**Terminal 4 · App 3 · Panel de empleados (puerto `3002`):**

```bash
cd apps/panel-empleados && npm run dev
```

### Paso 5 · Verificar servicios y cargar datos demo del simulador

1. Comprueba que los dos backends responden `200 OK` en `/api/v1/health`:

   ```bash
   ./scripts/precalentar.sh --local
   ```

   *(En Windows puedes ejecutarlo desde Git Bash: `"C:\Program Files\Git\bin\bash.exe" ./scripts/precalentar.sh --local`.)*

2. Abre el Simulador EPS en `http://localhost:3000`, inicia sesión con tu `DEMO_ADMIN_PASSWORD` local, entra a la pestaña **Demo** y pulsa **Cargar datos demo**. Eso crea de forma idempotente los 5 pacientes ficticios (`CC 1000000001` a `1000000005`, coincidentes con `paciente1`–`paciente5` de `farma_db`) y 8 fórmulas variadas.
3. Accesos locales listos:
   - Simulador EPS: `http://localhost:3000`
   - Portal del paciente: `http://localhost:3001`
   - Panel de empleados: `http://localhost:3002` (pantalla de sala: `http://localhost:3002/sala/SEDE-CENTRO`)
   - API Swagger UI: `http://localhost:8080/swagger-ui.html`

---

## Cómo correr las pruebas

### 1. Pruebas de integración y unidad del backend (`farmagestion-api`)

Requiere Docker activo (usa Testcontainers con `postgres:18-alpine` y WireMock; no toca Neon ni tu base local):

```bash
# macOS / Linux / Git Bash
cd services/farmagestion-api && ./mvnw verify
```

```powershell
# Windows PowerShell
cd services\farmagestion-api; .\mvnw.cmd verify
```

Cubre esquema y checks, autenticación/catálogo, inventario y concurrencia (24 hilos), fórmulas/pedidos/turnos/outbox, domicilios/heurístico de rutas, reportes/administración y sincronización del contrato OpenAPI.

### 2. Pruebas del Simulador EPS (Vitest)

Requiere Postgres local de Docker levantado (`docker compose up -d`) con migraciones y semilla de `eps_db` aplicadas:

```bash
cd apps/simulador-eps && npm test
```

### 3. Pruebas unitarias y build de los frontends

```bash
# Portal del paciente
cd apps/portal-paciente && npm test && npm run build

# Panel de empleados
cd apps/panel-empleados && npm test && npm run build

# Build de verificación del Simulador EPS
cd apps/simulador-eps && npm run build
```

### 4. Precalentamiento con `scripts/precalentar.sh`

Consulta `/api/v1/health` de `simulador-eps` y `farmagestion-api` con reintentos (30 intentos cada 5 s por defecto):

```bash
# Producción (URLs reales de docs/entorno.md)
./scripts/precalentar.sh

# Entorno local (localhost:3000 y localhost:8080)
./scripts/precalentar.sh --local

# Ver opciones y variables configurables (MAX_REINTENTOS, ESPERA_SEGUNDOS, TIMEOUT_SEGUNDOS)
./scripts/precalentar.sh --help
```

### 5. Prueba E2E completa con Playwright (`e2e/`, Hito H1)

Recorre el flujo real completo: emitir fórmula en Simulador EPS → vincular y crear pedido `RECOGER` con reserva y turno en Portal del paciente → tomar, marcar `LISTO` y entregar verificando documento en Panel de empleados → esperar a que el job `ReintentarOutbox` marque la fórmula como `DISPENSADA` en el Simulador EPS.

**Instalación (solo la primera vez):**

```bash
cd e2e
npm install
npx playwright install chromium
cd ..
```

**Ejecución contra local** (con los 4 servicios corriendo en `localhost:3000`, `3001`, `3002` y `8080`):

```bash
# Bash / Git Bash / macOS / Linux
E2E_SIMULADOR_PASSWORD="demo-local-2026" npm --prefix e2e test
```

```powershell
# Windows PowerShell
$env:E2E_SIMULADOR_PASSWORD = "demo-local-2026"
npm --prefix e2e test
Remove-Item Env:E2E_SIMULADOR_PASSWORD
```

**Ejecución contra producción** (precalienta primero con `./scripts/precalentar.sh` y usa la `DEMO_ADMIN_PASSWORD` de producción sin guardarla en el repo):

```bash
# Bash / Git Bash / macOS / Linux
./scripts/precalentar.sh
E2E_SIMULADOR_URL="https://farmagestion-simulador-eps.vercel.app" \
E2E_PORTAL_URL="https://farmagestion-portal.vercel.app" \
E2E_PANEL_URL="https://farmagestion-panel.vercel.app" \
E2E_API_URL="https://farmagestion-api.onrender.com" \
E2E_SIMULADOR_PASSWORD="<tu DEMO_ADMIN_PASSWORD>" \
npm --prefix e2e test
```

```powershell
# Windows PowerShell
$env:E2E_SIMULADOR_URL = "https://farmagestion-simulador-eps.vercel.app"
$env:E2E_PORTAL_URL = "https://farmagestion-portal.vercel.app"
$env:E2E_PANEL_URL = "https://farmagestion-panel.vercel.app"
$env:E2E_API_URL = "https://farmagestion-api.onrender.com"
$env:E2E_SIMULADOR_PASSWORD = "<tu DEMO_ADMIN_PASSWORD>"
npm --prefix e2e test
Remove-Item Env:E2E_SIMULADOR_PASSWORD
```

Ver el reporte HTML de Playwright tras una ejecución:

```bash
npm --prefix e2e run report
```

*(Consulta `e2e/.env.example` para ver todas las variables parametrizables `E2E_*`.)*

### 6. Probar la imagen Docker de la API con límite de 512 MB

```bash
docker build -t farmagestion-api:local services/farmagestion-api
docker run --rm -m 512m -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=local \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/farma_db \
  -e SPRING_DATASOURCE_USERNAME=farma_app \
  -e SPRING_DATASOURCE_PASSWORD=farma_dev_pass \
  farmagestion-api:local
```

Verificación: `curl http://localhost:8080/api/v1/health`

---

## Documentación

- [Arquitectura, diagramas y problemas/soluciones](docs/arquitectura.md)
- [Matriz de trazabilidad (RF y CA)](docs/trazabilidad.md)
- [Guía de despliegue](docs/despliegue.md)
- [Entorno y URLs](docs/entorno.md)
- [Registro de decisiones menores](docs/decisiones.md)
- [Especificaciones del proyecto](docs/specs/)
