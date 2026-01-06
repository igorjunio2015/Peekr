import { useState, useCallback, useRef } from 'react'
import { OpenAIService } from '../services/openai-service'

export const useTranslation = (apiKey: string) => {
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const serviceRef = useRef<OpenAIService | null>(null)

  if (!serviceRef.current && apiKey) {
    try {
      serviceRef.current = new OpenAIService(apiKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize translation service')
    }
  }

  const translateText = useCallback(
    async (
      text: string,
      targetLanguage: string = 'Portuguese',
      _onChunk?: (chunk: string) => void
    ): Promise<string> => {
      if (!serviceRef.current) {
        setError('Translation service not initialized')
        return ''
      }

      setIsTranslating(true)
      setError(null)

      try {
        const translation = await serviceRef.current.translateText(text, targetLanguage)
        setIsTranslating(false)
        return translation
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Translation failed'
        setError(errorMessage)
        setIsTranslating(false)
        return ''
      }
    },
    []
  )

  const detectLanguage = useCallback(
    async (text: string): Promise<string> => {
      if (!serviceRef.current) {
        setError('Translation service not initialized')
        return ''
      }

      try {
        setIsTranslating(true)
        setError(null)

        const response = await (serviceRef.current as any).client.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: `Detect the language of this text and respond with only the language name: "${text}"`,
            },
          ],
          temperature: 0.3,
          max_tokens: 50,
        })

        const language = response.choices[0]?.message?.content || 'Unknown'
        setIsTranslating(false)
        return language
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Language detection failed'
        setError(errorMessage)
        setIsTranslating(false)
        return ''
      }
    },
    []
  )

  const translateToMultipleLanguages = useCallback(
    async (text: string, languages: string[]): Promise<Record<string, string>> => {
      if (!serviceRef.current) {
        setError('Translation service not initialized')
        return {}
      }

      setIsTranslating(true)
      setError(null)

      const results: Record<string, string> = {}

      try {
        for (const language of languages) {
          const translation = await serviceRef.current.translateText(text, language)
          results[language] = translation
        }

        setIsTranslating(false)
        return results
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Translation failed'
        setError(errorMessage)
        setIsTranslating(false)
        return results
      }
    },
    []
  )

  return {
    translateText,
    detectLanguage,
    translateToMultipleLanguages,
    isTranslating,
    error,
  }
}
