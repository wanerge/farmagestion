package co.farmagestion.api.formulas;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "formula_item_ref")
public class FormulaItemRef {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "formula_ref_id", nullable = false)
	private UUID formulaRefId;

	@Column(name = "medicamento_id", nullable = false)
	private UUID medicamentoId;

	@Column(name = "cantidad_autorizada", nullable = false)
	private int cantidadAutorizada;

	@Column(name = "cantidad_dispensada", nullable = false)
	private int cantidadDispensada;

	protected FormulaItemRef() {
	}

	public UUID getId() {
		return id;
	}

	public UUID getFormulaRefId() {
		return formulaRefId;
	}

	public void setFormulaRefId(UUID formulaRefId) {
		this.formulaRefId = formulaRefId;
	}

	public UUID getMedicamentoId() {
		return medicamentoId;
	}

	public void setMedicamentoId(UUID medicamentoId) {
		this.medicamentoId = medicamentoId;
	}

	public int getCantidadAutorizada() {
		return cantidadAutorizada;
	}

	public void setCantidadAutorizada(int cantidadAutorizada) {
		this.cantidadAutorizada = cantidadAutorizada;
	}

	public int getCantidadDispensada() {
		return cantidadDispensada;
	}

	public void setCantidadDispensada(int cantidadDispensada) {
		this.cantidadDispensada = cantidadDispensada;
	}
}
