package co.farmagestion.api.inventario;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.common.web.OpenApiConfig;
import co.farmagestion.api.common.web.PaginaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion/inventario")
@Tag(name = "Gestión de inventario", description = "Consulta de inventario, entradas, ajustes, stock mínimo y kárdex por sede (RF-EMP-03 a RF-EMP-07)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class InventarioGestionController {

	private final InventarioGestionService inventarioGestionService;

	public InventarioGestionController(InventarioGestionService inventarioGestionService) {
		this.inventarioGestionService = inventarioGestionService;
	}

	@GetMapping
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Listar inventario", description = "Lista paginada del inventario con búsqueda por nombre y filtros bajoMinimo y agotado (RF-EMP-03). Respeta el alcance por sede (RN-09).")
	public PaginaResponse<InventarioItemResponse> listarInventario(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) String q,
			@RequestParam(required = false) Boolean bajoMinimo,
			@RequestParam(required = false) Boolean agotado,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return inventarioGestionService.listarInventario(auth, sedeId, q, bajoMinimo, agotado, page, size);
	}

	@PostMapping("/{medicamentoId}/entradas")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAuthority('CARGO_FARMACEUTICO'))")
	@Operation(summary = "Registrar entrada de stock", description = "Incrementa la cantidad física y registra un movimiento ENTRADA en el kárdex (RF-EMP-04, CA-EMP-02).")
	public InventarioItemResponse registrarEntrada(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID medicamentoId,
			@RequestParam(required = false) UUID sedeId,
			@Valid @RequestBody EntradaStockRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return inventarioGestionService.registrarEntrada(auth, sedeId, medicamentoId, request);
	}

	@PostMapping("/{medicamentoId}/ajustes")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAuthority('CARGO_FARMACEUTICO'))")
	@Operation(summary = "Registrar ajuste de stock", description = "Registra un ajuste positivo o negativo con motivo obligatorio; nunca deja físico menor que reservado sin resolver (RF-EMP-05, CA-EMP-03).")
	public InventarioItemResponse registrarAjuste(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID medicamentoId,
			@RequestParam(required = false) UUID sedeId,
			@Valid @RequestBody AjusteStockRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return inventarioGestionService.registrarAjuste(auth, sedeId, medicamentoId, request);
	}

	@PatchMapping("/{medicamentoId}")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAuthority('CARGO_FARMACEUTICO'))")
	@Operation(summary = "Editar stock mínimo", description = "Actualiza el stock mínimo de un medicamento en la sede (RF-EMP-07).")
	public InventarioItemResponse actualizarStockMinimo(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID medicamentoId,
			@RequestParam(required = false) UUID sedeId,
			@Valid @RequestBody ActualizarStockMinimoRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return inventarioGestionService.actualizarStockMinimo(auth, sedeId, medicamentoId, request);
	}

	@GetMapping("/{medicamentoId}/kardex")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Consultar kárdex", description = "Lista paginada de movimientos de inventario de un medicamento en la sede con filtros por tipo y fecha (RF-EMP-06).")
	public PaginaResponse<MovimientoKardexResponse> consultarKardex(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID medicamentoId,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) TipoMovimientoInventario tipo,
			@RequestParam(required = false) String desde,
			@RequestParam(required = false) String hasta,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return inventarioGestionService.consultarKardex(auth, sedeId, medicamentoId, tipo, desde, hasta, page, size);
	}
}
