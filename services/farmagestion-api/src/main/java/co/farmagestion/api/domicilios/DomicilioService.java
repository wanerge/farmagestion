package co.farmagestion.api.domicilios;

import co.farmagestion.api.auth.AuthService;
import co.farmagestion.api.auth.CargoEmpleado;
import co.farmagestion.api.auth.EmpleadoResumen;
import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.catalogo.CatalogoConsultaService;
import co.farmagestion.api.catalogo.SedePublicaResponse;
import co.farmagestion.api.common.domain.ParametroService;
import co.farmagestion.api.common.web.ApiException;
import co.farmagestion.api.domicilios.HeuristicoRutaService.ParadaCalculada;
import co.farmagestion.api.domicilios.HeuristicoRutaService.PuntoEntrega;
import co.farmagestion.api.domicilios.HeuristicoRutaService.ResultadoHeuristico;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class DomicilioService implements RutaPorPedidoConsulta {

	private static final int ORDEN_TEMPORAL_OFFSET = 10_000;

	private final RutaRepository rutaRepository;
	private final RutaParadaRepository rutaParadaRepository;
	private final HeuristicoRutaService heuristicoRutaService;
	private final PedidoDomicilioPort pedidoDomicilioPort;
	private final CatalogoConsultaService catalogoConsultaService;
	private final AuthService authService;
	private final ParametroService parametroService;
	private final TransactionTemplate transactionTemplate;
	private final Clock clock;

	public DomicilioService(
			RutaRepository rutaRepository,
			RutaParadaRepository rutaParadaRepository,
			HeuristicoRutaService heuristicoRutaService,
			PedidoDomicilioPort pedidoDomicilioPort,
			CatalogoConsultaService catalogoConsultaService,
			AuthService authService,
			ParametroService parametroService,
			PlatformTransactionManager transactionManager,
			Clock clock) {
		this.rutaRepository = rutaRepository;
		this.rutaParadaRepository = rutaParadaRepository;
		this.heuristicoRutaService = heuristicoRutaService;
		this.pedidoDomicilioPort = pedidoDomicilioPort;
		this.catalogoConsultaService = catalogoConsultaService;
		this.authService = authService;
		this.parametroService = parametroService;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
		this.clock = clock;
	}

	/**
	 * Lista pedidos DOMICILIO en estado LISTO de la sede sin ruta activa, junto con
	 * coordenadas de origen y domiciliarios disponibles (RF-EMP-19, RN-EMP-06).
	 */
	public DomiciliosPendientesResponse listarPendientes(UsuarioAutenticado auth, UUID sedeIdSolicitada) {
		UUID sedeId = resolverSedeOperacion(auth, sedeIdSolicitada, true);
		pedidoDomicilioPort.evaluarVencimientoPedidosDeSede(sedeId);

		SedePublicaResponse sede = obtenerSedeOReportar(sedeId);
		List<PedidoDomicilioSnapshot> listos = pedidoDomicilioPort.listarPedidosDomicilioListosDeSede(sedeId);

		Set<UUID> enRutaActiva = listos.isEmpty()
				? Collections.emptySet()
				: new HashSet<>(rutaParadaRepository.findPedidoIdsEnRutasActivas(
						listos.stream().map(PedidoDomicilioSnapshot::id).toList()));

		List<PedidoPendienteDomicilioResponse> disponibles = listos.stream()
				.filter(p -> !enRutaActiva.contains(p.id()))
				.map(PedidoPendienteDomicilioResponse::from)
				.toList();

		List<DomiciliarioResumenResponse> domiciliarios = authService.obtenerDomiciliariosActivosDeSede(sedeId)
				.stream()
				.map(d -> new DomiciliarioResumenResponse(d.usuarioId(), d.nombres(), d.apellidos()))
				.toList();

		int maxParadas = parametroService.obtenerEntero(ParametroService.DOMICILIO_MAX_PARADAS, 8);
		int maxIntentos = parametroService.obtenerEntero(ParametroService.DOMICILIO_MAX_INTENTOS, 2);

		return new DomiciliosPendientesResponse(
				sede.id(),
				sede.codigo(),
				sede.nombre(),
				sede.direccion(),
				sede.latitud(),
				sede.longitud(),
				maxParadas,
				maxIntentos,
				domiciliarios,
				disponibles);
	}

	/**
	 * Lista rutas de la sede (o de todas si es ADMIN sin sedeId) para una fecha dada (por defecto hoy).
	 */
	@Transactional(readOnly = true)
	public List<RutaDetalleResponse> listarRutasGestion(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			LocalDate fecha) {
		UUID sedeId = resolverSedeOperacion(auth, sedeIdSolicitada, false);
		LocalDate fechaConsulta = fecha != null ? fecha : hoyBogota();
		List<Ruta> rutas = sedeId != null
				? rutaRepository.findAllBySedeIdAndFechaOrderByCreatedAtDesc(sedeId, fechaConsulta)
				: rutaRepository.findAllByFechaOrderByCreatedAtDesc(fechaConsulta);
		return construirDetallesRutas(rutas);
	}

	/**
	 * Lista las rutas asignadas al domiciliario autenticado (RF-EMP-22, RN-EMP-05).
	 */
	@Transactional(readOnly = true)
	public List<RutaDetalleResponse> listarMisRutas(UsuarioAutenticado auth, LocalDate fecha) {
		LocalDate fechaConsulta = fecha != null ? fecha : hoyBogota();
		List<Ruta> rutas = rutaRepository.findAllByDomiciliarioIdAndFechaOrderByCreatedAtDesc(
				auth.usuarioId(), fechaConsulta);
		return construirDetallesRutas(rutas);
	}

	/**
	 * Consulta una ruta por ID respetando alcance por sede y asignación del domiciliario (RN-EMP-05, CA-EMP-13).
	 */
	@Transactional(readOnly = true)
	public RutaDetalleResponse obtenerRutaDetalle(UsuarioAutenticado auth, UUID rutaId) {
		Ruta ruta = rutaRepository.findById(rutaId)
				.orElseThrow(() -> ApiException.notFound(
						"RUTA_NO_ENCONTRADA",
						"Ruta no encontrada",
						"No existe una ruta con el identificador indicado."));
		verificarAccesoLecturaRuta(auth, ruta);
		return construirDetallesRutas(List.of(ruta)).getFirst();
	}

	/**
	 * Crea una ruta PLANEADA ordenando las paradas con vecino más cercano (Haversine) + 1 pasada de 2-opt
	 * (RF-EMP-20, RN-EMP-06, CA-EMP-11).
	 */
	public RutaDetalleResponse crearRuta(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			CrearRutaRequest request) {
		List<UUID> pedidoIds = request.pedidoIds();
		Set<UUID> unicos = new LinkedHashSet<>(pedidoIds);
		if (unicos.size() != pedidoIds.size()) {
			throw ApiException.badRequest(
					"PEDIDOS_DUPLICADOS",
					"Pedidos duplicados",
					"La lista de pedidos para la ruta contiene identificadores repetidos.");
		}

		int maxParadas = parametroService.obtenerEntero(ParametroService.DOMICILIO_MAX_PARADAS, 8);
		if (pedidoIds.size() > maxParadas) {
			throw ApiException.unprocessable(
					"MAX_PARADAS_EXCEDIDO",
					"Máximo de paradas excedido",
					"Una ruta puede tener máximo " + maxParadas + " paradas (se solicitaron " + pedidoIds.size() + ").");
		}

		EmpleadoResumen domiciliario = authService.obtenerEmpleadoActivo(request.domiciliarioId())
				.orElseThrow(() -> ApiException.notFound(
						"DOMICILIARIO_NO_ENCONTRADO",
						"Domiciliario no encontrado",
						"No se encontró un empleado activo con el identificador indicado."));
		if (domiciliario.cargo() != CargoEmpleado.DOMICILIARIO || domiciliario.sedeId() == null) {
			throw ApiException.unprocessable(
					"DOMICILIARIO_INVALIDO",
					"Domiciliario inválido",
					"El empleado seleccionado no tiene el cargo DOMICILIARIO o no tiene sede asignada.");
		}

		UUID sedeId = resolverSedeParaCrearRuta(auth, sedeIdSolicitada, domiciliario);
		SedePublicaResponse sede = obtenerSedeOReportar(sedeId);

		// Evaluar vencimiento perezoso antes de armar la ruta
		pedidoDomicilioPort.evaluarVencimientoPedidosDeSede(sedeId);

		UUID rutaId = transactionTemplate.execute(status -> {
			Map<UUID, PedidoDomicilioSnapshot> pedidos = pedidoDomicilioPort.obtenerPedidosPorIds(pedidoIds);
			List<PuntoEntrega> puntos = new ArrayList<>(pedidoIds.size());

			for (UUID pedidoId : pedidoIds) {
				PedidoDomicilioSnapshot p = pedidos.get(pedidoId);
				if (p == null) {
					throw ApiException.notFound(
							"PEDIDO_NO_ENCONTRADO",
							"Pedido no encontrado",
							"No existe el pedido con identificador " + pedidoId + ".");
				}
				if (!sedeId.equals(p.sedeId())) {
					if (auth.esEmpleado()) {
						throw ApiException.forbidden(
								"SEDE_NO_AUTORIZADA",
								"Sede no autorizada",
								"No puede incluir pedidos de otra sede en una ruta.");
					}
					throw ApiException.unprocessable(
							"PEDIDO_OTRA_SEDE",
							"Pedido de otra sede",
							"Todos los pedidos de una ruta deben pertenecer a la misma sede.");
				}
				if (!"DOMICILIO".equals(p.modalidad())) {
					throw ApiException.unprocessable(
							"PEDIDO_NO_ES_DOMICILIO",
							"Modalidad inválida",
							"El pedido " + p.codigo() + " no corresponde a la modalidad DOMICILIO.");
				}
				if (!"LISTO".equals(p.estado())) {
					throw ApiException.conflict(
							"PEDIDO_NO_LISTO",
							"Pedido no está listo",
							"El pedido " + p.codigo() + " debe estar en estado LISTO para incluirse en una ruta (actual: "
									+ p.estado() + ").");
				}
				if (p.latitudEntrega() == null || p.longitudEntrega() == null) {
					throw ApiException.unprocessable(
							"COORDENADAS_REQUERIDAS",
							"Coordenadas faltantes",
							"El pedido " + p.codigo() + " no tiene coordenadas de entrega registradas.");
				}
				puntos.add(new PuntoEntrega(
						p.id(),
						p.latitudEntrega().doubleValue(),
						p.longitudEntrega().doubleValue()));
			}

			List<UUID> yaEnRuta = rutaParadaRepository.findPedidoIdsEnRutasActivas(pedidoIds);
			if (!yaEnRuta.isEmpty()) {
				throw ApiException.conflict(
						"PEDIDO_YA_EN_RUTA_ACTIVA",
						"Pedido ya incluido en una ruta activa",
						"Uno o más pedidos ya hacen parte de una ruta activa (RN-EMP-06).");
			}

			ResultadoHeuristico resultado = heuristicoRutaService.optimizarRuta(
					sede.latitud().doubleValue(),
					sede.longitud().doubleValue(),
					puntos);

			Ruta ruta = new Ruta();
			ruta.setSedeId(sedeId);
			ruta.setDomiciliarioId(domiciliario.usuarioId());
			ruta.setFecha(hoyBogota());
			ruta.setEstado(EstadoRuta.PLANEADA);
			ruta.setDistanciaKm(resultado.distanciaTotalKm());
			Ruta guardada = rutaRepository.saveAndFlush(ruta);

			for (ParadaCalculada pc : resultado.paradas()) {
				RutaParada parada = new RutaParada();
				parada.setRutaId(guardada.getId());
				parada.setPedidoId(pc.pedidoId());
				parada.setOrden(pc.orden());
				parada.setEstado(EstadoRutaParada.PENDIENTE);
				parada.setDistanciaKmDesdeAnterior(pc.distanciaKmDesdeAnterior());
				rutaParadaRepository.save(parada);
			}
			rutaParadaRepository.flush();

			return guardada.getId();
		});

		return obtenerRutaDetalle(auth, rutaId);
	}

	/**
	 * Reordena manualmente las paradas de una ruta PLANEADA y recalcula las distancias (RF-EMP-21).
	 */
	public RutaDetalleResponse reordenarParadas(
			UsuarioAutenticado auth,
			UUID rutaId,
			ReordenarRutaRequest request) {
		List<UUID> nuevosIds = request.paradaIds();
		Set<UUID> unicos = new LinkedHashSet<>(nuevosIds);
		if (unicos.size() != nuevosIds.size()) {
			throw ApiException.badRequest(
					"PARADAS_DUPLICADAS",
					"Paradas duplicadas",
					"La lista de paradas contiene identificadores repetidos.");
		}

		transactionTemplate.executeWithoutResult(status -> {
			Ruta ruta = rutaRepository.findByIdForUpdate(rutaId)
					.orElseThrow(() -> ApiException.notFound(
							"RUTA_NO_ENCONTRADA",
							"Ruta no encontrada",
							"No existe una ruta con el identificador indicado."));
			verificarAccesoGestionRuta(auth, ruta);

			if (ruta.getEstado() != EstadoRuta.PLANEADA) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Ruta no editable",
						"Solo se pueden reordenar las paradas de una ruta en estado PLANEADA (actual: "
								+ ruta.getEstado() + ").");
			}

			List<RutaParada> paradasActuales = rutaParadaRepository.findAllByRutaIdOrderByOrdenAsc(rutaId);
			if (paradasActuales.size() != nuevosIds.size()) {
				throw ApiException.badRequest(
						"PARADAS_INVALIDAS",
						"Lista de paradas incompleta",
						"Debe enviar exactamente todas las paradas que pertenecen a la ruta.");
			}

			Map<UUID, RutaParada> paradaPorId = new HashMap<>();
			for (RutaParada rp : paradasActuales) {
				paradaPorId.put(rp.getId(), rp);
			}
			List<RutaParada> paradasEnNuevoOrden = new ArrayList<>(nuevosIds.size());
			for (UUID paradaId : nuevosIds) {
				RutaParada rp = paradaPorId.get(paradaId);
				if (rp == null) {
					throw ApiException.badRequest(
							"PARADAS_INVALIDAS",
							"Parada no pertenece a la ruta",
							"La parada " + paradaId + " no pertenece a la ruta indicada.");
				}
				paradasEnNuevoOrden.add(rp);
			}

			SedePublicaResponse sede = obtenerSedeOReportar(ruta.getSedeId());
			Map<UUID, PedidoDomicilioSnapshot> pedidos = pedidoDomicilioPort.obtenerPedidosPorIds(
					paradasEnNuevoOrden.stream().map(RutaParada::getPedidoId).toList());

			List<PuntoEntrega> puntosOrdenados = paradasEnNuevoOrden.stream()
					.map(rp -> {
						PedidoDomicilioSnapshot p = pedidos.get(rp.getPedidoId());
						return new PuntoEntrega(
								rp.getPedidoId(),
								p.latitudEntrega().doubleValue(),
								p.longitudEntrega().doubleValue());
					})
					.toList();

			ResultadoHeuristico recalculado = heuristicoRutaService.calcularDistanciasEnOrden(
					sede.latitud().doubleValue(),
					sede.longitud().doubleValue(),
					puntosOrdenados);

			// Actualización en dos fases para respetar UNIQUE(ruta_id, orden) sin colisiones
			for (int i = 0; i < paradasEnNuevoOrden.size(); i++) {
				paradasEnNuevoOrden.get(i).setOrden(ORDEN_TEMPORAL_OFFSET + i + 1);
			}
			rutaParadaRepository.saveAllAndFlush(paradasEnNuevoOrden);

			for (int i = 0; i < paradasEnNuevoOrden.size(); i++) {
				RutaParada rp = paradasEnNuevoOrden.get(i);
				ParadaCalculada calc = recalculado.paradas().get(i);
				rp.setOrden(calc.orden());
				rp.setDistanciaKmDesdeAnterior(calc.distanciaKmDesdeAnterior());
			}
			rutaParadaRepository.saveAllAndFlush(paradasEnNuevoOrden);

			ruta.setDistanciaKm(recalculado.distanciaTotalKm());
			rutaRepository.saveAndFlush(ruta);
		});

		return obtenerRutaDetalle(auth, rutaId);
	}

	/**
	 * Inicia una ruta PLANEADA → EN_CURSO y transiciona sus pedidos LISTO → EN_RUTA (RF-EMP-21, CA-PAC-10).
	 */
	public RutaDetalleResponse iniciarRuta(UsuarioAutenticado auth, UUID rutaId) {
		Ruta previa = rutaRepository.findById(rutaId)
				.orElseThrow(() -> ApiException.notFound(
						"RUTA_NO_ENCONTRADA",
						"Ruta no encontrada",
						"No existe una ruta con el identificador indicado."));
		verificarAccesoGestionRuta(auth, previa);
		pedidoDomicilioPort.evaluarVencimientoPedidosDeSede(previa.getSedeId());

		transactionTemplate.executeWithoutResult(status -> {
			Ruta ruta = rutaRepository.findByIdForUpdate(rutaId)
					.orElseThrow(() -> ApiException.notFound(
							"RUTA_NO_ENCONTRADA",
							"Ruta no encontrada",
							"No existe una ruta con el identificador indicado."));
			verificarAccesoGestionRuta(auth, ruta);

			if (ruta.getEstado() != EstadoRuta.PLANEADA) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Transición inválida",
						"Solo se puede iniciar una ruta en estado PLANEADA (actual: " + ruta.getEstado() + ").");
			}

			List<RutaParada> paradas = rutaParadaRepository.findAllByRutaIdOrderByOrdenAsc(rutaId);
			if (paradas.isEmpty()) {
				throw ApiException.conflict(
						"RUTA_SIN_PARADAS",
						"Ruta sin paradas",
						"La ruta no tiene paradas para iniciar.");
			}

			List<UUID> pedidoIds = paradas.stream().map(RutaParada::getPedidoId).toList();
			pedidoDomicilioPort.iniciarEntregaPedidosEnRuta(
					ruta.getSedeId(), pedidoIds, auth.usuarioId(), ruta.getId());

			ruta.setEstado(EstadoRuta.EN_CURSO);
			rutaRepository.saveAndFlush(ruta);
		});

		return obtenerRutaDetalle(auth, rutaId);
	}

	/**
	 * Marca una parada PENDIENTE como ENTREGADA, dispensa stock, encola outbox y completa la ruta si no quedan pendientes
	 * (RF-EMP-22, RF-EMP-24, RN-EMP-05, RN-06).
	 */
	public RutaDetalleResponse marcarParadaEntregada(
			UsuarioAutenticado auth,
			UUID rutaId,
			UUID paradaId,
			EntregarParadaRequest request) {
		transactionTemplate.executeWithoutResult(status -> {
			Ruta ruta = rutaRepository.findByIdForUpdate(rutaId)
					.orElseThrow(() -> ApiException.notFound(
							"RUTA_NO_ENCONTRADA",
							"Ruta no encontrada",
							"No existe una ruta con el identificador indicado."));
			verificarDomiciliarioAsignado(auth, ruta);

			if (ruta.getEstado() != EstadoRuta.EN_CURSO) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Transición inválida",
						"Solo se pueden registrar entregas en una ruta EN_CURSO (actual: " + ruta.getEstado() + ").");
			}

			RutaParada parada = rutaParadaRepository.findByIdAndRutaId(paradaId, rutaId)
					.orElseThrow(() -> ApiException.notFound(
							"PARADA_NO_ENCONTRADA",
							"Parada no encontrada",
							"No existe la parada indicada en esta ruta."));

			if (parada.getEstado() != EstadoRutaParada.PENDIENTE) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Parada ya resuelta",
						"La parada ya fue marcada en estado " + parada.getEstado() + ".");
			}

			String nota = (request == null || request.nota() == null || request.nota().isBlank())
					? null
					: request.nota().trim();
			pedidoDomicilioPort.entregarPedidoDomicilio(parada.getPedidoId(), auth.usuarioId(), nota);

			parada.setEstado(EstadoRutaParada.ENTREGADA);
			rutaParadaRepository.saveAndFlush(parada);

			completarRutaSiSinPendientes(ruta);
		});

		return obtenerRutaDetalle(auth, rutaId);
	}

	/**
	 * Marca una parada PENDIENTE como FALLIDA con motivo, actualiza intentos del pedido
	 * (LISTO si intentos < max_intentos, CANCELADO con liberación si intentos >= max_intentos)
	 * y completa la ruta si no quedan pendientes (RF-EMP-22, RF-EMP-23, RF-EMP-24, CA-EMP-12).
	 */
	public RutaDetalleResponse marcarParadaFallida(
			UsuarioAutenticado auth,
			UUID rutaId,
			UUID paradaId,
			ParadaFallidaRequest request) {
		int maxIntentos = parametroService.obtenerEntero(ParametroService.DOMICILIO_MAX_INTENTOS, 2);

		transactionTemplate.executeWithoutResult(status -> {
			Ruta ruta = rutaRepository.findByIdForUpdate(rutaId)
					.orElseThrow(() -> ApiException.notFound(
							"RUTA_NO_ENCONTRADA",
							"Ruta no encontrada",
							"No existe una ruta con el identificador indicado."));
			verificarDomiciliarioAsignado(auth, ruta);

			if (ruta.getEstado() != EstadoRuta.EN_CURSO) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Transición inválida",
						"Solo se pueden registrar fallos en una ruta EN_CURSO (actual: " + ruta.getEstado() + ").");
			}

			RutaParada parada = rutaParadaRepository.findByIdAndRutaId(paradaId, rutaId)
					.orElseThrow(() -> ApiException.notFound(
							"PARADA_NO_ENCONTRADA",
							"Parada no encontrada",
							"No existe la parada indicada en esta ruta."));

			if (parada.getEstado() != EstadoRutaParada.PENDIENTE) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Parada ya resuelta",
						"La parada ya fue marcada en estado " + parada.getEstado() + ".");
			}

			pedidoDomicilioPort.registrarEntregaFallida(
					parada.getPedidoId(),
					auth.usuarioId(),
					request.motivo().trim(),
					maxIntentos);

			parada.setEstado(EstadoRutaParada.FALLIDA);
			rutaParadaRepository.saveAndFlush(parada);

			completarRutaSiSinPendientes(ruta);
		});

		return obtenerRutaDetalle(auth, rutaId);
	}

	@Override
	@Transactional(readOnly = true)
	public Optional<RutaResumenPedidoResponse> obtenerResumenPorPedido(UUID pedidoId) {
		List<RutaParada> historial = rutaParadaRepository.findHistorialParadasPorPedido(pedidoId);
		if (historial.isEmpty()) {
			return Optional.empty();
		}
		RutaParada reciente = historial.getFirst();
		Ruta ruta = rutaRepository.findById(reciente.getRutaId()).orElse(null);
		if (ruta == null) {
			return Optional.empty();
		}
		String domiciliarioNombre = authService.obtenerEmpleado(ruta.getDomiciliarioId())
				.map(e -> e.nombres() + " " + e.apellidos())
				.orElse(null);
		return Optional.of(new RutaResumenPedidoResponse(
				ruta.getId(),
				ruta.getFecha(),
				ruta.getEstado(),
				reciente.getOrden(),
				reciente.getEstado(),
				domiciliarioNombre,
				ruta.getDistanciaKm()));
	}

	private void completarRutaSiSinPendientes(Ruta ruta) {
		List<RutaParada> paradas = rutaParadaRepository.findAllByRutaIdOrderByOrdenAsc(ruta.getId());
		boolean quedanPendientes = paradas.stream().anyMatch(p -> p.getEstado() == EstadoRutaParada.PENDIENTE);
		if (!quedanPendientes) {
			ruta.setEstado(EstadoRuta.COMPLETADA);
			rutaRepository.saveAndFlush(ruta);
		}
	}

	private List<RutaDetalleResponse> construirDetallesRutas(List<Ruta> rutas) {
		if (rutas.isEmpty()) {
			return List.of();
		}
		List<UUID> rutaIds = rutas.stream().map(Ruta::getId).toList();
		List<RutaParada> todasParadas = rutaParadaRepository.findAllByRutaIdInOrderByRutaIdAscOrdenAsc(rutaIds);

		Map<UUID, List<RutaParada>> paradasPorRuta = new HashMap<>();
		Set<UUID> pedidoIds = new HashSet<>();
		for (RutaParada rp : todasParadas) {
			paradasPorRuta.computeIfAbsent(rp.getRutaId(), k -> new ArrayList<>()).add(rp);
			pedidoIds.add(rp.getPedidoId());
		}

		Set<UUID> sedeIds = rutas.stream().map(Ruta::getSedeId).collect(Collectors.toSet());
		Set<UUID> domIds = rutas.stream().map(Ruta::getDomiciliarioId).collect(Collectors.toSet());

		Map<UUID, SedePublicaResponse> sedes = catalogoConsultaService.obtenerSedesPorIds(sedeIds);
		Map<UUID, EmpleadoResumen> domiciliarios = authService.obtenerEmpleadosPorIds(domIds);
		Map<UUID, PedidoDomicilioSnapshot> pedidos = pedidoDomicilioPort.obtenerPedidosPorIds(pedidoIds);

		List<RutaDetalleResponse> respuesta = new ArrayList<>(rutas.size());
		for (Ruta ruta : rutas) {
			SedePublicaResponse sede = sedes.get(ruta.getSedeId());
			EmpleadoResumen dom = domiciliarios.get(ruta.getDomiciliarioId());
			List<RutaParada> paradasRuta = paradasPorRuta.getOrDefault(ruta.getId(), List.of());

			List<RutaParadaResponse> paradasDto = paradasRuta.stream()
					.map(rp -> {
						PedidoDomicilioSnapshot p = pedidos.get(rp.getPedidoId());
						return new RutaParadaResponse(
								rp.getId(),
								rp.getPedidoId(),
								p != null ? p.codigo() : null,
								rp.getOrden(),
								rp.getEstado(),
								rp.getDistanciaKmDesdeAnterior(),
								p != null ? p.estado() : null,
								p != null ? p.intentosEntrega() : 0,
								p != null ? p.pacienteNombre() : null,
								p != null ? p.pacienteDocumento() : null,
								p != null ? p.pacienteTelefono() : null,
								p != null ? p.direccionEntrega() : null,
								p != null ? p.latitudEntrega() : null,
								p != null ? p.longitudEntrega() : null,
								p != null && p.esParcial());
					})
					.toList();

			respuesta.add(new RutaDetalleResponse(
					ruta.getId(),
					ruta.getSedeId(),
					sede != null ? sede.codigo() : null,
					sede != null ? sede.nombre() : null,
					sede != null ? sede.direccion() : null,
					sede != null ? sede.latitud() : null,
					sede != null ? sede.longitud() : null,
					ruta.getDomiciliarioId(),
					dom != null ? dom.nombres() + " " + dom.apellidos() : null,
					ruta.getFecha(),
					ruta.getEstado(),
					ruta.getDistanciaKm(),
					ruta.getCreatedAt(),
					paradasDto));
		}
		return respuesta;
	}

	private LocalDate hoyBogota() {
		return LocalDate.now(clock.withZone(ParametroService.ZONA_NEGOCIO));
	}

	private SedePublicaResponse obtenerSedeOReportar(UUID sedeId) {
		return catalogoConsultaService.obtenerSedePorId(sedeId)
				.orElseThrow(() -> ApiException.notFound(
						"SEDE_NO_ENCONTRADA",
						"Sede no encontrada",
						"No existe una sede con el identificador indicado."));
	}

	private UUID resolverSedeOperacion(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			boolean obligatoriaParaAdmin) {
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
						"No tiene permiso para operar domicilios de otra sede.");
			}
			return auth.sedeId();
		}
		if (auth.esAdmin()) {
			if (sedeIdSolicitada != null) {
				obtenerSedeOReportar(sedeIdSolicitada);
				return sedeIdSolicitada;
			}
			if (obligatoriaParaAdmin) {
				throw ApiException.badRequest(
						"SEDE_REQUERIDA",
						"Sede requerida",
						"El administrador debe indicar sedeId.");
			}
			return null;
		}
		throw ApiException.forbidden("ACCESO_DENEGADO", "Acceso denegado", "No tiene permisos para operar domicilios.");
	}

	private UUID resolverSedeParaCrearRuta(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			EmpleadoResumen domiciliario) {
		if (auth.esEmpleado()) {
			UUID sedeEmpleado = resolverSedeOperacion(auth, sedeIdSolicitada, true);
			if (!sedeEmpleado.equals(domiciliario.sedeId())) {
				throw ApiException.unprocessable(
						"DOMICILIARIO_OTRA_SEDE",
						"Domiciliario de otra sede",
						"El domiciliario seleccionado no pertenece a la sede de la ruta.");
			}
			return sedeEmpleado;
		}
		if (auth.esAdmin()) {
			if (sedeIdSolicitada != null) {
				obtenerSedeOReportar(sedeIdSolicitada);
				if (!sedeIdSolicitada.equals(domiciliario.sedeId())) {
					throw ApiException.unprocessable(
							"DOMICILIARIO_OTRA_SEDE",
							"Domiciliario de otra sede",
							"El domiciliario seleccionado no pertenece a la sede indicada.");
				}
				return sedeIdSolicitada;
			}
			return domiciliario.sedeId();
		}
		throw ApiException.forbidden("ACCESO_DENEGADO", "Acceso denegado", "No tiene permisos para crear rutas.");
	}

	private void verificarAccesoGestionRuta(UsuarioAutenticado auth, Ruta ruta) {
		if (auth.esAdmin()) {
			return;
		}
		if (auth.esEmpleado() && ruta.getSedeId().equals(auth.sedeId())) {
			return;
		}
		throw ApiException.forbidden(
				"SEDE_NO_AUTORIZADA",
				"Sede no autorizada",
				"No tiene permiso para operar rutas de otra sede.");
	}

	private void verificarAccesoLecturaRuta(UsuarioAutenticado auth, Ruta ruta) {
		if (auth.esAdmin()) {
			return;
		}
		if (auth.esEmpleado() && auth.cargo() == CargoEmpleado.DOMICILIARIO) {
			verificarDomiciliarioAsignado(auth, ruta);
			return;
		}
		verificarAccesoGestionRuta(auth, ruta);
	}

	private void verificarDomiciliarioAsignado(UsuarioAutenticado auth, Ruta ruta) {
		if (!ruta.getDomiciliarioId().equals(auth.usuarioId())) {
			throw ApiException.forbidden(
					"RUTA_NO_ASIGNADA",
					"Ruta no asignada",
					"Solo el domiciliario asignado puede consultar o ejecutar esta ruta (RN-EMP-05).");
		}
	}
}
