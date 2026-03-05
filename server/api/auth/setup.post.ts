import { hashPassword } from '~~/server/utils/auth'
import { useNeon } from '~~/server/utils/neon'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { email, password, setupSecret } = await readValidatedBody(event, z.object({
    email: z.string().email(),
    password: z.string().min(8),
    setupSecret: z.string()
  }).parse)

  const config = useRuntimeConfig()

  // Protect this endpoint with a secret from env
  if (setupSecret !== config.setupSecret) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid setup secret' })
  }

  const sql = useNeon()
  const hash = await hashPassword(password)

  await sql`
    UPDATE users SET password_hash = ${hash}
    WHERE email = ${email.toLowerCase().trim()}
  `

  return { success: true }
})