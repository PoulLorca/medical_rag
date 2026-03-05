import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/session'
import { useNeon } from '~~/server/utils/neon'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const { id } = await getValidatedRouterParams(event, z.object({
    id: z.string().uuid()
  }).parse)

  const sql = useNeon()

  // Chunks are deleted automatically via ON DELETE CASCADE
  const [deleted] = await sql`
    DELETE FROM documents WHERE id = ${id}
    RETURNING id, name
  `

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  return { success: true, deleted: deleted.name }
})