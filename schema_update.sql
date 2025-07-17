-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.areas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT areas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operacion_id uuid,
  item text NOT NULL,
  completado boolean DEFAULT false,
  imagen_url text,
  CONSTRAINT checklist_items_pkey PRIMARY KEY (id),
  CONSTRAINT checklist_items_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id)
);
CREATE TABLE public.clientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clientes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.depositos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['silo'::text, 'celda'::text])),
  cliente_id uuid,
  capacidad_toneladas numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT depositos_pkey PRIMARY KEY (id),
  CONSTRAINT depositos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
);
CREATE TABLE public.historial_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tipo_movimiento text NOT NULL,
  deposito text NOT NULL,
  tipo_producto text NOT NULL,
  cantidad_kg_movido numeric,
  cantidad_unidades_movidas numeric,
  descripcion text,
  operacion_id uuid,
  CONSTRAINT historial_stock_pkey PRIMARY KEY (id),
  CONSTRAINT historial_stock_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id)
);
CREATE TABLE public.limpiezas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deposito_id uuid,
  fecha_limpieza date NOT NULL,
  fecha_garantia_limpieza date,
  observaciones text,
  CONSTRAINT limpiezas_pkey PRIMARY KEY (id),
  CONSTRAINT limpiezas_deposito_id_fkey FOREIGN KEY (deposito_id) REFERENCES public.depositos(id)
);
CREATE TABLE public.mercaderias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mercaderias_pkey PRIMARY KEY (id)
);
CREATE TABLE public.movimientos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operacion_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  observacion text,
  media_url jsonb,
  toneladas_movidas numeric,
  CONSTRAINT movimientos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.muestreos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operacion_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  observacion text,
  media_url ARRAY,
  CONSTRAINT muestreos_pkey PRIMARY KEY (id),
  CONSTRAINT muestreos_operacion_id_fkey FOREIGN KEY (operacion_id) REFERENCES public.operaciones(id)
);
CREATE TABLE public.operaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone,
  cliente_id uuid,
  deposito_id uuid,
  mercaderia_id uuid,
  estado text CHECK (estado = ANY (ARRAY['en curso'::text, 'finalizada'::text])),
  deposito_origen_stock text,
  producto_usado_cantidad numeric,
  tipo_registro text CHECK (tipo_registro = ANY (ARRAY['inicial'::text, 'producto'::text, 'muestreo'::text, 'finalizacion'::text])),
  operario_nombre text,
  tratamiento text,
  toneladas numeric,
  metodo_fumigacion text CHECK (metodo_fumigacion = ANY (ARRAY['pastillas'::text, 'liquido'::text])),
  modalidad text CHECK (modalidad = ANY (ARRAY['trasilado'::text, 'descarga'::text])),
  operacion_original_id uuid,
  con_garantia boolean DEFAULT false,
  fecha_vencimiento_garantia date,
  eliminado boolean DEFAULT false,
  observacion_finalizacion text,
  estado_aprobacion text DEFAULT 'pendiente'::text CHECK (estado_aprobacion = ANY (ARRAY['aprobado'::text, 'pendiente'::text, 'rechazado'::text])),
  observacion_aprobacion text,
  supervisor_id uuid,
  fecha_aprobacion timestamp with time zone,
  CONSTRAINT operaciones_pkey PRIMARY KEY (id),
  CONSTRAINT operaciones_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.usuarios(id),
  CONSTRAINT operaciones_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id),
  CONSTRAINT operaciones_deposito_id_fkey FOREIGN KEY (deposito_id) REFERENCES public.depositos(id),
  CONSTRAINT operaciones_mercaderia_id_fkey FOREIGN KEY (mercaderia_id) REFERENCES public.mercaderias(id),
  CONSTRAINT operaciones_operacion_original_id_fkey FOREIGN KEY (operacion_original_id) REFERENCES public.operaciones(id)
);
CREATE TABLE public.operario_clientes (
  operario_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  CONSTRAINT operario_clientes_pkey PRIMARY KEY (operario_id, cliente_id),
  CONSTRAINT operario_clientes_operario_id_fkey FOREIGN KEY (operario_id) REFERENCES public.usuarios(id),
  CONSTRAINT operario_clientes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
);
CREATE TABLE public.stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deposito text NOT NULL,
  tipo_producto text NOT NULL CHECK (tipo_producto = ANY (ARRAY['pastillas'::text, 'liquido'::text])),
  cantidad_kg numeric DEFAULT 0,
  cantidad_unidades numeric,
  CONSTRAINT stock_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  apellido text NOT NULL,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'operario'::text, 'supervisor'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);

DROP TABLE IF EXISTS public.supervisor_clientes;
