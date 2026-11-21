package co.farmagestion.api.inventario;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

interface MovimientoInventarioRepository
		extends JpaRepository<MovimientoInventario, UUID>, JpaSpecificationExecutor<MovimientoInventario> {
}
