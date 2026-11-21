package co.farmagestion.api.auth;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface PacienteRepository extends JpaRepository<Paciente, UUID> {

	boolean existsByTipoDocumentoIgnoreCaseAndDocumento(String tipoDocumento, String documento);

	Optional<Paciente> findByUsuarioId(UUID usuarioId);

	List<Paciente> findAllByUsuarioIdIn(Collection<UUID> usuarioIds);
}
