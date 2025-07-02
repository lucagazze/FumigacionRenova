-- Borrar tablas existentes si es necesario (para una instalación limpia)
DROP TABLE IF EXISTS checklist_items;
DROP TABLE IF EXISTS historial_stock;
DROP TABLE IF EXISTS stock;
DROP TABLE IF EXISTS operaciones;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS mercaderias;
DROP TABLE IF EXISTS areas;

-- Crear la tabla de operaciones
CREATE TABLE operaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    cliente text,
    area_tipo text,
    silo text,
    celda text,
    mercaderia text,
    estado text,
    deposito text,
    pastillas integer,
    tipo_registro text,
    operario text,
    tratamiento text,
    toneladas integer,
    operacion_original_id uuid REFERENCES operaciones(id) ON DELETE SET NULL
);

-- Crear la tabla de stock
CREATE TABLE stock (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deposito text UNIQUE NOT NULL,
    cantidad integer NOT NULL
);

-- Crear la tabla de historial de stock
CREATE TABLE historial_stock (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    tipo text NOT NULL,
    deposito text NOT NULL,
    cantidad integer NOT NULL
);

-- Crear la tabla de items del checklist
CREATE TABLE checklist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operacion_id uuid REFERENCES operaciones(id) ON DELETE CASCADE,
    item text NOT NULL,
    completado boolean DEFAULT false,
    imagen_url text,
    UNIQUE(operacion_id, item)
);

-- Crear tabla de clientes
CREATE TABLE clientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text UNIQUE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear tabla de mercaderias
CREATE TABLE mercaderias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text UNIQUE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear tabla de areas (silos/celdas)
CREATE TABLE areas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    tipo text NOT NULL, -- 'silo' o 'celda'
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(nombre, tipo)
);

-- Insertar datos iniciales de stock
INSERT INTO stock (deposito, cantidad) VALUES
('Baigorria', 10000),
('Fagaz', 15000);

-- Habilitar Row Level Security (RLS) para las tablas
ALTER TABLE operaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercaderias ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

-- Borrar políticas existentes antes de crear nuevas
DROP POLICY IF EXISTS "Permitir acceso total" ON operaciones;
DROP POLICY IF EXISTS "Permitir acceso total" ON stock;
DROP POLICY IF EXISTS "Permitir acceso total" ON historial_stock;
DROP POLICY IF EXISTS "Permitir acceso total" ON checklist_items;
DROP POLICY IF EXISTS "Permitir acceso total" ON clientes;
DROP POLICY IF EXISTS "Permitir acceso total" ON mercaderias;
DROP POLICY IF EXISTS "Permitir acceso total" ON areas;

-- Políticas de acceso para permitir acceso total (lectura y escritura) a todos los usuarios
CREATE POLICY "Permitir acceso total" ON operaciones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON historial_stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON checklist_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON mercaderias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir acceso total" ON areas FOR ALL USING (true) WITH CHECK (true);
