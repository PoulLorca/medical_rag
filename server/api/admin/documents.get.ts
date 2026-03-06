import { requireAdmin } from '~~/server/utils/session'
import { useNeon } from '~~/server/utils/neon'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const sql = useNeon()

  const documents = await sql`
    SELECT id, name, vehicle_model, file_name, total_chunks, total_pages, status, created_at
    FROM documents
    ORDER BY created_at DESC
  `

  return documents
})