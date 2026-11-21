package co.farmagestion.api.pedidos;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.common.web.OpenApiConfig;
import co.farmagestion.api.common.web.PaginaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion/pedidos")
@Tag(name = "Gestión de pedidos", description = "Bandeja operativa, preparación, entrega con verificación de documento y cancelación por sede (RF-EMP-08 a RF-EMP-12)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class PedidoGestionController {

	private final PedidoService pedidoService;

	public PedidoGestionController(PedidoService pedidoService) {
		this.pedidoService = pedidoService;
	}

	@GetMapping
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Listar bandeja de pedidos", description = "Lista paginada de pedidos de la sede filtrados por estado, modalidad y fecha, ordenados por urgencia de vencimiento (RF-EMP-08, RN-09).")
	public PaginaResponse<PedidoResumenResponse> listar(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) EstadoPedido estado,
			@RequestParam(required = false) ModalidadPedido modalidad,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.listarPedidosGestion(auth, sedeId, estado, modalidad, fecha, page, size);
	}

	@GetMapping("/{id}")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Consultar detalle de pedido", description = "Evalúa vencimiento perezoso y devuelve el detalle completo del pedido, paciente, fórmula, turno e historial (RF-EMP-09).")
	public PedidoDetalleResponse detalle(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.obtenerDetalleGestion(auth, id);
	}

	@PostMapping("/{id}/tomar")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Tomar pedido para preparación", description = "Transiciona el pedido de RESERVADO a EN_PREPARACION y lo asigna al empleado autenticado (RF-EMP-10, RN-EMP-01, RN-EMP-04).")
	public PedidoDetalleResponse tomar(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id,
			@RequestBody(required = false) @Valid NotaOpcionalRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.tomarPedido(auth, id, request);
	}

	@PostMapping("/{id}/listo")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Marcar pedido como listo", description = "Transiciona el pedido de EN_PREPARACION a LISTO; solo quien lo tomó o un ADMIN puede ejecutarlo (RF-EMP-10, RN-EMP-04).")
	public PedidoDetalleResponse marcarListo(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id,
			@RequestBody(required = false) @Valid NotaOpcionalRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.marcarListo(auth, id, request);
	}

	@PostMapping("/{id}/entregar")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Entregar pedido RECOGER", description = "Verifica el documento del paciente (RN-EMP-02), dispensa el stock, marca el turno ATENDIDO y encola la dispensación en el outbox (RF-EMP-11, RN-06).")
	public PedidoDetalleResponse entregar(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id,
			@Valid @RequestBody EntregarPedidoRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.entregarPedidoRecoger(auth, id, request);
	}

	@PostMapping("/{id}/cancelar")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Cancelar pedido desde gestión", description = "Cancela un pedido antes de ENTREGADO con motivo obligatorio, libera stock, cancela turno y notifica al paciente (RF-EMP-12).")
	public PedidoDetalleResponse cancelar(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id,
			@Valid @RequestBody CancelarPedidoGestionRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.cancelarPedidoGestion(auth, id, request);
	}
}
