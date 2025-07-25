import { serve } from "https://deno.land/std@0.162.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const { id } = await req.json();
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    
    // El borrado en cascada se encargará de la tabla `public.usuarios`
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      throw new Error(error.message);
    }

    return new Response(JSON.stringify({ message: 'Usuario eliminado correctamente' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
      });
  }
})