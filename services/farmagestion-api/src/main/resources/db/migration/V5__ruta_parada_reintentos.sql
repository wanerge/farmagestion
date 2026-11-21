-- V5: Permite múltiples intentos de entrega en ruta_parada para el mismo pedido (RF-EMP-23, RN-EMP-06)
-- Un pedido fallido vuelve a LISTO y puede incluirse en una nueva ruta, pero nunca estar en dos rutas activas a la vez.

ALTER TABLE ruta_parada
    DROP CONSTRAINT IF EXISTS ruta_parada_pedido_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ruta_parada_pedido_pendiente
    ON ruta_parada (pedido_id)
    WHERE estado = 'PENDIENTE';
