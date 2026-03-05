import { authenticateUser } from '~~/server/utils/auth'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, z.object({
    email: z.string().email(),
    password: z.string().min(6)
  }).parse)

  const user = await authenticateUser(email, password)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  // Set session using nuxt-auth-utils
  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      username: user.name,
      role: user.role
    }
  })

  return { user }
})