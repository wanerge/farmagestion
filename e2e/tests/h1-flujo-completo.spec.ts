import { expect, test } from "@playwright/test";

function sinBarraFinal(url: string): string {
  return url.replace(/\/+$/, "");
}

const SIMULADOR_URL = sinBarraFinal(
  process.env.E2E_SIMULADOR_URL ?? "http://localhost:3000"
);
const PORTAL_URL = sinBarraFinal(
  process.env.E2E_PORTAL_URL ?? "http://localhost:3001"
);
const PANEL_URL = sinBarraFinal(
  process.env.E2E_PANEL_URL ?? "http://localhost:3002"
);
const API_URL = sinBarraFinal(
  process.env.E2E_API_URL ?? "http://localhost:8080"
);

const SIMULADOR_PASSWORD =
  process.env.E2E_SIMULADOR_PASSWORD ??
  process.env.DEMO_ADMIN_PASSWORD ??
  "";

const PACIENTE_EMAIL =
  process.env.E2E_PACIENTE_EMAIL ?? "paciente1@farmagestion.demo";
const PACIENTE_PASSWORD =
  process.env.E2E_PACIENTE_PASSWORD ?? "Farma2026!";
const PACIENTE_DOCUMENTO =
  process.env.E2E_PACIENTE_DOCUMENTO ?? "1000000001";

const EMPLEADO_EMAIL =
  process.env.E2E_EMPLEADO_EMAIL ?? "farmaceutico.centro@farmagestion.demo";
const EMPLEADO_PASSWORD =
  process.env.E2E_EMPLEADO_PASSWORD ?? "Farma2026!";

const SEDE_NOMBRE = process.env.E2E_SEDE_NOMBRE ?? "FarmaGestión Centro";
const SEDE_CODIGO = process.env.E2E_SEDE_CODIGO ?? "SEDE-CENTRO";
const MED_CODIGO = process.env.E2E_MED_CODIGO ?? "MED-0001";
const CANTIDAD = Number(process.env.E2E_CANTIDAD ?? "2");
const OUTBOX_TIMEOUT_MS = Number(
  process.env.E2E_OUTBOX_TIMEOUT_MS ?? "95000"
);

test.describe("Hito H1 · Flujo completo punta a punta", () => {
  test("H1: emitir fórmula -> paciente vincula y crea pedido RECOGER -> empleado prepara y entrega -> fórmula DISPENSADA en simulador", async ({
    browser,
    request,
  }) => {
    expect(
      SIMULADOR_PASSWORD,
      "Define E2E_SIMULADOR_PASSWORD (o DEMO_ADMIN_PASSWORD) para autenticarte en simulador-eps."
    ).toBeTruthy();

    // -----------------------------------------------------------------------
    // Paso 0: Verificar que ambos backends respondan /api/v1/health
    // -----------------------------------------------------------------------
    await test.step("0. Verificar /api/v1/health de farmagestion-api y simulador-eps", async () => {
      await expect
        .poll(
          async () => {
            const res = await request.get(`${API_URL}/api/v1/health`);
            return res.status();
          },
          {
            message: `farmagestion-api no respondió 200 en ${API_URL}/api/v1/health`,
            timeout: 30_000,
            intervals: [2_000, 3_000],
          }
        )
        .toBe(200);

      await expect
        .poll(
          async () => {
            const res = await request.get(`${SIMULADOR_URL}/api/v1/health`);
            return res.status();
          },
          {
            message: `simulador-eps no respondió 200 en ${SIMULADOR_URL}/api/v1/health`,
            timeout: 30_000,
            intervals: [2_000, 3_000],
          }
        )
        .toBe(200);
    });

    const simContext = await browser.newContext();
    const portalContext = await browser.newContext();
    const panelContext = await browser.newContext();

    const simPage = await simContext.newPage();
    const portalPage = await portalContext.newPage();
    const panelPage = await panelContext.newPage();

    let formulaCodigo = "";
    let formulaId = "";
    let pedidoCodigo = "";
    let pedidoId = "";

    try {
      // ---------------------------------------------------------------------
      // Paso 1: Emitir fórmula en el Simulador EPS
      // ---------------------------------------------------------------------
      await test.step("1. Simulador EPS: iniciar sesión como operador y emitir fórmula", async () => {
        await simPage.goto(SIMULADOR_URL, { waitUntil: "domcontentloaded" });

        const passwordInput = simPage.locator('input[type="password"]');
        await expect(passwordInput).toBeVisible();
        await passwordInput.fill(SIMULADOR_PASSWORD);
        await simPage.getByRole("button", { name: "Ingresar" }).click();

        const btnEmitirNav = simPage.getByRole("button", {
          name: "Emitir fórmula",
          exact: true,
        });
        await expect(btnEmitirNav).toBeVisible();
        await btnEmitirNav.click();

        await expect(
          simPage.getByRole("heading", { name: "Emitir nueva fórmula médica" })
        ).toBeVisible();

        const selectPaciente = simPage.locator(
          'label:has-text("Paciente") + select'
        );

        // Esperar a que carguen catálogos o asegurar que el paciente demo exista
        await simPage.waitForResponse(
          (res) =>
            res.url().includes("/api/admin/pacientes") && res.status() === 200
        ).catch(() => undefined);

        const buscarOpcionPaciente = async (): Promise<string | null> => {
          return selectPaciente.evaluate((el, doc) => {
            const select = el as HTMLSelectElement;
            const match = Array.from(select.options).find((opt) =>
              opt.text.includes(doc)
            );
            return match ? match.value : null;
          }, PACIENTE_DOCUMENTO);
        };

        let pacienteValue = await buscarOpcionPaciente();

        if (!pacienteValue) {
          // Cargar datos demo de forma idempotente si la base aún no tiene los 5 pacientes demo
          await simPage
            .getByRole("button", { name: "Demo", exact: true })
            .click();
          await simPage
            .getByRole("button", { name: "Cargar datos demo" })
            .click();
          await expect(simPage.getByText(/Datos demo listos:/)).toBeVisible();
          await btnEmitirNav.click();
          await expect(
            simPage.getByRole("heading", {
              name: "Emitir nueva fórmula médica",
            })
          ).toBeVisible();

          await expect
            .poll(buscarOpcionPaciente, {
              message: `No se encontró el paciente con documento ${PACIENTE_DOCUMENTO} tras cargar datos demo`,
              timeout: 15_000,
            })
            .not.toBeNull();
          pacienteValue = await buscarOpcionPaciente();
        }

        await selectPaciente.selectOption(pacienteValue!);

        const selectMedicamento = simPage
          .locator('label:has-text("Medicamento") + select')
          .first();
        await expect
          .poll(async () =>
            selectMedicamento.evaluate((el, cod) => {
              const select = el as HTMLSelectElement;
              return Array.from(select.options).some(
                (opt) => opt.value === cod
              );
            }, MED_CODIGO)
          )
          .toBe(true);
        await selectMedicamento.selectOption(MED_CODIGO);

        const inputCantidad = simPage
          .locator('label:has-text("Cant. autorizada") + input')
          .first();
        await inputCantidad.fill(String(CANTIDAD));

        await simPage
          .locator("textarea")
          .fill("Fórmula emitida por prueba automática E2E H1");

        await simPage.locator('form button[type="submit"]').click();

        const codigoHeading = simPage.locator("h2", {
          hasText: /^FRM-\d{4}-\d{6}$/,
        });
        await expect(codigoHeading).toBeVisible();
        formulaCodigo = (await codigoHeading.textContent())!.trim();

        await expect(
          simPage.locator("span", { hasText: /^EMITIDA$/ })
        ).toBeVisible();

        const pdfHref = await simPage
          .getByRole("link", { name: "Descargar PDF" })
          .getAttribute("href");
        const matchId = pdfHref?.match(/\/api\/admin\/formulas\/([^/]+)\/pdf/);
        expect(matchId, "No se pudo obtener el UUID de la fórmula emitida").toBeTruthy();
        formulaId = matchId![1];
      });

      // ---------------------------------------------------------------------
      // Paso 2: Portal del paciente — vincular fórmula y ver disponibilidad
      // ---------------------------------------------------------------------
      await test.step("2. Portal del paciente: iniciar sesión, vincular fórmula y revisar disponibilidad", async () => {
        await portalPage.goto(`${PORTAL_URL}/login`, {
          waitUntil: "domcontentloaded",
        });

        await portalPage.locator("#login-email").fill(PACIENTE_EMAIL);
        await portalPage.locator("#login-password").fill(PACIENTE_PASSWORD);
        await portalPage
          .getByRole("button", { name: "Iniciar sesión" })
          .click();

        await expect(portalPage).toHaveURL(/\/formulas/);
        await expect(
          portalPage.getByRole("heading", { name: "Mis fórmulas médicas" })
        ).toBeVisible();

        await portalPage
          .getByRole("button", { name: "+ Vincular fórmula" })
          .click();
        await portalPage.locator("#codigo-formula").fill(formulaCodigo);
        await portalPage
          .getByRole("button", { name: "Vincular fórmula", exact: true })
          .click();

        await expect(portalPage).toHaveURL(/\/formulas\/[0-9a-f-]+/i);
        await expect(
          portalPage.getByRole("heading", { name: formulaCodigo })
        ).toBeVisible();
        await expect(
          portalPage.getByRole("heading", { name: "Disponibilidad por sede" })
        ).toBeVisible();
      });

      // ---------------------------------------------------------------------
      // Paso 3: Portal del paciente — crear pedido RECOGER con reserva y turno
      // ---------------------------------------------------------------------
      await test.step("3. Portal del paciente: crear pedido RECOGER con reserva y turno", async () => {
        await portalPage
          .getByRole("link", { name: "Pedir medicamentos" })
          .click();

        await expect(portalPage).toHaveURL(/\/pedidos\/nuevo/);
        await expect(
          portalPage.getByRole("heading", {
            name: /Nuevo pedido · Recoger en sede/,
          })
        ).toBeVisible();

        await portalPage
          .getByRole("button", { name: new RegExp(SEDE_NOMBRE) })
          .click();

        const btnConfirmar = portalPage.getByRole("button", {
          name: "Confirmar pedido y generar turno",
        });
        const btnMananaFallback = portalPage.getByRole("button", {
          name: "Ver franjas de mañana",
        });

        // Esperar a que carguen las franjas de hoy; si no quedan hoy (p. ej. tras cierre), pasar a mañana
        await expect
          .poll(
            async () => {
              if (await btnMananaFallback.isVisible()) return "SIN_HOY";
              if (await btnConfirmar.isEnabled()) return "LISTO";
              return "CARGANDO";
            },
            { timeout: 20_000, intervals: [500, 1_000] }
          )
          .not.toBe("CARGANDO");

        if (await btnMananaFallback.isVisible()) {
          await btnMananaFallback.click();
        }

        await expect(btnConfirmar).toBeEnabled({ timeout: 20_000 });
        await btnConfirmar.click();

        await expect(portalPage).toHaveURL(/\/pedidos\/[0-9a-f-]+/i);
        const pedidoUrlMatch = portalPage
          .url()
          .match(/\/pedidos\/([0-9a-f-]+)/i);
        expect(pedidoUrlMatch).toBeTruthy();
        pedidoId = pedidoUrlMatch![1];

        const h1Pedido = portalPage.locator("h1", {
          hasText: /^PED-\d{4}-\d{6}$/,
        });
        await expect(h1Pedido).toBeVisible();
        pedidoCodigo = (await h1Pedido.textContent())!.trim();

        await expect(
          portalPage.getByText("Turno para recoger en sede")
        ).toBeVisible();
        await expect(
          portalPage.locator("p", { hasText: /^[A-Z]{3}-\d{3}$/ })
        ).toBeVisible();
        await expect(
          portalPage.locator("span", { hasText: /^Reservado$/ }).first()
        ).toBeVisible();
      });

      // ---------------------------------------------------------------------
      // Paso 4: Panel de empleados — tomar, marcar listo y entregar
      // ---------------------------------------------------------------------
      await test.step("4. Panel de empleados: iniciar sesión, tomar, marcar LISTO y entregar pedido", async () => {
        await panelPage.goto(`${PANEL_URL}/login`, {
          waitUntil: "domcontentloaded",
        });

        await panelPage.locator("#login-email").fill(EMPLEADO_EMAIL);
        await panelPage.locator("#login-password").fill(EMPLEADO_PASSWORD);
        await panelPage
          .getByRole("button", { name: "Iniciar sesión" })
          .click();

        await expect(panelPage).not.toHaveURL(/\/login/);

        await panelPage.goto(`${PANEL_URL}/pedidos`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          panelPage.getByRole("heading", { name: "Bandeja de pedidos" })
        ).toBeVisible();

        await panelPage.locator("#filtro-estado").selectOption("RESERVADO");

        const linkPedido = panelPage.getByRole("link", {
          name: pedidoCodigo,
        });
        const encontradoEnPrimeraPagina = await linkPedido
          .waitFor({ state: "visible", timeout: 10_000 })
          .then(() => true)
          .catch(() => false);

        if (encontradoEnPrimeraPagina) {
          await linkPedido.click();
        } else {
          // Si hay más de 20 pedidos RESERVADO en el entorno, navegar al detalle directo
          await panelPage.goto(`${PANEL_URL}/pedidos/${pedidoId}`, {
            waitUntil: "domcontentloaded",
          });
        }

        await expect(
          panelPage.getByRole("heading", { name: pedidoCodigo })
        ).toBeVisible();

        // 4.1 Tomar pedido (RESERVADO -> EN_PREPARACION)
        await panelPage.getByRole("button", { name: "Tomar pedido" }).click();
        await panelPage
          .locator("#pedido-nota")
          .fill("Iniciando alistamiento en prueba E2E H1");
        await panelPage.getByRole("button", { name: "Confirmar" }).click();
        await expect(
          panelPage.getByRole("button", { name: "Marcar LISTO" })
        ).toBeVisible();

        // 4.2 Marcar LISTO (EN_PREPARACION -> LISTO)
        await panelPage.getByRole("button", { name: "Marcar LISTO" }).click();
        await panelPage
          .locator("#pedido-nota")
          .fill("Empacado completo en prueba E2E H1");
        await panelPage.getByRole("button", { name: "Confirmar" }).click();
        await expect(
          panelPage.getByRole("button", { name: "Entregar pedido" })
        ).toBeVisible();

        // 4.3 Entregar pedido verificando documento (LISTO -> ENTREGADO)
        await panelPage
          .getByRole("button", { name: "Entregar pedido" })
          .click();
        await panelPage
          .locator("#doc-verificado")
          .fill(PACIENTE_DOCUMENTO);
        await panelPage
          .locator("#entrega-nota")
          .fill("Entregado en ventanilla en prueba E2E H1");
        await panelPage.getByRole("button", { name: "Confirmar" }).click();

        await expect(
          panelPage.locator("span", { hasText: /^Entregado$/ }).first()
        ).toBeVisible();
        await expect(panelPage.getByText("LISTO → ENTREGADO")).toBeVisible();
        await expect(
          panelPage.locator("span", { hasText: /^Atendido$/ }).first()
        ).toBeVisible();
      });

      // ---------------------------------------------------------------------
      // Paso 5: Verificar que la fórmula quedó DISPENSADA en el Simulador EPS
      // ---------------------------------------------------------------------
      await test.step("5. Simulador EPS: verificar que el outbox marcó la fórmula como DISPENSADA", async () => {
        await expect
          .poll(
            async () => {
              const res = await simPage.request.get(
                `${SIMULADOR_URL}/api/admin/formulas/${formulaId}`
              );
              if (!res.ok()) return `HTTP_${res.status()}`;
              const data = (await res.json()) as {
                estado?: string;
                dispensaciones?: Array<{ sedeCodigo?: string }>;
              };
              const dispCount = data.dispensaciones?.length ?? 0;
              return `${data.estado ?? "DESCONOCIDO"}:${dispCount}`;
            },
            {
              message: `La fórmula ${formulaCodigo} no pasó a DISPENSADA en simulador-eps dentro de ${OUTBOX_TIMEOUT_MS} ms`,
              timeout: OUTBOX_TIMEOUT_MS,
              intervals: [2_000, 3_000, 5_000],
            }
          )
          .toBe("DISPENSADA:1");

        // Refrescar la vista del simulador en el navegador y validar UI
        await simPage
          .getByRole("button", { name: "← Volver al listado" })
          .click();
        const filaFormula = simPage.locator("tr", { hasText: formulaCodigo });
        await expect(filaFormula).toBeVisible();
        await expect(filaFormula).toContainText("DISPENSADA");

        await filaFormula.getByRole("button", { name: "Ver detalle" }).click();
        await expect(
          simPage.locator("span", { hasText: /^DISPENSADA$/ })
        ).toBeVisible();
        await expect(
          simPage.getByText("Historial de dispensaciones (1)")
        ).toBeVisible();
        await expect(simPage.getByText(SEDE_CODIGO)).toBeVisible();

        // Confirmar también el estado Entregado desde el portal del paciente
        await portalPage
          .getByRole("button", { name: "Actualizar estado" })
          .click();
        await expect(
          portalPage.locator("span", { hasText: /^Entregado$/ }).first()
        ).toBeVisible();
      });
    } finally {
      await Promise.all([
        simContext.close(),
        portalContext.close(),
        panelContext.close(),
      ]);
    }
  });
});
