package co.farmagestion.api.formulas;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.common.web.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pacientes/me/formulas")
@Tag(name = "Fórmulas del paciente", description = "Vinculación, consulta con saldos, matriz de disponibilidad y descarga de PDF de fórmulas (RF-PAC-06 a RF-PAC-09)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class FormulaPacienteController {

	private final FormulaService formulaService;

	public FormulaPacienteController(FormulaService formulaService) {
		this.formulaService = formulaService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Vincular fórmula", description = "Valida la fórmula contra el simulador EPS usando el documento del paciente y guarda la copia local (RF-PAC-06, RN-04, RN-PAC-01, RN-PAC-02).")
	public FormulaDetalleResponse vincular(
			@AuthenticationPrincipal Jwt jwt,
			@Valid @RequestBody VincularFormulaRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return formulaService.vincularFormula(auth.usuarioId(), request);
	}

	@GetMapping
	@Operation(summary = "Listar fórmulas vinculadas", description = "Lista las fórmulas vinculadas del paciente con su vigencia e ítems con saldo pendiente (RF-PAC-07, RN-03).")
	public List<FormulaResumenResponse> listar(@AuthenticationPrincipal Jwt jwt) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return formulaService.listarFormulas(auth.usuarioId());
	}

	@GetMapping("/{id}")
	@Operation(summary = "Ver detalle de fórmula", description = "Refresca desde el simulador si está disponible y devuelve detalle con saldos pendientes y matriz de disponibilidad por sede (RF-PAC-07, RF-PAC-09).")
	public FormulaDetalleResponse detalle(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return formulaService.obtenerDetalleFormula(auth.usuarioId(), id);
	}

	@GetMapping(value = "/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
	@Operation(summary = "Descargar PDF de la fórmula", description = "Obtiene del simulador EPS el documento PDF simulado de la fórmula autenticada (RF-PAC-08, CA-PAC-12).")
	public ResponseEntity<byte[]> descargarPdf(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		PdfFormula pdf = formulaService.descargarPdf(auth.usuarioId(), id);
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_PDF);
		headers.setContentDisposition(
				ContentDisposition.attachment().filename("formula-" + pdf.codigoExterno() + ".pdf").build());
		return ResponseEntity.ok().headers(headers).body(pdf.contenido());
	}
}
