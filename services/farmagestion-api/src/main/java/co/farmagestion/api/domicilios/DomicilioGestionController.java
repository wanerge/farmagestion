package co.farmagestion.api.domicilios;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.common.web.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion")
@Tag(name = "Domicilios y rutas", description = "Planeación heurística, reordenamiento, inicio y ejecución de rutas de domicilio (RF-EMP-19 a RF-EMP-24)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class DomicilioGestionController {

	private final DomicilioService domicilioService;

	public DomicilioGestionController(DomicilioService domicilioService) {
		this.domicilioService = domicilioService;
	}

	@GetMapping("/domicilios/pendientes")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAuthority('CARGO_FARMACEUTICO'))")
	@Operation(summary = "Listar pedidos a domicilio listos para rutear", description = "Devuelve los pedidos DOMICILIO en estado LISTO sin ruta activa de la sede, junto con las coordenadas de origen y los domiciliarios disponibles (RF-EMP-19).")
	public DomiciliosPendientesResponse listarPendientes(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return domicilioService.listarPendientes(auth, sedeId);
	}

	@GetMapping("/rutas")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAuthority('CARGO_FARMACEUTICO'))")
	@Operation(summary = "Listar rutas de la sede", description = "Lista las rutas planeadas, en curso y completadas de la sede para la fecha indicada (por defecto hoy).")
	public List<RutaDetalleResponse> listarRutas(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return domicilioService.listarRutasGestion(auth, sedeId, fecha);
	}

	@GetMapping("/rutas/mias")
	@PreAuthorize("hasRole('EMPLEADO') and hasAuthority('CARGO_DOMICILIARIO')")
	@Operation(summary = "Listar mis rutas asignadas", description = "Devuelve las rutas asignadas al domiciliario autenticado para la fecha indicada (por defecto hoy) (RF-EMP-22, RN-EMP-05).")
	public List<RutaDetalleResponse> listarMisRutas(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return domicilioService.listarMisRutas(auth, fecha);
	}

	@GetMapping("/rutas/{id}")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_FARMACEUTICO', 'CARGO_DOMICILIARIO'))")
	@Operation(summary = "Consultar detalle de ruta", description = "Devuelve el detalle y paradas de una ruta. Un domiciliario solo puede consultar rutas asignadas a él (RN-EMP-05, CA-EMP-13).")
	public RutaDetalleResponse obtenerRuta(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return domicilioService.obtenerRutaDetalle(auth, id);
	}

	@PostMapping("/rutas")
	@ResponseStatus(HttpStatus.CREATED)
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAuthority('CARGO_FARMACEUTICO'))")
	@Operation(summary = "Crear ruta de domicilio", description = "Crea una ruta PLANEADA ordenando los pedidos mediante vecino más cercano (Haversine) y una pasada de 2-opt, respetando domicilio.max_paradas (RF-EMP-20, RN-EMP-06, CA-EMP-11).")
	public RutaDetalleResponse crearRuta(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@Valid @RequestBody CrearRutaRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return domicilioService.crearRuta(auth, sedeId, request);
	}

	@PutMapping("/rutas/{id}/orden")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAuthority('CARGO_FARMACEUTICO'))")
	@Operation(summary = "Reordenar paradas de una ruta", description = "Reordena manualmente las paradas de una ruta PLANEADA y recalcula las distancias estimadas (RF-EMP-21).")
	public RutaDetalleResponse reordenarParadas(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id,
			@Valid @RequestBody ReordenarRutaRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return domicilioService.reordenarParadas(auth, id, request);
	}

	@PostMapping("/rutas/{id}/iniciar")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAuthority('CARGO_FARMACEUTICO'))")
	@Operation(summary = "Iniciar ruta", description = "Pasa la ruta de PLANEADA a EN_CURSO, pasa todos sus pedidos a EN_RUTA y notifica a los pacientes (RF-EMP-21, CA-PAC-10).")
	public RutaDetalleResponse iniciarRuta(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return domicilioService.iniciarRuta(auth, id);
	}

	@PostMapping("/rutas/{id}/paradas/{paradaId}/entregar")
	@PreAuthorize("hasRole('EMPLEADO') and hasAuthority('CARGO_DOMICILIARIO')")
	@Operation(summary = "Marcar parada como entregada", description = "Marca la parada ENTREGADA, dispensa el stock del pedido, encola la dispensación al simulador y completa la ruta si no quedan paradas pendientes (RF-EMP-22, RF-EMP-24, RN-06).")
	public RutaDetalleResponse marcarParadaEntregada(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id,
			@PathVariable UUID paradaId,
			@RequestBody(required = false) @Valid EntregarParadaRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return domicilioService.marcarParadaEntregada(auth, id, paradaId, request);
	}

	@PostMapping("/rutas/{id}/paradas/{paradaId}/fallida")
	@PreAuthorize("hasRole('EMPLEADO') and hasAuthority('CARGO_DOMICILIARIO')")
	@Operation(summary = "Marcar parada como fallida", description = "Marca la parada FALLIDA con motivo, incrementa intentos_entrega y devuelve el pedido a LISTO o lo cancela liberando stock al alcanzar domicilio.max_intentos (RF-EMP-22, RF-EMP-23, RF-EMP-24, CA-EMP-12).")
	public RutaDetalleResponse marcarParadaFallida(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id,
			@PathVariable UUID paradaId,
			@Valid @RequestBody ParadaFallidaRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return domicilioService.marcarParadaFallida(auth, id, paradaId, request);
	}
}
