package co.farmagestion.api.integracion;

import co.farmagestion.api.common.web.ApiException;
import co.farmagestion.api.common.web.PaginaResponse;
import co.farmagestion.api.formulas.FormulaService;
import co.farmagestion.api.formulas.ResultadoDispensacionSimulador;
import co.farmagestion.api.formulas.SimuladorDispensacionRequest;
import co.farmagestion.api.formulas.SimuladorDispensacionRequest.SimuladorDispensacionItemRequest;
import co.farmagestion.api.formulas.SimuladorEpsClient;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/**
 * Outbox transaccional hacia simulador-eps con reintentos de espera creciente hasta 10 intentos (RN-06, 00 §9.3).
 */
@Service
public class OutboxService {

	public static final String TIPO_DISPENSACION_FORMULA = "DISPENSACION_FORMULA";
	private static final int MAX_PAGE_SIZE = 100;

	private static final Logger log = LoggerFactory.getLogger(OutboxService.class);

	private final EventoIntegracionRepository eventoRepository;
	private final SimuladorEpsClient simuladorEpsClient;
	private final FormulaService formulaService;
	private final ApplicationEventPublisher eventPublisher;
	private final TransactionTemplate transactionTemplate;
	private final ObjectMapper objectMapper;
	private final Clock clock;
	private final long backoffBaseSegundos;
	private final int maxIntentos;

	public OutboxService(
			EventoIntegracionRepository eventoRepository,
			SimuladorEpsClient simuladorEpsClient,
			FormulaService formulaService,
			ApplicationEventPublisher eventPublisher,
			TransactionTemplate transactionTemplate,
			ObjectMapper objectMapper,
			Clock clock,
			@Value("${app.integracion.outbox-backoff-base-segundos:60}") long backoffBaseSegundos,
			@Value("${app.integracion.outbox-max-intentos:10}") int maxIntentos) {
		this.eventoRepository = eventoRepository;
		this.simuladorEpsClient = simuladorEpsClient;
		this.formulaService = formulaService;
		this.eventPublisher = eventPublisher;
		this.transactionTemplate = transactionTemplate;
		this.objectMapper = objectMapper;
		this.clock = clock;
		this.backoffBaseSegundos = Math.max(1L, backoffBaseSegundos);
		this.maxIntentos = Math.max(1, maxIntentos);
	}

	@Transactional
	public void encolarDispensacion(String idempotencyKey, DispensacionOutboxPayload payload) {
		if (eventoRepository.existsByIdempotencyKey(idempotencyKey)) {
			return;
		}
		EventoIntegracion evento = new EventoIntegracion();
		evento.setTipo(TIPO_DISPENSACION_FORMULA);
		evento.setPayload(objectMapper.writeValueAsString(payload));
		evento.setEstado(EstadoEventoIntegracion.PENDIENTE);
		evento.setIntentos(0);
		evento.setIdempotencyKey(idempotencyKey);
		eventoRepository.save(evento);
	}

	@Transactional(readOnly = true)
	public PaginaResponse<EventoIntegracionResponse> listarEventos(
			EstadoEventoIntegracion estado,
			int page,
			int size) {
		int pagina = Math.max(0, page);
		int tamano = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
		PageRequest pageable = PageRequest.of(pagina, tamano);

		Page<EventoIntegracion> resultados = estado == null
				? eventoRepository.findAllByOrderByCreatedAtDesc(pageable)
				: eventoRepository.findAllByEstadoOrderByCreatedAtDesc(estado, pageable);

		return PaginaResponse.of(resultados.map(EventoIntegracionResponse::from));
	}

	/**
	 * Reintenta manualmente un evento en ERROR o PENDIENTE y ejecuta el envío de inmediato (RF-EMP-34).
	 */
	public EventoIntegracionResponse reintentarManual(UUID eventoId) {
		transactionTemplate.executeWithoutResult(status -> {
			EventoIntegracion evento = eventoRepository.findByIdForUpdate(eventoId)
					.orElseThrow(() -> ApiException.notFound(
							"EVENTO_INTEGRACION_NO_ENCONTRADO",
							"Evento de integración no encontrado",
							"No existe un evento de integración con el identificador indicado."));

			if (evento.getEstado() == EstadoEventoIntegracion.ENVIADO) {
				throw ApiException.conflict(
						"EVENTO_YA_ENVIADO",
						"Evento ya enviado",
						"El evento de integración ya fue enviado exitosamente al simulador.");
			}

			if (evento.getEstado() == EstadoEventoIntegracion.ERROR) {
				evento.setIntentos(0);
			}
			evento.setEstado(EstadoEventoIntegracion.PENDIENTE);
			evento.setUltimoError(null);
			eventoRepository.saveAndFlush(evento);
		});

		procesarUno(eventoId, Instant.now(clock));

		EventoIntegracion actualizado = eventoRepository.findById(eventoId)
				.orElseThrow(() -> ApiException.notFound(
						"EVENTO_INTEGRACION_NO_ENCONTRADO",
						"Evento de integración no encontrado",
						"No existe un evento de integración con el identificador indicado."));
		return EventoIntegracionResponse.from(actualizado);
	}

	/**
	 * Procesa los eventos PENDIENTE cuyo tiempo de espera creciente ya se cumplió (tarea ReintentarOutbox).
	 */
	public int procesarPendientes() {
		return procesarPendientes(Instant.now(clock));
	}

	/**
	 * Procesa los eventos PENDIENTE tomando {@code ahora} como marca de tiempo de referencia.
	 */
	public int procesarPendientes(Instant ahora) {
		List<EventoIntegracion> pendientes = eventoRepository
				.findAllByEstadoOrderByCreatedAtAsc(EstadoEventoIntegracion.PENDIENTE);
		int procesados = 0;
		for (EventoIntegracion evento : pendientes) {
			if (!estaListoParaReintento(evento, ahora)) {
				continue;
			}
			procesarUno(evento.getId(), ahora);
			procesados++;
		}
		return procesados;
	}

	public boolean estaListoParaReintento(EventoIntegracion evento, Instant ahora) {
		if (evento.getIntentos() <= 0) {
			return true;
		}
		long esperaAcumuladaSegundos = calcularEsperaAcumuladaSegundos(evento.getIntentos());
		Instant proximoIntento = evento.getCreatedAt().plusSeconds(esperaAcumuladaSegundos);
		return !proximoIntento.isAfter(ahora);
	}

	long calcularEsperaAcumuladaSegundos(int intentosPrevios) {
		if (intentosPrevios <= 0) {
			return 0L;
		}
		int exponente = Math.min(intentosPrevios, 10);
		return backoffBaseSegundos * ((1L << exponente) - 1L);
	}

	private void procesarUno(UUID eventoId, Instant ahora) {
		EventoIntegracion snapshot = eventoRepository.findById(eventoId).orElse(null);
		if (snapshot == null || snapshot.getEstado() != EstadoEventoIntegracion.PENDIENTE) {
			return;
		}
		if (!TIPO_DISPENSACION_FORMULA.equals(snapshot.getTipo())) {
			log.warn("Tipo de evento de integración desconocido: {}", snapshot.getTipo());
			return;
		}

		DispensacionOutboxPayload payload;
		try {
			payload = objectMapper.readValue(snapshot.getPayload(), DispensacionOutboxPayload.class);
		} catch (Exception ex) {
			marcarErrorDefinitivo(eventoId, "Payload JSON inválido: " + ex.getMessage());
			return;
		}

		SimuladorDispensacionRequest request = new SimuladorDispensacionRequest(
				payload.pedidoRef(),
				payload.sedeCodigo(),
				payload.fecha(),
				payload.items().stream()
						.map(i -> new SimuladorDispensacionItemRequest(i.medicamentoCodigo(), i.cantidad()))
						.toList());

		ResultadoDispensacionSimulador resultado = simuladorEpsClient.registrarDispensacion(
				payload.formulaCodigo(), snapshot.getIdempotencyKey(), request);

		transactionTemplate.executeWithoutResult(status -> {
			EventoIntegracion evento = eventoRepository.findByIdForUpdate(eventoId).orElse(null);
			if (evento == null || evento.getEstado() != EstadoEventoIntegracion.PENDIENTE) {
				return;
			}

			int intentos = evento.getIntentos() + 1;
			evento.setIntentos(intentos);

			if (resultado instanceof ResultadoDispensacionSimulador.Exito exito) {
				evento.setEstado(EstadoEventoIntegracion.ENVIADO);
				evento.setEnviadoEn(ahora);
				evento.setUltimoError(null);
				eventoRepository.save(evento);
				formulaService.actualizarDesdeSimulador(payload.formulaCodigo(), exito.formula());
			} else if (resultado instanceof ResultadoDispensacionSimulador.ErrorDefinitivo definitivo) {
				String error = "HTTP " + definitivo.status() + " " + definitivo.code() + ": " + definitivo.detalle();
				evento.setEstado(EstadoEventoIntegracion.ERROR);
				evento.setUltimoError(error);
				eventoRepository.save(evento);
				eventPublisher.publishEvent(new IntegracionErrorEvent(
						evento.getId(), evento.getTipo(), evento.getIdempotencyKey(), error));
			} else if (resultado instanceof ResultadoDispensacionSimulador.ErrorReintentable reintentable) {
				evento.setUltimoError(reintentable.detalle());
				if (intentos >= maxIntentos) {
					evento.setEstado(EstadoEventoIntegracion.ERROR);
					eventoRepository.save(evento);
					eventPublisher.publishEvent(new IntegracionErrorEvent(
							evento.getId(), evento.getTipo(), evento.getIdempotencyKey(), reintentable.detalle()));
				} else {
					evento.setEstado(EstadoEventoIntegracion.PENDIENTE);
					eventoRepository.save(evento);
				}
			}
		});
	}

	private void marcarErrorDefinitivo(UUID eventoId, String error) {
		transactionTemplate.executeWithoutResult(status -> {
			EventoIntegracion evento = eventoRepository.findByIdForUpdate(eventoId).orElse(null);
			if (evento == null || evento.getEstado() != EstadoEventoIntegracion.PENDIENTE) {
				return;
			}
			evento.setIntentos(evento.getIntentos() + 1);
			evento.setEstado(EstadoEventoIntegracion.ERROR);
			evento.setUltimoError(error);
			eventoRepository.save(evento);
			eventPublisher.publishEvent(new IntegracionErrorEvent(
					evento.getId(), evento.getTipo(), evento.getIdempotencyKey(), error));
		});
	}
}
