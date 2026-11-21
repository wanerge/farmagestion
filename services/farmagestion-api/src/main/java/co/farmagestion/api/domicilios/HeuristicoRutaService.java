package co.farmagestion.api.domicilios;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Heurístico de optimización de rutas de domicilio (03 §5, L6 de 00):
 * 1. Distancia en km con fórmula de Haversine (línea recta).
 * 2. Construcción por vecino más cercano partiendo desde la sede.
 * 3. Una pasada de 2-opt sobre el camino abierto resultante (sin regreso obligatorio a la sede).
 */
@Service
public class HeuristicoRutaService {

	private static final double RADIO_TIERRA_KM = 6371.0;
	private static final double EPSILON = 1e-9;

	public record PuntoEntrega(UUID pedidoId, double latitud, double longitud) {
	}

	public record ParadaCalculada(UUID pedidoId, int orden, BigDecimal distanciaKmDesdeAnterior) {
	}

	public record ResultadoHeuristico(List<ParadaCalculada> paradas, BigDecimal distanciaTotalKm) {
	}

	public static double distanciaHaversineKm(double lat1, double lon1, double lat2, double lon2) {
		double dLat = Math.toRadians(lat2 - lat1);
		double dLon = Math.toRadians(lon2 - lon1);
		double a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0)
				+ Math.cos(Math.toRadians(lat1))
						* Math.cos(Math.toRadians(lat2))
						* Math.sin(dLon / 2.0)
						* Math.sin(dLon / 2.0);
		double c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0.0, 1.0 - a)));
		return RADIO_TIERRA_KM * c;
	}

	public ResultadoHeuristico optimizarRuta(
			double origenLat,
			double origenLon,
			List<PuntoEntrega> destinos) {
		if (destinos == null || destinos.isEmpty()) {
			return new ResultadoHeuristico(List.of(), BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));
		}

		// 1. Construcción por vecino más cercano partiendo desde la sede
		List<PuntoEntrega> pendientes = new ArrayList<>(destinos);
		List<PuntoEntrega> orden = new ArrayList<>(destinos.size());

		double actualLat = origenLat;
		double actualLon = origenLon;

		while (!pendientes.isEmpty()) {
			int mejorIndice = 0;
			double mejorDistancia = Double.POSITIVE_INFINITY;
			for (int i = 0; i < pendientes.size(); i++) {
				PuntoEntrega candidato = pendientes.get(i);
				double d = distanciaHaversineKm(actualLat, actualLon, candidato.latitud(), candidato.longitud());
				if (d < mejorDistancia - EPSILON) {
					mejorDistancia = d;
					mejorIndice = i;
				}
			}
			PuntoEntrega elegido = pendientes.remove(mejorIndice);
			orden.add(elegido);
			actualLat = elegido.latitud();
			actualLon = elegido.longitud();
		}

		// 2. Una pasada de 2-opt sobre camino abierto (sin regreso a la sede)
		aplicarUnaPasada2Opt(origenLat, origenLon, orden);

		return calcularDistanciasEnOrden(origenLat, origenLon, orden);
	}

	public ResultadoHeuristico calcularDistanciasEnOrden(
			double origenLat,
			double origenLon,
			List<PuntoEntrega> orden) {
		if (orden == null || orden.isEmpty()) {
			return new ResultadoHeuristico(List.of(), BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP));
		}

		List<ParadaCalculada> paradas = new ArrayList<>(orden.size());
		BigDecimal total = BigDecimal.ZERO.setScale(3, RoundingMode.HALF_UP);

		double prevLat = origenLat;
		double prevLon = origenLon;

		for (int i = 0; i < orden.size(); i++) {
			PuntoEntrega punto = orden.get(i);
			double distKm = distanciaHaversineKm(prevLat, prevLon, punto.latitud(), punto.longitud());
			BigDecimal tramo = BigDecimal.valueOf(distKm).setScale(3, RoundingMode.HALF_UP);
			paradas.add(new ParadaCalculada(punto.pedidoId(), i + 1, tramo));
			total = total.add(tramo);
			prevLat = punto.latitud();
			prevLon = punto.longitud();
		}

		return new ResultadoHeuristico(paradas, total.setScale(3, RoundingMode.HALF_UP));
	}

	private void aplicarUnaPasada2Opt(double origenLat, double origenLon, List<PuntoEntrega> orden) {
		int n = orden.size();
		if (n < 2) {
			return;
		}
		for (int i = 0; i < n - 1; i++) {
			for (int j = i + 1; j < n; j++) {
				double prevLat = (i == 0) ? origenLat : orden.get(i - 1).latitud();
				double prevLon = (i == 0) ? origenLon : orden.get(i - 1).longitud();

				PuntoEntrega pi = orden.get(i);
				PuntoEntrega pj = orden.get(j);

				double costoActual = distanciaHaversineKm(prevLat, prevLon, pi.latitud(), pi.longitud());
				double costoNuevo = distanciaHaversineKm(prevLat, prevLon, pj.latitud(), pj.longitud());

				if (j + 1 < n) {
					PuntoEntrega next = orden.get(j + 1);
					costoActual += distanciaHaversineKm(pj.latitud(), pj.longitud(), next.latitud(), next.longitud());
					costoNuevo += distanciaHaversineKm(pi.latitud(), pi.longitud(), next.latitud(), next.longitud());
				}

				if (costoNuevo + EPSILON < costoActual) {
					Collections.reverse(orden.subList(i, j + 1));
				}
			}
		}
	}
}
