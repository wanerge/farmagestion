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
