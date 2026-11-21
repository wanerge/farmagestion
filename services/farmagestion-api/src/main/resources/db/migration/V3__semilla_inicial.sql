-- V3: Datos semilla de demostración para farma_db (00 §14)
-- Contraseña de demostración para todos los usuarios semilla: Farma2026! (documentada en README.md)

-- 1. Sedes (3 sedes en el Valle de Aburrá)
INSERT INTO sede (codigo, nombre, direccion, latitud, longitud, hora_apertura, hora_cierre, activa) VALUES
    ('SEDE-CENTRO', 'FarmaGestión Centro', 'Carrera 49 # 52-40, Medellín', 6.247638, -75.565815, '07:00', '19:00', TRUE),
    ('SEDE-BELLO',  'FarmaGestión Bello',  'Calle 50 # 49-28, Bello',      6.337320, -75.557950, '07:00', '19:00', TRUE),
    ('SEDE-ITAGUI', 'FarmaGestión Itagüí', 'Carrera 51 # 51-15, Itagüí',   6.171900, -75.611400, '07:00', '19:00', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Catálogo de 30 medicamentos (sincronizado con data/seed/catalogo-medicamentos.json)
INSERT INTO medicamento (codigo, nombre, principio_activo, presentacion, activo) VALUES
    ('MED-0001', 'Acetaminofén 500 mg', 'Acetaminofén', 'Tableta caja x 20', TRUE),
    ('MED-0002', 'Ibuprofeno 400 mg', 'Ibuprofeno', 'Tableta recubierta caja x 20', TRUE),
    ('MED-0003', 'Naproxeno 250 mg', 'Naproxeno', 'Tableta caja x 10', TRUE),
    ('MED-0004', 'Losartán 50 mg', 'Losartán potásico', 'Tableta recubierta caja x 30', TRUE),
    ('MED-0005', 'Enalapril 20 mg', 'Enalapril maleato', 'Tableta caja x 30', TRUE),
    ('MED-0006', 'Amlodipino 5 mg', 'Amlodipino besilato', 'Tableta caja x 30', TRUE),
    ('MED-0007', 'Hidroclorotiazida 25 mg', 'Hidroclorotiazida', 'Tableta caja x 30', TRUE),
    ('MED-0008', 'Metformina 850 mg', 'Metformina clorhidrato', 'Tableta recubierta caja x 30', TRUE),
    ('MED-0009', 'Glibenclamida 5 mg', 'Glibenclamida', 'Tableta caja x 30', TRUE),
    ('MED-0010', 'Atorvastatina 20 mg', 'Atorvastatina cálcica', 'Tableta recubierta caja x 30', TRUE),
    ('MED-0011', 'Rosuvastatina 10 mg', 'Rosuvastatina cálcica', 'Tableta recubierta caja x 30', TRUE),
    ('MED-0012', 'Omeprazol 20 mg', 'Omeprazol', 'Cápsula de liberación retardada caja x 30', TRUE),
    ('MED-0013', 'Esomeprazol 40 mg', 'Esomeprazol magnésico', 'Tableta gastrorresistente caja x 14', TRUE),
    ('MED-0014', 'Amoxicilina 500 mg', 'Amoxicilina trihidrato', 'Cápsula caja x 21', TRUE),
    ('MED-0015', 'Azitromicina 500 mg', 'Azitromicina', 'Tableta recubierta caja x 3', TRUE),
    ('MED-0016', 'Cefalexina 500 mg', 'Cefalexina', 'Cápsula caja x 20', TRUE),
    ('MED-0017', 'Ciprofloxacino 500 mg', 'Ciprofloxacino clorhidrato', 'Tableta recubierta caja x 10', TRUE),
    ('MED-0018', 'Loratadina 10 mg', 'Loratadina', 'Tableta caja x 10', TRUE),
    ('MED-0019', 'Cetirizina 10 mg', 'Cetirizina diclorhidrato', 'Tableta recubierta caja x 10', TRUE),
    ('MED-0020', 'Salbutamol 100 mcg', 'Salbutamol sulfato', 'Aerosol inhalador frasco x 200 dosis', TRUE),
    ('MED-0021', 'Beclometasona 250 mcg', 'Beclometasona dipropionato', 'Aerosol inhalador frasco x 200 dosis', TRUE),
    ('MED-0022', 'Levotiroxina 50 mcg', 'Levotiroxina sódica', 'Tableta caja x 30', TRUE),
    ('MED-0023', 'Ácido acetilsalicílico 100 mg', 'Ácido acetilsalicílico', 'Tableta recubierta caja x 30', TRUE),
    ('MED-0024', 'Clopidogrel 75 mg', 'Clopidogrel bisulfato', 'Tableta recubierta caja x 28', TRUE),
    ('MED-0025', 'Metoprolol 50 mg', 'Metoprolol tartrato', 'Tableta caja x 30', TRUE),
    ('MED-0026', 'Furosemida 40 mg', 'Furosemida', 'Tableta caja x 20', TRUE),
    ('MED-0027', 'Prednisolona 5 mg', 'Prednisolona', 'Tableta caja x 30', TRUE),
    ('MED-0028', 'Diclofenaco 50 mg', 'Diclofenaco sódico', 'Tableta gastrorresistente caja x 20', TRUE),
    ('MED-0029', 'Fluconazol 150 mg', 'Fluconazol', 'Cápsula caja x 2', TRUE),
    ('MED-0030', 'Sales de rehidratación oral', 'Glucosa + electrolitos', 'Polvo para solución oral sobre x 4', TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- 3. Usuarios semilla (1 ADMIN, 2 empleados + 1 domiciliario por sede, 5 pacientes)
INSERT INTO usuario (email, password_hash, rol, activo) VALUES
    ('admin@farmagestion.demo',               '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'ADMIN',    TRUE),
    ('farmaceutico.centro@farmagestion.demo', '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'EMPLEADO', TRUE),
    ('auxiliar.centro@farmagestion.demo',     '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'EMPLEADO', TRUE),
    ('domiciliario.centro@farmagestion.demo', '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'EMPLEADO', TRUE),
    ('farmaceutico.bello@farmagestion.demo',  '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'EMPLEADO', TRUE),
    ('auxiliar.bello@farmagestion.demo',      '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'EMPLEADO', TRUE),
    ('domiciliario.bello@farmagestion.demo',  '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'EMPLEADO', TRUE),
    ('farmaceutico.itagui@farmagestion.demo', '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'EMPLEADO', TRUE),
    ('auxiliar.itagui@farmagestion.demo',     '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'EMPLEADO', TRUE),
    ('domiciliario.itagui@farmagestion.demo', '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'EMPLEADO', TRUE),
    ('paciente1@farmagestion.demo',           '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'PACIENTE', TRUE),
    ('paciente2@farmagestion.demo',           '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'PACIENTE', TRUE),
    ('paciente3@farmagestion.demo',           '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'PACIENTE', TRUE),
    ('paciente4@farmagestion.demo',           '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'PACIENTE', TRUE),
    ('paciente5@farmagestion.demo',           '$2a$10$wlfOOcGOkv2HWQz171Uy6ueW96GDjsRZ02gTjw16Ecl3XGMoFG0Oy', 'PACIENTE', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 4. Empleados (incluye admin sin sede y 3 empleados por sede)
INSERT INTO empleado (usuario_id, sede_id, cargo, nombres, apellidos)
SELECT u.id, s.id, v.cargo, v.nombres, v.apellidos
FROM (VALUES
    ('admin@farmagestion.demo',               NULL,          'FARMACEUTICO', 'Laura',     'Restrepo'),
    ('farmaceutico.centro@farmagestion.demo', 'SEDE-CENTRO', 'FARMACEUTICO', 'Carlos',    'Gómez'),
    ('auxiliar.centro@farmagestion.demo',     'SEDE-CENTRO', 'AUXILIAR',     'Mariana',   'López'),
    ('domiciliario.centro@farmagestion.demo', 'SEDE-CENTRO', 'DOMICILIARIO', 'Andrés',    'Mejía'),
    ('farmaceutico.bello@farmagestion.demo',  'SEDE-BELLO',  'FARMACEUTICO', 'Juliana',   'Zapata'),
    ('auxiliar.bello@farmagestion.demo',      'SEDE-BELLO',  'AUXILIAR',     'Mateo',     'Cárdenas'),
    ('domiciliario.bello@farmagestion.demo',  'SEDE-BELLO',  'DOMICILIARIO', 'Sebastián', 'Ríos'),
    ('farmaceutico.itagui@farmagestion.demo', 'SEDE-ITAGUI', 'FARMACEUTICO', 'Valentina', 'Ospina'),
    ('auxiliar.itagui@farmagestion.demo',     'SEDE-ITAGUI', 'AUXILIAR',     'Daniel',    'Henao'),
    ('domiciliario.itagui@farmagestion.demo', 'SEDE-ITAGUI', 'DOMICILIARIO', 'Esteban',   'Quintero')
) AS v(email, sede_codigo, cargo, nombres, apellidos)
JOIN usuario u ON u.email = v.email
LEFT JOIN sede s ON s.codigo = v.sede_codigo
ON CONFLICT (usuario_id) DO NOTHING;

-- 5. Pacientes semilla (5 pacientes con documentos ficticios)
INSERT INTO paciente (usuario_id, tipo_documento, documento, nombres, apellidos, telefono)
SELECT u.id, v.tipo_doc, v.doc, v.nombres, v.apellidos, v.telefono
FROM (VALUES
    ('paciente1@farmagestion.demo', 'CC', '1000000001', 'Ana María',  'Velásquez', '3001112201'),
    ('paciente2@farmagestion.demo', 'CC', '1000000002', 'Jorge Luis', 'Ramírez',   '3001112202'),
    ('paciente3@farmagestion.demo', 'CC', '1000000003', 'Sofía',      'Giraldo',   '3001112203'),
    ('paciente4@farmagestion.demo', 'CC', '1000000004', 'Miguel',     'Arango',    '3001112204'),
    ('paciente5@farmagestion.demo', 'CC', '1000000005', 'Camila',     'Montoya',   '3001112205')
) AS v(email, tipo_doc, doc, nombres, apellidos, telefono)
JOIN usuario u ON u.email = v.email
ON CONFLICT (usuario_id) DO NOTHING;

-- 6. Inventario inicial determinístico por sede y medicamento
-- Incluye medicamentos agotados (0) y bajo mínimo (3..8) para demostrar casos de faltante.
INSERT INTO inventario (sede_id, medicamento_id, cantidad_fisica, cantidad_reservada, stock_minimo)
SELECT
    s.id,
    m.id,
    CASE
        WHEN (s.codigo = 'SEDE-CENTRO' AND m.codigo IN ('MED-0005', 'MED-0017', 'MED-0024')) THEN 0
        WHEN (s.codigo = 'SEDE-BELLO'  AND m.codigo IN ('MED-0004', 'MED-0014', 'MED-0021')) THEN 0
        WHEN (s.codigo = 'SEDE-ITAGUI' AND m.codigo IN ('MED-0008', 'MED-0020', 'MED-0029')) THEN 0
        WHEN (s.codigo = 'SEDE-CENTRO' AND m.codigo IN ('MED-0003', 'MED-0013', 'MED-0020')) THEN 5
        WHEN (s.codigo = 'SEDE-BELLO'  AND m.codigo IN ('MED-0002', 'MED-0012', 'MED-0025')) THEN 4
        WHEN (s.codigo = 'SEDE-ITAGUI' AND m.codigo IN ('MED-0001', 'MED-0010', 'MED-0019')) THEN 6
        ELSE 25 + ((ASCII(SUBSTRING(s.codigo FROM 6 FOR 1)) + CAST(SUBSTRING(m.codigo FROM 5) AS INTEGER) * 7) % 85)
    END AS cantidad_fisica,
    0 AS cantidad_reservada,
    10 AS stock_minimo
FROM sede s
CROSS JOIN medicamento m
ON CONFLICT (sede_id, medicamento_id) DO NOTHING;

-- 7. Trazabilidad inicial en kárdex (movimiento_inventario) para stock > 0
INSERT INTO movimiento_inventario (sede_id, medicamento_id, tipo, cantidad, saldo_fisico, referencia_tipo, usuario_id, motivo)
SELECT
    i.sede_id,
    i.medicamento_id,
    'ENTRADA',
    i.cantidad_fisica,
    i.cantidad_fisica,
    'SEMILLA',
    (SELECT id FROM usuario WHERE email = 'admin@farmagestion.demo'),
    'Carga inicial de inventario semilla'
FROM inventario i
WHERE i.cantidad_fisica > 0
  AND NOT EXISTS (
      SELECT 1 FROM movimiento_inventario mi
      WHERE mi.sede_id = i.sede_id AND mi.medicamento_id = i.medicamento_id AND mi.referencia_tipo = 'SEMILLA'
  );
