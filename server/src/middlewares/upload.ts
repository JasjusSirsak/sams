import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Request, Response, NextFunction } from 'express'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Ensure uploads directory exists
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

/**
 * Lightweight multipart/form-data parser for single file uploads without external dependencies.
 * Handles both multipart/form-data and JSON/urlencoded payloads seamlessly.
 */
export function handleEvidenceUpload(fieldName: string = 'file') {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'] || ''

    if (!contentType.includes('multipart/form-data')) {
      return next()
    }

    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
    if (!boundaryMatch) {
      return res.status(400).json({ message: 'Invalid multipart/form-data boundary.' })
    }

    const boundary = boundaryMatch[1] || boundaryMatch[2]
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks)
        const boundaryBuffer = Buffer.from(`--${boundary}`)
        const endBoundaryBuffer = Buffer.from(`--${boundary}--`)

        let start = 0
        req.body = req.body || {}

        while (start < buffer.length) {
          const boundaryIndex = buffer.indexOf(boundaryBuffer, start)
          if (boundaryIndex === -1) break

          const partStart = boundaryIndex + boundaryBuffer.length
          if (buffer.slice(partStart, partStart + 2).toString() === '--') {
            break // Reached final boundary
          }

          const headerEndIndex = buffer.indexOf('\r\n\r\n', partStart)
          if (headerEndIndex === -1) break

          const headerStr = buffer.slice(partStart, headerEndIndex).toString('utf-8')
          const nextBoundaryIndex = buffer.indexOf(boundaryBuffer, headerEndIndex + 4)
          const partEnd = nextBoundaryIndex !== -1 ? nextBoundaryIndex - 2 : buffer.length

          const partContent = buffer.slice(headerEndIndex + 4, partEnd)

          // Parse Content-Disposition
          const nameMatch = headerStr.match(/name="([^"]+)"/)
          const filenameMatch = headerStr.match(/filename="([^"]+)"/)

          if (nameMatch) {
            const field = nameMatch[1]
            if (filenameMatch && filenameMatch[1]) {
              const originalName = filenameMatch[1]
              const ext = path.extname(originalName) || '.bin'
              const uniqueName = `evidence-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
              const filePath = path.join(UPLOADS_DIR, uniqueName)

              fs.writeFileSync(filePath, partContent)

              // Attach file info to req.file and req.body.document_url
              ;(req as any).file = {
                fieldname: field,
                originalname: originalName,
                filename: uniqueName,
                size: partContent.length,
                path: filePath,
              }
              req.body.document_url = `/uploads/${uniqueName}`
            } else {
              // Regular form field
              req.body[field] = partContent.toString('utf-8').trim()
            }
          }

          start = nextBoundaryIndex !== -1 ? nextBoundaryIndex : buffer.length
        }

        next()
      } catch (err) {
        console.error('Multipart upload parsing failed:', err)
        return res.status(500).json({ message: 'Failed to process file upload.' })
      }
    })

    req.on('error', (err) => {
      console.error('Request stream error:', err)
      return res.status(500).json({ message: 'Stream error during upload.' })
    })
  }
}
