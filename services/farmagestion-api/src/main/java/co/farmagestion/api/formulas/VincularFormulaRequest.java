package co.farmagestion.api.formulas;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VincularFormulaRequest(
		@NotBlank(message = "El código de la fórmula es obligatorio.")
		@Size(max = 40, message = "El código de la fórmula excede el máximo permitido.")
		String codigo) {
}
