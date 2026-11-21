package co.farmagestion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import co.farmagestion.api.domicilios.HeuristicoRutaService;
import co.farmagestion.api.domicilios.HeuristicoRutaService.ParadaCalculada;
import co.farmagestion.api.domicilios.HeuristicoRutaService.PuntoEntrega;
import co.farmagestion.api.domicilios.HeuristicoRutaService.ResultadoHeuristico;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HeuristicoRutaServiceTest {

	private final HeuristicoRutaService service = new HeuristicoRutaService();

	@Test
	void distanciaHaversineEntreMedellinYBelloEsConsistente() {
		// SEDE-CENTRO (6.247638, -75.565815) a SEDE-BELLO (6.337320, -75.557950) ~ 10.01 km
		double km = HeuristicoRutaService.distanciaHaversineKm(6.247638, -75.565815, 6.337320, -75.557950);
		assertThat(km).isCloseTo(10.01, within(0.15));
		assertThat(HeuristicoRutaService.distanciaHaversineKm(6.25, -75.56, 6.25, -75.56)).isZero();
	}

	@Test
	void vecinoMasCercanoY2OptOrdenanCaminoAbiertoSinRegresoASede() {
		double sedeLat = 6.247638;
		double sedeLon = -75.565815;

		// 4 puntos en línea hacia el sur; entregados desordenados
		UUID p1 = UUID.randomUUID();
		UUID p2 = UUID.randomUUID();
		UUID p3 = UUID.randomUUID();
		UUID p4 = UUID.randomUUID();

		List<PuntoEntrega> destinos = List.of(
				new PuntoEntrega(p4, 6.2000, -75.5658),
				new PuntoEntrega(p2, 6.2300, -75.5658),
				new PuntoEntrega(p3, 6.2150, -75.5658),
				new PuntoEntrega(p1, 6.2420, -75.5658));

		ResultadoHeuristico res = service.optimizarRuta(sedeLat, sedeLon, destinos);

		assertThat(res.paradas()).extracting(ParadaCalculada::pedidoId)
				.containsExactly(p1, p2, p3, p4);
		assertThat(res.paradas()).extracting(ParadaCalculada::orden)
				.containsExactly(1, 2, 3, 4);

		BigDecimal suma = res.paradas().stream()
				.map(ParadaCalculada::distanciaKmDesdeAnterior)
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		assertThat(res.distanciaTotalKm()).isEqualByComparingTo(suma);
		// Distancia total en línea recta ~ 5.3 km (sin regreso a sede, que sería ~10.6 km)
		assertThat(res.distanciaTotalKm().doubleValue()).isCloseTo(5.30, within(0.1));
	}

	@Test
	void pasada2OptMejoraCruceDeSegmentos() {
		// Geometría donde el orden inicial de vecino más cercano genera un cruce que 2-opt elimina:
		// Origen (0,0), A (0, 0.01), B (0.012, 0.011), C (0.012, 0.0), D (0.001, -0.012)
		// Mejor que verificar un orden específico: la distancia total tras optimizar debe ser <=
		// la distancia de cualquier permutación cruzada y exacta a la suma de tramos.
		UUID a = UUID.randomUUID();
		UUID b = UUID.randomUUID();
		UUID c = UUID.randomUUID();
		UUID d = UUID.randomUUID();

		List<PuntoEntrega> ordenCruzado = List.of(
				new PuntoEntrega(a, 0.0, 0.01),
				new PuntoEntrega(c, 0.02, 0.0),
				new PuntoEntrega(b, 0.0, 0.02),
				new PuntoEntrega(d, 0.02, 0.02));

		ResultadoHeuristico cruzado = service.calcularDistanciasEnOrden(0.0, 0.0, ordenCruzado);
		ResultadoHeuristico optimizado = service.optimizarRuta(0.0, 0.0, ordenCruzado);

		assertThat(optimizado.distanciaTotalKm()).isLessThan(cruzado.distanciaTotalKm());
	}
}
