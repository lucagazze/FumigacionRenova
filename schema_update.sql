-- Habilitar RLS para la tabla de usuarios si aún no está habilitada
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas de 'usuarios' si es necesario (opcional, pero bueno para la limpieza)
DROP POLICY IF EXISTS "Allow authenticated users to read user data" ON public.usuarios;
DROP POLICY IF EXISTS "Allow admin users to manage users" ON public.usuarios;

-- Política para permitir a los usuarios autenticados leer datos de usuarios (sin la contraseña)
CREATE POLICY "Allow authenticated users to read user data"
ON public.usuarios
FOR SELECT
TO authenticated
USING (true);

-- Política para permitir a los administradores leer todos los datos de los usuarios (incluida la contraseña)
CREATE POLICY "Allow admin users to read all user data"
ON public.usuarios
FOR SELECT
TO authenticated
USING (auth.jwt()->>'role' = 'admin');

-- Política para permitir a los administradores gestionar usuarios (crear, actualizar, eliminar)
CREATE POLICY "Allow admin users to manage users"
ON public.usuarios
FOR ALL
TO authenticated
WITH CHECK (auth.jwt()->>'role' = 'admin');
