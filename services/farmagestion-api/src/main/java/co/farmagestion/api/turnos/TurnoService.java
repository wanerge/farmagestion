package co.farmagestion.api.turnos;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.catalogo.CatalogoConsultaService;
import co.farmagestion.api.catalogo.SedePublicaResponse;
import co.farmagestion.api.common.domain.ParametroService;
import co.farmagestion.api.common.web.ApiException;
import co.farmagestion.api.turnos.FranjasDisponiblesResponse.FranjaDisponibleItem;
import co.farmagestion.api.turnos.PantallaSalaResponse.TurnoSalaItem;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TurnoService {

	private static final int ANTICIPACION_MINUTOS = 60;
	private static final Set<EstadoTurno> ESTADOS_QUE_OCUPAN_CUPO =
			EnumSet.of(EstadoTurno.EN_ESPERA, EstadoTurno.LLAMADO, EstadoTurno.ATENDIDO);

	private final TurnoRepository turnoRepository;
	private final CatalogoConsultaService catalogoConsultaService;
	private final ParametroService parametroService;
	private final ApplicationEventPublisher eventPublisher;
	private final ObjectProvider<PedidoPorTurnoPort> pedidoPorTurnoProvider;
	private final Clock clock;

	public TurnoService(
			TurnoRepository turnoRepository,
			CatalogoConsultaService catalogoConsultaService,
			ParametroService parametroService,
			ApplicationEventPublisher eventPublisher,
			ObjectProvider<PedidoPorTurnoPort> pedidoPorTurnoProvider,
			Clock clock) {
		this.turnoRepository = turnoRepository;
		this.catalogoConsultaService = catalogoConsultaService;
		this.parametroService = parametroService;
		this.eventPublisher = eventPublisher;
		this.pedidoPorTurnoProvider = pedidoPorTurnoProvider;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public FranjasDisponiblesResponse consultarFranjasDisponibles(UUID sedeId, LocalDate fechaSolicitada) {
		SedePublicaResponse sede = catalogoConsultaService.obtenerSedeActivaPorId(sedeId)
				.orElseThrow(() -> ApiException.notFound(
						"SEDE_NO_ENCONTRADA",
						"Sede no encontrada",
						"No existe una sede activa con el identificador indicado."));

		ZonedDateTime ahoraBogota = ahoraBogota();
		LocalDate hoy = ahoraBogota.toLocalDate();
		LocalDate fecha = fechaSolicitada == null ? hoy : fechaSolicitada;

		int franjaMin = parametroService.obtenerEntero(ParametroService.TURNO_FRANJA_MIN, 30);
		int capacidad = parametroService.obtenerEntero(ParametroService.TURNO_CAPACIDAD_FRANJA, 6);
		int diasAdelante = parametroService.obtenerEntero(ParametroService.TURNO_DIAS_ADELANTE, 1);

		LocalDate maxFecha = hoy.plusDays(diasAdelante);
		if (fecha.isBefore(hoy) || fecha.isAfter(maxFecha)) {
			return new FranjasDisponiblesResponse(
					sede.id(), sede.codigo(), sede.nombre(), fecha, franjaMin, capacidad, List.of());
		}

		Map<LocalTime, Integer> ocupadosPorFranja = new HashMap<>();
		for (Object[] row : turnoRepository.contarOcupadosPorFranja(sede.id(), fecha, ESTADOS_QUE_OCUPAN_CUPO)) {
			ocupadosPorFranja.put((LocalTime) row[0], ((Number) row[1]).intValue());
		}

		ZonedDateTime limiteAnticipacion = ahoraBogota.plusMinutes(ANTICIPACION_MINUTOS);
		List<FranjaDisponibleItem> franjas = new ArrayList<>();
		LocalTime cursor = sede.horaApertura();
		while (!cursor.plusMinutes(franjaMin).isAfter(sede.horaCierre())) {
			LocalTime fin = cursor.plusMinutes(franjaMin);
			ZonedDateTime inicioZoned = ZonedDateTime.of(fecha, cursor, ParametroService.ZONA_NEGOCIO);
			int ocupados = ocupadosPorFranja.getOrDefault(cursor, 0);
			int cuposDisponibles = Math.max(0, capacidad - ocupados);
			boolean cumpleAnticipacion = !inicioZoned.isBefore(limiteAnticipacion);
			boolean disponible = cuposDisponibles > 0 && cumpleAnticipacion;

			franjas.add(new FranjaDisponibleItem(
					cursor,
					fin,
					inicioZoned.toOffsetDateTime(),
					capacidad,
					ocupados,
					cuposDisponibles,
					disponible));
			cursor = fin;
		}

		return new FranjasDisponiblesResponse(
				sede.id(), sede.codigo(), sede.nombre(), fecha, franjaMin, capacidad, franjas);
	}

	/**
	 * Valida las reglas RN-PAC-05 de la franja antes de bloquear inventario.
	 */
	public void validarFranjaSinBloquear(SedePublicaResponse sede, OffsetDateTime franjaInicioInput) {
		resolverYValidarFranja(sede, franjaInicioInput);
	}

	/**
	 * Crea el turno de un pedido RECOGER dentro de la misma transacción que la reserva de stock.
	 */
	@Transactional
	public TurnoCreado crearTurnoParaPedido(
			UUID pedidoId,
			SedePublicaResponse sede,
			OffsetDateTime franjaInicioInput) {
		FranjaValidada franja = resolverYValidarFranja(sede, franjaInicioInput);

		turnoRepository.adquirirBloqueoTransaccional("turno:" + sede.id() + ":" + franja.fecha());

		long ocupados = turnoRepository.countBySedeIdAndFechaAndFranjaInicioAndEstadoIn(
				sede.id(), franja.fecha(), franja.horaInicio(), ESTADOS_QUE_OCUPAN_CUPO);
		if (ocupados >= franja.capacidad()) {
			throw ApiException.conflict(
					"FRANJA_SIN_CUPO",
					"Franja sin cupo",
					"La franja horaria seleccionada ya alcanzó su capacidad máxima.");
		}

		int siguienteNumero = turnoRepository.findMaxNumeroBySedeIdAndFecha(sede.id(), franja.fecha()) + 1;
		Turno turno = new Turno();
		turno.setPedidoId(pedidoId);
		turno.setSedeId(sede.id());
		turno.setFecha(franja.fecha());
		turno.setFranjaInicio(franja.horaInicio());
		turno.setNumero(siguienteNumero);
		turno.setCodigo(generarCodigoTurno(sede.codigo(), siguienteNumero));
		turno.setEstado(EstadoTurno.EN_ESPERA);
		Turno guardado = turnoRepository.saveAndFlush(turno);

		int graciaMin = parametroService.obtenerEntero(ParametroService.RESERVA_GRACIA_TURNO_MIN, 30);
		Instant expiraEn = franja.inicioZoned()
				.plusMinutes((long) franja.franjaMin() + graciaMin)
				.toInstant();

		return new TurnoCreado(TurnoResponse.from(guardado), expiraEn);
	}

	@Transactional(readOnly = true)
	public Optional<TurnoResponse> obtenerPorPedidoId(UUID pedidoId) {
		return turnoRepository.findByPedidoId(pedidoId).map(TurnoResponse::from);
	}

	@Transactional(readOnly = true)
	public Map<UUID, TurnoResponse> obtenerPorPedidoIds(Collection<UUID> pedidoIds) {
		if (pedidoIds == null || pedidoIds.isEmpty()) {
			return Collections.emptyMap();
		}
		Map<UUID, TurnoResponse> mapa = new LinkedHashMap<>();
		for (Turno turno : turnoRepository.findAllByPedidoIdIn(pedidoIds)) {
			mapa.put(turno.getPedidoId(), TurnoResponse.from(turno));
		}
		return mapa;
	}

	@Transactional
	public void cancelarPorPedido(UUID pedidoId) {
		turnoRepository.findByPedidoId(pedidoId).ifPresent(turno -> {
			if (turno.getEstado() == EstadoTurno.EN_ESPERA || turno.getEstado() == EstadoTurno.LLAMADO) {
				turno.setEstado(EstadoTurno.CANCELADO);
				turnoRepository.save(turno);
			}
		});
	}

	@Transactional
	public void marcarAtendidoPorPedido(UUID pedidoId) {
		turnoRepository.findByPedidoId(pedidoId).ifPresent(turno -> {
			if (turno.getEstado() == EstadoTurno.EN_ESPERA || turno.getEstado() == EstadoTurno.LLAMADO) {
				turno.setEstado(EstadoTurno.ATENDIDO);
				turno.setAtendidoEn(Instant.now(clock));
				turnoRepository.save(turno);
			}
		});
	}

	@Transactional
	public void marcarVencidoPorPedido(UUID pedidoId) {
		turnoRepository.findByPedidoId(pedidoId).ifPresent(turno -> {
			if (turno.getEstado() == EstadoTurno.EN_ESPERA || turno.getEstado() == EstadoTurno.LLAMADO) {
				turno.setEstado(EstadoTurno.VENCIDO);
				turnoRepository.save(turno);
			}
		});
	}

	@Transactional
	public List<TurnoResponse> listarColaDelDia(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			LocalDate fechaSolicitada) {
		UUID sedeId = resolverSedeOperacion(auth, sedeIdSolicitada);
		PedidoPorTurnoPort port = pedidoPorTurnoProvider.getIfAvailable();
		if (port != null) {
			port.evaluarVencimientoPedidosDeSede(sedeId);
		}
		LocalDate fecha = fechaSolicitada == null ? ahoraBogota().toLocalDate() : fechaSolicitada;
		return turnoRepository.findAllBySedeIdAndFechaOrderByFranjaInicioAscNumeroAsc(sedeId, fecha).stream()
				.map(TurnoResponse::from)
				.toList();
	}

	@Transactional
	public TurnoResponse llamarSiguiente(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			LocalDate fechaSolicitada) {
		UUID sedeId = resolverSedeOperacion(auth, sedeIdSolicitada);
		PedidoPorTurnoPort port = pedidoPorTurnoProvider.getIfAvailable();
		if (port != null) {
			port.evaluarVencimientoPedidosDeSede(sedeId);
		}

		LocalDate fecha = fechaSolicitada == null ? ahoraBogota().toLocalDate() : fechaSolicitada;
		turnoRepository.adquirirBloqueoTransaccional("turno-cola:" + sedeId + ":" + fecha);

		Turno siguiente = turnoRepository
				.findFirstBySedeIdAndFechaAndEstadoOrderByFranjaInicioAscNumeroAsc(
						sedeId, fecha, EstadoTurno.EN_ESPERA)
				.orElseThrow(() -> ApiException.conflict(
						"SIN_TURNOS_EN_ESPERA",
						"Sin turnos en espera",
						"No hay turnos en espera para llamar en esta sede."));

		siguiente.setEstado(EstadoTurno.LLAMADO);
		siguiente.setLlamadoEn(Instant.now(clock));
		Turno guardado = turnoRepository.saveAndFlush(siguiente);

		if (port != null) {
			port.obtenerPacienteIdPorPedido(guardado.getPedidoId()).ifPresent(pacienteId ->
					eventPublisher.publishEvent(new TurnoLlamadoEvent(
							guardado.getId(),
							guardado.getPedidoId(),
							pacienteId,
							guardado.getSedeId(),
							guardado.getCodigo(),
							guardado.getFranjaInicio())));
		}

		return TurnoResponse.from(guardado);
	}

	@Transactional
	public TurnoResponse vencerTurnoManual(UsuarioAutenticado auth, UUID turnoId) {
		Turno turno = turnoRepository.findByIdForUpdate(turnoId)
				.orElseThrow(() -> ApiException.notFound(
						"TURNO_NO_ENCONTRADO",
						"Turno no encontrado",
						"No se encontró el turno solicitado."));

		verificarAccesoSede(auth, turno.getSedeId());

		if (turno.getEstado() != EstadoTurno.EN_ESPERA && turno.getEstado() != EstadoTurno.LLAMADO) {
			throw ApiException.conflict(
					"TRANSICION_INVALIDA",
					"Transición de turno inválida",
					"Solo se pueden vencer turnos en estado EN_ESPERA o LLAMADO.");
		}

		turno.setEstado(EstadoTurno.VENCIDO);
		Turno guardado = turnoRepository.saveAndFlush(turno);

		PedidoPorTurnoPort port = pedidoPorTurnoProvider.getIfAvailable();
		if (port != null) {
			port.vencerPedidoPorTurno(guardado.getPedidoId(), auth.usuarioId(), "Paciente no se presentó al turno");
		}

		return TurnoResponse.from(guardado);
	}

	@Transactional(readOnly = true)
	public PantallaSalaResponse obtenerPantallaSala(String sedeCodigo, LocalDate fechaSolicitada) {
		SedePublicaResponse sede = catalogoConsultaService.obtenerSedePorCodigo(sedeCodigo)
				.orElseThrow(() -> ApiException.notFound(
						"SEDE_NO_ENCONTRADA",
						"Sede no encontrada",
						"No existe una sede con el código indicado."));

		LocalDate fecha = fechaSolicitada == null ? ahoraBogota().toLocalDate() : fechaSolicitada;
		List<TurnoSalaItem> llamados = turnoRepository
				.findAllBySedeIdAndFechaAndEstadoOrderByLlamadoEnDescNumeroAsc(
						sede.id(), fecha, EstadoTurno.LLAMADO)
				.stream()
				.map(t -> new TurnoSalaItem(t.getCodigo(), t.getFranjaInicio(), t.getLlamadoEn()))
				.toList();
		List<TurnoSalaItem> enEspera = turnoRepository
				.findAllBySedeIdAndFechaAndEstadoOrderByFranjaInicioAscNumeroAsc(
						sede.id(), fecha, EstadoTurno.EN_ESPERA)
				.stream()
				.map(t -> new TurnoSalaItem(t.getCodigo(), t.getFranjaInicio(), null))
				.toList();

		return new PantallaSalaResponse(sede.codigo(), sede.nombre(), fecha, llamados, enEspera);
	}

	/**
	 * Tarea programada VencerTurnos (00 §11): idempotente, basada en marcas de tiempo.
	 */
	@Transactional
	public int vencerTurnosExpirados() {
		int franjaMin = parametroService.obtenerEntero(ParametroService.TURNO_FRANJA_MIN, 30);
		int graciaMin = parametroService.obtenerEntero(ParametroService.RESERVA_GRACIA_TURNO_MIN, 30);
		Instant ahora = Instant.now(clock);

		List<Turno> enEspera = turnoRepository.findAllByEstado(EstadoTurno.EN_ESPERA);
		int vencidos = 0;
		PedidoPorTurnoPort port = pedidoPorTurnoProvider.getIfAvailable();

		for (Turno candidato : enEspera) {
			Instant limite = ZonedDateTime.of(
							candidato.getFecha(), candidato.getFranjaInicio(), ParametroService.ZONA_NEGOCIO)
					.plusMinutes((long) franjaMin + graciaMin)
					.toInstant();
			if (limite.isAfter(ahora)) {
				continue;
			}
			Turno turno = turnoRepository.findByIdForUpdate(candidato.getId()).orElse(null);
			if (turno == null || turno.getEstado() != EstadoTurno.EN_ESPERA) {
				continue;
			}
			turno.setEstado(EstadoTurno.VENCIDO);
			turnoRepository.save(turno);
			if (port != null) {
				port.vencerPedidoPorTurno(turno.getPedidoId(), null, "Turno vencido por franja expirada");
			}
			vencidos++;
		}
		return vencidos;
	}

	private FranjaValidada resolverYValidarFranja(SedePublicaResponse sede, OffsetDateTime franjaInicioInput) {
		if (franjaInicioInput == null) {
			throw ApiException.badRequest(
					"FRANJA_REQUERIDA",
					"Franja horaria requerida",
					"Para pedidos de modalidad RECOGER debe seleccionar una franja horaria.");
		}

		int franjaMin = parametroService.obtenerEntero(ParametroService.TURNO_FRANJA_MIN, 30);
		int capacidad = parametroService.obtenerEntero(ParametroService.TURNO_CAPACIDAD_FRANJA, 6);
		int diasAdelante = parametroService.obtenerEntero(ParametroService.TURNO_DIAS_ADELANTE, 1);

		ZonedDateTime ahoraBogota = ahoraBogota();
		ZonedDateTime inicioZoned = franjaInicioInput.atZoneSameInstant(ParametroService.ZONA_NEGOCIO);
		LocalDate hoy = ahoraBogota.toLocalDate();
		LocalDate fecha = inicioZoned.toLocalDate();
		LocalTime hora = inicioZoned.toLocalTime();

		if (hora.getSecond() != 0 || hora.getNano() != 0) {
			throw ApiException.unprocessable(
					"FRANJA_INVALIDA",
					"Franja horaria inválida",
					"La franja horaria debe iniciar en una marca exacta de minutos.");
		}
		if (fecha.isBefore(hoy) || fecha.isAfter(hoy.plusDays(diasAdelante))) {
			throw ApiException.unprocessable(
					"FRANJA_INVALIDA",
					"Franja horaria fuera de rango",
					"Solo se pueden agendar turnos para hoy o los próximos " + diasAdelante + " día(s).");
		}
		if (hora.isBefore(sede.horaApertura()) || hora.plusMinutes(franjaMin).isAfter(sede.horaCierre())) {
			throw ApiException.unprocessable(
					"FRANJA_INVALIDA",
					"Franja fuera del horario de la sede",
					"La franja seleccionada está fuera del horario de atención de la sede.");
		}
		long minutosDesdeApertura = Duration.between(sede.horaApertura(), hora).toMinutes();
		if (minutosDesdeApertura < 0 || minutosDesdeApertura % franjaMin != 0) {
			throw ApiException.unprocessable(
					"FRANJA_INVALIDA",
					"Franja horaria inválida",
					"La hora de inicio no coincide con las franjas de " + franjaMin + " minutos de la sede.");
		}
		if (inicioZoned.isBefore(ahoraBogota.plusMinutes(ANTICIPACION_MINUTOS))) {
			throw ApiException.unprocessable(
					"FRANJA_INVALIDA",
					"Anticipación insuficiente",
					"Los turnos deben agendarse con al menos " + ANTICIPACION_MINUTOS + " minutos de anticipación.");
		}

		return new FranjaValidada(fecha, hora, inicioZoned, franjaMin, capacidad);
	}

	private UUID resolverSedeOperacion(UsuarioAutenticado auth, UUID sedeIdSolicitada) {
		if (auth.esEmpleado()) {
			if (auth.sedeId() == null) {
				throw ApiException.forbidden(
						"SEDE_NO_ASIGNADA",
						"Sede no asignada",
						"El empleado no tiene una sede asignada.");
			}
			if (sedeIdSolicitada != null && !sedeIdSolicitada.equals(auth.sedeId())) {
				throw ApiException.forbidden(
						"SEDE_NO_AUTORIZADA",
						"Sede no autorizada",
						"No tiene permiso para operar turnos de otra sede.");
			}
			return auth.sedeId();
		}
		if (auth.esAdmin()) {
			if (sedeIdSolicitada == null) {
				throw ApiException.badRequest(
						"SEDE_REQUERIDA",
						"Sede requerida",
						"El administrador debe indicar sedeId para consultar u operar la cola de turnos.");
			}
			catalogoConsultaService.obtenerSedePorId(sedeIdSolicitada)
					.orElseThrow(() -> ApiException.notFound(
							"SEDE_NO_ENCONTRADA",
							"Sede no encontrada",
							"No existe una sede con el identificador indicado."));
			return sedeIdSolicitada;
		}
		throw ApiException.forbidden("ACCESO_DENEGADO", "Acceso denegado", "No tiene permisos para operar turnos.");
	}

	private void verificarAccesoSede(UsuarioAutenticado auth, UUID sedeIdRecurso) {
		if (auth.esEmpleado() && !sedeIdRecurso.equals(auth.sedeId())) {
			throw ApiException.forbidden(
					"SEDE_NO_AUTORIZADA",
					"Sede no autorizada",
					"No tiene permiso para operar turnos de otra sede.");
		}
	}

	private String generarCodigoTurno(String sedeCodigo, int numero) {
		String base = sedeCodigo == null ? "TRN" : sedeCodigo.trim().toUpperCase(Locale.ROOT);
		if (base.startsWith("SEDE-")) {
			base = base.substring(5);
		}
		String limpio = base.replaceAll("[^A-Z0-9]", "");
		String prefijo = limpio.isEmpty() ? "TRN" : limpio.substring(0, Math.min(3, limpio.length()));
		return String.format("%s-%03d", prefijo, numero);
	}

	private ZonedDateTime ahoraBogota() {
		return ZonedDateTime.now(clock).withZoneSameInstant(ParametroService.ZONA_NEGOCIO);
	}

	private record FranjaValidada(
			LocalDate fecha,
			LocalTime horaInicio,
			ZonedDateTime inicioZoned,
			int franjaMin,
			int capacidad) {
	}
}
