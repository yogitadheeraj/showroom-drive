import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
}

const ROLE = {
  SUPERADMIN: 'superadmin',
  DEALER_ADMIN: 'dealer_admin',
} as const

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null

  try {
    const payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')

    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

function response(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders })
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return response({ error: 'Method not allowed' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      return response({ error: 'Server configuration error' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return response({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader.slice('Bearer '.length).trim()
    const claims = parseJwtClaims(token)
    const callerUserId = typeof claims?.sub === 'string' ? claims.sub : null
    if (!callerUserId) {
      return response({ error: 'Unauthorized' }, 401)
    }

    let targetUserId = ''
    try {
      const body = await req.json()
      targetUserId = String(body.userId ?? '').trim()
    } catch {
      return response({ error: 'Invalid JSON body' }, 400)
    }

    if (!targetUserId) {
      return response({ error: 'userId is required' }, 400)
    }

    if (targetUserId === callerUserId) {
      return response({ error: 'You cannot delete your own account' }, 400)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerRoleRows, error: callerRoleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUserId)

    if (callerRoleError) {
      return response({ error: 'Unable to verify caller role' }, 500)
    }

    const callerRoles = new Set((callerRoleRows ?? []).map((r) => r.role as string))
    const isSuperAdmin = callerRoles.has(ROLE.SUPERADMIN)
    const isDealerAdmin = callerRoles.has(ROLE.DEALER_ADMIN)

    if (!isSuperAdmin && !isDealerAdmin) {
      return response({ error: 'Forbidden' }, 403)
    }

    const { data: targetRoles, error: targetRolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUserId)

    if (targetRolesError) {
      return response({ error: 'Unable to verify target role' }, 500)
    }

    const targetRoleSet = new Set((targetRoles ?? []).map((r) => r.role as string))

    if (!isSuperAdmin && targetRoleSet.has(ROLE.DEALER_ADMIN)) {
      return response({ error: 'Dealer admin cannot delete dealer admin users' }, 403)
    }

    if (isDealerAdmin) {
      const { data: callerDealerId, error: callerDealerError } = await supabase
        .rpc('get_user_dealer_id', { _user_id: callerUserId })

      if (callerDealerError || !callerDealerId) {
        return response({ error: 'Unable to resolve dealer context' }, 403)
      }

      const { data: targetProfile, error: targetProfileError } = await supabase
        .from('profiles')
        .select('location_id')
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (targetProfileError || !targetProfile?.location_id) {
        return response({ error: 'Target user is not in your dealership scope' }, 403)
      }

      const { data: targetLocation, error: targetLocationError } = await supabase
        .from('locations')
        .select('dealer_id')
        .eq('id', targetProfile.location_id)
        .maybeSingle()

      if (targetLocationError || !targetLocation || targetLocation.dealer_id !== callerDealerId) {
        return response({ error: 'Target user is not in your dealership scope' }, 403)
      }
    }

    const { error: deleteRolesError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId)

    if (deleteRolesError) {
      return response({ error: deleteRolesError.message || 'Failed to delete user roles' }, 500)
    }

    const { error: deleteProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', targetUserId)

    if (deleteProfileError) {
      return response({ error: deleteProfileError.message || 'Failed to delete profile' }, 500)
    }

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(targetUserId)
    if (deleteAuthError) {
      return response({ error: deleteAuthError.message || 'Failed to delete auth user' }, 500)
    }

    return response({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error'
    return response({ error: message }, 500)
  }
})