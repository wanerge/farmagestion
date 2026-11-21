package co.farmagestion.api.auth;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

	Optional<Usuario> findByEmailIgnoreCase(String email);

	boolean existsByEmailIgnoreCase(String email);

	boolean existsByEmailIgnoreCaseAndIdNot(String email, UUID id);

	List<Usuario> findAllByIdIn(Collection<UUID> ids);

	@Query("SELECT u.id FROM Usuario u WHERE u.rol = :rol AND u.activo = true")
	List<UUID> findIdsActivosByRol(@Param("rol") RolUsuario rol);
}
