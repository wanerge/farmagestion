package co.farmagestion.api.integracion;

import co.farmagestion.api.formulas.FormulaService;
import co.farmagestion.api.pedidos.PedidoService;
import co.farmagestion.api.turnos.TurnoService;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Tareas programadas idempotentes de 00 §11 con puesta al día al arrancar (00 §12).
 */
@Component
public class TareasProgramadas {

	private static final Logger log = LoggerFactory.getLogger(TareasProgramadas.class);

	private final PedidoService pedidoService;
	private final TurnoService turnoService;
	private final OutboxService outboxService;
	private final FormulaService formulaService;
	private final boolean schedulingEnabled;

	public TareasProgramadas(
			PedidoService pedidoService,
			TurnoService turnoService,
			OutboxService outboxService,
			FormulaService formulaService,
			@Value("${app.scheduling.enabled:true}") boolean schedulingEnabled) {
		this.pedidoService = pedidoService;
		this.turnoService = turnoService;
		this.outboxService = outboxService;
		this.formulaService = formulaService;
		this.schedulingEnabled = schedulingEnabled;
	}

	@EventListener(ApplicationReadyEvent.class)
	public void puestaAlDiaAlArrancar() {
		if (!schedulingEnabled) {
			return;
		}
		ejecutarSeguro("ExpirarReservas (arranque)", this::expirarReservas);
		ejecutarSeguro("VencerTurnos (arranque)", this::vencerTurnos);
		ejecutarSeguro("ReintentarOutbox (arranque)", this::reintentarOutbox);
	}

	@Scheduled(fixedDelayString = "${app.scheduling.expirar-reservas-ms:60000}")
	public int expirarReservas() {
		return pedidoService.expirarReservasVencidas();
	}

	@Scheduled(fixedDelayString = "${app.scheduling.vencer-turnos-ms:300000}")
	public int vencerTurnos() {
		return turnoService.vencerTurnosExpirados();
	}

	@Scheduled(fixedDelayString = "${app.scheduling.reintentar-outbox-ms:60000}")
	public int reintentarOutbox() {
		return outboxService.procesarPendientes();
	}

	@Scheduled(fixedDelayString = "${app.scheduling.sincronizar-formulas-ms:3600000}")
	public int sincronizarFormulas() {
		List<UUID> formulaIds = pedidoService.obtenerFormulaRefIdsDePedidosActivos();
		return formulaService.sincronizarFormulas(formulaIds);
	}

	private void ejecutarSeguro(String nombre, Runnable accion) {
		try {
			accion.run();
		} catch (Exception ex) {
			log.warn("Error controlado en tarea {}: {}", nombre, ex.getMessage());
		}
	}
}
