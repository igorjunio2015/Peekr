import { desktopCapturer, screen } from 'electron'
import sharp from 'sharp'

export interface ScreenshotOptions {
  quality?: number
  maxWidth?: number
  maxHeight?: number
  format?: 'png' | 'jpeg'
}

const DEFAULT_OPTIONS: ScreenshotOptions = {
  quality: 80,
  maxWidth: 1920,
  maxHeight: 1080,
  format: 'jpeg',
}

export class ScreenshotService {
  static async captureScreen(options: ScreenshotOptions = {}): Promise<Buffer> {
    const config = { ...DEFAULT_OPTIONS, ...options }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: config.maxWidth || 1920,
          height: config.maxHeight || 1080,
        },
      })

      if (sources.length === 0) {
        throw new Error('No screen sources available')
      }

      const source = sources[0]
      const image = source.thumbnail

      let processedImage = sharp(image.toPNG())

      if (config.maxWidth || config.maxHeight) {
        processedImage = processedImage.resize(config.maxWidth, config.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
      }

      if (config.format === 'jpeg') {
        return await processedImage.jpeg({ quality: config.quality }).toBuffer()
      } else {
        return await processedImage.png().toBuffer()
      }
    } catch (error) {
      throw new Error(`Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async captureRegion(
    x: number,
    y: number,
    width: number,
    height: number,
    options: ScreenshotOptions = {}
  ): Promise<Buffer> {
    const config = { ...DEFAULT_OPTIONS, ...options }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: screen.getPrimaryDisplay().bounds.width,
          height: screen.getPrimaryDisplay().bounds.height,
        },
      })

      if (sources.length === 0) {
        throw new Error('No screen sources available')
      }

      const source = sources[0]
      const image = source.thumbnail
      const imageSize = image.getSize()

      let processedImage = sharp(image.toPNG()).extract({
        left: Math.max(0, x),
        top: Math.max(0, y),
        width: Math.min(width, imageSize.width - x),
        height: Math.min(height, imageSize.height - y),
      })

      if (config.format === 'jpeg') {
        return await processedImage.jpeg({ quality: config.quality }).toBuffer()
      } else {
        return await processedImage.png().toBuffer()
      }
    } catch (error) {
      throw new Error(`Region screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static bufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64')
  }

  static async compressImage(buffer: Buffer, maxSizeKB: number = 500): Promise<Buffer> {
    let quality = 80
    let compressed = buffer

    while (compressed.length > maxSizeKB * 1024 && quality > 20) {
      quality -= 10
      compressed = await sharp(buffer).jpeg({ quality }).toBuffer()
    }

    return compressed
  }
}
