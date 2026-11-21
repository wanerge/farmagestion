package co.farmagestion.api.catalogo;

import co.farmagestion.api.common.web.ApiException;
import co.farmagestion.api.common.web.PaginaResponse;
import co.farmagestion.api.inventario.InventarioConsultaService;
import co.farmagestion.api.inventario.NivelDisponibilidad;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogoPublicoService {

	private static final int MAX_PAGE_SIZE = 100;

	private final MedicamentoRepository medicamentoRepository;
	private final CatalogoConsultaService catalogoConsultaService;
	private final InventarioConsultaService inventarioConsultaService;

	public CatalogoPublicoService(
			MedicamentoRepository medicamentoRepository,
			CatalogoConsultaService catalogoConsultaService,
			InventarioConsultaService inventarioConsultaService) {
		this.medicamentoRepository = medicamentoRepository;
		this.catalogoConsultaService = catalogoConsultaService;
		this.inventarioConsultaService = inventarioConsultaService;
	}

	@Transactional(readOnly = true)
	public PaginaResponse<MedicamentoPublicoResponse> buscarMedicamentos(String q, int page, int size) {
		int pagina = Math.max(0, page);
		int tamano = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
		String filtro = q == null ? "" : q.trim();

		Page<MedicamentoPublicoResponse> resultado = medicamentoRepository
				.buscarActivos(filtro, PageRequest.of(pagina, tamano))
				.map(MedicamentoPublicoResponse::from);
		return PaginaResponse.of(resultado);
	}

	@Transactional(readOnly = true)
	public List<SedePublicaResponse> listarSedes() {
		return catalogoConsultaService.listarSedesActivas();
	}

	@Transactional(readOnly = true)
	public DisponibilidadMedicamentoResponse consultarDisponibilidad(UUID medicamentoId) {
		Medicamento medicamento = medicamentoRepository.findByIdAndActivoTrue(medicamentoId)
				.orElseThrow(() -> ApiException.notFound(
						"MEDICAMENTO_NO_ENCONTRADO",
						"Medicamento no encontrado",
						"No se encontró un medicamento activo con el identificador indicado."));

		List<SedePublicaResponse> sedesActivas = catalogoConsultaService.listarSedesActivas();
		Map<UUID, NivelDisponibilidad> nivelesPorSede = inventarioConsultaService
				.obtenerNivelesPorMedicamento(medicamento.getId());

		List<DisponibilidadSedeResponse> sedes = sedesActivas.stream()
				.map(s -> new DisponibilidadSedeResponse(
						s.id(),
						s.codigo(),
						s.nombre(),
						s.direccion(),
						s.latitud(),
						s.longitud(),
						s.horaApertura(),
						s.horaCierre(),
						nivelesPorSede.getOrDefault(s.id(), NivelDisponibilidad.AGOTADO)))
				.toList();

		return new DisponibilidadMedicamentoResponse(
				medicamento.getId(),
				medicamento.getCodigo(),
				medicamento.getNombre(),
				medicamento.getPrincipioActivo(),
				medicamento.getPresentacion(),
				sedes);
	}
}
