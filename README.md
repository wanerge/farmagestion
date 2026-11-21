# FarmaGestión

Monorepo de la simulación funcional **FarmaGestión S.A.S.**: sistema integrado de gestión de inventario, fórmulas simuladas, turnos y entregas farmacéuticas.

## Estructura del repositorio

```text
farmagestion/
├── AGENTS.md                 # Reglas para el agente
├── docker-compose.yml        # Postgres 18 local (eps_db y farma_db)
├── render.yaml               # Blueprint de Render para farmagestion-api
├── contracts/                # Contratos OpenAPI
├── data/seed/                # Catálogo semilla compartido
├── docs/                     # Specs, entorno, despliegue, decisiones, trazabilidad
├── services/
│   └── farmagestion-api/     # Backend Spring Boot 4.2 + Java 21 (puerto 8080)
└── apps/
    ├── simulador-eps/        # App 1 · Simulador EPS Next.js (puerto 3000)
    ├── portal-paciente/      # App 2 · Portal del paciente Next.js (puerto 3001)
    └── panel-empleados/      # App 3 · Panel de empleados Next.js (puerto 3002)
```

## Levantar el entorno local

### 1. Base de datos local (Docker)

```bash
docker compose up -d
```

Crea Postgres 18 en `localhost:5432` con las bases `eps_db` (rol `eps_app`) y `farma_db` (rol `farma_app`).

### 2. Variables de entorno locales

Copia `.env.example` a `.env.local` (o `.env`) en cada app/servicio si necesitas sobreescribir los valores locales por defecto:
- `services/farmagestion-api/.env.example`
- `apps/simulador-eps/.env.example`
- `apps/portal-paciente/.env.example`
- `apps/panel-empleados/.env.example`

### 3. Correr cada servicio

```bash
# Backend (puerto 8080)
cd services/farmagestion-api && ./mvnw spring-boot:run

# Simulador EPS (puerto 3000)
cd apps/simulador-eps && npm run dev

# Portal del paciente (puerto 3001)
cd apps/portal-paciente && npm run dev

# Panel de empleados (puerto 3002)
cd apps/panel-empleados && npm run dev
```

### 4. Pruebas y compilación

```bash
# Backend (incluye Testcontainers)
cd services/farmagestion-api && ./mvnw verify

# Frontends
cd apps/simulador-eps && npm run build
cd apps/portal-paciente && npm run build
cd apps/panel-empleados && npm run build
```

### 5. Probar la imagen Docker de la API con límite de 512 MB

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

## Despliegue

Ver [docs/despliegue.md](docs/despliegue.md).
