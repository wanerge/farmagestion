# Matriz de trazabilidad — FarmaGestión

Este documento traza cada requerimiento funcional (**RF**) y cada criterio de aceptación (**CA**) definidos en las especificaciones `01`, `02` y `03` contra su implementación real y su cobertura con pruebas automáticas al cierre del proyecto (P1 a P11).

## Criterios de estado

| Estado | Significado |
|---|---|
| **Cumplido** | Implementado conforme a la spec y respaldado por prueba automática. |
| **Parcial** | Implementado en el producto, pero con alguna desviación frente a la spec/contrato o sin prueba automática directa de su flujo principal. |
| **Pendiente** | Dentro del alcance acordado y aún no implementado. |
| **Fuera de alcance** | Excluido explícitamente por decisión del proyecto (`00 §2`, "Fuera" de cada spec, `04 §1` y `docs/entorno.md`). |

## Resumen cuantitativo

| Spec | Total RF | RF Cumplido | RF Parcial | RF Pendiente | RF Fuera de alcance | Total CA | CA Cumplido | CA Parcial / Pendiente |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `01` · Simulador EPS | 12 | 10 | 2 | 0 | 0 | 9 | 9 | 0 |
| `02` · Portal del paciente | 19 | 18 | 1 | 0 | 0 | 12 | 12 | 0 |
| `03` · Panel de empleados | 34 | 32 | 1 | 0 | 1 | 14 | 14 | 0 |
| **Total** | **65** | **60** | **4** | **0** | **1** | **35** | **35** | **0** |

---

## 1. App 1 · Simulador EPS (`01-spec-simulador-eps.md`)

### 1.1 Requerimientos funcionales (`RF-EPS-01` a `RF-EPS-12`)

| ID | Requerimiento (resumen) | Prueba automática | Estado | Observaciones |
|---|---|---|---|---|
| `RF-EPS-01` | Crear, listar, buscar (por documento o nombre) y editar pacientes de la EPS | *Sin prueba automática HTTP dedicada* (solo uso indirecto vía carga demo en `admin-y-pdf.test.ts` y E2E `h1-flujo-completo.spec.ts`) | **Parcial** | Implementado completo en `/api/admin/pacientes`, `/api/admin/pacientes/[id]` y UI `PacientesView.tsx`; falta prueba automática directa de crear, buscar y editar. |
| `RF-EPS-02` | Unicidad de `(tipoDocumento, documento)` con error de validación ante duplicado | *Sin prueba automática HTTP dedicada* | **Parcial** | Implementado con `UNIQUE(tipo_documento, documento)` en `eps_db` y manejo `P2002 → 409 VALIDACION_ERROR` en API; falta prueba automática del caso duplicado. |
| `RF-EPS-03` | Emitir fórmula eligiendo paciente, médico semilla y 1–10 ítems del catálogo | `apps/simulador-eps/src/app/api/admin/__tests__/admin-y-pdf.test.ts` (`CA_EPS_01`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | Validaciones de 1–10 ítems y sin medicamentos duplicados (`RN-EPS-02`) implementadas en `POST /api/admin/formulas` y `EmitirFormulaView.tsx`. |
| `RF-EPS-04` | Código `FRM-{año}-{6 dígitos}` y vigencia por defecto de 30 días (configurable) | `apps/simulador-eps/src/app/api/v1/__tests__/api-servicio.test.ts` (`generarCodigoFormula...`), `admin-y-pdf.test.ts` (`CA_EPS_01`) | **Cumplido** | Generado con secuencia de BD (`20261121010000_secuencia_formula`). |
| `RF-EPS-05` | Listar fórmulas con filtros (estado, paciente, fechas) y ver detalle con historial de dispensaciones | `admin-y-pdf.test.ts` (`CA_EPS_01`, filtro `pacienteId`), `e2e/tests/h1-flujo-completo.spec.ts` (detalle e historial de dispensaciones) | **Cumplido** | Filtros `estado`, `desde` y `hasta` implementados en `GET /api/admin/formulas` y `FormulasView.tsx` (sin prueba unitaria específica de esos 3 parámetros). |
| `RF-EPS-06` | Anular fórmula en `EMITIDA` sin dispensaciones; rechazar si tiene dispensaciones | `admin-y-pdf.test.ts` (`RF-EPS-06: anular fórmula en EMITIDA funciona y rechaza anular si ya está anulada`) | **Cumplido** | El rechazo cuando existen dispensaciones (`formula._count.dispensaciones > 0 → 409`) está implementado en `/api/admin/formulas/[id]/anular`, aunque la prueba ejercita solo `EMITIDA` y re-anulación en `ANULADA`. |
| `RF-EPS-07` | Generar PDF con paciente, médico, ítems, vigencia, código y marca "DOCUMENTO SIMULADO — SIN VALIDEZ CLÍNICA" | `admin-y-pdf.test.ts` (`CA_EPS_09`), `api-servicio.test.ts` (`CA_EPS_09`) | **Cumplido** | Generado con `pdf-lib` en `src/lib/pdf-formula.ts`, disponible en `/api/v1/formulas/[codigo]/pdf` y `/api/admin/formulas/[id]/pdf`. |
| `RF-EPS-08` | Calcular estado `VENCIDA` por fecha al consultar sin tarea programada | `api-servicio.test.ts` (`CA_EPS_07`) | **Cumplido** | Calculado dinámicamente en `calcularEstadoEfectivo`. |
| `RF-EPS-09` | Registrar dispensaciones con `Idempotency-Key` en API de servicio sin duplicar | `api-servicio.test.ts` (`CA_EPS_06`) | **Cumplido** | Restricción única `idempotency_key` en `dispensacion` y transacción única (`RN-EPS-06`). |
| `RF-EPS-10` | Actualizar estado de fórmula a `PARCIALMENTE_DISPENSADA` o `DISPENSADA` tras cada dispensación | `api-servicio.test.ts` (`CA_EPS_04`, `CA_EPS_05`, `RN-EPS-04`) | **Cumplido** | Protegido además por check `0 <= cantidad_dispensada <= cantidad_autorizada` en `eps_db`. |
| `RF-EPS-11` | Botón "Cargar datos demo" idempotente (5 pacientes, 4 médicos, 8 fórmulas incluida próxima a vencer y vencida) | `admin-y-pdf.test.ts` (`RF-EPS-11 y RF-EPS-12`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | Implementado en `POST /api/admin/demo/cargar` y `DemoView.tsx`. |
| `RF-EPS-12` | Botón "Reiniciar demo" con confirmación | `admin-y-pdf.test.ts` (`RF-EPS-11 y RF-EPS-12`) | **Cumplido** | Confirmación en UI `DemoView.tsx` y limpieza/recarga en `POST /api/admin/demo/reiniciar`. |

### 1.2 Criterios de aceptación (`CA-EPS-01` a `CA-EPS-09`)

| ID | Criterio de aceptación | Prueba automática | Estado |
|---|---|---|---|
| `CA-EPS-01` | Emitir fórmula con 2 ítems: `EMITIDA`, código único, vigencia 30 días y aparece en listado | `apps/simulador-eps/src/app/api/admin/__tests__/admin-y-pdf.test.ts` (`CA_EPS_01`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** |
| `CA-EPS-02` | Consulta con documento correcto → `200` con ítems y saldos | `apps/simulador-eps/src/app/api/v1/__tests__/api-servicio.test.ts` (`CA_EPS_02`) | **Cumplido** |
| `CA-EPS-03` | Consulta con documento incorrecto → `404 FORMULA_NO_ENCONTRADA` idéntico a código inexistente | `api-servicio.test.ts` (`CA_EPS_03`) | **Cumplido** |
| `CA-EPS-04` | Dispensación parcial (20 de 60) → `cantidadDispensada = 20` y `PARCIALMENTE_DISPENSADA` | `api-servicio.test.ts` (`CA_EPS_04`) | **Cumplido** |
| `CA-EPS-05` | Exceso sobre autorizado (50 + 20 > 60) → `409 CANTIDAD_EXCEDE_AUTORIZADA` sin alterar datos | `api-servicio.test.ts` (`CA_EPS_05`) | **Cumplido** |
| `CA-EPS-06` | Repetición con misma `Idempotency-Key` → `200` sin duplicar cantidades | `api-servicio.test.ts` (`CA_EPS_06`) | **Cumplido** |
| `CA-EPS-07` | Fórmula vencida al intentar dispensar → `409 FORMULA_NO_DISPENSABLE` | `api-servicio.test.ts` (`CA_EPS_07`) | **Cumplido** |
| `CA-EPS-08` | Acceso al API de servicio sin `X-API-Key` o inválida → `401` | `api-servicio.test.ts` (`CA_EPS_08`) | **Cumplido** |
| `CA-EPS-09` | Descarga de PDF `application/pdf` con código, ítems y marca de documento simulado | `admin-y-pdf.test.ts` (`CA_EPS_09`), `api-servicio.test.ts` (`CA_EPS_09`) | **Cumplido** |

---

## 2. App 2 · Portal del paciente (`02-spec-portal-paciente.md`)

### 2.1 Requerimientos funcionales (`RF-PAC-01` a `RF-PAC-19`)

| ID | Requerimiento (resumen) | Prueba automática | Estado | Observaciones |
|---|---|---|---|---|
| `RF-PAC-01` | Registro de paciente con correo y documento únicos | `AuthYCatalogoIntegrationTest` (`registroYLoginPacienteYEdicionPerfil`) | **Cumplido** | Backend `POST /auth/registro` + UI `/registro`. |
| `RF-PAC-02` | Inicio y cierre de sesión; redirección al expirar JWT (2 h) | `AuthYCatalogoIntegrationTest` (`registroYLoginPacienteYEdicionPerfil`), `portal-paciente.test.ts` (`activa 'Despertando el servicio…' tras 5 s, maneja 401 y valida rol PACIENTE`) | **Cumplido** | Backend `POST /auth/login` + UI `/login`, `AppProvider` y `PacienteGuard`. |
| `RF-PAC-03` | Consultar y editar teléfono y contraseña; documento no editable | `AuthYCatalogoIntegrationTest` (`registroYLoginPacienteYEdicionPerfil`) | **Cumplido** | Backend `GET/PUT /pacientes/me` + UI `/perfil`. |
| `RF-PAC-04` | Búsqueda pública por nombre y disponibilidad por sede en niveles sin cantidades exactas (`RN-10`) | `AuthYCatalogoIntegrationTest` (`CA_PAC_01_busquedaPublicaYDisponibilidadPorNivelesSinCantidadesExactas`), `portal-paciente.test.ts` (`CA_PAC_01`) | **Cumplido** | Búsqueda insensible a tildes y mayúsculas + UI `/`. |
| `RF-PAC-05` | Mostrar sedes con dirección, horario y mapa | `AuthYCatalogoIntegrationTest` (`CA_PAC_01_...`, `corsSoloPermiteOrigenesConfigurados`), `portal-paciente.test.ts` (`listarSedes`) | **Cumplido** | Backend `GET /catalogo/sedes` + UI `/sedes` con Leaflet y OpenStreetMap. |
| `RF-PAC-06` | Vincular fórmula por código contra simulador usando documento del paciente y guardar `formula_ref` | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_02`, `CA_PAC_03`), `portal-paciente.test.ts` (`CA_PAC_02`, `CA_PAC_03`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | Respeta `RN-04`, `RN-PAC-01` y `RN-PAC-02`. |
| `RF-PAC-07` | Listar fórmulas vinculadas y ver detalle con medicamento, dosis y saldo pendiente (`RN-03`) | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_02`, `reglasNegocio_RN03_...`), `portal-paciente.test.ts` (`CA_PAC_02`) | **Cumplido** | `dosis`, `frecuencia` y `duracionDias` se enriquecen en vivo desde el simulador al consultar detalle; si el simulador no responde, se muestra la copia local `formula_ref` sin esos campos descriptivos. |
| `RF-PAC-08` | Descargar PDF de la fórmula autenticado vía backend | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_02_vincularFormulaValidaVerDetalleYDescargarPdf`), `portal-paciente.test.ts` (`CA_PAC_12`) | **Cumplido** | Backend `GET /pacientes/me/formulas/{id}/pdf` + UI `/formulas/[id]`. |
| `RF-PAC-09` | Matriz medicamento × sede en el detalle de la fórmula | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_02`), `portal-paciente.test.ts` (`CA_PAC_02`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | Incluida en `FormulaDetalleResponse` y renderizada en `/formulas/[id]`. |
| `RF-PAC-10` | Crear pedido eligiendo fórmula, sede, modalidad, ítems y cantidades hasta el pendiente (`RN-03`) | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04`, `reglasNegocio_RN03_RN04_RNPAC03_RNPAC04_RNPAC05_yDomicilio`), `portal-paciente.test.ts` (`CA_PAC_04`) | **Cumplido** | Valida `RN-01` a `RN-04` y `RN-PAC-03` a `RN-PAC-05`. |
| `RF-PAC-11` | Modalidad `RECOGER`: elegir franja con cupo, reservar stock, crear pedido y generar turno | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04`), `portal-paciente.test.ts` (`CA_PAC_04`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | Franjas hoy/mañana con anticipación mínima de 60 min y control de cupo con bloqueo transaccional. |
| `RF-PAC-12` | Modalidad `DOMICILIO`: dirección en texto y selección de ubicación en el mapa | `DomiciliosRutasIntegrationTest` (`CA_PAC_10`), `PortalPacienteFlujosIntegrationTest` (`reglasNegocio_..._yDomicilio`), `portal-paciente.test.ts` (`CA_PAC_10`) | **Cumplido** | UI `/pedidos/nuevo` con `MapaSeleccionUbicacionLeaflet.tsx`. |
| `RF-PAC-13` | Aviso por ítem ante faltante (`409 STOCK_INSUFICIENTE`) para decidir pedido parcial o cancelar | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_05`, `CA_PAC_06`), `portal-paciente.test.ts` (`CA_PAC_05 y CA_PAC_06`) | **Cumplido** | Modal interactivo en `/pedidos/nuevo`; no reserva si el paciente cancela (`RN-02`). |
| `RF-PAC-14` | Detalle del pedido: ítems, línea de tiempo, turno o ruta y hora límite de reserva | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04`, `CA_PAC_08`, `CA_PAC_09`), `DomiciliosRutasIntegrationTest` (`CA_PAC_10`), `portal-paciente.test.ts` (`CA_PAC_10`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | UI `/pedidos/[id]` muestra línea de tiempo, tarjeta de turno o de ruta asignada y `expiraEn`. |
| `RF-PAC-15` | Cancelar pedido en `RESERVADO`, `EN_PREPARACION` o `LISTO` liberando reserva y cancelando turno | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_08`), `portal-paciente.test.ts` (`CA_PAC_08`) | **Cumplido** | Bloquea cancelación en `EN_RUTA` y estados finales (`RN-PAC-06`). |
| `RF-PAC-16` | Historial de pedidos con filtro por estado | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04`, `CA_PAC_11`) | **Cumplido** | Backend paginado `GET /pacientes/me/pedidos?estado=` + UI `/pedidos`. |
| `RF-PAC-17` | Notificaciones in-app para los 9 eventos del paciente (reservado, en preparación, listo, en ruta, entregado, cancelado, vencido, faltante detectado y turno llamado) | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04`), `GestionPedidosTurnosIntegracionTest` (`CA_EMP_04`, `CA_EMP_09`, `CA_EMP_10`, `RF_EMP_13`), `DomiciliosRutasIntegrationTest` (`CA_PAC_10`, `CA_EMP_12`) | **Cumplido** | Implementados los 9 eventos en `NotificacionesEventListener` sobre el puerto `Notificador` (`NotificadorInApp`). |
| `RF-PAC-18` | Contador de no leídas, marcar como leídas y refresco cada 20 s | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04`, listado y lectura) | **Cumplido** | `NotificacionesListadoResponse.noLeidas` + polling cada 20 s en `AppProvider.tsx` (el temporizador de 20 s en cliente no tiene test unitario de componente). |
| `RF-PAC-19` | PWA: manifiesto, iconos, instalable y diseño responsivo mobile-first | *Sin prueba automática de Lighthouse / instalabilidad PWA* (verificado por `npm run build`) | **Parcial** | Implementados `src/app/manifest.ts` (`/manifest.webmanifest`), iconos PNG en `public/icons/`, `public/sw.js` (solo shell, sin caché de datos API según `02 §2`) y diseño mobile-first; sin auditoría automatizada de instalabilidad en navegador móvil. |

### 2.2 Criterios de aceptación (`CA-PAC-01` a `CA-PAC-12`)

| ID | Criterio de aceptación | Prueba automática | Estado |
|---|---|---|---|
| `CA-PAC-01` | Búsqueda pública por "losartán" muestra niveles por sede sin cantidades exactas | `AuthYCatalogoIntegrationTest` (`CA_PAC_01_busquedaPublicaYDisponibilidadPorNivelesSinCantidadesExactas`), `portal-paciente.test.ts` (`CA_PAC_01`) | **Cumplido** |
| `CA-PAC-02` | Vincular fórmula válida aparece en "Mis fórmulas" con ítems y saldos | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_02_vincularFormulaValidaVerDetalleYDescargarPdf`), `portal-paciente.test.ts` (`CA_PAC_02`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** |
| `CA-PAC-03` | Vincular fórmula ajena responde mensaje genérico de no encontrada y no guarda nada | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_03_vincularFormulaAjenaDevuelveMensajeGenericoYNoGuardaNada`), `portal-paciente.test.ts` (`CA_PAC_03`) | **Cumplido** |
| `CA-PAC-04` | Crear pedido `RECOGER`: `RESERVADO`, aumenta stock reservado, genera turno y notifica | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04_crearPedidoRecogerReservaStockGeneraTurnoYNotifica`), `portal-paciente.test.ts` (`CA_PAC_04`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** |
| `CA-PAC-05` | Faltante con `aceptaParcial = false` → `409 STOCK_INSUFICIENTE` con detalle y sin reservar | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_05_faltanteSinAceptarParcialDevuelve409YNoReservaNada`), `portal-paciente.test.ts` (`CA_PAC_05 y CA_PAC_06`) | **Cumplido** |
| `CA-PAC-06` | Faltante con `aceptaParcial = true` → pedido con `es_parcial = true` e ítems `PARCIAL`/`AGOTADO` | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_06_faltanteAceptandoParcialCreaPedidoParcialYRechazaTodoAgotado`), `portal-paciente.test.ts` (`CA_PAC_05 y CA_PAC_06`) | **Cumplido** |
| `CA-PAC-07` | Concurrencia: dos pacientes pidiendo última unidad → solo uno reserva y el otro recibe faltante | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_07_concurrenciaDosPacientesPidiendoUltimaUnidad`), `InventarioConcurrenciaTest` (24 hilos y multi-medicamento) | **Cumplido** |
| `CA-PAC-08` | Cancelar pedido `RESERVADO` → pedido y turno en `CANCELADO` y stock liberado | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_08_cancelarPedidoLiberandoStockYCancelandoTurno`), `portal-paciente.test.ts` (`CA_PAC_08`) | **Cumplido** |
| `CA-PAC-09` | Reserva vencida al consultar detalle pasa a `VENCIDO` y permite crear nuevo pedido | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_09_reservaVencidaEvaluacionPerezosaPermiteNuevoPedido`) | **Cumplido** |
| `CA-PAC-10` | Pedido `DOMICILIO` incluido en ruta iniciada muestra `EN_RUTA` y notifica al paciente | `DomiciliosRutasIntegrationTest` (`CA_PAC_10_domicilioEnRutaNotificacionYEntregaCompleta`), `portal-paciente.test.ts` (`CA_PAC_10`) | **Cumplido** |
| `CA-PAC-11` | Pedido de otro paciente responde `404` (`RN-PAC-07`) | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_11_aislamientoDeDatosPacienteAjenoRecibe404`) | **Cumplido** |
| `CA-PAC-12` | Descargar PDF de fórmula vinculada entrega `application/pdf` con marca de documento simulado | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_02_vincularFormulaValidaVerDetalleYDescargarPdf`), `portal-paciente.test.ts` (`CA_PAC_12`) | **Cumplido** |

---

## 3. App 3 · Panel de empleados (`03-spec-panel-empleados.md`)

### 3.1 Requerimientos funcionales (`RF-EMP-01` a `RF-EMP-34`)

| ID | Requerimiento (resumen) | Prueba automática | Estado | Observaciones |
|---|---|---|---|---|
| `RF-EMP-01` | Login de empleado; JWT con `rol`, `cargo` y `sedeId`; menú y guardas según rol | `AuthYCatalogoIntegrationTest` (`loginEmpleadoIncluyeRolCargoYSedeIdEnJwt`), `panel-empleados.test.ts` (matriz de permisos `03 §3`) | **Cumplido** | Guardas en `RoleGuard` y `PanelShell` + `@PreAuthorize` en backend. |
| `RF-EMP-02` | Tablero operativo de sede: pedidos por estado, turnos del día, medicamentos bajo mínimo y domicilios del día | *Sin prueba automática dedicada del tablero* | **Parcial** | La pantalla `/` muestra todos los indicadores requeridos en `RF-EMP-02`, pero el backend **no expone el endpoint `GET /api/v1/gestion/tablero`** indicado en `03 §6`; el cliente lo compone en `farmaApi.obtenerResumenTablero` consultando `/gestion/pedidos`, `/gestion/turnos` y `/gestion/inventario?bajoMinimo=true` (ver `docs/decisiones.md`). |
| `RF-EMP-03` | Consultar inventario de sede con búsqueda por nombre y filtros "bajo mínimo" y "agotado" | `InventarioGestionIntegrationTest` (`CA_EMP_01_alcancePorSede`, `permisosPorRolYCargoFiltrosYStockMinimo`) | **Cumplido** | Muestra física, reservada, disponible y stock mínimo en `/inventario`. |
| `RF-EMP-04` | Registrar entrada de stock generando movimiento `ENTRADA` | `InventarioGestionIntegrationTest` (`CA_EMP_02_entradaDeStockYRegistroEnKardex`) | **Cumplido** | Restringido a `FARMACEUTICO` y `ADMIN`. |
| `RF-EMP-05` | Registrar ajuste positivo/negativo con motivo obligatorio sin dejar `cantidad_fisica < cantidad_reservada` | `InventarioGestionIntegrationTest` (`CA_EMP_03_ajusteInvalidoNoDejaFisicoMenorQueReservado`) | **Cumplido** | Motivo obligatorio (`RN-EMP-03`) y manejo de reserva excedente (`RN-EMP-07`). |
| `RF-EMP-06` | Consultar kárdex por medicamento y sede con filtros de fecha y tipo de movimiento | `InventarioGestionIntegrationTest` (`CA_EMP_02_entradaDeStockYRegistroEnKardex`, `operacionesInternasReservaLiberacionYDispensacionEscribenKardex`) | **Cumplido** | Backend `GET /gestion/inventario/{id}/kardex` + UI `/inventario/[medicamentoId]/kardex`. |
| `RF-EMP-07` | Editar `stock_minimo` de un medicamento en la sede | `InventarioGestionIntegrationTest` (`permisosPorRolYCargoFiltrosYStockMinimo`) | **Cumplido** | Backend `PATCH /gestion/inventario/{id}` + UI `/inventario`. |
| `RF-EMP-08` | Bandeja de pedidos con filtros (estado, modalidad, fecha) ordenada por urgencia (`expira_en`) | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_04`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | Backend `GET /gestion/pedidos` + UI `/pedidos`. |
| `RF-EMP-09` | Detalle de pedido: paciente, fórmula, ítems, turno o dirección, historial | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_04`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | Backend `GET /gestion/pedidos/{id}` + UI `/pedidos/[id]`. |
| `RF-EMP-10` | Tomar pedido (`RESERVADO → EN_PREPARACION`) y marcar `LISTO` con nota opcional | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_04`, `CA_EMP_06`), `panel-empleados.test.ts` (`CA_EMP_04`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | Respeta asignación exclusiva en `EN_PREPARACION` (`RN-EMP-04`). |
| `RF-EMP-11` | Entregar pedido `RECOGER` verificando documento del paciente y registrando dispensación (`RN-06`) | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_04`, `CA_EMP_05`), `panel-empleados.test.ts` (`CA_EMP_04`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** | Verifica `documentoVerificado` (`RN-EMP-02`) y encola evento outbox en la misma transacción. |
| `RF-EMP-12` | Cancelar pedido antes de `ENTREGADO` con motivo obligatorio y notificar al paciente | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_06_transicionInvalidaYReglaDeAsignacion`) | **Cumplido** | Motivo en blanco responde `400 VALIDACION_ERROR`; cancelación libera stock y notifica. |
| `RF-EMP-13` | Ajuste negativo por diferencia física reduce reserva del pedido más reciente, marca `es_parcial` y notifica | `GestionPedidosTurnosIntegracionTest` (`RF_EMP_13_ajusteNegativoReduceReservaDePedidoMasRecienteYNotifica`) | **Cumplido** | Implementado vía `AjusteReservaExcedenteHandlerImpl` (`RN-EMP-07`). |
| `RF-EMP-14` | *(Fase H3)* Traslado entre dos sedes (`TRASLADO_SALIDA` / `TRASLADO_ENTRADA`) en una transacción | — | **Fuera de alcance** | Excluido explícitamente por decisión en `docs/entorno.md` ("Traslados: no"), `04 §1` y `03 §2` ("Fuera"). No existe `POST /gestion/traslados` ni pantalla de traslados. |
| `RF-EMP-15` | Cola de turnos del día ordenada por franja y número | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_10`) | **Cumplido** | Backend `GET /gestion/turnos` + UI `/turnos`. |
| `RF-EMP-16` | Llamar siguiente turno (`EN_ESPERA → LLAMADO`) y notificar al paciente | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_10`) | **Cumplido** | Backend `POST /gestion/turnos/llamar-siguiente` + evento `TurnoLlamadoEvent`. |
| `RF-EMP-17` | Turno pasa a `ATENDIDO` al entregar; marcar no presentado como `VENCIDO` (vence pedido y libera stock) | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_04`, `CA_EMP_10`) | **Cumplido** | Backend `POST /gestion/turnos/{id}/vencer` + UI `/turnos`. |
| `RF-EMP-18` | Pantalla pública de sala (`/sala/{sedeCodigo}`) sin autenticación ni datos personales | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_10`) | **Cumplido** | Backend `GET /gestion/public/sala/{sedeCodigo}` (`permitAll`) + UI `/sala/[sede]` con refresco cada 10 s. |
| `RF-EMP-19` | Ver pedidos `DOMICILIO` en estado `LISTO` sobre mapa con sede como origen | `DomiciliosRutasIntegrationTest` (`CA_EMP_11`) | **Cumplido** | Backend `GET /gestion/domicilios/pendientes` + UI `/domicilios` (Leaflet). |
| `RF-EMP-20` | Seleccionar pedidos (hasta `domicilio.max_paradas`), elegir domiciliario y generar ruta con heurístico | `HeuristicoRutaServiceTest` (3 pruebas), `DomiciliosRutasIntegrationTest` (`CA_EMP_11`), `panel-empleados.test.ts` (`CA_EMP_11 y CA_EMP_12`) | **Cumplido** | Haversine + vecino más cercano + pasada 2-opt sin regreso obligatorio a sede (`03 §5`). |
| `RF-EMP-21` | Reordenar manualmente paradas antes de iniciar; al iniciar ruta pasa a `EN_CURSO` y pedidos a `EN_RUTA` | `DomiciliosRutasIntegrationTest` (`CA_EMP_11`, `CA_PAC_10`), `panel-empleados.test.ts` (`CA_EMP_11 y CA_EMP_12`) | **Cumplido** | Backend `PUT /gestion/rutas/{id}/orden` y `POST /gestion/rutas/{id}/iniciar` + UI `/domicilios`. |
| `RF-EMP-22` | Domiciliario ve ruta del día con mapa y marca paradas entregadas o fallidas con motivo | `DomiciliosRutasIntegrationTest` (`CA_PAC_10`, `CA_EMP_12`, `CA_EMP_13`), `panel-empleados.test.ts` (`CA_EMP_11 y CA_EMP_12`) | **Cumplido** | Backend `GET /gestion/rutas/mias`, `.../entregar`, `.../fallida` + UI `/mi-ruta`. |
| `RF-EMP-23` | Parada fallida regresa pedido a `LISTO` e incrementa intentos; al alcanzar `domicilio.max_intentos`, `CANCELADO` con liberación | `DomiciliosRutasIntegrationTest` (`CA_EMP_12_paradaFallidaReintentoYCancelacionAlAgotarIntentos`), `panel-empleados.test.ts` (`CA_EMP_11 y CA_EMP_12`) | **Cumplido** | Soportado por índice único parcial en `V5__ruta_parada_reintentos.sql`. |
| `RF-EMP-24` | Ruta pasa a `COMPLETADA` cuando todas sus paradas quedan resueltas | `DomiciliosRutasIntegrationTest` (`CA_PAC_10`, `CA_EMP_12`) | **Cumplido** | Transición automática al resolver la última parada `PENDIENTE`. |
| `RF-EMP-25` | Alerta `STOCK_BAJO` a empleados de la sede una vez por cruce (`RN-07`) y visibilidad en tablero | `InventarioGestionIntegrationTest` (`CA_EMP_08_alertaStockMinimoUnaSolaVezPorCruce`) | **Cumplido** | Publica `StockBajoEvent` y genera notificación in-app `STOCK_BAJO`. |
| `RF-EMP-26` | Notificación a empleados de la sede ante nuevos pedidos | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04_crearPedidoRecogerReservaStockGeneraTurnoYNotifica`) | **Cumplido** | Publica `PedidoCreadoEvent` → notificación `NUEVO_PEDIDO`. |
| `RF-EMP-27` | Alerta al `ADMIN` cuando un evento de integración queda en `ERROR` (`RN-06`) | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_07_simuladorCaidoOutboxReintentoExitosoYErrorDefinitivo`) | **Cumplido** | Publica `IntegracionErrorEvent` → notificación `INTEGRACION_ERROR`. |
| `RF-EMP-28` | Reportes por sede y rango: pedidos por estado/día, tiempos preparación/entrega, turnos por franja y ranking de faltantes | `ReportesYAdminIntegrationTest` (`CA_EMP_14_reporteTiemposYReportesAgregadosPorSedeYRango`) | **Cumplido** | Consultas SQL agregadas en `ReportesService` con zona `America/Bogota`. |
| `RF-EMP-29` | Reportes con gráficos, tablas y exportación de tabla a CSV | `panel-empleados.test.ts` (`CA_EMP_14`) | **Cumplido** | UI `/reportes` con Recharts y exportación CSV RFC 4180 + BOM UTF-8 (`src/lib/csv.ts`). |
| `RF-EMP-30` | `ADMIN`: crear, editar y desactivar sedes (horario y coordenadas) | `ReportesYAdminIntegrationTest` (`RF_EMP_30_a_33_administracionSedesEmpleadosCatalogoYParametros`) | **Cumplido** | Backend `/gestion/admin/sedes` + UI `/admin`. |
| `RF-EMP-31` | `ADMIN`: crear, editar y desactivar empleados con cargo y sede | `ReportesYAdminIntegrationTest` (`RF_EMP_30_a_33_administracionSedesEmpleadosCatalogoYParametros`) | **Cumplido** | Backend `/gestion/admin/empleados` + UI `/admin`. |
| `RF-EMP-32` | `ADMIN`: crear, editar y desactivar medicamentos; crear genera inventario en cero por sede activa | `ReportesYAdminIntegrationTest` (`RF_EMP_30_a_33_administracionSedesEmpleadosCatalogoYParametros`) | **Cumplido** | Backend `/gestion/admin/medicamentos` + inicialización idempotente de inventario en cero + UI `/admin`. |
| `RF-EMP-33` | `ADMIN`: editar parámetros de `00 §6.3` | `ReportesYAdminIntegrationTest` (`RF_EMP_30_a_33_administracionSedesEmpleadosCatalogoYParametros`) | **Cumplido** | Backend `/gestion/admin/parametros` + UI `/admin`. |
| `RF-EMP-34` | `ADMIN`: consultar y reintentar manualmente eventos de integración en estado `ERROR` | `ReportesYAdminIntegrationTest` (`RF_EMP_34_outboxConsultarEventosYReintentoManualExitoso`), `panel-empleados.test.ts` (`cliente tipado de administración...`) | **Cumplido** | Backend `/gestion/admin/integracion/eventos` y `/reintentar` + UI `/admin`. |

### 3.2 Criterios de aceptación (`CA-EMP-01` a `CA-EMP-14`)

| ID | Criterio de aceptación | Prueba automática | Estado |
|---|---|---|---|
| `CA-EMP-01` | Alcance por sede: empleado de sede A no accede a datos de sede B (`403`/`404`) | `InventarioGestionIntegrationTest` (`CA_EMP_01_alcancePorSede`) | **Cumplido** |
| `CA-EMP-02` | Entrada de stock (10 + 40 = 50), movimiento `ENTRADA` con saldo 50 visible en kárdex | `InventarioGestionIntegrationTest` (`CA_EMP_02_entradaDeStockYRegistroEnKardex`) | **Cumplido** |
| `CA-EMP-03` | Ajuste negativo con físico < reservado aplica `RN-EMP-07` o rechaza sin violar invariante | `InventarioGestionIntegrationTest` (`CA_EMP_03_ajusteInvalidoNoDejaFisicoMenorQueReservado`), `GestionPedidosTurnosIntegracionTest` (`RF_EMP_13_...`) | **Cumplido** |
| `CA-EMP-04` | Flujo completo `RECOGER` (tomar, `LISTO`, entregar con documento) → `ENTREGADO`, stock, turno `ATENDIDO`, historial y outbox `PENDIENTE` | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_04_flujoCompletoPedidoRecogerYCreacionOutbox`), `panel-empleados.test.ts` (`CA_EMP_04`), `e2e/tests/h1-flujo-completo.spec.ts` | **Cumplido** |
| `CA-EMP-05` | Entregar pedido `LISTO` con documento incorrecto → `422` sin cambiar estado | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_05_entregarConDocumentoIncorrectoDevuelve422YSinCambiarEstado`), `panel-empleados.test.ts` (`maneja errores problem+json...`) | **Cumplido** |
| `CA-EMP-06` | Entregar pedido `RESERVADO` sin preparar → `409 TRANSICION_INVALIDA` | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_06_transicionInvalidaYReglaDeAsignacion`), `panel-empleados.test.ts` (`maneja errores problem+json...`) | **Cumplido** |
| `CA-EMP-07` | Simulador caído al entregar → entrega completa, outbox `PENDIENTE` y reintento posterior `ENVIADO` | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_07_simuladorCaidoOutboxReintentoExitosoYErrorDefinitivo`) | **Cumplido** |
| `CA-EMP-08` | Alerta `STOCK_BAJO` una sola vez por cruce del mínimo | `InventarioGestionIntegrationTest` (`CA_EMP_08_alertaStockMinimoUnaSolaVezPorCruce`) | **Cumplido** |
| `CA-EMP-09` | Vencimiento automático (job `ExpirarReservas` y lectura perezosa) de pedido `LISTO` expirado → `VENCIDO`, liberación y notificación | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_09_vencimientoAutomaticoDePedidoListoPorJobYConsulta`) | **Cumplido** |
| `CA-EMP-10` | Llamar siguiente turno → `LLAMADO`, visible en pantalla de sala y notificación al paciente | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_10_llamarSiguienteTurnoPantallaSalaVencerTurnoYSincronizarFormulas`) | **Cumplido** |
| `CA-EMP-11` | Generar ruta con 5 pedidos `DOMICILIO` en `LISTO`: paradas ordenadas, distancia estimada y respeto de `domicilio.max_paradas` | `DomiciliosRutasIntegrationTest` (`CA_EMP_11_generarRutaConHeuristicoReordenYMaximoDeParadas`), `HeuristicoRutaServiceTest`, `panel-empleados.test.ts` (`CA_EMP_11 y CA_EMP_12`) | **Cumplido** |
| `CA-EMP-12` | Parada fallida en intento final (`domicilio.max_intentos = 2`) → pedido `CANCELADO` y stock liberado | `DomiciliosRutasIntegrationTest` (`CA_EMP_12_paradaFallidaReintentoYCancelacionAlAgotarIntentos`), `panel-empleados.test.ts` (`CA_EMP_11 y CA_EMP_12`) | **Cumplido** |
| `CA-EMP-13` | Permisos de domiciliario: inventario y ruta ajena responden `403` | `DomiciliosRutasIntegrationTest` (`CA_EMP_13_permisosDeDomiciliario`), `panel-empleados.test.ts` (matriz de permisos `03 §3`) | **Cumplido** |
| `CA-EMP-14` | Reporte de tiempos con promedios de preparación/entrega y exportación CSV | `ReportesYAdminIntegrationTest` (`CA_EMP_14_reporteTiemposYReportesAgregadosPorSedeYRango`), `panel-empleados.test.ts` (`CA_EMP_14`) | **Cumplido** |

---

## 4. Verificaciones transversales (arquitectura `00` e hito H1)

| Elemento | Prueba automática | Estado |
|---|---|---|
| Esquema BD, semillas y checks (`fisico >= reservado`, `dispensada <= autorizada`) | `EsquemaYChecksTest` (3 pruebas) | **Cumplido** |
| Arranque de aplicación y `/api/v1/health` sin autenticación | `FarmagestionApiApplicationTests` (2 pruebas), `api-servicio.test.ts` (`GET /api/v1/health`) | **Cumplido** |
| Contrato OpenAPI sincronizado con `/v3/api-docs` y `contracts/eps-simulador.openapi.yaml` | `OpenApiContractTest`, `AuthYCatalogoIntegrationTest` (`openApiExponeEndpoints...`), `api-servicio.test.ts` (validación Ajv contra OpenAPI) | **Cumplido** |
| Concurrencia de reservas (24 hilos, multi-medicamento en orden opuesto sin interbloqueo, `RN-01`) | `InventarioConcurrenciaTest` (3 pruebas) | **Cumplido** |
| Control `403` en `/api/v1/gestion/admin/**` para cualquier empleado no `ADMIN` | `ReportesYAdminIntegrationTest` (`controlAcceso403EnAdminParaCualquierEmpleadoNoAdmin`), `panel-empleados.test.ts` | **Cumplido** |
| CORS restringido a orígenes permitidos (`00 §5`) | `AuthYCatalogoIntegrationTest` (`corsSoloPermiteOrigenesConfigurados`) | **Cumplido** |
| Hito H1 punta a punta (Simulador → Portal → API → Panel → Outbox → Simulador) | `e2e/tests/h1-flujo-completo.spec.ts` (Playwright, parametrizada con `E2E_*`) + `scripts/precalentar.sh` | **Cumplido** |

---

## 5. Detalle de puntos parciales y fuera de alcance

### Puntos parciales (sin maquillar)

1. **`RF-EPS-01` y `RF-EPS-02` (Simulador EPS · CRUD y unicidad de pacientes):** los endpoints `/api/admin/pacientes`, `/api/admin/pacientes/[id]`, la restricción `UNIQUE(tipo_documento, documento)` y la pantalla `PacientesView.tsx` están implementados y operativos, pero no cuentan con una prueba automática HTTP dedicada en `admin-y-pdf.test.ts` que verifique creación, búsqueda, edición y respuesta `409` por documento duplicado.
2. **`RF-EMP-02` (Panel de empleados · Tablero operativo):** la pantalla principal (`/`) muestra los cuatro grupos de indicadores exigidos (pedidos por estado, turnos del día, medicamentos bajo mínimo y domicilios del día), pero el backend no implementa el endpoint `GET /api/v1/gestion/tablero` listado en `03 §6`. En su lugar, el cliente compone los contadores mediante llamadas paralelas a `/gestion/pedidos`, `/gestion/turnos` y `/gestion/inventario` (`docs/decisiones.md`), y esa composición no tiene prueba automática dedicada.
3. **`RF-PAC-19` (Portal del paciente · PWA):** el manifiesto (`/manifest.webmanifest`), los iconos PNG (192, 512, maskable y Apple Touch), el `sw.js` mínimo para caché de shell y el diseño mobile-first están implementados, pero no existe una prueba automatizada de instalabilidad PWA ni de auditoría Lighthouse en el repositorio.
4. **Cobertura complementaria no ejercitada en tests unitarios (funcionalidad implementada):**
   - `RF-EPS-05`: filtros por `estado` y rango de fechas (`desde`/`hasta`) en `GET /api/admin/formulas` están implementados pero sin prueba unitaria dedicada.
   - `RF-EPS-06`: la validación que impide anular una fórmula que ya tiene dispensaciones está implementada en el handler, pero la prueba cubre solo anular en `EMITIDA` y re-anular en `ANULADA`.
   - `RF-PAC-18`: el polling cada 20 segundos en `AppProvider.tsx` está implementado pero sin test unitario de componente con temporizador.

### Elementos fuera de alcance (por diseño y decisión del equipo)

- **`RF-EMP-14` (Traslados entre sedes, `POST /api/v1/gestion/traslados`):** excluido explícitamente en `docs/entorno.md` ("Traslados: no"), `04-preparacion-entorno.md §1` y `03-spec-panel-empleados.md §2`.
- **Notificaciones por correo, SMS o push:** excluido en `docs/entorno.md` ("Correo: no") y `00 §2` (L5). El backend deja el puerto `Notificador` desacoplado con la implementación `NotificadorInApp`.
- **Limitaciones globales declaradas (`00 §2` L1–L10, `01 §2`, `02 §2`, `03 §2`):** datos 100 % sintéticos sin integración con EPS/IPS reales, PDFs sin validez clínica ni legal, inventario sin lotes/vencimientos/cadena de frío/controlados, sin pagos/copagos/facturación, sin cuidadores ni terceros, sin geocodificación automática ni GPS en vivo, sin modo sin conexión de datos, sin compras a proveedores ni nómina, y sin cumplimiento productivo de protección de datos de salud reales.
