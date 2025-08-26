import { serve } from "https://deno.land/std@0.162.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, nombre, apellido, role, cliente_ids } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. Invita al usuario a través de Supabase Auth
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { nombre, apellido, role }, // Metadatos que se pueden usar
        redirectTo: `${Deno.env.get('SITE_URL')}/src/login/aceptar-invitacion.html` // URL a la que se redirige al usuario
    });

    if (inviteError) throw inviteError;
    const newUser = inviteData.user;

    // 2. Inserta el perfil del usuario en la tabla 'usuarios'
    const { error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({ id: newUser.id, nombre, apellido, email, role });
    
    if (insertError) throw insertError;

    // 3. Asigna los clientes al nuevo usuario si es necesario
    if ((role === 'operario' || role === 'supervisor') && cliente_ids && cliente_ids.length > 0) {
        const relaciones = cliente_ids.map((cliente_id: string) => ({
            operario_id: newUser.id,
            cliente_id: cliente_id
        }));
        const { error: relError } = await supabaseAdmin.from('operario_clientes').insert(relaciones);
        if (relError) throw relError;
    }
    
    return new Response(JSON.stringify({ message: 'Invitación enviada con éxito', user: newUser }), {
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