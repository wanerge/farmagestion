package co.farmagestion.api.formulas;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "formula_ref")
public class FormulaRef {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "codigo_externo", nullable = false, unique = true, length = 40)
	private String codigoExterno;

	@Column(name = "paciente_id", nullable = false)
	private UUID pacienteId;

	@Enumerated(EnumType.STRING)
	@Column(name = "estado_externo", nullable = false, length = 30)
	private EstadoFormulaExterna estadoExterno;

	@Column(name = "fecha_emision", nullable = false)
	private LocalDate fechaEmision;

	@Column(name = "fecha_vencimiento", nullable = false)
	private LocalDate fechaVencimiento;

	@Column(name = "sincronizada_en", nullable = false)
	private Instant sincronizadaEn = Instant.now();

	protected FormulaRef() {
	}

	public UUID getId() {
		return id;
	}

	public String getCodigoExterno() {
		return codigoExterno;
	}

	public void setCodigoExterno(String codigoExterno) {
		this.codigoExterno = codigoExterno;
	}

	public UUID getPacienteId() {
		return pacienteId;
	}

	public void setPacienteId(UUID pacienteId) {
		this.pacienteId = pacienteId;
	}

	public EstadoFormulaExterna getEstadoExterno() {
		return estadoExterno;
	}

	public void setEstadoExterno(EstadoFormulaExterna estadoExterno) {
		this.estadoExterno = estadoExterno;
	}

	public LocalDate getFechaEmision() {
		return fechaEmision;
	}

	public void setFechaEmision(LocalDate fechaEmision) {
		this.fechaEmision = fechaEmision;
	}

	public LocalDate getFechaVencimiento() {
		return fechaVencimiento;
	}

	public void setFechaVencimiento(LocalDate fechaVencimiento) {
		this.fechaVencimiento = fechaVencimiento;
	}

	public Instant getSincronizadaEn() {
		return sincronizadaEn;
	}

	public void setSincronizadaEn(Instant sincronizadaEn) {
		this.sincronizadaEn = sincronizadaEn;
	}
}
