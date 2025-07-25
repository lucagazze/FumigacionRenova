import { serve } from "https://deno.land/std@0.162.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 1. Validar que la solicitud sea POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const { email, password, nombre, apellido, role } = await req.json();

    // 2. Crear un cliente de Supabase con permisos de administrador
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 3. Crear el usuario en el sistema de autenticación de Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirma el email
      user_metadata: { nombre, apellido, role } // Guardamos metadatos aquí
    });

    if (authError) {
      throw new Error(authError.message);
    }
    
    // 4. Insertar los detalles en tu tabla 'public.usuarios'
    const { error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: authData.user.id,
        nombre: nombre,
        apellido: apellido,
        email: email,
        role: role,
      });

    if (insertError) {
        // Si la inserción falla, borrar el usuario de auth para evitar inconsistencias
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(insertError.message);
    }
    
    return new Response(JSON.stringify({ message: "Usuario creado exitosamente" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
})