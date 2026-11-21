package co.farmagestion.api.inventario;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.catalogo.CatalogoConsultaService;
import co.farmagestion.api.catalogo.MedicamentoPublicoResponse;
import co.farmagestion.api.catalogo.SedePublicaResponse;
import co.farmagestion.api.common.web.ApiException;
import co.farmagestion.api.common.web.PaginaResponse;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventarioGestionService {

	private static final int MAX_PAGE_SIZE = 100;
	private static final ZoneId ZONA_NEGOCIO = ZoneId.of("America/Bogota");

	private final InventarioRepository inventarioRepository;
	private final MovimientoInventarioRepository movimientoRepository;
	private final CatalogoConsultaService catalogoConsultaService;
	private final ApplicationEventPublisher eventPublisher;
	private final ObjectProvider<AjusteReservaExcedenteHandler> ajusteReservaHandlerProvider;

	public InventarioGestionService(
			InventarioRepository inventarioRepository,
			MovimientoInventarioRepository movimientoRepository,
			CatalogoConsultaService catalogoConsultaService,
			ApplicationEventPublisher eventPublisher,
			ObjectProvider<AjusteReservaExcedenteHandler> ajusteReservaHandlerProvider) {
		this.inventarioRepository = inventarioRepository;
		this.movimientoRepository = movimientoRepository;
		this.catalogoConsultaService = catalogoConsultaService;
		this.eventPublisher = eventPublisher;
		this.ajusteReservaHandlerProvider = ajusteReservaHandlerProvider;
	}

	@Transactional(readOnly = true)
	public PaginaResponse<InventarioItemResponse> listarInventario(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			String q,
			Boolean bajoMinimo,
			Boolean agotado,
			int page,
			int size) {
		UUID sedeObjetivo = resolverSedeOperacion(auth, sedeIdSolicitada, false);
		int pagina = Math.max(0, page);
		int tamano = Math.min(Math.max(1, size), MAX_PAGE_SIZE);

		List<UUID> medicamentoIdsFiltro = null;
		if (q != null && !q.isBlank()) {
			medicamentoIdsFiltro = catalogoConsultaService.buscarIdsMedicamentosPorTexto(q);
			if (medicamentoIdsFiltro.isEmpty()) {
				return new PaginaResponse<>(List.of(), pagina, tamano, 0);
			}
		}

		final List<UUID> medIdsFinal = medicamentoIdsFiltro;
		Specification<Inventario> spec = (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (sedeObjetivo != null) {
				predicates.add(cb.equal(root.get("sedeId"), sedeObjetivo));
			}
			if (medIdsFinal != null) {
				predicates.add(root.get("medicamentoId").in(medIdsFinal));
			}
			Expression<Integer> disponibleExpr = cb.diff(root.get("cantidadFisica"), root.get("cantidadReservada"));
			if (Boolean.TRUE.equals(bajoMinimo)) {
				predicates.add(cb.lessThanOrEqualTo(disponibleExpr, root.get("stockMinimo")));
			}
			if (Boolean.TRUE.equals(agotado)) {
				predicates.add(cb.equal(disponibleExpr, 0));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};

		Page<Inventario> resultados = inventarioRepository.findAll(
				spec,
				PageRequest.of(pagina, tamano, Sort.by("sedeId").ascending().and(Sort.by("medicamentoId").ascending())));

		Set<UUID> sedeIds = resultados.stream().map(Inventario::getSedeId).collect(Collectors.toSet());
		Set<UUID> medIds = resultados.stream().map(Inventario::getMedicamentoId).collect(Collectors.toSet());

		Map<UUID, SedePublicaResponse> sedes = catalogoConsultaService.obtenerSedesPorIds(sedeIds);
		Map<UUID, MedicamentoPublicoResponse> meds = catalogoConsultaService.obtenerMedicamentosPorIds(medIds);

		Page<InventarioItemResponse> mapped = resultados.map(inv -> toItemResponse(
				inv, sedes.get(inv.getSedeId()), meds.get(inv.getMedicamentoId())));
		return PaginaResponse.of(mapped);
	}

	@Transactional
	public InventarioItemResponse registrarEntrada(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			UUID medicamentoId,
			EntradaStockRequest request) {
		UUID sedeId = resolverSedeOperacion(auth, sedeIdSolicitada, true);
		Inventario inv = inventarioRepository.findBySedeIdAndMedicamentoIdForUpdate(sedeId, medicamentoId)
				.orElseThrow(() -> ApiException.notFound(
						"INVENTARIO_NO_ENCONTRADO",
						"Inventario no encontrado",
						"No existe registro de inventario para ese medicamento en la sede."));

		inv.setCantidadFisica(inv.getCantidadFisica() + request.cantidad());
		inventarioRepository.saveAndFlush(inv);

		String motivo = (request.motivo() == null || request.motivo().isBlank())
				? "Entrada de stock"
				: request.motivo().trim();
		registrarMovimiento(
				sedeId,
				medicamentoId,
				TipoMovimientoInventario.ENTRADA,
				request.cantidad(),
				inv.getCantidadFisica(),
				"ENTRADA_MANUAL",
				null,
				auth.usuarioId(),
				motivo);

		return construirRespuestaIndividual(inv);
	}

	@Transactional
	public InventarioItemResponse registrarAjuste(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			UUID medicamentoId,
			AjusteStockRequest request) {
		if (request.cantidad() == 0) {
			throw ApiException.badRequest(
					"CANTIDAD_INVALIDA",
					"Cantidad inválida",
					"La cantidad del ajuste debe ser diferente de cero.");
		}

		UUID sedeId = resolverSedeOperacion(auth, sedeIdSolicitada, true);
		Inventario inv = inventarioRepository.findBySedeIdAndMedicamentoIdForUpdate(sedeId, medicamentoId)
				.orElseThrow(() -> ApiException.notFound(
						"INVENTARIO_NO_ENCONTRADO",
						"Inventario no encontrado",
						"No existe registro de inventario para ese medicamento en la sede."));

		int nuevoFisico = inv.getCantidadFisica() + request.cantidad();
		if (nuevoFisico < 0) {
			throw ApiException.conflict(
					"AJUSTE_EXCEDE_STOCK_FISICO",
					"Ajuste excede el stock físico",
					"El ajuste negativo no puede dejar la cantidad física por debajo de cero.");
		}

		String motivo = request.motivo().trim();
		int disponibleAntes = inv.getDisponible();

		if (nuevoFisico < inv.getCantidadReservada()) {
			int excedente = inv.getCantidadReservada() - nuevoFisico;
			AjusteReservaExcedenteHandler handler = ajusteReservaHandlerProvider.getIfAvailable();
			if (handler == null) {
				throw ApiException.conflict(
						"AJUSTE_INVALIDO_RESERVA",
						"Ajuste inválido sobre stock reservado",
						"El ajuste dejaría la cantidad física menor que la cantidad reservada y no hay pedidos activos reducibles.");
			}
			int liberado = handler.liberarReservaExcedente(sedeId, medicamentoId, excedente, auth.usuarioId(), motivo);
			if (liberado < excedente) {
				throw ApiException.conflict(
						"AJUSTE_INVALIDO_RESERVA",
						"Ajuste inválido sobre stock reservado",
						"No se logró liberar la reserva excedente necesaria para mantener cantidad física >= reservada.");
			}
			inv.setCantidadReservada(inv.getCantidadReservada() - excedente);
			registrarMovimiento(
					sedeId,
					medicamentoId,
					TipoMovimientoInventario.LIBERACION,
					excedente,
					inv.getCantidadFisica(),
					"AJUSTE_EXCEDENTE",
					null,
					auth.usuarioId(),
					"Liberación de reserva por ajuste negativo: " + motivo);
		}

		inv.setCantidadFisica(nuevoFisico);
		inventarioRepository.saveAndFlush(inv);

		TipoMovimientoInventario tipo = request.cantidad() > 0
				? TipoMovimientoInventario.AJUSTE_POS
				: TipoMovimientoInventario.AJUSTE_NEG;
		registrarMovimiento(
				sedeId,
				medicamentoId,
				tipo,
				Math.abs(request.cantidad()),
				inv.getCantidadFisica(),
				"AJUSTE_MANUAL",
				null,
				auth.usuarioId(),
				motivo);

		int disponibleDespues = inv.getDisponible();
		if (InventarioOperacionesService.cruzoBajoMinimo(disponibleAntes, disponibleDespues, inv.getStockMinimo())) {
			eventPublisher.publishEvent(new StockBajoEvent(
					sedeId, medicamentoId, disponibleDespues, inv.getStockMinimo(), Instant.now()));
		}

		return construirRespuestaIndividual(inv);
	}

	@Transactional
	public InventarioItemResponse actualizarStockMinimo(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			UUID medicamentoId,
			ActualizarStockMinimoRequest request) {
		UUID sedeId = resolverSedeOperacion(auth, sedeIdSolicitada, true);
		Inventario inv = inventarioRepository.findBySedeIdAndMedicamentoIdForUpdate(sedeId, medicamentoId)
				.orElseThrow(() -> ApiException.notFound(
						"INVENTARIO_NO_ENCONTRADO",
						"Inventario no encontrado",
						"No existe registro de inventario para ese medicamento en la sede."));

		inv.setStockMinimo(request.stockMinimo());
		inventarioRepository.saveAndFlush(inv);
		return construirRespuestaIndividual(inv);
	}

	@Transactional(readOnly = true)
	public PaginaResponse<MovimientoKardexResponse> consultarKardex(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			UUID medicamentoId,
			TipoMovimientoInventario tipo,
			String desdeRaw,
			String hastaRaw,
			int page,
			int size) {
		UUID sedeId = resolverSedeOperacion(auth, sedeIdSolicitada, true);
		inventarioRepository.findBySedeIdAndMedicamentoId(sedeId, medicamentoId)
				.orElseThrow(() -> ApiException.notFound(
						"INVENTARIO_NO_ENCONTRADO",
						"Inventario no encontrado",
						"No existe registro de inventario para ese medicamento en la sede."));

		Instant desde = parsearFecha(desdeRaw, false);
		Instant hasta = parsearFecha(hastaRaw, true);

		int pagina = Math.max(0, page);
		int tamano = Math.min(Math.max(1, size), MAX_PAGE_SIZE);

		Specification<MovimientoInventario> spec = (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			predicates.add(cb.equal(root.get("sedeId"), sedeId));
			predicates.add(cb.equal(root.get("medicamentoId"), medicamentoId));
			if (tipo != null) {
				predicates.add(cb.equal(root.get("tipo"), tipo));
			}
			if (desde != null) {
				predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), desde));
			}
			if (hasta != null) {
				predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), hasta));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};

		Page<MovimientoKardexResponse> movimientos = movimientoRepository.findAll(
				spec,
				PageRequest.of(pagina, tamano, Sort.by("createdAt").descending().and(Sort.by("id").descending())))
				.map(MovimientoKardexResponse::from);

		return PaginaResponse.of(movimientos);
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
						"El empleado no tiene una sede asignada en su cuenta.");
			}
			if (sedeIdSolicitada != null && !sedeIdSolicitada.equals(auth.sedeId())) {
				throw ApiException.forbidden(
						"SEDE_NO_AUTORIZADA",
						"Sede no autorizada",
						"No tiene permiso para acceder al inventario de otra sede.");
			}
			return auth.sedeId();
		}

		if (auth.esAdmin()) {
			if (sedeIdSolicitada != null) {
				catalogoConsultaService.obtenerSedePorId(sedeIdSolicitada)
						.orElseThrow(() -> ApiException.notFound(
								"SEDE_NO_ENCONTRADA",
								"Sede no encontrada",
								"No existe una sede con el identificador indicado."));
				return sedeIdSolicitada;
			}
			if (obligatoriaParaAdmin) {
				throw ApiException.badRequest(
						"SEDE_REQUERIDA",
						"Sede requerida",
						"El administrador debe indicar el parámetro sedeId para operar sobre un inventario específico.");
			}
			return null;
		}

		throw ApiException.forbidden(
				"ACCESO_DENEGADO",
				"Acceso denegado",
				"No tiene permisos para operar el inventario.");
	}

	private InventarioItemResponse construirRespuestaIndividual(Inventario inv) {
		SedePublicaResponse sede = catalogoConsultaService.obtenerSedePorId(inv.getSedeId()).orElse(null);
		MedicamentoPublicoResponse med = catalogoConsultaService.obtenerMedicamentoPorId(inv.getMedicamentoId())
				.orElse(null);
		return toItemResponse(inv, sede, med);
	}

	private InventarioItemResponse toItemResponse(
			Inventario inv,
			SedePublicaResponse sede,
			MedicamentoPublicoResponse med) {
		int disponible = inv.getDisponible();
		return new InventarioItemResponse(
				inv.getId(),
				inv.getSedeId(),
				sede != null ? sede.codigo() : null,
				sede != null ? sede.nombre() : null,
				inv.getMedicamentoId(),
				med != null ? med.codigo() : null,
				med != null ? med.nombre() : null,
				med != null ? med.principioActivo() : null,
				med != null ? med.presentacion() : null,
				inv.getCantidadFisica(),
				inv.getCantidadReservada(),
				disponible,
				inv.getStockMinimo(),
				NivelDisponibilidad.calcular(disponible, inv.getStockMinimo()));
	}

	private void registrarMovimiento(
			UUID sedeId,
			UUID medicamentoId,
			TipoMovimientoInventario tipo,
			int cantidad,
			int saldoFisico,
			String referenciaTipo,
			UUID referenciaId,
			UUID usuarioId,
			String motivo) {
		MovimientoInventario mov = new MovimientoInventario();
		mov.setSedeId(sedeId);
		mov.setMedicamentoId(medicamentoId);
		mov.setTipo(tipo);
		mov.setCantidad(cantidad);
		mov.setSaldoFisico(saldoFisico);
		mov.setReferenciaTipo(referenciaTipo);
		mov.setReferenciaId(referenciaId);
		mov.setUsuarioId(usuarioId);
		mov.setMotivo(motivo);
		movimientoRepository.save(mov);
	}

	private Instant parsearFecha(String valor, boolean finDeDiaSiSoloFecha) {
		if (valor == null || valor.isBlank()) {
			return null;
		}
		String texto = valor.trim();
		try {
			return Instant.parse(texto);
		} catch (DateTimeParseException ignored) {
		}
		try {
			return OffsetDateTime.parse(texto).toInstant();
		} catch (DateTimeParseException ignored) {
		}
		try {
			LocalDate fecha = LocalDate.parse(texto);
			if (finDeDiaSiSoloFecha) {
				return fecha.plusDays(1).atStartOfDay(ZONA_NEGOCIO).toInstant().minusNanos(1);
			}
			return fecha.atStartOfDay(ZONA_NEGOCIO).toInstant();
		} catch (DateTimeParseException ex) {
			throw ApiException.badRequest(
					"FECHA_INVALIDA",
					"Fecha inválida",
					"El formato de fecha debe ser ISO-8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ssZ).");
		}
	}
}
