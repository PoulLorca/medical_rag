export interface Chunk{
  content: string
  pageNumber: number
  chunkIndex: number
}

export function splitIntoChunks(
  text: string,
  chunkSize: number = 800,
  overlap: number = 150
): Chunk[] {
  const chunks: Chunk[] = [];
  const paragraphs = text.split(/\n\s*\n/);

  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue

    if (currentChunk.length + trimmed.length > chunkSize && currentChunk.length > 0){
      chunks.push({
        content: currentChunk.trim(),
        pageNumber: 0,
        chunkIndex: chunkIndex++
      })

      // Overlap handling
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(' ') + ' ' + trimmed;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      pageNumber: 0,
      chunkIndex: chunkIndex
    })
  }

  return chunks;
}