package co.farmagestion.api.formulas;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface FormulaItemRefRepository extends JpaRepository<FormulaItemRef, UUID> {

	List<FormulaItemRef> findAllByFormulaRefId(UUID formulaRefId);

	List<FormulaItemRef> findAllByFormulaRefIdIn(Collection<UUID> formulaRefIds);
}
