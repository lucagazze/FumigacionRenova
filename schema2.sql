-- Eliminar tablas existentes para una instalación limpia
DROP TABLE IF EXISTS movimientos CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS historial_stock CASCADE;
DROP TABLE IF EXISTS stock CASCADE;
DROP TABLE IF EXISTS operaciones CASCADE;
DROP TABLE IF EXISTS limpiezas CASCADE;
DROP TABLE IF EXISTS depositos CASCADE;
DROP TABLE IF EXISTS mercaderias CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;

-- Tabla de Clientes
CREATE TABLE clientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Tabla de Mercaderías
CREATE TABLE mercaderias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Tabla de Depósitos (antes Áreas)
CREATE TABLE depositos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('silo', 'celda')),
    cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
    capacidad_toneladas numeric,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(nombre, tipo, cliente_id)
);

-- Tabla de Limpiezas
CREATE TABLE limpiezas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deposito_id uuid REFERENCES depositos(id) ON DELETE CASCADE,
    fecha_limpieza date NOT NULL,
    fecha_garantia_limpieza date, -- Se calcula al insertar
    observaciones text
);

-- Tabla de Operaciones
CREATE TABLE operaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz,
    cliente_id uuid REFERENCES clientes(id),
    deposito_id uuid REFERENCES depositos(id),
    mercaderia_id uuid REFERENCES mercaderias(id),
    estado text CHECK (estado IN ('en curso', 'finalizada')),
    deposito_origen_stock text,
    producto_usado_cantidad numeric,
    tipo_registro text CHECK (tipo_registro IN ('inicial', 'producto', 'movimiento', 'finalizacion')),
    operario_nombre text,
    tratamiento text CHECK (tratamiento IN ('preventivo', 'curativo')),
    toneladas numeric,
    metodo_fumigacion text CHECK (metodo_fumigacion IN ('pastillas', 'liquido')),
    modalidad text CHECK (modalidad IN ('trasilado', 'descarga')),
    operacion_original_id uuid REFERENCES operaciones(id) ON DELETE CASCADE
);

-- Nueva Tabla de Movimientos
CREATE TABLE movimientos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id uuid NOT NULL REFERENCES operaciones(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    observacion text,
    media_url text, -- URL del video o foto
    toneladas_movidas numeric
);


-- Tabla de Stock
CREATE TABLE stock (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deposito text NOT NULL, -- 'Fagaz', 'Baigorria', etc.
    tipo_producto text NOT NULL CHECK (tipo_producto IN ('pastillas', 'liquido')),
    cantidad_kg numeric DEFAULT 0,
    cantidad_unidades numeric, -- Solo para pastillas
    UNIQUE(deposito, tipo_producto)
);

-- Tabla de Historial de Stock
CREATE TABLE historial_stock (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now() NOT NULL,
    tipo_movimiento text NOT NULL,
    deposito text NOT NULL,
    tipo_producto text NOT NULL,
    cantidad_kg_movido numeric,
    cantidad_unidades_movidas numeric,
    descripcion text
);

-- Tabla de Checklist
CREATE TABLE checklist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id uuid REFERENCES operaciones(id) ON DELETE CASCADE,
    item text NOT NULL,
    completado boolean DEFAULT false,
    imagen_url text,
    UNIQUE(operacion_id, item)
);

-- Insertar datos iniciales de stock para Fagaz y Baigorria
INSERT INTO stock (deposito, tipo_producto, cantidad_kg, cantidad_unidades) VALUES
('Fagaz', 'pastillas', 45, 15000), -- 15000 pastillas * 3g = 45000g = 45kg
('Baigorria', 'pastillas', 30, 10000), -- 10000 pastillas * 3g = 30000g = 30kg
('Fagaz', 'liquido', 100, null), -- 100 kg de líquido
('Baigorria', 'liquido', 50, null); -- 50 kg de líquido


-- Habilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercaderias ENABLE ROW LEVEL SECURITY;
ALTER TABLE depositos ENABLE ROW LEVEL SECURITY;
ALTER TABLE limpiezas ENABLE ROW LEVEL SECURITY;
ALTER TABLE operaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso (permitir todo por ahora)
CREATE POLICY "Permitir acceso total" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON mercaderias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON depositos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON limpiezas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON operaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON movimientos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON historial_stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON checklist_items FOR ALL USING (true) WITH CHECK (true);