package co.farmagestion.api.integracion;

import co.farmagestion.api.common.web.OpenApiConfig;
import co.farmagestion.api.common.web.PaginaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion/admin/integracion")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Administración", description = "Gestión administrativa de sedes, empleados, catálogo, parámetros y outbox (solo ADMIN, RF-EMP-30 a RF-EMP-34)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class AdminIntegracionController {

	private final OutboxService outboxService;

	public AdminIntegracionController(OutboxService outboxService) {
		this.outboxService = outboxService;
	}

	@GetMapping("/eventos")
	@Operation(summary = "Consultar eventos del outbox de integración", description = "Lista paginada de eventos de integración con filtro opcional por estado (PENDIENTE, ENVIADO, ERROR) (RF-EMP-34).")
	public PaginaResponse<EventoIntegracionResponse> listarEventos(
			@RequestParam(required = false) EstadoEventoIntegracion estado,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		return outboxService.listarEventos(estado, page, size);
	}

	@PostMapping("/eventos/{id}/reintentar")
	@Operation(summary = "Reintentar manualmente evento de integración", description = "Reencola y reintenta de inmediato un evento de integración en estado ERROR o PENDIENTE (RF-EMP-34).")
	public EventoIntegracionResponse reintentarEvento(@PathVariable UUID id) {
		return outboxService.reintentarManual(id);
	}
}
