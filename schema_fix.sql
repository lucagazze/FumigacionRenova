-- Paso 1: Agregar la columna 'operacion_id' a la tabla 'historial_stock' si no existe.
-- Esta columna es crucial para vincular un movimiento de stock a una operación específica.
ALTER TABLE public.historial_stock
ADD COLUMN IF NOT EXISTS operacion_id UUID;

-- Paso 2: Crear la relación de clave foránea (foreign key).
-- Esto le dice a Supabase que 'operacion_id' en 'historial_stock' se refiere a una 'id' en 'operaciones'.
-- Esto solucionará el error "Could not find a relationship" de una vez por todas.
-- Se agrega una condición para crear la restricción solo si no existe, para que el script se pueda ejecutar de forma segura varias veces.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'historial_stock_operacion_id_fkey'
  ) THEN
    ALTER TABLE public.historial_stock
    ADD CONSTRAINT historial_stock_operacion_id_fkey
    FOREIGN KEY (operacion_id)
    REFERENCES public.operaciones(id)
    ON DELETE SET NULL; -- Si se elimina una operación, el registro de historial no se borra, solo pierde el vínculo.
  END IF;
END;
$$;

-- Mensaje para el usuario:
-- Por favor, ejecuta este script en el Editor SQL de tu proyecto Supabase.
-- Esto actualizará el esquema de tu base de datos para que coincida con la lógica de la aplicación.
-- Después de ejecutar el script, el error 400 debería resolverse.
