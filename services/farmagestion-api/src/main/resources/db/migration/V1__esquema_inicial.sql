-- V1: Esquema completo de farma_db (00 §6.2)

-- Identidad y sedes

CREATE TABLE usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('PACIENTE', 'EMPLEADO', 'ADMIN')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sede (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(32) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    latitud NUMERIC(9, 6) NOT NULL,
    longitud NUMERIC(9, 6) NOT NULL,
    hora_apertura TIME NOT NULL,
    hora_cierre TIME NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE paciente (
    usuario_id UUID PRIMARY KEY REFERENCES usuario(id),
    tipo_documento VARCHAR(10) NOT NULL,
    documento VARCHAR(30) NOT NULL,
    nombres VARCHAR(120) NOT NULL,
    apellidos VARCHAR(120) NOT NULL,
    telefono VARCHAR(30),
    CONSTRAINT uq_paciente_documento UNIQUE (tipo_documento, documento)
);

CREATE TABLE empleado (
    usuario_id UUID PRIMARY KEY REFERENCES usuario(id),
    sede_id UUID REFERENCES sede(id),
    cargo VARCHAR(20) NOT NULL CHECK (cargo IN ('FARMACEUTICO', 'AUXILIAR', 'DOMICILIARIO')),
    nombres VARCHAR(120) NOT NULL,
    apellidos VARCHAR(120) NOT NULL
);

CREATE INDEX idx_empleado_sede_id ON empleado(sede_id);

-- Catálogo e inventario

CREATE TABLE medicamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(32) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    principio_activo VARCHAR(200) NOT NULL,
    presentacion VARCHAR(200) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sede_id UUID NOT NULL REFERENCES sede(id),
    medicamento_id UUID NOT NULL REFERENCES medicamento(id),
    cantidad_fisica INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_fisica >= 0),
    cantidad_reservada INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 10 CHECK (stock_minimo >= 0),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_inventario_sede_medicamento UNIQUE (sede_id, medicamento_id),
    CONSTRAINT chk_inventario_reservada_le_fisica CHECK (cantidad_reservada >= 0 AND cantidad_reservada <= cantidad_fisica)
);

CREATE INDEX idx_inventario_sede_id ON inventario(sede_id);
CREATE INDEX idx_inventario_medicamento_id ON inventario(medicamento_id);

CREATE TABLE movimiento_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sede_id UUID NOT NULL REFERENCES sede(id),
    medicamento_id UUID NOT NULL REFERENCES medicamento(id),
    tipo VARCHAR(25) NOT NULL CHECK (tipo IN (
        'ENTRADA', 'AJUSTE_POS', 'AJUSTE_NEG', 'RESERVA',
        'LIBERACION', 'DISPENSACION', 'TRASLADO_SALIDA', 'TRASLADO_ENTRADA'
    )),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    saldo_fisico INTEGER NOT NULL CHECK (saldo_fisico >= 0),
    referencia_tipo VARCHAR(40),
    referencia_id UUID,
    usuario_id UUID REFERENCES usuario(id),
    motivo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movimiento_sede_id ON movimiento_inventario(sede_id);
CREATE INDEX idx_movimiento_usuario_id ON movimiento_inventario(usuario_id);
CREATE INDEX idx_movimiento_medicamento_created ON movimiento_inventario(medicamento_id, created_at);

-- Fórmulas, pedidos y entregas

CREATE TABLE formula_ref (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_externo VARCHAR(40) NOT NULL UNIQUE,
    paciente_id UUID NOT NULL REFERENCES paciente(usuario_id),
    estado_externo VARCHAR(30) NOT NULL CHECK (estado_externo IN (
        'EMITIDA', 'PARCIALMENTE_DISPENSADA', 'DISPENSADA', 'VENCIDA', 'ANULADA'
    )),
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    sincronizada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formula_ref_paciente_id ON formula_ref(paciente_id);

CREATE TABLE formula_item_ref (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_ref_id UUID NOT NULL REFERENCES formula_ref(id),
    medicamento_id UUID NOT NULL REFERENCES medicamento(id),
    cantidad_autorizada INTEGER NOT NULL CHECK (cantidad_autorizada > 0),
    cantidad_dispensada INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_formula_item_ref UNIQUE (formula_ref_id, medicamento_id),
    CONSTRAINT chk_formula_item_dispensada_le_autorizada CHECK (
        cantidad_dispensada >= 0 AND cantidad_dispensada <= cantidad_autorizada
    )
);

CREATE INDEX idx_formula_item_ref_formula_id ON formula_item_ref(formula_ref_id);
CREATE INDEX idx_formula_item_ref_medicamento_id ON formula_item_ref(medicamento_id);

CREATE TABLE pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(40) NOT NULL UNIQUE,
    paciente_id UUID NOT NULL REFERENCES paciente(usuario_id),
    formula_ref_id UUID NOT NULL REFERENCES formula_ref(id),
    sede_id UUID NOT NULL REFERENCES sede(id),
    modalidad VARCHAR(20) NOT NULL CHECK (modalidad IN ('RECOGER', 'DOMICILIO')),
    estado VARCHAR(25) NOT NULL CHECK (estado IN (
        'RESERVADO', 'EN_PREPARACION', 'LISTO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO', 'VENCIDO'
    )),
    es_parcial BOOLEAN NOT NULL DEFAULT FALSE,
    direccion_entrega VARCHAR(255),
    latitud_entrega NUMERIC(9, 6),
    longitud_entrega NUMERIC(9, 6),
    intentos_entrega INTEGER NOT NULL DEFAULT 0 CHECK (intentos_entrega >= 0),
    expira_en TIMESTAMPTZ NOT NULL,
    asignado_a UUID REFERENCES empleado(usuario_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    listo_en TIMESTAMPTZ,
    entregado_en TIMESTAMPTZ
);

CREATE INDEX idx_pedido_paciente_id ON pedido(paciente_id);
CREATE INDEX idx_pedido_formula_ref_id ON pedido(formula_ref_id);
CREATE INDEX idx_pedido_sede_id ON pedido(sede_id);
CREATE INDEX idx_pedido_asignado_a ON pedido(asignado_a);
CREATE INDEX idx_pedido_estado_sede ON pedido(estado, sede_id);

CREATE TABLE pedido_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES pedido(id),
    medicamento_id UUID NOT NULL REFERENCES medicamento(id),
    cantidad_solicitada INTEGER NOT NULL CHECK (cantidad_solicitada > 0),
    cantidad_reservada INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
    cantidad_entregada INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_entregada >= 0),
    estado_item VARCHAR(20) NOT NULL CHECK (estado_item IN ('COMPLETO', 'PARCIAL', 'AGOTADO')),
    CONSTRAINT uq_pedido_item UNIQUE (pedido_id, medicamento_id)
);

CREATE INDEX idx_pedido_item_pedido_id ON pedido_item(pedido_id);
CREATE INDEX idx_pedido_item_medicamento_id ON pedido_item(medicamento_id);

CREATE TABLE pedido_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL REFERENCES pedido(id),
    estado_anterior VARCHAR(25),
    estado_nuevo VARCHAR(25) NOT NULL,
    usuario_id UUID REFERENCES usuario(id),
    nota TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pedido_historial_pedido_id ON pedido_historial(pedido_id);
CREATE INDEX idx_pedido_historial_usuario_id ON pedido_historial(usuario_id);

CREATE TABLE turno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL UNIQUE REFERENCES pedido(id),
    sede_id UUID NOT NULL REFERENCES sede(id),
    fecha DATE NOT NULL,
    franja_inicio TIME NOT NULL,
    numero INTEGER NOT NULL CHECK (numero > 0),
    codigo VARCHAR(30) NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('EN_ESPERA', 'LLAMADO', 'ATENDIDO', 'VENCIDO', 'CANCELADO')),
    llamado_en TIMESTAMPTZ,
    atendido_en TIMESTAMPTZ,
    CONSTRAINT uq_turno_sede_fecha_numero UNIQUE (sede_id, fecha, numero)
);

CREATE INDEX idx_turno_sede_fecha ON turno(sede_id, fecha);

CREATE TABLE ruta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sede_id UUID NOT NULL REFERENCES sede(id),
    domiciliario_id UUID NOT NULL REFERENCES empleado(usuario_id),
    fecha DATE NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('PLANEADA', 'EN_CURSO', 'COMPLETADA')),
    distancia_km NUMERIC(10, 3) NOT NULL DEFAULT 0 CHECK (distancia_km >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ruta_sede_id ON ruta(sede_id);
CREATE INDEX idx_ruta_domiciliario_id ON ruta(domiciliario_id);

CREATE TABLE ruta_parada (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ruta_id UUID NOT NULL REFERENCES ruta(id),
    pedido_id UUID NOT NULL UNIQUE REFERENCES pedido(id),
    orden INTEGER NOT NULL CHECK (orden > 0),
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('PENDIENTE', 'ENTREGADA', 'FALLIDA')),
    distancia_km_desde_anterior NUMERIC(10, 3) NOT NULL DEFAULT 0 CHECK (distancia_km_desde_anterior >= 0),
    CONSTRAINT uq_ruta_parada_orden UNIQUE (ruta_id, orden)
);

CREATE INDEX idx_ruta_parada_ruta_id ON ruta_parada(ruta_id);

-- Soporte

CREATE TABLE notificacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuario(id),
    tipo VARCHAR(40) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    referencia_tipo VARCHAR(40),
    referencia_id UUID,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notificacion_usuario_id ON notificacion(usuario_id);

CREATE TABLE evento_integracion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(40) NOT NULL,
    payload JSONB NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('PENDIENTE', 'ENVIADO', 'ERROR')),
    intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    ultimo_error TEXT,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    enviado_en TIMESTAMPTZ
);

CREATE INDEX idx_evento_integracion_estado ON evento_integracion(estado);

CREATE TABLE parametro (
    clave VARCHAR(100) PRIMARY KEY,
    valor VARCHAR(255) NOT NULL,
    descripcion TEXT
);
