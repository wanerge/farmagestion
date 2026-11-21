package co.farmagestion.api.inventario;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.util.UUID;

@Entity
@Table(name = "inventario")
public class Inventario {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "sede_id", nullable = false)
	private UUID sedeId;

	@Column(name = "medicamento_id", nullable = false)
	private UUID medicamentoId;

	@Column(name = "cantidad_fisica", nullable = false)
	private int cantidadFisica;

	@Column(name = "cantidad_reservada", nullable = false)
	private int cantidadReservada;

	@Column(name = "stock_minimo", nullable = false)
	private int stockMinimo = 10;

	@Version
	@Column(name = "version", nullable = false)
	private long version;

	protected Inventario() {
	}

	public UUID getId() {
		return id;
	}

	public UUID getSedeId() {
		return sedeId;
	}

	public void setSedeId(UUID sedeId) {
		this.sedeId = sedeId;
	}

	public UUID getMedicamentoId() {
		return medicamentoId;
	}

	public void setMedicamentoId(UUID medicamentoId) {
		this.medicamentoId = medicamentoId;
	}

	public int getCantidadFisica() {
		return cantidadFisica;
	}

	public void setCantidadFisica(int cantidadFisica) {
		this.cantidadFisica = cantidadFisica;
	}

	public int getCantidadReservada() {
		return cantidadReservada;
	}

	public void setCantidadReservada(int cantidadReservada) {
		this.cantidadReservada = cantidadReservada;
	}

	public int getStockMinimo() {
		return stockMinimo;
	}

	public void setStockMinimo(int stockMinimo) {
		this.stockMinimo = stockMinimo;
	}

	public long getVersion() {
		return version;
	}
}
