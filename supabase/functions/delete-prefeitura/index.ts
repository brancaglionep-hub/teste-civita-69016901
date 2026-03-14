import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the requesting user is a super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if requesting user is super_admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Apenas super admins podem excluir prefeituras' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { prefeitura_id } = await req.json()

    if (!prefeitura_id) {
      return new Response(
        JSON.stringify({ error: 'ID da prefeitura é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Deleting prefeitura and related data:', prefeitura_id)

    // Delete in order of dependencies (child tables first)
    
    // 1. Delete whatsapp_mensagens (depends on whatsapp_conversas)
    await supabaseAdmin
      .from('whatsapp_mensagens')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 2. Delete whatsapp_conversas
    await supabaseAdmin
      .from('whatsapp_conversas')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 3. Delete whatsapp_templates
    await supabaseAdmin
      .from('whatsapp_templates')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 4. Delete webhook_logs
    await supabaseAdmin
      .from('webhook_logs')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 5. Delete alerta_envios (depends on alertas)
    const { data: alertas } = await supabaseAdmin
      .from('alertas')
      .select('id')
      .eq('prefeitura_id', prefeitura_id)

    if (alertas && alertas.length > 0) {
      const alertaIds = alertas.map(a => a.id)
      await supabaseAdmin
        .from('alerta_envios')
        .delete()
        .in('alerta_id', alertaIds)
    }

    // 6. Delete alertas
    await supabaseAdmin
      .from('alertas')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 7. Delete avaliacoes (depends on reclamacoes)
    await supabaseAdmin
      .from('avaliacoes')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 8. Delete historico_status (depends on reclamacoes)
    const { data: reclamacoes } = await supabaseAdmin
      .from('reclamacoes')
      .select('id')
      .eq('prefeitura_id', prefeitura_id)

    if (reclamacoes && reclamacoes.length > 0) {
      const reclamacaoIds = reclamacoes.map(r => r.id)
      await supabaseAdmin
        .from('historico_status')
        .delete()
        .in('reclamacao_id', reclamacaoIds)
    }

    // 9. Delete upload_queue (depends on reclamacoes)
    await supabaseAdmin
      .from('upload_queue')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 10. Delete reclamacoes
    await supabaseAdmin
      .from('reclamacoes')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 11. Delete cidadaos
    await supabaseAdmin
      .from('cidadaos')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 12. Delete bairros
    await supabaseAdmin
      .from('bairros')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 13. Delete categorias (only non-global ones)
    await supabaseAdmin
      .from('categorias')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 14. Delete prefeitura_configuracoes
    await supabaseAdmin
      .from('prefeitura_configuracoes')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 15. Delete user_roles linked to this prefeitura
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 16. Update profiles to remove prefeitura_id reference
    await supabaseAdmin
      .from('profiles')
      .update({ prefeitura_id: null })
      .eq('prefeitura_id', prefeitura_id)

    // 17. Delete visitas
    await supabaseAdmin
      .from('visitas')
      .delete()
      .eq('prefeitura_id', prefeitura_id)

    // 18. Finally delete the prefeitura
    const { error: deleteError } = await supabaseAdmin
      .from('prefeituras')
      .delete()
      .eq('id', prefeitura_id)

    if (deleteError) {
      console.error('Error deleting prefeitura:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Prefeitura deleted successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
