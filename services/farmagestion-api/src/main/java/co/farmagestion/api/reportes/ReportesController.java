package co.farmagestion.api.reportes;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.common.web.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion/reportes")
@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAuthority('CARGO_FARMACEUTICO'))")
@Tag(name = "Reportes", description = "Consultas agregadas por sede y rango de fechas (RF-EMP-28, RF-EMP-29, CA-EMP-14)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class ReportesController {

	private final ReportesService reportesService;

	public ReportesController(ReportesService reportesService) {
		this.reportesService = reportesService;
	}

	@GetMapping("/pedidos")
	@Operation(summary = "Reporte de pedidos por estado y por día", description = "Agrega pedidos por estado y atendidos por día en el rango de fechas indicado (RF-EMP-28).")
	public ReportePedidosResponse reportePedidos(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return reportesService.reportePedidos(auth, sedeId, desde, hasta);
	}

	@GetMapping("/tiempos")
	@Operation(summary = "Reporte de tiempos de preparación y entrega", description = "Calcula tiempos promedio de preparación (RESERVADO -> LISTO) y entrega (LISTO -> ENTREGADO) en minutos (RF-EMP-28, CA-EMP-14).")
	public ReporteTiemposResponse reporteTiempos(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return reportesService.reporteTiempos(auth, sedeId, desde, hasta);
	}

	@GetMapping("/turnos")
	@Operation(summary = "Reporte de turnos por franja", description = "Agrega turnos atendidos y por estado agrupados por franja horaria (RF-EMP-28).")
	public ReporteTurnosResponse reporteTurnos(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return reportesService.reporteTurnos(auth, sedeId, desde, hasta);
	}

	@GetMapping("/faltantes")
	@Operation(summary = "Ranking de medicamentos agotados o con más faltantes", description = "Lista el ranking de medicamentos con faltantes en pedidos del rango o agotados en inventario (RF-EMP-28).")
	public ReporteFaltantesResponse reporteFaltantes(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return reportesService.reporteFaltantes(auth, sedeId, desde, hasta);
	}
}
