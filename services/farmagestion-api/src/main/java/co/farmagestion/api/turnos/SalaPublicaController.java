package co.farmagestion.api.turnos;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion/public/sala")
@Tag(name = "Pantalla pública de sala", description = "Consulta pública sin autenticación ni datos personales de turnos llamados y en espera (RF-EMP-18, CA-EMP-10)")
public class SalaPublicaController {

	private final TurnoService turnoService;

	public SalaPublicaController(TurnoService turnoService) {
		this.turnoService = turnoService;
	}

	@GetMapping("/{sedeCodigo}")
	@Operation(summary = "Consultar pantalla de sala", description = "Retorna los códigos de turnos llamados y en espera de la sede sin datos personales.")
	public PantallaSalaResponse consultarSala(
			@PathVariable String sedeCodigo,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
		return turnoService.obtenerPantallaSala(sedeCodigo, fecha);
	}
}
