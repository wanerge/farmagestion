# Entorno — FarmaGestión

## Plataformas

| Plataforma | Cuenta dueña | Región                      |
| ---------- | ------------ | --------------------------- |
| GitHub     | <usuario>    | —                           |
| Neon       | <correo>     | aws-us-east-1 (N. Virginia) |
| Render     | <correo>     | virginia                    |
| Vercel     | <correo>     | iad1                        |

## Neon

- Proyecto: farmagestion
- Bases: eps_db (rol eps_app), farma_db (rol farma_app)
- Cadenas: guardadas en el gestor de contraseñas (EPS_POOLED, EPS_DIRECT, FARMA_DIRECT, FARMA_POOLED)

## Servicios y URLs

| Servicio         | Plataforma | Nombre                     | URL real    |
| ---------------- | ---------- | -------------------------- | ----------- |
| simulador-eps    | Vercel     | farmagestion-simulador-eps | <completar> |
| portal-paciente  | Vercel     | farmagestion-portal        | <completar> |
| panel-empleados  | Vercel     | farmagestion-panel         | <completar> |
| farmagestion-api | Render     | farmagestion-api           | <completar> |

## Variables (solo nombres; los valores están en los paneles)

- API (Render): SPRING_PROFILES_ACTIVE, SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD, JWT_SECRET, EPS_SIMULADOR_URL, EPS_SIMULADOR_API_KEY, CORS_ALLOWED_ORIGINS
- Simulador (Vercel): DATABASE_URL, FARMA_SERVICE_API_KEY, DEMO_ADMIN_PASSWORD, SESSION_SECRET
- Portal y Panel (Vercel): NEXT_PUBLIC_API_URL
- Local solamente: DIRECT_URL

## Decisiones tomadas

- Correo: no. Traslados: no.
- Dueño del despliegue: <nombre>
