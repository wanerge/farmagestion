package co.farmagestion.api.inventario;

import java.util.UUID;

/**
 * Puerto de extensión para RN-EMP-07 (RF-EMP-13):
 * cuando un ajuste negativo deja cantidad_fisica menor que cantidad_reservada,
 * el módulo pedidos (P6) libera la diferencia del pedido más reciente primero.
 */
public interface AjusteReservaExcedenteHandler {

	/**
	 * Intenta liberar hasta {@code cantidadExcedente} unidades reservadas en pedidos activos.
	 *
	 * @return cantidad efectivamente liberada (0 si no hay pedidos reducibles).
	 */
	int liberarReservaExcedente(
			UUID sedeId,
			UUID medicamentoId,
			int cantidadExcedente,
			UUID usuarioId,
			String motivo);
}
