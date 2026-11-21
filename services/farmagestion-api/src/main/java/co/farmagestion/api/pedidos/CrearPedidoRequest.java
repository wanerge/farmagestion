package co.farmagestion.api.pedidos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record CrearPedidoRequest(
		@NotNull(message = "La fórmula es obligatoria.")
		UUID formulaId,
		@NotNull(message = "La sede es obligatoria.")
		UUID sedeId,
		@NotNull(message = "La modalidad es obligatoria.")
		ModalidadPedido modalidad,
		OffsetDateTime franjaInicio,
		@Size(max = 255, message = "La dirección de entrega excede el máximo permitido.")
		String direccionEntrega,
		BigDecimal latitudEntrega,
		BigDecimal longitudEntrega,
		boolean aceptaParcial,
		@NotEmpty(message = "Debe solicitar al menos un medicamento.")
		List<@Valid ItemSolicitud> items) {

	public record ItemSolicitud(
			@NotNull(message = "El medicamento es obligatorio.")
			UUID medicamentoId,
			@Min(value = 1, message = "La cantidad debe ser mayor o igual a 1.")
			int cantidad) {
	}
}
