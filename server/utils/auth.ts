import bcrypt from 'bcrypt'
import { useNeon } from './neon'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const sql = useNeon()

  const [user] = await sql`
    SELECT id, email, name, role, password_hash, is_active
    FROM users
    WHERE email = ${email.toLowerCase().trim()}
  `

  if (!user || !user.is_active) return null
  if (!user.password_hash) return null

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return null

  // Update last login
  await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}