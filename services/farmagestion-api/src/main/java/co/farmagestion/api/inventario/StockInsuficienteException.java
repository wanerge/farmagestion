package co.farmagestion.api.inventario;

import co.farmagestion.api.common.web.ApiException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;

public class StockInsuficienteException extends ApiException {

	private final List<ResultadoReservaItem> items;

	public StockInsuficienteException(List<ResultadoReservaItem> items, String detail) {
		super(
				HttpStatus.CONFLICT,
				"STOCK_INSUFICIENTE",
				"Stock insuficiente",
				detail,
				Map.of("items", List.copyOf(items)));
		this.items = List.copyOf(items);
	}

	public List<ResultadoReservaItem> getItems() {
		return items;
	}
}
