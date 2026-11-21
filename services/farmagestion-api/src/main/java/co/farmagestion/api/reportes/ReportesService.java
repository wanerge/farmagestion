package co.farmagestion.api.reportes;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.catalogo.CatalogoConsultaService;
import co.farmagestion.api.common.domain.ParametroService;
import co.farmagestion.api.common.web.ApiException;
import co.farmagestion.api.pedidos.EstadoPedido;
import co.farmagestion.api.pedidos.ModalidadPedido;
import co.farmagestion.api.reportes.ReporteFaltantesResponse.FaltanteMedicamentoItem;
import co.farmagestion.api.reportes.ReportePedidosResponse.PedidosPorDiaItem;
import co.farmagestion.api.reportes.ReportePedidosResponse.PedidosPorEstadoItem;
import co.farmagestion.api.reportes.ReporteTiemposResponse.TiemposPorDiaItem;
import co.farmagestion.api.reportes.ReporteTiemposResponse.TiemposPorModalidadItem;
import co.farmagestion.api.reportes.ReporteTurnosResponse.TurnosPorFranjaItem;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportesService {

	private static final int DIAS_RANGO_DEFECTO = 29;

	private final NamedParameterJdbcTemplate jdbcTemplate;
	private final CatalogoConsultaService catalogoConsultaService;
	private final Clock clock;

	public ReportesService(
			NamedParameterJdbcTemplate jdbcTemplate,
			CatalogoConsultaService catalogoConsultaService,
			Clock clock) {
		this.jdbcTemplate = jdbcTemplate;
		this.catalogoConsultaService = catalogoConsultaService;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public ReportePedidosResponse reportePedidos(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			LocalDate desdeParam,
			LocalDate hastaParam) {
		UUID sedeId = resolverSedeConsulta(auth, sedeIdSolicitada);
		RangoFechas rango = resolverRango(desdeParam, hastaParam);

		MapSqlParameterSource params = crearParametrosTemporales(rango, sedeId);
		String filtroSede = sedeId != null ? " AND p.sede_id = :sedeId" : "";

		String sqlPorEstado = """
				SELECT p.estado, COUNT(*) AS cantidad
				FROM pedido p
				WHERE p.created_at >= :inicio AND p.created_at < :fin
				""" + filtroSede + """
				 GROUP BY p.estado
				""";

		Map<EstadoPedido, Long> conteoPorEstado = new EnumMap<>(EstadoPedido.class);
		for (EstadoPedido estado : EstadoPedido.values()) {
			conteoPorEstado.put(estado, 0L);
		}
		jdbcTemplate.query(sqlPorEstado, params, rs -> {
			EstadoPedido estado = EstadoPedido.valueOf(rs.getString("estado"));
			conteoPorEstado.put(estado, rs.getLong("cantidad"));
		});

		List<PedidosPorEstadoItem> porEstado = new ArrayList<>();
		long totalPedidos = 0;
		for (EstadoPedido estado : EstadoPedido.values()) {
			long cantidad = conteoPorEstado.getOrDefault(estado, 0L);
			totalPedidos += cantidad;
			porEstado.add(new PedidosPorEstadoItem(estado, cantidad));
		}

		String sqlPorDia = """
				SELECT (p.created_at AT TIME ZONE 'America/Bogota')::date AS fecha,
				       COUNT(*) AS total,
				       COUNT(*) FILTER (WHERE p.estado = 'ENTREGADO') AS entregados,
				       COUNT(*) FILTER (WHERE p.estado = 'CANCELADO') AS cancelados,
				       COUNT(*) FILTER (WHERE p.estado = 'VENCIDO') AS vencidos
				FROM pedido p
				WHERE p.created_at >= :inicio AND p.created_at < :fin
				""" + filtroSede + """
				 GROUP BY (p.created_at AT TIME ZONE 'America/Bogota')::date
				 ORDER BY fecha ASC
				""";

		List<PedidosPorDiaItem> porDia = jdbcTemplate.query(sqlPorDia, params, (rs, rowNum) -> new PedidosPorDiaItem(
				rs.getDate("fecha").toLocalDate(),
				rs.getLong("total"),
				rs.getLong("entregados"),
				rs.getLong("cancelados"),
				rs.getLong("vencidos")));

		return new ReportePedidosResponse(
				rango.desde(),
				rango.hasta(),
				sedeId,
				totalPedidos,
				conteoPorEstado.getOrDefault(EstadoPedido.ENTREGADO, 0L),
				conteoPorEstado.getOrDefault(EstadoPedido.CANCELADO, 0L),
				conteoPorEstado.getOrDefault(EstadoPedido.VENCIDO, 0L),
				porEstado,
				porDia);
	}

	@Transactional(readOnly = true)
	public ReporteTiemposResponse reporteTiempos(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			LocalDate desdeParam,
			LocalDate hastaParam) {
		UUID sedeId = resolverSedeConsulta(auth, sedeIdSolicitada);
		RangoFechas rango = resolverRango(desdeParam, hastaParam);

		MapSqlParameterSource params = crearParametrosTemporales(rango, sedeId);
		String filtroSede = sedeId != null ? " AND p.sede_id = :sedeId" : "";

		String baseWhere = """
				WHERE p.estado = 'ENTREGADO'
				  AND p.listo_en IS NOT NULL
				  AND p.entregado_en IS NOT NULL
				  AND p.entregado_en >= :inicio
				  AND p.entregado_en < :fin
				""" + filtroSede;

		String sqlResumen = """
				SELECT COUNT(*) AS cantidad_entregados,
				       COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.listo_en - p.created_at)) / 60.0)::numeric, 2), 0) AS prom_prep_min,
				       COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.entregado_en - p.listo_en)) / 60.0)::numeric, 2), 0) AS prom_entrega_min,
				       COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.entregado_en - p.created_at)) / 60.0)::numeric, 2), 0) AS prom_total_min
				FROM pedido p
				""" + baseWhere;

		ResumenTiempos resumen = jdbcTemplate.queryForObject(sqlResumen, params, (rs, rowNum) -> new ResumenTiempos(
				rs.getLong("cantidad_entregados"),
				rs.getDouble("prom_prep_min"),
				rs.getDouble("prom_entrega_min"),
				rs.getDouble("prom_total_min")));
		if (resumen == null) {
			resumen = new ResumenTiempos(0L, 0.0, 0.0, 0.0);
		}

		String sqlPorDia = """
				SELECT (p.entregado_en AT TIME ZONE 'America/Bogota')::date AS fecha,
				       COUNT(*) AS cantidad_entregados,
				       COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.listo_en - p.created_at)) / 60.0)::numeric, 2), 0) AS prom_prep_min,
				       COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.entregado_en - p.listo_en)) / 60.0)::numeric, 2), 0) AS prom_entrega_min,
				       COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.entregado_en - p.created_at)) / 60.0)::numeric, 2), 0) AS prom_total_min
				FROM pedido p
				""" + baseWhere + """
				 GROUP BY (p.entregado_en AT TIME ZONE 'America/Bogota')::date
				 ORDER BY fecha ASC
				""";

		List<TiemposPorDiaItem> porDia = jdbcTemplate.query(sqlPorDia, params, (rs, rowNum) -> new TiemposPorDiaItem(
				rs.getDate("fecha").toLocalDate(),
				rs.getLong("cantidad_entregados"),
				rs.getDouble("prom_prep_min"),
				rs.getDouble("prom_entrega_min"),
				rs.getDouble("prom_total_min")));

		String sqlPorModalidad = """
				SELECT p.modalidad,
				       COUNT(*) AS cantidad_entregados,
				       COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.listo_en - p.created_at)) / 60.0)::numeric, 2), 0) AS prom_prep_min,
				       COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.entregado_en - p.listo_en)) / 60.0)::numeric, 2), 0) AS prom_entrega_min,
				       COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (p.entregado_en - p.created_at)) / 60.0)::numeric, 2), 0) AS prom_total_min
				FROM pedido p
				""" + baseWhere + """
				 GROUP BY p.modalidad
				 ORDER BY p.modalidad ASC
				""";

		List<TiemposPorModalidadItem> porModalidad = jdbcTemplate.query(
				sqlPorModalidad,
				params,
				(rs, rowNum) -> new TiemposPorModalidadItem(
						ModalidadPedido.valueOf(rs.getString("modalidad")),
						rs.getLong("cantidad_entregados"),
						rs.getDouble("prom_prep_min"),
						rs.getDouble("prom_entrega_min"),
						rs.getDouble("prom_total_min")));

		return new ReporteTiemposResponse(
				rango.desde(),
				rango.hasta(),
				sedeId,
				resumen.cantidadEntregados(),
				resumen.promedioPreparacionMin(),
				resumen.promedioEntregaMin(),
				resumen.promedioTotalMin(),
				porDia,
				porModalidad);
	}

	@Transactional(readOnly = true)
	public ReporteTurnosResponse reporteTurnos(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			LocalDate desdeParam,
			LocalDate hastaParam) {
		UUID sedeId = resolverSedeConsulta(auth, sedeIdSolicitada);
		RangoFechas rango = resolverRango(desdeParam, hastaParam);

		MapSqlParameterSource params = new MapSqlParameterSource()
				.addValue("desde", Date.valueOf(rango.desde()))
				.addValue("hasta", Date.valueOf(rango.hasta()));
		String filtroSede = "";
		if (sedeId != null) {
			params.addValue("sedeId", sedeId);
			filtroSede = " AND t.sede_id = :sedeId";
		}

		String sql = """
				SELECT to_char(t.franja_inicio, 'HH24:MI') AS franja_inicio,
				       COUNT(*) AS total,
				       COUNT(*) FILTER (WHERE t.estado = 'ATENDIDO') AS atendidos,
				       COUNT(*) FILTER (WHERE t.estado = 'EN_ESPERA') AS en_espera,
				       COUNT(*) FILTER (WHERE t.estado = 'LLAMADO') AS llamados,
				       COUNT(*) FILTER (WHERE t.estado = 'VENCIDO') AS vencidos,
				       COUNT(*) FILTER (WHERE t.estado = 'CANCELADO') AS cancelados
				FROM turno t
				WHERE t.fecha >= :desde AND t.fecha <= :hasta
				""" + filtroSede + """
				 GROUP BY t.franja_inicio
				 ORDER BY t.franja_inicio ASC
				""";

		List<TurnosPorFranjaItem> porFranja = jdbcTemplate.query(sql, params, (rs, rowNum) -> new TurnosPorFranjaItem(
				rs.getString("franja_inicio"),
				rs.getLong("total"),
				rs.getLong("atendidos"),
				rs.getLong("en_espera"),
				rs.getLong("llamados"),
				rs.getLong("vencidos"),
				rs.getLong("cancelados")));

		long totalTurnos = 0;
		long totalAtendidos = 0;
		long totalVencidos = 0;
		long totalCancelados = 0;
		for (TurnosPorFranjaItem item : porFranja) {
			totalTurnos += item.total();
			totalAtendidos += item.atendidos();
			totalVencidos += item.vencidos();
			totalCancelados += item.cancelados();
		}

		return new ReporteTurnosResponse(
				rango.desde(),
				rango.hasta(),
				sedeId,
				totalTurnos,
				totalAtendidos,
				totalVencidos,
				totalCancelados,
				porFranja);
	}

	@Transactional(readOnly = true)
	public ReporteFaltantesResponse reporteFaltantes(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			LocalDate desdeParam,
			LocalDate hastaParam) {
		UUID sedeId = resolverSedeConsulta(auth, sedeIdSolicitada);
		RangoFechas rango = resolverRango(desdeParam, hastaParam);

		MapSqlParameterSource params = crearParametrosTemporales(rango, sedeId);
		String filtroPedidoSede = sedeId != null ? " AND p.sede_id = :sedeId" : "";
		String filtroInvSede = sedeId != null ? " AND i.sede_id = :sedeId" : "";

		String sql = """
				WITH faltantes_pedidos AS (
				    SELECT pi.medicamento_id,
				           COUNT(*) FILTER (WHERE pi.estado_item IN ('PARCIAL', 'AGOTADO') OR pi.cantidad_solicitada > pi.cantidad_reservada) AS veces_faltante,
				           COUNT(*) FILTER (WHERE pi.estado_item = 'AGOTADO') AS veces_agotado,
				           COALESCE(SUM(GREATEST(0, pi.cantidad_solicitada - pi.cantidad_reservada)), 0) AS unidades_faltantes
				    FROM pedido_item pi
				    JOIN pedido p ON p.id = pi.pedido_id
				    WHERE p.created_at >= :inicio AND p.created_at < :fin
				""" + filtroPedidoSede + """
				    GROUP BY pi.medicamento_id
				),
				estado_inventario AS (
				    SELECT i.medicamento_id,
				           COUNT(*) FILTER (WHERE (i.cantidad_fisica - i.cantidad_reservada) = 0) AS sedes_agotado,
				           COUNT(*) FILTER (WHERE (i.cantidad_fisica - i.cantidad_reservada) <= i.stock_minimo) AS sedes_bajo_minimo
				    FROM inventario i
				    JOIN sede s ON s.id = i.sede_id AND s.activa = TRUE
				    WHERE 1 = 1
				""" + filtroInvSede + """
				    GROUP BY i.medicamento_id
				)
				SELECT m.id AS medicamento_id,
				       m.codigo AS medicamento_codigo,
				       m.nombre AS medicamento_nombre,
				       COALESCE(fp.veces_faltante, 0) AS veces_faltante,
				       COALESCE(fp.veces_agotado, 0) AS veces_agotado,
				       COALESCE(fp.unidades_faltantes, 0) AS unidades_faltantes,
				       COALESCE(ei.sedes_agotado, 0) AS sedes_agotado,
				       COALESCE(ei.sedes_bajo_minimo, 0) AS sedes_bajo_minimo
				FROM medicamento m
				LEFT JOIN faltantes_pedidos fp ON fp.medicamento_id = m.id
				LEFT JOIN estado_inventario ei ON ei.medicamento_id = m.id
				WHERE COALESCE(fp.veces_faltante, 0) > 0
				   OR COALESCE(fp.unidades_faltantes, 0) > 0
				   OR COALESCE(ei.sedes_agotado, 0) > 0
				ORDER BY unidades_faltantes DESC, veces_faltante DESC, sedes_agotado DESC, m.nombre ASC
				LIMIT 50
				""";

		List<FaltanteMedicamentoItem> items = jdbcTemplate.query(
				sql,
				params,
				(rs, rowNum) -> new FaltanteMedicamentoItem(
						rs.getObject("medicamento_id", UUID.class),
						rs.getString("medicamento_codigo"),
						rs.getString("medicamento_nombre"),
						rs.getLong("veces_faltante"),
						rs.getLong("veces_agotado"),
						rs.getLong("unidades_faltantes"),
						rs.getLong("sedes_agotado"),
						rs.getLong("sedes_bajo_minimo")));

		return new ReporteFaltantesResponse(rango.desde(), rango.hasta(), sedeId, items);
	}

	private UUID resolverSedeConsulta(UsuarioAutenticado auth, UUID sedeIdSolicitada) {
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
						"No tiene permiso para consultar reportes de otra sede.");
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
			}
			return sedeIdSolicitada;
		}
		throw ApiException.forbidden(
				"ACCESO_DENEGADO",
				"Acceso denegado",
				"No tiene permisos para consultar reportes.");
	}

	private RangoFechas resolverRango(LocalDate desdeParam, LocalDate hastaParam) {
		LocalDate hoy = LocalDate.now(clock.withZone(ParametroService.ZONA_NEGOCIO));
		LocalDate hasta = hastaParam != null ? hastaParam : hoy;
		LocalDate desde = desdeParam != null ? desdeParam : hasta.minusDays(DIAS_RANGO_DEFECTO);
		if (desde.isAfter(hasta)) {
			throw ApiException.badRequest(
					"RANGO_FECHAS_INVALIDO",
					"Rango de fechas inválido",
					"La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
		}
		Instant inicio = desde.atStartOfDay(ParametroService.ZONA_NEGOCIO).toInstant();
		Instant finExclusivo = hasta.plusDays(1).atStartOfDay(ParametroService.ZONA_NEGOCIO).toInstant();
		return new RangoFechas(desde, hasta, inicio, finExclusivo);
	}

	private MapSqlParameterSource crearParametrosTemporales(RangoFechas rango, UUID sedeId) {
		MapSqlParameterSource params = new MapSqlParameterSource()
				.addValue("inicio", Timestamp.from(rango.inicio()))
				.addValue("fin", Timestamp.from(rango.finExclusivo()));
		if (sedeId != null) {
			params.addValue("sedeId", sedeId);
		}
		return params;
	}

	private record RangoFechas(LocalDate desde, LocalDate hasta, Instant inicio, Instant finExclusivo) {
	}

	private record ResumenTiempos(
			long cantidadEntregados,
			double promedioPreparacionMin,
			double promedioEntregaMin,
			double promedioTotalMin) {
	}
}
