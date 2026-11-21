package co.farmagestion.api.catalogo;

import co.farmagestion.api.common.web.PaginaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/catalogo")
@Tag(name = "Catálogo público", description = "Consulta pública de medicamentos, sedes y disponibilidad por niveles (RN-10, RF-PAC-04, RF-PAC-05)")
public class CatalogoController {

	private final CatalogoPublicoService catalogoPublicoService;

	public CatalogoController(CatalogoPublicoService catalogoPublicoService) {
		this.catalogoPublicoService = catalogoPublicoService;
	}

	@GetMapping("/medicamentos")
	@Operation(summary = "Buscar medicamentos", description = "Búsqueda pública paginada de medicamentos activos por nombre, principio activo o código.")
	public PaginaResponse<MedicamentoPublicoResponse> buscarMedicamentos(
			@RequestParam(required = false) String q,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		return catalogoPublicoService.buscarMedicamentos(q, page, size);
	}

	@GetMapping("/medicamentos/{id}/disponibilidad")
	@Operation(summary = "Consultar disponibilidad por sede", description = "Retorna el nivel de disponibilidad (DISPONIBLE, POCAS_UNIDADES, AGOTADO) en cada sede activa sin exponer cantidades exactas (RN-10).")
	public DisponibilidadMedicamentoResponse consultarDisponibilidad(@PathVariable UUID id) {
		return catalogoPublicoService.consultarDisponibilidad(id);
	}

	@GetMapping("/sedes")
	@Operation(summary = "Listar sedes activas", description = "Retorna las sedes activas con dirección, horario y coordenadas para mapa (RF-PAC-05).")
	public List<SedePublicaResponse> listarSedes() {
		return catalogoPublicoService.listarSedes();
	}
}
