# 03 · Spec — App 3: Panel de gestión de empleados

> Depende de `00-arquitectura-y-contratos.md` (modelo `farma_db`, estados, reglas RN-01 a RN-10, tareas programadas). Corresponde a los Proyectos 1 y 3 del portafolio: integración de inventario y automatización de procesos internos.

| Campo | Valor |
|---|---|
| Producto | `panel-empleados` |
| Stack | Next.js (App Router) + TypeScript + Tailwind, Leaflet (mapa de rutas), Recharts (reportes) |
| Backend | `farmagestion-api` (namespace `/gestion`) |
| Despliegue | Vercel |
| Estado | Borrador v0.1 |

---

## 1. Propósito

Darle al personal de cada sede una herramienta para operar con información confiable: ver y mantener el inventario, atender los pedidos desde la reserva hasta la entrega, organizar la cola de turnos, planear rutas de domicilio y recibir alertas, sin recurrir a procesos manuales.

## 2. Alcance

### Dentro

- Inicio de sesión por rol con alcance por sede.
- Tablero operativo de la sede.
- Inventario: consulta, entradas, ajustes y kárdex.
- Bandeja de pedidos y su flujo de preparación y entrega.
- Cola de turnos del día.
- Domicilios: armado de rutas y ejecución por el domiciliario.
- Alertas de stock mínimo y notificaciones internas.
- Reportes básicos.
- Administración: sedes, empleados, catálogo y parámetros (solo `ADMIN`).

### Fuera

- Compras, órdenes a proveedores y recepción contra factura.
- Lotes, fechas de vencimiento, control de temperatura o medicamentos controlados.
- Nómina, turnos laborales y gestión de personal más allá de cuentas y cargos.
- Facturación y pagos.
- Traslados entre sedes (fase H3, ver RF-EMP-14).

## 3. Actores y permisos

| Actor | `rol` / `cargo` | Alcance |
|---|---|---|
| Farmacéutico | `EMPLEADO` / `FARMACEUTICO` | Su sede: inventario (consulta, entradas, ajustes), pedidos, turnos, rutas, reportes |
| Auxiliar | `EMPLEADO` / `AUXILIAR` | Su sede: consulta de inventario, pedidos y turnos. Sin ajustes de inventario ni rutas |
| Domiciliario | `EMPLEADO` / `DOMICILIARIO` | Solo sus rutas asignadas: ver y marcar paradas |
| Administrador | `ADMIN` | Todas las sedes, más administración de catálogo, empleados, sedes y parámetros |

Matriz de permisos:

| Función | Auxiliar | Farmacéutico | Domiciliario | Admin |
|---|:--:|:--:|:--:|:--:|
| Ver inventario y kárdex | ✔ | ✔ | — | ✔ |
| Registrar entradas y ajustes | — | ✔ | — | ✔ |
| Gestionar pedidos y turnos | ✔ | ✔ | — | ✔ |
| Armar y asignar rutas | — | ✔ | — | ✔ |
| Ejecutar rutas | — | — | ✔ | — |
| Ver reportes | — | ✔ | — | ✔ |
| Administración | — | — | — | ✔ |

## 4. Requerimientos funcionales

### Acceso y tablero

| ID | Requerimiento |
|---|---|
| RF-EMP-01 | El empleado inicia sesión con correo y contraseña. El token incluye `rol` y `sedeId`, y el panel muestra solo las opciones permitidas. |
| RF-EMP-02 | El tablero de la sede muestra: pedidos por estado, turnos del día (en espera, llamados, atendidos), medicamentos bajo el mínimo y domicilios del día. |

### Inventario

| ID | Requerimiento |
|---|---|
| RF-EMP-03 | El empleado consulta el inventario de su sede con búsqueda por nombre y filtros "bajo mínimo" y "agotado". Cada fila muestra física, reservada, disponible y mínimo. |
| RF-EMP-04 | El farmacéutico registra una **entrada** de stock (medicamento, cantidad, motivo opcional). Genera un movimiento `ENTRADA`. |
| RF-EMP-05 | El farmacéutico registra un **ajuste** positivo o negativo con motivo obligatorio. No se permite dejar `cantidad_fisica < cantidad_reservada`. |
| RF-EMP-06 | El empleado consulta el **kárdex** de un medicamento en su sede, con filtros por fecha y tipo de movimiento, y con la referencia al pedido o usuario origen. |
| RF-EMP-07 | El farmacéutico edita el `stock_minimo` de un medicamento en su sede. |

### Pedidos

| ID | Requerimiento |
|---|---|
| RF-EMP-08 | La bandeja lista los pedidos de la sede con filtros por estado, modalidad y fecha, ordenados por urgencia (vencimiento de reserva más próximo). |
| RF-EMP-09 | El empleado abre el detalle: paciente, fórmula, ítems (solicitado, reservado), turno o dirección, historial. |
| RF-EMP-10 | El empleado **toma** un pedido `RESERVADO` (queda asignado a él y pasa a `EN_PREPARACION`) y lo marca **LISTO** al terminar. Puede registrar una nota. |
| RF-EMP-11 | Para pedidos `RECOGER`, el empleado **entrega** el pedido `LISTO` verificando el documento del paciente. Se registra la dispensación (RN-06). |
| RF-EMP-12 | El empleado o el administrador puede **cancelar** un pedido antes de `ENTREGADO` con motivo obligatorio. El paciente recibe notificación. |
| RF-EMP-13 | Si al preparar detecta una diferencia (el físico no alcanza la reserva), el farmacéutico registra un ajuste negativo con motivo y el sistema reduce la reserva del pedido afectado, lo marca `es_parcial` y notifica al paciente. |
| RF-EMP-14 | (Fase H3) El farmacéutico registra un **traslado** entre dos sedes: salida en origen (`TRASLADO_SALIDA`) y entrada en destino (`TRASLADO_ENTRADA`) en una sola transacción. |

### Turnos

| ID | Requerimiento |
|---|---|
| RF-EMP-15 | La pantalla de turnos muestra la cola del día de la sede, ordenada por franja y número, con el estado de cada turno. |
| RF-EMP-16 | El empleado **llama** el siguiente turno (`EN_ESPERA → LLAMADO`). El paciente recibe una notificación. |
| RF-EMP-17 | Al entregar el pedido, el turno pasa a `ATENDIDO`. Si el paciente no se presenta, el empleado lo marca `VENCIDO` y el pedido queda `VENCIDO` con liberación de stock. |
| RF-EMP-18 | Una pantalla pública de sala (`/sala/{sedeCodigo}`, solo lectura, sin datos personales) muestra los códigos de turno llamados y en espera. |

### Domicilios

| ID | Requerimiento |
|---|---|
| RF-EMP-19 | El farmacéutico ve los pedidos `DOMICILIO` en estado `LISTO` de su sede, sobre un mapa con la sede como origen. |
| RF-EMP-20 | El farmacéutico selecciona pedidos (hasta `domicilio.max_paradas`), elige un domiciliario y **genera la ruta**. El sistema ordena las paradas con el heurístico de la sección 5 y muestra orden y distancia estimada. |
| RF-EMP-21 | El farmacéutico puede reordenar manualmente las paradas antes de **iniciar** la ruta. Al iniciar, la ruta pasa a `EN_CURSO` y los pedidos a `EN_RUTA`. |
| RF-EMP-22 | El domiciliario ve su ruta del día con el mapa y marca cada parada como **entregada** (registra la dispensación) o **fallida** con motivo. |
| RF-EMP-23 | Una parada fallida devuelve el pedido a `LISTO` e incrementa `intentos_entrega`. Al alcanzar `domicilio.max_intentos`, el pedido pasa a `CANCELADO` con liberación de stock. |
| RF-EMP-24 | Cuando todas las paradas están resueltas, la ruta pasa a `COMPLETADA`. |

### Alertas y notificaciones

| ID | Requerimiento |
|---|---|
| RF-EMP-25 | Cuando un movimiento deja el disponible en el mínimo o por debajo (RN-07), los empleados de la sede reciben una notificación y el medicamento aparece en el tablero. |
| RF-EMP-26 | Los empleados reciben notificación de nuevos pedidos en su sede. |
| RF-EMP-27 | El administrador recibe una alerta cuando un evento de integración queda en `ERROR` (RN-06). |

### Reportes

| ID | Requerimiento |
|---|---|
| RF-EMP-28 | Reportes por sede y rango de fechas: pedidos por estado, pedidos atendidos por día, tiempo promedio de preparación (`RESERVADO → LISTO`) y de entrega (`LISTO → ENTREGADO`), turnos atendidos por franja, ranking de medicamentos agotados o con más faltantes. |
| RF-EMP-29 | Los reportes se muestran con gráficos y tablas, y la tabla se exporta a CSV. |

### Administración (`ADMIN`)

| ID | Requerimiento |
|---|---|
| RF-EMP-30 | Crear, editar y desactivar sedes (horario y coordenadas incluidos). |
| RF-EMP-31 | Crear, editar y desactivar empleados con cargo y sede. |
| RF-EMP-32 | Crear, editar y desactivar medicamentos del catálogo. Al crear un medicamento se generan registros de inventario en cero para cada sede activa. |
| RF-EMP-33 | Editar los parámetros de `00` §6.3. |
| RF-EMP-34 | Consultar y reintentar manualmente eventos de integración con estado `ERROR`. |

## 5. Reglas de negocio específicas

Aplican además las reglas RN-01 a RN-10 del documento `00`.

| ID | Regla |
|---|---|
| RN-EMP-01 | Cada transición de pedido solo la ejecuta el rol permitido y solo desde los estados que define la máquina de `00` §7.1. Un intento inválido responde `409 TRANSICION_INVALIDA`. |
| RN-EMP-02 | Para entregar un pedido `RECOGER` se debe confirmar el documento del paciente. El documento digitado debe coincidir con el del pedido. |
| RN-EMP-03 | Los ajustes de inventario siempre llevan motivo y quedan en el kárdex con el usuario que los hizo. |
| RN-EMP-04 | Un pedido solo puede ser tomado por un empleado de su sede, y mientras esté `EN_PREPARACION` solo quien lo tomó o un `ADMIN` puede modificarlo. |
| RN-EMP-05 | Un domiciliario solo accede a rutas que tiene asignadas. |
| RN-EMP-06 | Una ruta solo incluye pedidos `DOMICILIO` en estado `LISTO` de la misma sede. Un pedido no puede estar en dos rutas activas. |
| RN-EMP-07 | Cuando un ajuste negativo deja `cantidad_fisica < cantidad_reservada`, el sistema libera la diferencia del pedido más reciente primero y lo marca `es_parcial` (RF-EMP-13). |

### Heurístico de ruta (L6 de `00`)

1. Distancia: fórmula de Haversine entre coordenadas, en km.
2. Construcción: vecino más cercano partiendo de la sede.
3. Mejora opcional: una pasada de 2-opt sobre el orden resultante.
4. La ruta termina en la última parada, sin regreso obligatorio a la sede.
5. La distancia total mostrada es una estimación en línea recta, no por calles.

## 6. Operaciones del API usadas

Todas bajo `/api/v1/gestion`, requieren JWT con `rol = EMPLEADO` o `ADMIN` salvo indicación. El alcance por sede se toma del token (RN-09).

### Tablero y notificaciones

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/tablero` | Resumen de la sede |
| GET | `/notificaciones` | Listar |
| POST | `/notificaciones/{id}/leer` | Marcar como leída |

### Inventario

| Método | Ruta | Rol mínimo | Descripción |
|---|---|---|---|
| GET | `/inventario?q=&bajoMinimo=&agotado=` | Auxiliar | Listado paginado |
| POST | `/inventario/{medicamentoId}/entradas` | Farmacéutico | Entrada `{ cantidad, motivo }` |
| POST | `/inventario/{medicamentoId}/ajustes` | Farmacéutico | Ajuste `{ cantidad (±), motivo }` |
| PATCH | `/inventario/{medicamentoId}` | Farmacéutico | Editar `stockMinimo` |
| GET | `/inventario/{medicamentoId}/kardex` | Auxiliar | Movimientos |
| POST | `/traslados` | Farmacéutico | (H3) Traslado entre sedes |

### Pedidos y turnos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/pedidos?estado=&modalidad=&fecha=` | Bandeja |
| GET | `/pedidos/{id}` | Detalle e historial |
| POST | `/pedidos/{id}/tomar` | `RESERVADO → EN_PREPARACION` |
| POST | `/pedidos/{id}/listo` | `EN_PREPARACION → LISTO` |
| POST | `/pedidos/{id}/entregar` | Entrega `RECOGER` `{ documentoVerificado }` |
| POST | `/pedidos/{id}/cancelar` | Cancelar `{ motivo }` |
| GET | `/turnos?fecha=` | Cola del día |
| POST | `/turnos/llamar-siguiente` | Llama el siguiente en espera |
| POST | `/turnos/{id}/vencer` | Marca como no presentado |
| GET | `/public/sala/{sedeCodigo}` | Pantalla de sala (sin autenticación, sin datos personales) |

### Domicilios

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/domicilios/pendientes` | Farmacéutico | Pedidos `DOMICILIO` en `LISTO` |
| POST | `/rutas` | Farmacéutico | Crear ruta `{ domiciliarioId, pedidoIds[] }`; devuelve paradas ordenadas |
| PUT | `/rutas/{id}/orden` | Farmacéutico | Reordenar paradas |
| POST | `/rutas/{id}/iniciar` | Farmacéutico | Pasa la ruta a `EN_CURSO` |
| GET | `/rutas/mias?fecha=` | Domiciliario | Rutas asignadas |
| POST | `/rutas/{id}/paradas/{paradaId}/entregar` | Domiciliario | Parada entregada |
| POST | `/rutas/{id}/paradas/{paradaId}/fallida` | Domiciliario | Parada fallida `{ motivo }` |

### Reportes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/reportes/pedidos?desde=&hasta=` | Pedidos por estado y por día |
| GET | `/reportes/tiempos?desde=&hasta=` | Tiempos de preparación y entrega |
| GET | `/reportes/turnos?desde=&hasta=` | Turnos por franja |
| GET | `/reportes/faltantes?desde=&hasta=` | Ranking de faltantes |

### Administración (`ADMIN`)

| Método | Ruta | Descripción |
|---|---|---|
| GET / POST / PUT | `/admin/sedes` | Sedes |
| GET / POST / PUT | `/admin/empleados` | Empleados |
| GET / POST / PUT | `/admin/medicamentos` | Catálogo |
| GET / PUT | `/admin/parametros` | Parámetros |
| GET | `/admin/integracion/eventos?estado=` | Outbox |
| POST | `/admin/integracion/eventos/{id}/reintentar` | Reintento manual |

## 7. Pantallas

| Pantalla | Rol | Contenido |
|---|---|---|
| Inicio de sesión | todos | Formulario |
| Tablero | empleado | Indicadores, alertas, accesos rápidos |
| Inventario | auxiliar+ | Tabla con filtros, acciones de entrada y ajuste |
| Kárdex | auxiliar+ | Movimientos por medicamento |
| Pedidos | auxiliar+ | Bandeja y detalle con acciones por estado |
| Turnos | auxiliar+ | Cola del día y botón "Llamar siguiente" |
| Sala | público | Pantalla de turnos para televisor |
| Domicilios | farmacéutico | Mapa y selección de pedidos, armado de ruta |
| Mi ruta | domiciliario | Paradas en orden, mapa y acciones |
| Reportes | farmacéutico+ | Gráficos, tablas y exportación |
| Administración | admin | Sedes, empleados, catálogo, parámetros, outbox |

## 8. Criterios de aceptación

**CA-EMP-01 · Alcance por sede**
- Dado un empleado de la sede A,
- cuando solicita pedidos o inventario de la sede B,
- entonces la respuesta es `403` o `404` y no recibe datos de B.

**CA-EMP-02 · Entrada de stock**
- Dado un medicamento con 10 unidades físicas,
- cuando el farmacéutico registra una entrada de 40,
- entonces el físico pasa a 50, se crea un movimiento `ENTRADA` con saldo 50 y queda visible en el kárdex.

**CA-EMP-03 · Ajuste inválido**
- Dado un medicamento con 10 físicas y 8 reservadas,
- cuando se intenta un ajuste de −5 sin pasar por RN-EMP-07,
- entonces el sistema aplica la regla de liberar la reserva excedente o rechaza el ajuste si no hay pedidos que reducir, y nunca deja `físico < reservado` sin resolver.

**CA-EMP-04 · Flujo completo de pedido a recoger**
- Dado un pedido `RESERVADO`,
- cuando el empleado lo toma, lo marca `LISTO` y lo entrega con el documento correcto,
- entonces el pedido queda `ENTREGADO`, el físico y la reserva disminuyen en la cantidad entregada, el turno queda `ATENDIDO`, el historial registra cada transición y se crea un evento de integración `PENDIENTE`.

**CA-EMP-05 · Documento incorrecto**
- Dado un pedido `LISTO`,
- cuando el empleado intenta entregarlo con un documento distinto,
- entonces la respuesta es `422` y el pedido no cambia de estado.

**CA-EMP-06 · Transición inválida**
- Dado un pedido `RESERVADO`,
- cuando se intenta entregar sin pasar por preparación,
- entonces la respuesta es `409 TRANSICION_INVALIDA`.

**CA-EMP-07 · Simulador caído**
- Dado un simulador que no responde,
- cuando se entrega un pedido,
- entonces la entrega se completa, el evento queda `PENDIENTE` y un reintento posterior lo envía y lo marca `ENVIADO`.

**CA-EMP-08 · Alerta de stock mínimo**
- Dado un medicamento con mínimo 10 y disponible 12,
- cuando una reserva deja el disponible en 9,
- entonces los empleados de la sede reciben una notificación `STOCK_BAJO` una sola vez.

**CA-EMP-09 · Vencimiento automático**
- Dado un pedido `LISTO` cuya reserva expiró,
- cuando corre `ExpirarReservas` (o alguien consulta el pedido),
- entonces pasa a `VENCIDO`, libera el stock y notifica al paciente.

**CA-EMP-10 · Llamar turno**
- Dada una cola con turnos en espera,
- cuando el empleado pulsa "Llamar siguiente",
- entonces el primer turno pasa a `LLAMADO`, aparece en la pantalla de sala y el paciente recibe una notificación.

**CA-EMP-11 · Generar ruta**
- Dados 5 pedidos `DOMICILIO` en `LISTO` con coordenadas,
- cuando el farmacéutico crea una ruta con ellos,
- entonces el sistema devuelve las paradas ordenadas con la distancia estimada y respeta el máximo de paradas.

**CA-EMP-12 · Parada fallida**
- Dado un pedido en ruta con `intentos_entrega = 1` y `domicilio.max_intentos = 2`,
- cuando el domiciliario marca la parada como fallida,
- entonces el pedido pasa a `CANCELADO` y se libera el stock.

**CA-EMP-13 · Permisos de domiciliario**
- Dado un domiciliario,
- cuando intenta consultar el inventario o una ruta que no tiene asignada,
- entonces recibe `403`.

**CA-EMP-14 · Reportes**
- Dado un rango de fechas con pedidos entregados,
- cuando el farmacéutico abre el reporte de tiempos,
- entonces ve el promedio de preparación y entrega y puede exportar la tabla a CSV.

## 9. Limitaciones específicas

- El inventario se gestiona por medicamento y sede, sin lotes ni vencimientos (L3 de `00`).
- La distancia de las rutas es en línea recta y no considera tráfico ni sentido de las vías (L6).
- No hay seguimiento en vivo del domiciliario: el estado de la ruta se actualiza al marcar paradas.
- La pantalla de sala se actualiza por consulta periódica cada 10 segundos.
- Las alertas son notificaciones dentro del panel; no hay correo ni mensajería externa.

## 10. Tareas de implementación (orden sugerido)

**Backend (camino crítico)**

1. Entidades y migraciones de `farma_db`; seed de sedes, catálogo, inventario y usuarios.
2. Seguridad: JWT, roles, alcance por sede, formato `problem+json`.
3. Inventario con reservas atómicas (RN-01), kárdex y pruebas de concurrencia (CA-PAC-07).
4. Pedidos y máquina de estados con historial y eventos de dominio.
5. Adaptador del simulador, outbox y job de reintentos.
6. Turnos y franjas.
7. Tareas programadas (`00` §11).
8. Domicilios y heurístico de rutas.
9. Reportes y administración.

**Frontend**

1. Estructura, login, guardas por rol y cliente tipado desde OpenAPI.
2. Inventario y kárdex.
3. Bandeja de pedidos y acciones (corte vertical H1).
4. Turnos y pantalla de sala.
5. Tablero y notificaciones.
6. Domicilios, mapa y vista del domiciliario.
7. Reportes y administración.
