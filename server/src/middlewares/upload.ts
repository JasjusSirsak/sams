import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Request, Response, NextFunction } from 'express'
import multer, { MulterError } from 'multer'
import { fileTypeFromBuffer } from 'file-type'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SERVER_ROOT = path.resolve(__dirname, '../..')
const MAX_FILE_SIZE = 2 * 1024 * 1024

export const EVIDENCE_DIR = path.resolve(SERVER_ROOT, 'private_uploads', 'attendance-evidence')

declare global {
  namespace Express {
    interface Request {
      evidencePath?: string
      evidenceFilePath?: string
    }
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
})

export function handleEvidenceUpload(fieldName = 'file') {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (uploadError: unknown) => {
      if (uploadError) {
        if (uploadError instanceof MulterError && uploadError.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ message: 'Evidence image must not exceed 2 MB.' })
        }
        if (uploadError instanceof MulterError) {
          return res.status(400).json({ message: 'Invalid evidence file upload.' })
        }
        return next(uploadError)
      }

      req.body = req.body || {}
      req.evidencePath = undefined
      req.evidenceFilePath = undefined

      if (!req.file) {
        req.body.document_url = null
        return next()
      }

      void processEvidenceFile(req, res, next)
    })
  }
}

async function processEvidenceFile(req: Request, res: Response, next: NextFunction) {
  const file = req.file
  if (!file) return next()

  let detectedType
  try {
    detectedType = await fileTypeFromBuffer(file.buffer)
  } catch (error) {
    console.error('Failed to inspect attendance evidence file:', error)
    return res.status(400).json({ message: 'Evidence file must be a valid JPG or PNG image.' })
  }

  if (!detectedType || !['image/jpeg', 'image/png'].includes(detectedType.mime)) {
    return res.status(400).json({ message: 'Evidence file must be a valid JPG or PNG image.' })
  }

  let processedImage: Buffer
  try {
    const image = sharp(file.buffer, { limitInputPixels: 40_000_000 }).rotate()
    processedImage =
      detectedType.mime === 'image/jpeg'
        ? await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
        : await image.png({ compressionLevel: 9 }).toBuffer()
  } catch (error) {
    console.error('Failed to process attendance evidence image:', error)
    return res.status(400).json({ message: 'Evidence file must be a valid JPG or PNG image.' })
  }

  const extension = detectedType.mime === 'image/jpeg' ? '.jpg' : '.png'
  const filePath = path.join(EVIDENCE_DIR, `${randomUUID()}${extension}`)
  try {
    await fs.mkdir(EVIDENCE_DIR, { recursive: true, mode: 0o700 })
    await fs.writeFile(filePath, processedImage, { flag: 'wx', mode: 0o600 })
  } catch (error) {
    return next(error)
  }

  req.evidenceFilePath = filePath
  req.evidencePath = path.relative(SERVER_ROOT, filePath).split(path.sep).join('/')
  req.body.document_url = req.evidencePath
  return next()
}

export async function discardEvidenceUpload(req: Request): Promise<void> {
  if (!req.evidenceFilePath) return

  try {
    await fs.unlink(req.evidenceFilePath)
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error
    }
  }

  req.evidenceFilePath = undefined
  req.evidencePath = undefined
}
