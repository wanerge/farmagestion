package co.farmagestion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class EsquemaYChecksTest {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void semillaCargadaCorrectamente() {
		Integer sedes = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM sede", Integer.class);
		Integer medicamentos = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM medicamento", Integer.class);
		Integer parametros = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM parametro", Integer.class);
		Integer inventario = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM inventario", Integer.class);
		Integer agotados = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM inventario WHERE cantidad_fisica = 0", Integer.class);
		Integer bajoMinimo = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM inventario WHERE cantidad_fisica > 0 AND cantidad_fisica <= stock_minimo",
				Integer.class);
		String adminHash = jdbcTemplate.queryForObject(
				"SELECT password_hash FROM usuario WHERE email = 'admin@farmagestion.demo'", String.class);

		assertThat(sedes).isEqualTo(3);
		assertThat(medicamentos).isEqualTo(30);
		assertThat(parametros).isEqualTo(8);
		assertThat(inventario).isEqualTo(90);
		assertThat(agotados).isGreaterThan(0);
		assertThat(bajoMinimo).isGreaterThan(0);
		assertThat(new BCryptPasswordEncoder().matches("Farma2026!", adminHash)).isTrue();
	}

	@Test
	void checkInventarioFisicoMayorOIgualAReservado() {
		UUID inventarioId = jdbcTemplate.queryForObject(
				"SELECT id FROM inventario WHERE cantidad_fisica > 0 LIMIT 1", UUID.class);
		Integer fisico = jdbcTemplate.queryForObject(
				"SELECT cantidad_fisica FROM inventario WHERE id = ?", Integer.class, inventarioId);

		assertThatThrownBy(() -> jdbcTemplate.update(
				"UPDATE inventario SET cantidad_reservada = ? WHERE id = ?",
				fisico + 1, inventarioId))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void checkFormulaItemDispensadaMenorOIgualAAutorizada() {
		UUID pacienteId = jdbcTemplate.queryForObject(
				"SELECT usuario_id FROM paciente LIMIT 1", UUID.class);
		UUID medicamentoId = jdbcTemplate.queryForObject(
				"SELECT id FROM medicamento LIMIT 1", UUID.class);
		UUID formulaId = UUID.randomUUID();

		jdbcTemplate.update(
				"""
				INSERT INTO formula_ref (id, codigo_externo, paciente_id, estado_externo, fecha_emision, fecha_vencimiento)
				VALUES (?, ?, ?, 'EMITIDA', ?, ?)
				""",
				formulaId, "FRM-TEST-000001", pacienteId, LocalDate.now(), LocalDate.now().plusDays(30));

		try {
			assertThatThrownBy(() -> jdbcTemplate.update(
					"""
					INSERT INTO formula_item_ref (formula_ref_id, medicamento_id, cantidad_autorizada, cantidad_dispensada)
					VALUES (?, ?, 10, 11)
					""",
					formulaId, medicamentoId))
					.isInstanceOf(DataIntegrityViolationException.class);
		} finally {
			jdbcTemplate.update("DELETE FROM formula_ref WHERE id = ?", formulaId);
		}
	}
}
