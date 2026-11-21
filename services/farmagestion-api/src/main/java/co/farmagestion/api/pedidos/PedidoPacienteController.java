package co.farmagestion.api.pedidos;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.common.web.OpenApiConfig;
import co.farmagestion.api.common.web.PaginaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pacientes/me/pedidos")
@Tag(name = "Pedidos del paciente", description = "Creación con reserva atómica, seguimiento, línea de tiempo y cancelación de pedidos (RF-PAC-10 a RF-PAC-16)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class PedidoPacienteController {

	private final PedidoService pedidoService;

	public PedidoPacienteController(PedidoService pedidoService) {
		this.pedidoService = pedidoService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Crear pedido", description = "Refresca la fórmula (RN-04), reserva stock atómicamente (RN-01, RN-02, RN-03) y genera turno si la modalidad es RECOGER (RF-PAC-10 a RF-PAC-13).")
	public PedidoDetalleResponse crear(
			@AuthenticationPrincipal Jwt jwt,
			@Valid @RequestBody CrearPedidoRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.crearPedido(auth.usuarioId(), request);
	}

	@GetMapping
	@Operation(summary = "Listar historial de pedidos", description = "Historial paginado de pedidos del paciente con filtro opcional por estado (RF-PAC-16).")
	public PaginaResponse<PedidoResumenResponse> listar(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) EstadoPedido estado,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.listarPedidosPaciente(auth.usuarioId(), estado, page, size);
	}

	@GetMapping("/{id}")
	@Operation(summary = "Ver detalle del pedido", description = "Evalúa vencimiento perezoso (RN-05) y devuelve detalle, ítems, turno y línea de tiempo (RF-PAC-14, RN-PAC-07).")
	public PedidoDetalleResponse detalle(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.obtenerDetallePaciente(auth.usuarioId(), id);
	}

	@PostMapping("/{id}/cancelar")
	@Operation(summary = "Cancelar pedido", description = "Cancela un pedido en estado RESERVADO, EN_PREPARACION o LISTO, libera stock y cancela el turno (RF-PAC-15, RN-PAC-06).")
	public PedidoDetalleResponse cancelar(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id,
			@RequestBody(required = false) @Valid NotaOpcionalRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return pedidoService.cancelarPedidoPaciente(auth.usuarioId(), id, request);
	}
}
