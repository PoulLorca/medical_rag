import type { H3Event } from 'h3'
import type { AuthUser } from './auth'

export async function requireAuth(event: H3Event): Promise<AuthUser> {
  const session = await getUserSession(event)
  const user = session.user as AuthUser | undefined

  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  return user
}

export async function requireAdmin(event: H3Event): Promise<AuthUser> {
  const user = await requireAuth(event)

  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }

  return user
}