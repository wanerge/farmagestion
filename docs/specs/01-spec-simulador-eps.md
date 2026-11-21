# 01 · Spec — App 1: Simulador EPS (generador de fórmulas)

> Depende de `00-arquitectura-y-contratos.md` (modelo de datos `eps_db`, contrato de integración §9, convenciones y limitaciones globales).

| Campo | Valor |
|---|---|
| Producto | `simulador-eps` |
| Stack | Next.js (App Router, route handlers) + TypeScript + Prisma + `pdf-lib` |
| Despliegue | Vercel, base `eps_db` en Neon |
| Estado | Borrador v0.1 |

---

## 1. Propósito

Representar al sistema externo que emite la fórmula médica del paciente (EPS o IPS). Existe para que el resto de la simulación tenga un punto de partida realista: el paciente llega a FarmaGestión con una fórmula emitida por un tercero, y FarmaGestión la valida, la consume y le informa de cada dispensación.

No hace parte de la solución propuesta a la organización. Es el origen de los datos.

## 2. Alcance

### Dentro

- Gestión de pacientes de la EPS simulada.
- Emisión, consulta, anulación y descarga en PDF de fórmulas.
- API de servicio para que `farmagestion-api` consulte fórmulas y registre dispensaciones.
- Control de cantidades autorizadas contra cantidades dispensadas.
- Generación de datos de demostración.

### Fuera

- Historia clínica, diagnósticos, órdenes de exámenes o autorizaciones.
- Validación clínica (interacciones, dosis máximas).
- Autenticación de médicos o pacientes. El acceso es de un solo operador de demo.
- Cualquier integración real.

## 3. Actores

| Actor | Acceso |
|---|---|
| Operador de demo | Interfaz web protegida con la contraseña `DEMO_ADMIN_PASSWORD` (sesión por cookie) |
| `farmagestion-api` | API de servicio con cabecera `X-API-Key` |

## 4. Requerimientos funcionales

### Pacientes

| ID | Requerimiento |
|---|---|
| RF-EPS-01 | El operador puede crear, listar, buscar (por documento o nombre) y editar pacientes de la EPS. |
| RF-EPS-02 | El par `(tipoDocumento, documento)` es único. Un duplicado devuelve error de validación. |

### Fórmulas

| ID | Requerimiento |
|---|---|
| RF-EPS-03 | El operador emite una fórmula eligiendo paciente, médico (de una lista semilla) y entre 1 y 10 ítems del catálogo con dosis, frecuencia, duración y cantidad autorizada. |
| RF-EPS-04 | Al emitir, se genera el `codigo` con formato `FRM-{año}-{secuencial de 6 dígitos}` y la vigencia por defecto es de 30 días desde la emisión (configurable por emisión). |
| RF-EPS-05 | El operador puede listar fórmulas con filtros por estado, paciente y rango de fechas, y ver el detalle con el historial de dispensaciones. |
| RF-EPS-06 | El operador puede anular una fórmula en estado `EMITIDA` sin dispensaciones. Anular una fórmula con dispensaciones no está permitido. |
| RF-EPS-07 | El sistema genera un PDF de la fórmula con paciente, médico, ítems, vigencia, código y la marca "DOCUMENTO SIMULADO — SIN VALIDEZ CLÍNICA". |
| RF-EPS-08 | El estado `VENCIDA` se calcula por fecha: toda fórmula no dispensada por completo con `fechaVencimiento < hoy` se trata como vencida al consultarla, sin necesidad de una tarea programada. |

### Dispensaciones

| ID | Requerimiento |
|---|---|
| RF-EPS-09 | El API de servicio registra dispensaciones con `Idempotency-Key`. Una repetición con la misma clave devuelve el resultado original sin duplicar. |
| RF-EPS-10 | Tras cada dispensación el estado de la fórmula pasa a `PARCIALMENTE_DISPENSADA` si algún ítem tiene saldo, o a `DISPENSADA` si todos están completos. |

### Datos de demostración

| ID | Requerimiento |
|---|---|
| RF-EPS-11 | Un botón "Cargar datos demo" crea 5 pacientes ficticios, 4 médicos y 8 fórmulas variadas, incluyendo una próxima a vencer y una ya vencida. El proceso es repetible sin duplicar. |
| RF-EPS-12 | Un botón "Reiniciar demo" borra fórmulas y dispensaciones y vuelve a cargar los datos demo. Está protegido por confirmación. |

## 5. Reglas de negocio

| ID | Regla |
|---|---|
| RN-EPS-01 | `0 <= cantidadDispensada <= cantidadAutorizada` en todo momento (restricción en base de datos y validación en servicio). |
| RN-EPS-02 | Una fórmula no puede tener dos ítems del mismo medicamento. |
| RN-EPS-03 | No se dispensa una fórmula `ANULADA` ni `VENCIDA`. |
| RN-EPS-04 | La dispensación solo acepta medicamentos que pertenecen a la fórmula. |
| RN-EPS-05 | La consulta de una fórmula por el API de servicio exige código y documento coincidentes. Ante cualquier discrepancia responde `404` sin distinguir la causa. |
| RN-EPS-06 | La dispensación es transaccional: o se aplican todos los ítems o ninguno. |

## 6. Operaciones

### 6.1 API de servicio (consumida por `farmagestion-api`)

Contrato completo en `00-arquitectura-y-contratos.md` §9 y en `contracts/eps-simulador.openapi.yaml`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/formulas/{codigo}?documento=` | Consulta de fórmula |
| GET | `/api/v1/formulas/{codigo}/pdf?documento=` | PDF de la fórmula |
| POST | `/api/v1/formulas/{codigo}/dispensaciones` | Registro idempotente de dispensación |
| GET | `/api/v1/health` | Estado del servicio |

### 6.2 API interna de la interfaz (protegida por sesión del operador)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/admin/login` | Inicia sesión con la contraseña de demo |
| GET / POST | `/api/admin/pacientes` | Listar y crear pacientes |
| PUT | `/api/admin/pacientes/{id}` | Editar paciente |
| GET | `/api/admin/medicos` | Lista de médicos |
| GET | `/api/admin/medicamentos` | Catálogo para el formulario |
| GET / POST | `/api/admin/formulas` | Listar y emitir fórmulas |
| GET | `/api/admin/formulas/{id}` | Detalle con dispensaciones |
| POST | `/api/admin/formulas/{id}/anular` | Anular fórmula |
| POST | `/api/admin/demo/cargar` | Cargar datos demo |
| POST | `/api/admin/demo/reiniciar` | Reiniciar demo |

## 7. Pantallas

| Pantalla | Contenido |
|---|---|
| Inicio de sesión | Campo de contraseña de demo |
| Pacientes | Tabla con búsqueda, formulario de alta y edición |
| Emitir fórmula | Selector de paciente y médico, tabla editable de ítems, vigencia |
| Fórmulas | Tabla con filtros y estado visible |
| Detalle de fórmula | Datos, ítems con saldo, dispensaciones, botones de PDF y anular |
| Demo | Botones de carga y reinicio |

## 8. Criterios de aceptación

**CA-EPS-01 · Emitir fórmula**
- Dado un paciente existente y un médico,
- cuando el operador emite una fórmula con 2 ítems válidos,
- entonces se crea con estado `EMITIDA`, un `codigo` único, vigencia de 30 días y aparece en el listado.

**CA-EPS-02 · Consulta con documento correcto**
- Dada una fórmula emitida,
- cuando el backend consulta `GET /formulas/{codigo}?documento=` con el documento del paciente,
- entonces recibe `200` con los ítems y los saldos.

**CA-EPS-03 · Consulta con documento incorrecto**
- Dada una fórmula emitida,
- cuando se consulta con otro documento,
- entonces la respuesta es `404 FORMULA_NO_ENCONTRADA`, idéntica a la de un código inexistente.

**CA-EPS-04 · Dispensación parcial**
- Dada una fórmula con un ítem autorizado de 60 unidades,
- cuando se registra una dispensación de 20,
- entonces `cantidadDispensada = 20` y el estado pasa a `PARCIALMENTE_DISPENSADA`.

**CA-EPS-05 · Exceso sobre lo autorizado**
- Dada una fórmula con 50 de 60 unidades dispensadas,
- cuando se registra una dispensación de 20,
- entonces la respuesta es `409 CANTIDAD_EXCEDE_AUTORIZADA` y no cambia ningún dato.

**CA-EPS-06 · Idempotencia**
- Dada una dispensación ya registrada con la clave `K`,
- cuando se envía de nuevo con la misma clave `K`,
- entonces la respuesta es `200` con el resultado original y las cantidades no se duplican.

**CA-EPS-07 · Fórmula vencida**
- Dada una fórmula con `fechaVencimiento` anterior a hoy,
- cuando se intenta dispensar,
- entonces la respuesta es `409 FORMULA_NO_DISPENSABLE`.

**CA-EPS-08 · Acceso sin API key**
- Cuando se llama al API de servicio sin `X-API-Key` o con una inválida,
- entonces la respuesta es `401`.

**CA-EPS-09 · PDF**
- Dada una fórmula emitida,
- cuando se solicita su PDF,
- entonces se descarga un `application/pdf` que incluye el código, los ítems y la marca de documento simulado.

## 9. Limitaciones específicas

- La emisión de fórmulas es manual: no hay flujo de consulta médica ni de autorización.
- Las fórmulas no se envían automáticamente a FarmaGestión. El paciente las vincula con código y documento.
- No hay roles dentro del simulador.

## 10. Tareas de implementación (orden sugerido)

1. Esquema Prisma y migración de `eps_db`; carga del catálogo desde `data/seed/`.
2. Endpoints de pacientes y emisión de fórmulas.
3. API de servicio: consulta, `health` y middleware de `X-API-Key`.
4. Dispensaciones con idempotencia y pruebas de los casos CA-EPS-04 a 07.
5. PDF con `pdf-lib`.
6. Interfaz mínima de operador (pacientes, emitir, listar, detalle).
7. Datos demo y reinicio.
8. Publicar `contracts/eps-simulador.openapi.yaml` y verificarlo contra el servicio real.
