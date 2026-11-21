# Matriz de trazabilidad — FarmaGestión

Se actualiza al cierre de cada prompt con los RF y CA cubiertos.

| RF | CA | Prueba automática | Estado |
|---|---|---|---|
| RF-EPS-01, RF-EPS-02 | — | CRUD `/api/admin/pacientes` + UI | Cumplido |
| RF-EPS-03, RF-EPS-04 | CA-EPS-01 | `admin-y-pdf.test.ts` (`CA_EPS_01`) | Cumplido |
| RF-EPS-05 | CA-EPS-01 | `admin-y-pdf.test.ts` (`CA_EPS_01`) | Cumplido |
| RF-EPS-06 | — | `admin-y-pdf.test.ts` (`RF-EPS-06`) | Cumplido |
| RF-EPS-07 | CA-EPS-09 | `admin-y-pdf.test.ts` (`CA_EPS_09`), `api-servicio.test.ts` (`CA_EPS_09`) | Cumplido |
| RF-EPS-08 | CA-EPS-07 | `api-servicio.test.ts` (`CA_EPS_07`) | Cumplido |
| RF-EPS-09 | CA-EPS-06 | `api-servicio.test.ts` (`CA_EPS_06`) | Cumplido |
| RF-EPS-10 | CA-EPS-04, CA-EPS-05 | `api-servicio.test.ts` (`CA_EPS_04`, `CA_EPS_05`) | Cumplido |
| RF-EPS-11, RF-EPS-12 | — | `admin-y-pdf.test.ts` (`RF-EPS-11 y RF-EPS-12`) | Cumplido |
| RN-EPS-05 | CA-EPS-02, CA-EPS-03 | `api-servicio.test.ts` (`CA_EPS_02`, `CA_EPS_03`) | Cumplido |
| Seguridad API | CA-EPS-08 | `api-servicio.test.ts` (`CA_EPS_08`) | Cumplido |
| RF-PAC-01, RF-PAC-02, RF-PAC-03 | — | `AuthYCatalogoIntegrationTest` (`registroYLoginPacienteYEdicionPerfil`), UI `/registro`, `/login`, `/perfil` | Cumplido |
| RF-PAC-04, RF-PAC-05, RN-10 | CA-PAC-01 | `AuthYCatalogoIntegrationTest` (`CA_PAC_01_busquedaPublicaYDisponibilidadPorNivelesSinCantidadesExactas`), `portal-paciente.test.ts` (`CA_PAC_01`), UI `/` y `/sedes` (Leaflet + OpenStreetMap) | Cumplido |
| RF-PAC-06, RF-PAC-07, RF-PAC-08, RF-PAC-09, RN-04, RN-PAC-01 a 02 | CA-PAC-02, CA-PAC-03, CA-PAC-12 | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_02`, `CA_PAC_03`), `portal-paciente.test.ts` (`CA_PAC_02`, `CA_PAC_03`, `CA_PAC_12`), UI `/formulas` y `/formulas/[id]` | Cumplido |
| RF-PAC-10, RF-PAC-11, RN-01, RN-PAC-05 | CA-PAC-04 | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04_crearPedidoRecogerReservaStockGeneraTurnoYNotifica`), `portal-paciente.test.ts` (`CA_PAC_04`), UI `/pedidos/nuevo` (`RECOGER`) | Cumplido |
| RF-PAC-12 | — | `PortalPacienteFlujosIntegrationTest` (`reglasNegocio_RN03_RN04_RNPAC03_RNPAC04_RNPAC05_yDomicilio`) | Parcial (creación de pedido `DOMICILIO` en backend; rutas y UI en P10) |
| RF-PAC-13, RN-02 | CA-PAC-05, CA-PAC-06, CA-PAC-07 | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_05`, `CA_PAC_06`, `CA_PAC_07`), `portal-paciente.test.ts` (`CA_PAC_05 y CA_PAC_06`), UI `/pedidos/nuevo` (modal `409 STOCK_INSUFICIENTE`) | Cumplido |
| RF-PAC-14, RF-PAC-15, RF-PAC-16, RN-05, RN-PAC-06, RN-PAC-07 | CA-PAC-08, CA-PAC-09, CA-PAC-11 | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_08`, `CA_PAC_09`, `CA_PAC_11`), `portal-paciente.test.ts` (`CA_PAC_08`), UI `/pedidos` y `/pedidos/[id]` | Cumplido |
| RF-PAC-17, RF-PAC-18 | — | `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04`), `GestionPedidosTurnosIntegracionTest` (`CA_EMP_09`, `CA_EMP_10`, `RF_EMP_13`), UI `/notificaciones` y polling cada 20 s en `AppProvider` | Cumplido |
| RF-PAC-19 | — | `apps/portal-paciente`: `src/app/manifest.ts` (`/manifest.webmanifest`), iconos PNG en `public/icons/`, `public/sw.js` y diseño mobile-first | Cumplido |
| RF-EMP-01, RN-09 | CA-EMP-01 | `AuthYCatalogoIntegrationTest` (`loginEmpleadoIncluyeRolCargoYSedeIdEnJwt`), `InventarioGestionIntegrationTest` (`CA_EMP_01_alcancePorSede`), `GestionPedidosTurnosIntegracionTest` (`CA_EMP_04_flujoCompletoPedidoRecogerYCreacionOutbox`), `panel-empleados.test.ts` (guardas por rol `03 §3`) | Cumplido |
| RF-EMP-02 | — | `apps/panel-empleados` Tablero operativo (`/`, composición de pedidos por estado, turnos del día, stock bajo mínimo y domicilios del día) | Cumplido |
| RF-EMP-03, RF-EMP-07 | — | `InventarioGestionIntegrationTest` (`CA_EMP_01_alcancePorSede`, `permisosPorRolYCargoFiltrosYStockMinimo`), UI `/inventario` | Cumplido |
| RF-EMP-04, RF-EMP-06, RN-08 | CA-EMP-02 | `InventarioGestionIntegrationTest` (`CA_EMP_02_entradaDeStockYRegistroEnKardex`), UI `/inventario` y `/inventario/[medicamentoId]/kardex` | Cumplido |
| RF-EMP-05, RF-EMP-13, RN-EMP-03, RN-EMP-07 | CA-EMP-03 | `InventarioGestionIntegrationTest` (`CA_EMP_03_ajusteInvalidoNoDejaFisicoMenorQueReservado`), `GestionPedidosTurnosIntegracionTest` (`RF_EMP_13_ajusteNegativoReduceReservaDePedidoMasRecienteYNotifica`), UI `/inventario` y `/pedidos/[id]` | Cumplido |
| RF-EMP-08, RF-EMP-09, RF-EMP-10, RF-EMP-11, RF-EMP-12, RN-EMP-01, RN-EMP-02, RN-EMP-04 | CA-EMP-04, CA-EMP-05, CA-EMP-06 | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_04`, `CA_EMP_05`, `CA_EMP_06`), `panel-empleados.test.ts` (`CA_EMP_04`, manejo `problem+json` `422`/`409`), UI `/pedidos` y `/pedidos/[id]` | Cumplido |
| RN-06, RF-EMP-27 | CA-EMP-07 | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_07_simuladorCaidoOutboxReintentoExitosoYErrorDefinitivo`) | Cumplido (backend; UI admin outbox en P11) |
| RF-EMP-25, RN-07 | CA-EMP-08 | `InventarioGestionIntegrationTest` (`CA_EMP_08_alertaStockMinimoUnaSolaVezPorCruce`), UI `/notificaciones` y tablero (`/`) | Cumplido |
| RN-05, Tareas `00 §11` (`ExpirarReservas`, `VencerTurnos`, `ReintentarOutbox`, `SincronizarFormulas`) | CA-EMP-09 | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_09_vencimientoAutomaticoDePedidoListoPorJobYConsulta`, `CA_EMP_10_llamarSiguienteTurnoPantallaSalaVencerTurnoYSincronizarFormulas`, `CA_EMP_07_simuladorCaidoOutboxReintentoExitosoYErrorDefinitivo`) | Cumplido |
| RF-EMP-15, RF-EMP-16, RF-EMP-17, RF-EMP-18, RF-EMP-26 | CA-EMP-10 | `GestionPedidosTurnosIntegracionTest` (`CA_EMP_10_llamarSiguienteTurnoPantallaSalaVencerTurnoYSincronizarFormulas`), `PortalPacienteFlujosIntegrationTest` (`CA_PAC_04_crearPedidoRecogerReservaStockGeneraTurnoYNotifica`), UI `/turnos`, `/sala/[sede]` y `/notificaciones` | Cumplido |
| RN-01, RN-08 | — | `InventarioConcurrenciaTest`, `InventarioGestionIntegrationTest` (`operacionesInternasReservaLiberacionYDispensacionEscribenKardex`), `OpenApiContractTest` | Cumplido |
