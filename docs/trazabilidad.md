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
| RF-PAC-01, RF-PAC-02, RF-PAC-03 | — | `AuthYCatalogoIntegrationTest` (`registroYLoginPacienteYEdicionPerfil`) | Cumplido |
| RF-PAC-04, RF-PAC-05, RN-10 | CA-PAC-01 | `AuthYCatalogoIntegrationTest` (`CA_PAC_01_busquedaPublicaYDisponibilidadPorNivelesSinCantidadesExactas`) | Cumplido |
| RF-EMP-01, RN-09 | CA-EMP-01 | `AuthYCatalogoIntegrationTest` (`loginEmpleadoIncluyeRolCargoYSedeIdEnJwt`), `InventarioGestionIntegrationTest` (`CA_EMP_01_alcancePorSede`) | Cumplido |
| RF-EMP-03, RF-EMP-07 | — | `InventarioGestionIntegrationTest` (`CA_EMP_01_alcancePorSede`, `permisosPorRolYCargoFiltrosYStockMinimo`) | Cumplido |
| RF-EMP-04, RF-EMP-06, RN-08 | CA-EMP-02 | `InventarioGestionIntegrationTest` (`CA_EMP_02_entradaDeStockYRegistroEnKardex`) | Cumplido |
| RF-EMP-05, RN-EMP-03 | CA-EMP-03 | `InventarioGestionIntegrationTest` (`CA_EMP_03_ajusteInvalidoNoDejaFisicoMenorQueReservado`) | Cumplido (gancho `RN-EMP-07` se conecta en P6) |
| RF-EMP-25, RN-07 | CA-EMP-08 | `InventarioGestionIntegrationTest` (`CA_EMP_08_alertaStockMinimoUnaSolaVezPorCruce`) | Parcial (evento `StockBajoEvent` publicado; notificación in-app en P6) |
| RN-01, RN-08 | — | `InventarioConcurrenciaTest`, `InventarioGestionIntegrationTest` (`operacionesInternasReservaLiberacionYDispensacionEscribenKardex`) | Cumplido (servicio interno de inventario; pedidos en P6) |
