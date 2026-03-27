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
  GRO: 'gro',
  SALES: 'sales',
  SECURITY: 'security',
} as const

type AppRole = (typeof ROLE)[keyof typeof ROLE]

const CREATEABLE_ROLES: AppRole[] = [
  ROLE.DEALER_ADMIN,
  ROLE.GRO,
  ROLE.SALES,
  ROLE.SECURITY,
]

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

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  let email = ''
  let password = ''
  let fullName = ''
  let role: AppRole = ROLE.SALES
  let locationId: string | null = null

  try {
    const body = await req.json()
    email = String(body.email ?? '').trim().toLowerCase()
    password = String(body.password ?? '')
    fullName = String(body.fullName ?? '').trim()
    const requestedRole = String(body.role ?? '') as AppRole
    role = requestedRole
    locationId = body.locationId ? String(body.locationId) : null
  } catch {
    return response({ error: 'Invalid JSON body' }, 400)
  }

  if (!email || !password || !fullName || !role) {
    return response({ error: 'Missing required fields' }, 400)
  }

  if (!CREATEABLE_ROLES.includes(role)) {
    return response({ error: 'Invalid role' }, 400)
  }

  const { data: callerRoleRows, error: callerRoleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', callerUserId)

  if (callerRoleError) {
    return response({ error: 'Unable to verify caller role' }, 500)
  }

  const callerRoles = new Set((callerRoleRows ?? []).map((r) => r.role as AppRole))
  const isSuperAdmin = callerRoles.has(ROLE.SUPERADMIN)
  const isDealerAdmin = callerRoles.has(ROLE.DEALER_ADMIN)

  if (!isSuperAdmin && !isDealerAdmin) {
    return response({ error: 'Forbidden' }, 403)
  }

  if (isDealerAdmin && role === ROLE.DEALER_ADMIN) {
    return response({ error: 'Dealer admin cannot create dealer admin users' }, 403)
  }

  if (isDealerAdmin) {
    if (!locationId) {
      return response({ error: 'Location is required for dealer admin staff creation' }, 400)
    }

    const { data: dealerId, error: dealerIdError } = await supabase
      .rpc('get_user_dealer_id', { _user_id: callerUserId })

    if (dealerIdError || !dealerId) {
      return response({ error: 'Unable to resolve dealer context' }, 403)
    }

    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id, dealer_id')
      .eq('id', locationId)
      .maybeSingle()

    if (locationError || !location || location.dealer_id !== dealerId) {
      return response({ error: 'Invalid location for your dealership' }, 403)
    }
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    return response({ error: createError?.message || 'Failed to create user' }, 400)
  }

  const newUserId = created.user.id

  try {
    const { error: roleInsertError } = await supabase.from('user_roles').insert({
      user_id: newUserId,
      role,
    })
    if (roleInsertError) throw roleInsertError

    const profilePayload = {
      full_name: fullName,
      email,
      location_id: locationId,
      is_active: true,
    }

    const { data: updatedProfiles, error: updateProfileError } = await supabase
      .from('profiles')
      .update(profilePayload)
      .eq('user_id', newUserId)
      .select('id')

    if (updateProfileError) throw updateProfileError

    if (!updatedProfiles || updatedProfiles.length === 0) {
      const { error: insertProfileError } = await supabase.from('profiles').insert({
        user_id: newUserId,
        ...profilePayload,
      })
      if (insertProfileError) throw insertProfileError
    }
  } catch (err) {
    await supabase.auth.admin.deleteUser(newUserId)
    const message = err instanceof Error ? err.message : 'Failed to persist staff metadata'
    return response({ error: message }, 500)
  }

  return response({ success: true, userId: newUserId })
})