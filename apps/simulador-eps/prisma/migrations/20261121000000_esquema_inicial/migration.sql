-- Migración inicial de eps_db (00 §6.1)

CREATE TABLE "paciente_eps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo_documento" VARCHAR(10) NOT NULL,
    "documento" VARCHAR(30) NOT NULL,
    "nombres" VARCHAR(120) NOT NULL,
    "apellidos" VARCHAR(120) NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "eps" VARCHAR(120) NOT NULL,
    "telefono" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paciente_eps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "medico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(150) NOT NULL,
    "registro" VARCHAR(40) NOT NULL,
    "especialidad" VARCHAR(120) NOT NULL,

    CONSTRAINT "medico_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "medicamento_catalogo" (
    "codigo" VARCHAR(32) NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "principio_activo" VARCHAR(200) NOT NULL,
    "presentacion" VARCHAR(200) NOT NULL,

    CONSTRAINT "medicamento_catalogo_pkey" PRIMARY KEY ("codigo")
);

CREATE TABLE "formula" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(40) NOT NULL,
    "paciente_id" UUID NOT NULL,
    "medico_id" UUID NOT NULL,
    "fecha_emision" DATE NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "estado" VARCHAR(30) NOT NULL,
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formula_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_formula_estado" CHECK ("estado" IN ('EMITIDA', 'PARCIALMENTE_DISPENSADA', 'DISPENSADA', 'VENCIDA', 'ANULADA'))
);

CREATE TABLE "formula_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "formula_id" UUID NOT NULL,
    "medicamento_codigo" VARCHAR(32) NOT NULL,
    "dosis" VARCHAR(120) NOT NULL,
    "frecuencia" VARCHAR(120) NOT NULL,
    "duracion_dias" INTEGER NOT NULL,
    "cantidad_autorizada" INTEGER NOT NULL,
    "cantidad_dispensada" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "formula_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_formula_item_duracion_pos" CHECK ("duracion_dias" > 0),
    CONSTRAINT "chk_formula_item_autorizada_pos" CHECK ("cantidad_autorizada" > 0),
    CONSTRAINT "chk_formula_item_dispensada_le_autorizada" CHECK ("cantidad_dispensada" >= 0 AND "cantidad_dispensada" <= "cantidad_autorizada")
);

CREATE TABLE "dispensacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "formula_id" UUID NOT NULL,
    "pedido_ref" VARCHAR(60) NOT NULL,
    "sede_codigo" VARCHAR(32) NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispensacion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dispensacion_item" (
    "dispensacion_id" UUID NOT NULL,
    "medicamento_codigo" VARCHAR(32) NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "dispensacion_item_pkey" PRIMARY KEY ("dispensacion_id", "medicamento_codigo"),
    CONSTRAINT "chk_dispensacion_item_cantidad_pos" CHECK ("cantidad" > 0)
);

CREATE UNIQUE INDEX "uq_paciente_eps_documento" ON "paciente_eps"("tipo_documento", "documento");
CREATE UNIQUE INDEX "medico_registro_key" ON "medico"("registro");
CREATE UNIQUE INDEX "formula_codigo_key" ON "formula"("codigo");
CREATE INDEX "idx_formula_paciente_id" ON "formula"("paciente_id");
CREATE INDEX "idx_formula_medico_id" ON "formula"("medico_id");
CREATE UNIQUE INDEX "uq_formula_item_medicamento" ON "formula_item"("formula_id", "medicamento_codigo");
CREATE INDEX "idx_formula_item_formula_id" ON "formula_item"("formula_id");
CREATE INDEX "idx_formula_item_medicamento_codigo" ON "formula_item"("medicamento_codigo");
CREATE UNIQUE INDEX "dispensacion_idempotency_key_key" ON "dispensacion"("idempotency_key");
CREATE INDEX "idx_dispensacion_formula_id" ON "dispensacion"("formula_id");
CREATE INDEX "idx_dispensacion_item_medicamento_codigo" ON "dispensacion_item"("medicamento_codigo");

ALTER TABLE "formula" ADD CONSTRAINT "formula_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente_eps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "formula" ADD CONSTRAINT "formula_medico_id_fkey" FOREIGN KEY ("medico_id") REFERENCES "medico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "formula_item" ADD CONSTRAINT "formula_item_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "formula"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "formula_item" ADD CONSTRAINT "formula_item_medicamento_codigo_fkey" FOREIGN KEY ("medicamento_codigo") REFERENCES "medicamento_catalogo"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispensacion" ADD CONSTRAINT "dispensacion_formula_id_fkey" FOREIGN KEY ("formula_id") REFERENCES "formula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dispensacion_item" ADD CONSTRAINT "dispensacion_item_dispensacion_id_fkey" FOREIGN KEY ("dispensacion_id") REFERENCES "dispensacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dispensacion_item" ADD CONSTRAINT "dispensacion_item_medicamento_codigo_fkey" FOREIGN KEY ("medicamento_codigo") REFERENCES "medicamento_catalogo"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;
