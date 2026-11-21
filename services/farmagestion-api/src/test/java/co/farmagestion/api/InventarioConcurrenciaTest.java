package co.farmagestion.api;

import static org.assertj.core.api.Assertions.assertThat;

import co.farmagestion.api.inventario.InventarioOperacionesService;
import co.farmagestion.api.inventario.ResultadoReserva;
import co.farmagestion.api.inventario.SolicitudStockItem;
import co.farmagestion.api.inventario.StockInsuficienteException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@TestPropertySource(properties = "spring.datasource.hikari.maximum-pool-size=25")
class InventarioConcurrenciaTest {

	@Autowired
	private InventarioOperacionesService operacionesService;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private UUID sedeCentroId;
	private UUID usuarioId;

	@BeforeEach
	void setUp() {
		sedeCentroId = jdbcTemplate.queryForObject(
				"SELECT id FROM sede WHERE codigo = 'SEDE-CENTRO'", UUID.class);
		usuarioId = jdbcTemplate.queryForObject(
				"SELECT id FROM usuario WHERE email = 'farmaceutico.centro@farmagestion.demo'", UUID.class);
	}

	@Test
	void concurrencia24HilosPidiendo5UnidadesNuncaReservaMasDeLoDisponibleSinParcial() throws Exception {
		UUID medId = jdbcTemplate.queryForObject(
				"SELECT id FROM medicamento WHERE codigo = 'MED-0016'", UUID.class);
		int stockInicial = 23;
		int hilos = 24;
		int cantidadPorHilo = 5;

		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = ?, cantidad_reservada = 0, stock_minimo = 5 WHERE sede_id = ? AND medicamento_id = ?",
				stockInicial, sedeCentroId, medId);
		jdbcTemplate.update(
				"DELETE FROM movimiento_inventario WHERE sede_id = ? AND medicamento_id = ? AND referencia_tipo = 'TEST_CONCURRENCIA'",
				sedeCentroId, medId);

		CountDownLatch listos = new CountDownLatch(hilos);
		CountDownLatch disparar = new CountDownLatch(1);
		AtomicInteger exitos = new AtomicInteger();
		AtomicInteger sinStock = new AtomicInteger();
		AtomicInteger unidadesReservadasReportadas = new AtomicInteger();

		try (ExecutorService pool = Executors.newFixedThreadPool(hilos)) {
			List<Future<?>> futuros = new ArrayList<>();
			for (int i = 0; i < hilos; i++) {
				futuros.add(pool.submit(() -> {
					listos.countDown();
					try {
						assertThat(disparar.await(10, TimeUnit.SECONDS)).isTrue();
						ResultadoReserva res = operacionesService.reservar(
								sedeCentroId,
								List.of(new SolicitudStockItem(medId, cantidadPorHilo)),
								false,
								"TEST_CONCURRENCIA",
								UUID.randomUUID(),
								usuarioId);
						exitos.incrementAndGet();
						unidadesReservadasReportadas.addAndGet(res.items().getFirst().reservada());
					} catch (StockInsuficienteException ex) {
						sinStock.incrementAndGet();
					} catch (InterruptedException ex) {
						Thread.currentThread().interrupt();
						throw new RuntimeException(ex);
					}
				}));
			}

			assertThat(listos.await(10, TimeUnit.SECONDS)).isTrue();
			disparar.countDown();

			for (Future<?> f : futuros) {
				f.get(30, TimeUnit.SECONDS);
			}
		}

		Integer fisicoFinal = jdbcTemplate.queryForObject(
				"SELECT cantidad_fisica FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		Integer reservadoFinal = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		Integer movimientosReserva = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM movimiento_inventario WHERE sede_id = ? AND medicamento_id = ? AND referencia_tipo = 'TEST_CONCURRENCIA' AND tipo = 'RESERVA'",
				Integer.class, sedeCentroId, medId);

		assertThat(exitos.get()).isEqualTo(4);
		assertThat(sinStock.get()).isEqualTo(hilos - 4);
		assertThat(unidadesReservadasReportadas.get()).isEqualTo(20);
		assertThat(fisicoFinal).isEqualTo(stockInicial);
		assertThat(reservadoFinal).isEqualTo(20);
		assertThat(reservadoFinal).isLessThanOrEqualTo(fisicoFinal);
		assertThat(movimientosReserva).isEqualTo(4);
	}

	@Test
	void concurrencia24HilosPidiendo5UnidadesConParcialNuncaExcedeDisponible() throws Exception {
		UUID medId = jdbcTemplate.queryForObject(
				"SELECT id FROM medicamento WHERE codigo = 'MED-0018'", UUID.class);
		int stockInicial = 23;
		int hilos = 24;
		int cantidadPorHilo = 5;

		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = ?, cantidad_reservada = 0, stock_minimo = 5 WHERE sede_id = ? AND medicamento_id = ?",
				stockInicial, sedeCentroId, medId);

		CountDownLatch listos = new CountDownLatch(hilos);
		CountDownLatch disparar = new CountDownLatch(1);
		AtomicInteger exitos = new AtomicInteger();
		AtomicInteger agotados = new AtomicInteger();
		AtomicInteger totalReservado = new AtomicInteger();

		try (ExecutorService pool = Executors.newFixedThreadPool(hilos)) {
			List<Future<?>> futuros = new ArrayList<>();
			for (int i = 0; i < hilos; i++) {
				futuros.add(pool.submit(() -> {
					listos.countDown();
					try {
						assertThat(disparar.await(10, TimeUnit.SECONDS)).isTrue();
						ResultadoReserva res = operacionesService.reservar(
								sedeCentroId,
								List.of(new SolicitudStockItem(medId, cantidadPorHilo)),
								true,
								"TEST_CONCURRENCIA_PARCIAL",
								UUID.randomUUID(),
								usuarioId);
						exitos.incrementAndGet();
						totalReservado.addAndGet(res.items().getFirst().reservada());
					} catch (StockInsuficienteException ex) {
						agotados.incrementAndGet();
					} catch (InterruptedException ex) {
						Thread.currentThread().interrupt();
						throw new RuntimeException(ex);
					}
				}));
			}

			assertThat(listos.await(10, TimeUnit.SECONDS)).isTrue();
			disparar.countDown();

			for (Future<?> f : futuros) {
				f.get(30, TimeUnit.SECONDS);
			}
		}

		Integer reservadoFinal = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);

		assertThat(exitos.get()).isEqualTo(5); // 4 de 5 + 1 parcial de 3
		assertThat(agotados.get()).isEqualTo(hilos - 5);
		assertThat(totalReservado.get()).isEqualTo(stockInicial);
		assertThat(reservadoFinal).isEqualTo(stockInicial);
	}

	@Test
	void concurrenciaMultiMedicamentoEnOrdenOpuestoSinInterbloqueos() throws Exception {
		UUID medA = jdbcTemplate.queryForObject(
				"SELECT id FROM medicamento WHERE codigo = 'MED-0022'", UUID.class);
		UUID medB = jdbcTemplate.queryForObject(
				"SELECT id FROM medicamento WHERE codigo = 'MED-0023'", UUID.class);

		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 50, cantidad_reservada = 0, stock_minimo = 5 WHERE sede_id = ? AND medicamento_id IN (?, ?)",
				sedeCentroId, medA, medB);

		int hilos = 20;
		CountDownLatch listos = new CountDownLatch(hilos);
		CountDownLatch disparar = new CountDownLatch(1);
		AtomicInteger exitos = new AtomicInteger();

		try (ExecutorService pool = Executors.newFixedThreadPool(hilos)) {
			List<Future<?>> futuros = new ArrayList<>();
			for (int i = 0; i < hilos; i++) {
				final boolean ordenInvertido = (i % 2 == 1);
				futuros.add(pool.submit(() -> {
					listos.countDown();
					try {
						assertThat(disparar.await(10, TimeUnit.SECONDS)).isTrue();
						List<SolicitudStockItem> solicitud = ordenInvertido
								? List.of(new SolicitudStockItem(medB, 5), new SolicitudStockItem(medA, 5))
								: List.of(new SolicitudStockItem(medA, 5), new SolicitudStockItem(medB, 5));
						operacionesService.reservar(
								sedeCentroId,
								solicitud,
								false,
								"TEST_DEADLOCK",
								UUID.randomUUID(),
								usuarioId);
						exitos.incrementAndGet();
					} catch (StockInsuficienteException ignored) {
					} catch (InterruptedException ex) {
						Thread.currentThread().interrupt();
						throw new RuntimeException(ex);
					}
				}));
			}

			assertThat(listos.await(10, TimeUnit.SECONDS)).isTrue();
			disparar.countDown();

			for (Future<?> f : futuros) {
				f.get(30, TimeUnit.SECONDS);
			}
		}

		Integer reservadoA = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medA);
		Integer reservadoB = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medB);

		assertThat(exitos.get()).isEqualTo(10);
		assertThat(reservadoA).isEqualTo(50);
		assertThat(reservadoB).isEqualTo(50);
	}
}
