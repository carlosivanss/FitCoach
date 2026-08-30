import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) throw new Error('La función no tiene configurados los secretos de Supabase.');
    const authorization = request.headers.get('Authorization') || '';
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Sesión inválida.' }, 401);
    const { data: profile } = await userClient.from('fc_profiles').select('role').eq('user_id', user.id).single();
    if (!profile || !['admin', 'trainer'].includes(profile.role)) return json({ error: 'No tienes permiso para invitar pacientes.' }, 403);
    const { client_id, email, full_name } = await request.json();
    if (!client_id || !email) return json({ error: 'Faltan el paciente o el correo.' }, 400);
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: client, error: clientError } = await admin.from('fc_clients').select('id,primary_trainer_id,user_id').eq('id', client_id).single();
    if (clientError || !client) return json({ error: 'Paciente no encontrado.' }, 404);
    if (profile.role !== 'admin' && client.primary_trainer_id !== user.id) return json({ error: 'El paciente pertenece a otro entrenador.' }, 403);
    if (client.user_id) return json({ error: 'El paciente ya tiene una cuenta activa o invitada.' }, 409);
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: Deno.env.get('PATIENT_INVITE_REDIRECT_URL'), data: { full_name: full_name || '' } });
    if (inviteError) throw inviteError;
    const { error: profileError } = await admin.from('fc_profiles').upsert({ user_id: invited.user.id, full_name: full_name || '', role: 'patient' }, { onConflict: 'user_id' });
    if (profileError) throw profileError;
    const { error: updateError } = await admin.from('fc_clients').update({ user_id: invited.user.id, status: 'invited', archived_at: null }).eq('id', client_id);
    if (updateError) throw updateError;
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo enviar la invitación.' }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
