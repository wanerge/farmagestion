# 02 · Spec — App 2: Portal del paciente (web/móvil)

> Depende de `00-arquitectura-y-contratos.md` (modelo `farma_db`, estados, reglas RN-01 a RN-10, convenciones). Corresponde al Proyecto 2 del portafolio.

| Campo | Valor |
|---|---|
| Producto | `portal-paciente` |
| Stack | Next.js (App Router) + TypeScript + Tailwind, PWA, Leaflet para el mapa |
| Backend | `farmagestion-api` (namespaces `/auth`, `/catalogo`, `/pacientes/me`) |
| Despliegue | Vercel |
| Estado | Borrador v0.1 |

---

## 1. Propósito

Permitir que el paciente conozca la disponibilidad de sus medicamentos antes de desplazarse, y gestione su entrega sin filas: consultar y descargar su fórmula, reservar medicamentos en una sede con turno, o pedirlos a domicilio, y seguir el estado de cada solicitud.

Ataca directamente los síntomas del diagnóstico: desplazamientos innecesarios, esperas largas para descubrir un faltante y falta de información sobre el estado de la solicitud.

## 2. Alcance

### Dentro

- Registro e inicio de sesión del paciente.
- Consulta pública de disponibilidad por sede (sin sesión).
- Vincular, ver y descargar fórmulas.
- Crear pedido para recoger en sede (con turno) o a domicilio.
- Seguimiento del pedido, cancelación, historial.
- Notificaciones dentro de la aplicación.
- Instalación como PWA en el celular.

### Fuera

- Pagos, copagos y autorizaciones.
- Cuidadores o terceros que reclaman en nombre del paciente (queda como mejora; el segmento aparece en el CANVAS).
- Notificaciones push, correo o SMS.
- Seguimiento del domiciliario en tiempo real.
- Modo sin conexión (solo se cachea la estructura de la app).

## 3. Actor

**Paciente** (`rol = PACIENTE`). Un paciente tiene un único documento y puede tener varias fórmulas vinculadas.

## 4. Requerimientos funcionales

### Cuenta

| ID | Requerimiento |
|---|---|
| RF-PAC-01 | El paciente se registra con correo, contraseña, tipo y número de documento, nombres, apellidos y teléfono. El documento y el correo son únicos. |
| RF-PAC-02 | El paciente inicia sesión y cierra sesión. Al expirar el token (2 h), la app lo redirige al inicio de sesión. |
| RF-PAC-03 | El paciente consulta y edita su teléfono y su contraseña. El documento no es editable. |

### Disponibilidad (pública)

| ID | Requerimiento |
|---|---|
| RF-PAC-04 | Cualquier visitante busca un medicamento por nombre y ve, por sede, su nivel: `DISPONIBLE`, `POCAS_UNIDADES` o `AGOTADO` (RN-10). No se muestran cantidades exactas. |
| RF-PAC-05 | Las sedes se muestran con dirección y horario, y en un mapa. |

### Fórmulas

| ID | Requerimiento |
|---|---|
| RF-PAC-06 | El paciente vincula una fórmula ingresando su código. El backend la consulta al simulador usando el documento del paciente (RN-04) y guarda la copia local `formula_ref`. |
| RF-PAC-07 | El paciente lista sus fórmulas vinculadas con estado, vigencia y ver detalle con cada medicamento, dosis y saldo pendiente (RN-03). |
| RF-PAC-08 | El paciente descarga el PDF de la fórmula. El backend lo obtiene del simulador (9.2) y lo entrega autenticado. |
| RF-PAC-09 | Al abrir el detalle de una fórmula, la app muestra para cada medicamento su disponibilidad en cada sede (matriz medicamento × sede). |

### Pedidos

| ID | Requerimiento |
|---|---|
| RF-PAC-10 | El paciente crea un pedido seleccionando fórmula, sede, modalidad, ítems y cantidades (hasta el pendiente de RN-03). |
| RF-PAC-11 | Modalidad `RECOGER`: el paciente elige una franja horaria con cupo (hoy o mañana, dentro del horario de la sede). El sistema reserva el stock, crea el pedido y genera el turno con su código y franja. |
| RF-PAC-12 | Modalidad `DOMICILIO`: el paciente indica la dirección en texto y marca su ubicación en el mapa. El sistema reserva el stock y crea el pedido. |
| RF-PAC-13 | Si algún medicamento no está disponible completo, el sistema informa por ítem qué se puede reservar y qué no (RN-02). El paciente decide continuar con un pedido parcial o cancelar sin que se haya reservado nada. |
| RF-PAC-14 | El paciente ve el detalle del pedido con ítems (solicitado, reservado, entregado), línea de tiempo de estados, turno o ruta, y hora límite de la reserva. |
| RF-PAC-15 | El paciente cancela un pedido en estado `RESERVADO`, `EN_PREPARACION` o `LISTO`. La reserva se libera y el turno pasa a `CANCELADO`. |
| RF-PAC-16 | El paciente consulta su historial de pedidos con filtro por estado. |

### Notificaciones

| ID | Requerimiento |
|---|---|
| RF-PAC-17 | El paciente recibe notificaciones in-app por: pedido reservado, en preparación, listo, en ruta, entregado, cancelado, vencido, faltante detectado y turno llamado. |
| RF-PAC-18 | La app muestra un contador de no leídas, permite marcar como leídas y refresca cada 20 segundos mientras está abierta (consulta periódica). |

### PWA

| ID | Requerimiento |
|---|---|
| RF-PAC-19 | La app define manifiesto, iconos y es instalable desde el navegador móvil. El diseño es responsivo con prioridad móvil. |

## 5. Reglas de negocio específicas

Aplican además las reglas RN-01 a RN-10 del documento `00`.

| ID | Regla |
|---|---|
| RN-PAC-01 | Para vincular una fórmula el código debe existir y pertenecer al documento del paciente. Si no coincide, el mensaje es genérico ("No encontramos una fórmula con esos datos"). |
| RN-PAC-02 | Una fórmula ya vinculada por el paciente no se vincula dos veces. |
| RN-PAC-03 | Una fórmula `VENCIDA`, `ANULADA` o `DISPENSADA` se muestra pero no permite crear pedidos. |
| RN-PAC-04 | Un mismo paciente no puede tener más de 3 pedidos activos a la vez. |
| RN-PAC-05 | Los turnos solo se pueden agendar dentro del horario de la sede, hoy o mañana (`turno.dias_adelante`), con al menos 60 minutos de anticipación respecto a la franja elegida, y respetando `turno.capacidad_franja`. |
| RN-PAC-06 | La cancelación del paciente no está permitida en `EN_RUTA` ni en estados finales. |
| RN-PAC-07 | El paciente solo ve sus propios datos. Cualquier acceso a un recurso ajeno responde `404`. |

## 6. Operaciones del API usadas

Todas bajo `/api/v1`. Los errores siguen el formato `problem+json` de `00` §5.

### Públicas

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/registro` | Registro de paciente |
| POST | `/auth/login` | Devuelve el JWT |
| GET | `/catalogo/medicamentos?q=` | Búsqueda de medicamentos |
| GET | `/catalogo/medicamentos/{id}/disponibilidad` | Nivel por sede |
| GET | `/catalogo/sedes` | Sedes con horario y coordenadas |

### Requieren `rol = PACIENTE`

| Método | Ruta | Descripción |
|---|---|---|
| GET / PUT | `/pacientes/me` | Perfil |
| POST | `/pacientes/me/formulas` | Vincular fórmula `{ "codigo": "FRM-…" }` |
| GET | `/pacientes/me/formulas` | Listar fórmulas |
| GET | `/pacientes/me/formulas/{id}` | Detalle con saldos y disponibilidad por sede |
| GET | `/pacientes/me/formulas/{id}/pdf` | Descarga del PDF |
| GET | `/pacientes/me/sedes/{sedeId}/franjas?fecha=` | Franjas con cupo |
| POST | `/pacientes/me/pedidos` | Crear pedido (ver cuerpo abajo) |
| GET | `/pacientes/me/pedidos` | Historial paginado |
| GET | `/pacientes/me/pedidos/{id}` | Detalle y línea de tiempo |
| POST | `/pacientes/me/pedidos/{id}/cancelar` | Cancelar |
| GET | `/pacientes/me/notificaciones` | Listar |
| POST | `/pacientes/me/notificaciones/{id}/leer` | Marcar como leída |

Cuerpo de `POST /pacientes/me/pedidos`:

```json
{
  "formulaId": "6a0f…",
  "sedeId": "b41c…",
  "modalidad": "RECOGER",
  "franjaInicio": "2026-11-22T10:00:00-05:00",
  "direccionEntrega": null,
  "latitudEntrega": null,
  "longitudEntrega": null,
  "aceptaParcial": false,
  "items": [
    { "medicamentoId": "e8a2…", "cantidad": 60 }
  ]
}
```

Para `DOMICILIO`, `franjaInicio` es nulo y los campos de dirección y coordenadas son obligatorios.

Respuestas relevantes:

| Código | Situación |
|---|---|
| `201` | Pedido creado, con `turno` si es `RECOGER` |
| `409 STOCK_INSUFICIENTE` | Hay faltantes y `aceptaParcial = false`. El cuerpo incluye `items[]` con `solicitada`, `disponible` y `estadoItem` |
| `409 FRANJA_SIN_CUPO` | La franja se llenó |
| `409 CANTIDAD_EXCEDE_PENDIENTE` | Se pide más de lo que la fórmula permite (RN-03) |
| `409 LIMITE_PEDIDOS_ACTIVOS` | RN-PAC-04 |
| `422 FORMULA_NO_VIGENTE` | RN-PAC-03 |
| `503 SIMULADOR_NO_DISPONIBLE` | No se pudo validar la fórmula (RN-04) |

## 7. Pantallas

| Pantalla | Acceso | Contenido |
|---|---|---|
| Inicio / Buscar medicamento | público | Buscador y resultados por sede |
| Sedes | público | Lista y mapa |
| Registro e inicio de sesión | público | Formularios |
| Mis fórmulas | paciente | Lista con estado y vigencia; botón "Vincular fórmula" |
| Detalle de fórmula | paciente | Ítems, saldo, matriz de disponibilidad, PDF, botón "Pedir" |
| Nuevo pedido | paciente | Selección de sede y modalidad, ítems, franja o mapa, confirmación con aviso de faltantes |
| Mis pedidos | paciente | Lista con filtro por estado |
| Detalle de pedido | paciente | Línea de tiempo, turno o domicilio, ítems, cancelar |
| Notificaciones | paciente | Lista con no leídas |
| Perfil | paciente | Datos y contraseña |

## 8. Criterios de aceptación

**CA-PAC-01 · Búsqueda pública**
- Dado un visitante sin sesión,
- cuando busca "losartán",
- entonces ve el nivel de disponibilidad por sede sin ver cantidades exactas.

**CA-PAC-02 · Vincular fórmula válida**
- Dado un paciente con documento `D` y una fórmula emitida para `D`,
- cuando ingresa el código,
- entonces la fórmula aparece en "Mis fórmulas" con sus ítems y saldos.

**CA-PAC-03 · Vincular fórmula ajena**
- Dada una fórmula emitida para otro documento,
- cuando el paciente ingresa su código,
- entonces recibe el mensaje genérico de no encontrada y no se guarda nada.

**CA-PAC-04 · Pedido para recoger**
- Dada una fórmula vigente y stock suficiente en la sede,
- cuando el paciente crea un pedido `RECOGER` con una franja con cupo,
- entonces el pedido queda `RESERVADO`, el stock reservado aumenta, se genera un turno con código y franja, y llega la notificación de pedido reservado.

**CA-PAC-05 · Faltante sin aceptar parcial**
- Dado un medicamento con stock menor al solicitado,
- cuando el paciente envía el pedido con `aceptaParcial = false`,
- entonces recibe `409 STOCK_INSUFICIENTE` con el detalle por ítem y no se reserva nada.

**CA-PAC-06 · Faltante aceptando parcial**
- Dado el mismo caso,
- cuando el paciente reenvía con `aceptaParcial = true`,
- entonces el pedido se crea con `es_parcial = true`, reserva lo disponible y los ítems reflejan `PARCIAL` o `AGOTADO`.

**CA-PAC-07 · Concurrencia**
- Dados dos pacientes que piden la última unidad de un medicamento al mismo tiempo,
- entonces solo uno logra reservarla y el otro recibe el faltante.

**CA-PAC-08 · Cancelar**
- Dado un pedido `RESERVADO`,
- cuando el paciente lo cancela,
- entonces el pedido pasa a `CANCELADO`, el stock reservado se libera y el turno pasa a `CANCELADO`.

**CA-PAC-09 · Reserva vencida**
- Dado un pedido cuya reserva expiró,
- cuando el paciente abre su detalle,
- entonces el estado es `VENCIDO` y puede crear un pedido nuevo.

**CA-PAC-10 · Domicilio**
- Dado un pedido `DOMICILIO` con dirección y coordenadas,
- cuando el empleado lo incluye en una ruta y la inicia,
- entonces el paciente ve el estado `EN_RUTA` y recibe la notificación correspondiente.

**CA-PAC-11 · Aislamiento de datos**
- Dado un pedido de otro paciente,
- cuando el paciente intenta abrirlo por su identificador,
- entonces recibe `404`.

**CA-PAC-12 · Descargar PDF**
- Dada una fórmula vinculada,
- cuando el paciente pulsa "Descargar",
- entonces obtiene el PDF de la fórmula con la marca de documento simulado.

## 9. Limitaciones específicas

- El turno solo existe para la modalidad `RECOGER`, ligado a un pedido con stock reservado.
- La ubicación del domicilio se marca manualmente en el mapa; no hay geocodificación de direcciones.
- Las notificaciones se actualizan por consulta periódica, no en tiempo real.
- El primer acceso tras un periodo de inactividad puede tardar cerca de un minuto por el arranque en frío del backend; la app muestra un estado de carga explícito ("Despertando el servicio…") en las primeras peticiones que superan 5 segundos.

## 10. Tareas de implementación (orden sugerido)

1. Proyecto Next.js, cliente HTTP tipado a partir del OpenAPI del backend, manejo global de errores `problem+json` y del estado de arranque en frío.
2. Autenticación: registro, login, guardas de ruta y almacenamiento del token.
3. Búsqueda pública de medicamentos y sedes.
4. Vincular y ver fórmulas, descarga de PDF.
5. Matriz de disponibilidad y flujo de nuevo pedido `RECOGER` con franjas (corte vertical H1).
6. Detalle de pedido con línea de tiempo, cancelación e historial.
7. Notificaciones.
8. Modalidad `DOMICILIO` con mapa (fase H3 si el tiempo es corto).
9. Manifiesto PWA e iconos.
