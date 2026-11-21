package co.farmagestion.api.catalogo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface SedeRepository extends JpaRepository<Sede, UUID> {

	List<Sede> findAllByActivaTrueOrderByNombreAsc();

	List<Sede> findAllByOrderByNombreAsc();

	Optional<Sede> findByIdAndActivaTrue(UUID id);

	Optional<Sede> findByCodigoIgnoreCase(String codigo);

	boolean existsByCodigoIgnoreCase(String codigo);

	boolean existsByCodigoIgnoreCaseAndIdNot(String codigo, UUID id);

	List<Sede> findAllByIdIn(Collection<UUID> ids);
}
