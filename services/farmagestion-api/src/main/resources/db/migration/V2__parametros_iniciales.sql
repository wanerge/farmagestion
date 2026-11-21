-- V2: Parámetros del sistema con valores por defecto (00 §6.3)

INSERT INTO parametro (clave, valor, descripcion) VALUES
    ('reserva.ttl_domicilio_horas', '24', 'Vencimiento de la reserva en pedidos a domicilio (horas)'),
    ('reserva.gracia_turno_min', '30', 'Minutos tras el fin de la franja antes de vencer una reserva de turno'),
    ('turno.franja_min', '30', 'Duración de cada franja horaria de turno (minutos)'),
    ('turno.capacidad_franja', '6', 'Turnos máximos por franja y sede'),
    ('turno.dias_adelante', '1', 'Días hacia adelante en que se puede agendar turno'),
    ('domicilio.max_paradas', '8', 'Paradas máximas por ruta de domicilio'),
    ('domicilio.max_intentos', '2', 'Intentos de entrega antes de cancelar un pedido a domicilio'),
    ('inventario.stock_minimo_default', '10', 'Stock mínimo inicial al crear un registro de inventario')
ON CONFLICT (clave) DO NOTHING;
