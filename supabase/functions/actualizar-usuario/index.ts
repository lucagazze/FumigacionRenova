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
    const { id, email, password, nombre, apellido, role } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const userUpdateData = { email, user_metadata: { nombre, apellido, role } };
    if (password) {
        userUpdateData.password = password;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, userUpdateData);
    if (authError) throw authError;

    const { error: tableError } = await supabaseAdmin
      .from('usuarios')
      .update({ nombre, apellido, email, role })
      .eq('id', id);
    if (tableError) throw tableError;
    
    return new Response(JSON.stringify({ user: authData.user }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    });
  }
})