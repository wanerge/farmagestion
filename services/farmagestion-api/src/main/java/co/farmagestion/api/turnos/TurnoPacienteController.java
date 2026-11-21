package co.farmagestion.api.turnos;

import co.farmagestion.api.common.web.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pacientes/me/sedes")
@Tag(name = "Turnos del paciente", description = "Consulta de franjas horarias con cupo para recoger en sede (RF-PAC-11, RN-PAC-05)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class TurnoPacienteController {

	private final TurnoService turnoService;

	public TurnoPacienteController(TurnoService turnoService) {
		this.turnoService = turnoService;
	}

	@GetMapping("/{sedeId}/franjas")
	@Operation(summary = "Consultar franjas con cupo", description = "Devuelve las franjas horarias de la sede para la fecha indicada (por defecto hoy) respetando horario, anticipación de 60 minutos y capacidad (RN-PAC-05).")
	public FranjasDisponiblesResponse consultarFranjas(
			@PathVariable UUID sedeId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
		return turnoService.consultarFranjasDisponibles(sedeId, fecha);
	}
}
