package co.farmagestion.api.formulas;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface FormulaRefRepository extends JpaRepository<FormulaRef, UUID> {

	Optional<FormulaRef> findByCodigoExternoIgnoreCase(String codigoExterno);

	Optional<FormulaRef> findByIdAndPacienteId(UUID id, UUID pacienteId);

	List<FormulaRef> findAllByPacienteIdOrderByFechaEmisionDescSincronizadaEnDesc(UUID pacienteId);

	List<FormulaRef> findAllByIdIn(Collection<UUID> ids);
}
