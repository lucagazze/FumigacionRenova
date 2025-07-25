import { serve } from "https://deno.land/std@0.162.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Headers para la respuesta de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Maneja la "pregunta" de permiso del navegador (petición OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, nombre, apellido, role } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { nombre, apellido, role }
    });

    if (authError) throw authError;
    
    const { error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({ id: authData.user.id, nombre, apellido, email, role });

    if (insertError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw insertError;
    }
    
    return new Response(JSON.stringify({ user: authData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})