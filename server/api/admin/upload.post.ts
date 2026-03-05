import { PDFParse } from 'pdf-parse'
import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/session'
import { splitIntoChunks } from '~~/server/utils/chunking'
import { useNeon } from '~~/server/utils/neon'

export default defineEventHandler(async (event) => {  
  await requireAdmin(event)

  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, message: 'No data received' })
  }

  const fileField = formData.find(f => f.name === 'file')
  const nameField = formData.find(f => f.name === 'name')
  const equipmentField = formData.find(f => f.name === 'equipment_type')
  if (!fileField?.data) {
    throw createError({ statusCode: 400, message: 'Missing PDF file' })
  }

  const parser = new PDFParse({ data: fileField.data })
  const textResult = await parser.getText()
  const pdfData = {
    text: textResult.text,
    numpages: textResult.total
  }
  await parser.destroy()

  const sql = useNeon()

  try {
    // 1. Extract text from PDF
    console.log('📄 Extracting text from PDF...')
    // pdfData ya fue extraído arriba
    if (!pdfData.text || pdfData.text.length < 100) {
      throw createError({ statusCode: 400, message: 'Could not extract text from PDF. The file may be scanned or image-based.' })
    }

    // 2. Create document record (status: processing)
    console.log('💾 Creating document record...')
    const [document] = await sql`
      INSERT INTO documents (name, equipment_type, file_name, total_pages, status, created_by)
      VALUES (
        ${nameField?.data?.toString() || 'Unnamed'},
        ${equipmentField?.data?.toString() || 'general'},
        ${fileField.filename || 'unknown.pdf'},
        ${pdfData.numpages},
        'processing',
        'admin'
      )
      RETURNING id, name
    `

    if (!document) {
      throw createError({ statusCode: 500, message: 'Failed to create document record' })
    }

    // 3. Split into chunks
    console.log('✂️ Splitting into chunks...')
    const chunks = splitIntoChunks(pdfData.text)
    console.log(`   → ${chunks.length} chunks generated`)

    // 4. Generate embeddings and save in batches
    console.log('🧠 Generating embeddings...')
    const BATCH_SIZE = 10

    try {
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE)

        // Generate embeddings in parallel within the batch
        const embeddings = await Promise.all(
          batch.map(chunk => generateEmbeddings(chunk.content))
        )

        // Insert each chunk with its embedding
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j]
          if (!chunk) continue

          await sql`
            INSERT INTO document_chunks (document_id, content, page_number, chunk_index, embedding)
            VALUES (
              ${document.id},
              ${chunk.content},
              ${chunk.pageNumber},
              ${chunk.chunkIndex},
              ${JSON.stringify(embeddings[j])}::vector
            )
          `
        }

        console.log(`   → Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} saved`)
      }

      // 5. Update status to ready
      await sql`
        UPDATE documents
        SET status = 'ready', total_chunks = ${chunks.length}
        WHERE id = ${document.id}
      `

      console.log('✅ Document processed successfully')

      return {
        success: true,
        document: {
          id: document.id,
          name: document.name,
          totalChunks: chunks.length,
          totalPages: pdfData.numpages
        }
      }
    }
    catch (embeddingError: any) {
      // If embedding fails, mark document as error so admin can see it
      await sql`
        UPDATE documents SET status = 'error' WHERE id = ${document.id}
      `
      throw embeddingError
    }
  }
  catch (error: any) {
    console.error('Error processing PDF:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Error processing the PDF'
    })
  }
})