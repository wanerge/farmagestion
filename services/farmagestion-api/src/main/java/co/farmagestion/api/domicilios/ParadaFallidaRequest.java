package co.farmagestion.api.domicilios;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ParadaFallidaRequest(
		@NotBlank(message = "Debe indicar el motivo de la entrega fallida.") @Size(max = 500) String motivo) {
}
