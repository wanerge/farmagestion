package co.farmagestion.api.pedidos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pedido")
public class Pedido {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "codigo", nullable = false, unique = true, length = 40)
	private String codigo;

	@Column(name = "paciente_id", nullable = false)
	private UUID pacienteId;

	@Column(name = "formula_ref_id", nullable = false)
	private UUID formulaRefId;

	@Column(name = "sede_id", nullable = false)
	private UUID sedeId;

	@Enumerated(EnumType.STRING)
	@Column(name = "modalidad", nullable = false, length = 20)
	private ModalidadPedido modalidad;

	@Enumerated(EnumType.STRING)
	@Column(name = "estado", nullable = false, length = 25)
	private EstadoPedido estado;

	@Column(name = "es_parcial", nullable = false)
	private boolean esParcial;

	@Column(name = "direccion_entrega", length = 255)
	private String direccionEntrega;

	@Column(name = "latitud_entrega", precision = 9, scale = 6)
	private BigDecimal latitudEntrega;

	@Column(name = "longitud_entrega", precision = 9, scale = 6)
	private BigDecimal longitudEntrega;

	@Column(name = "intentos_entrega", nullable = false)
	private int intentosEntrega;

	@Column(name = "expira_en", nullable = false)
	private Instant expiraEn;

	@Column(name = "asignado_a")
	private UUID asignadoA;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt = Instant.now();

	@Column(name = "listo_en")
	private Instant listoEn;

	@Column(name = "entregado_en")
	private Instant entregadoEn;

	protected Pedido() {
	}

	public UUID getId() {
		return id;
	}

	public String getCodigo() {
		return codigo;
	}

	public void setCodigo(String codigo) {
		this.codigo = codigo;
	}

	public UUID getPacienteId() {
		return pacienteId;
	}

	public void setPacienteId(UUID pacienteId) {
		this.pacienteId = pacienteId;
	}

	public UUID getFormulaRefId() {
		return formulaRefId;
	}

	public void setFormulaRefId(UUID formulaRefId) {
		this.formulaRefId = formulaRefId;
	}

	public UUID getSedeId() {
		return sedeId;
	}

	public void setSedeId(UUID sedeId) {
		this.sedeId = sedeId;
	}

	public ModalidadPedido getModalidad() {
		return modalidad;
	}

	public void setModalidad(ModalidadPedido modalidad) {
		this.modalidad = modalidad;
	}

	public EstadoPedido getEstado() {
		return estado;
	}

	public void setEstado(EstadoPedido estado) {
		this.estado = estado;
	}

	public boolean isEsParcial() {
		return esParcial;
	}

	public void setEsParcial(boolean esParcial) {
		this.esParcial = esParcial;
	}

	public String getDireccionEntrega() {
		return direccionEntrega;
	}

	public void setDireccionEntrega(String direccionEntrega) {
		this.direccionEntrega = direccionEntrega;
	}

	public BigDecimal getLatitudEntrega() {
		return latitudEntrega;
	}

	public void setLatitudEntrega(BigDecimal latitudEntrega) {
		this.latitudEntrega = latitudEntrega;
	}

	public BigDecimal getLongitudEntrega() {
		return longitudEntrega;
	}

	public void setLongitudEntrega(BigDecimal longitudEntrega) {
		this.longitudEntrega = longitudEntrega;
	}

	public int getIntentosEntrega() {
		return intentosEntrega;
	}

	public void setIntentosEntrega(int intentosEntrega) {
		this.intentosEntrega = intentosEntrega;
	}

	public Instant getExpiraEn() {
		return expiraEn;
	}

	public void setExpiraEn(Instant expiraEn) {
		this.expiraEn = expiraEn;
	}

	public UUID getAsignadoA() {
		return asignadoA;
	}

	public void setAsignadoA(UUID asignadoA) {
		this.asignadoA = asignadoA;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public void setUpdatedAt(Instant updatedAt) {
		this.updatedAt = updatedAt;
	}

	public Instant getListoEn() {
		return listoEn;
	}

	public void setListoEn(Instant listoEn) {
		this.listoEn = listoEn;
	}

	public Instant getEntregadoEn() {
		return entregadoEn;
	}

	public void setEntregadoEn(Instant entregadoEn) {
		this.entregadoEn = entregadoEn;
	}
}
