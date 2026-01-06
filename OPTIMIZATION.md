# Performance Optimization Guide

## Estratégias de Otimização Implementadas

### 1. Compressão de Imagens

A aplicação comprime automaticamente screenshots para reduzir o tamanho de transferência:

- **Qualidade JPEG**: 85% (balanceado entre qualidade e tamanho)
- **Tamanho máximo**: 500KB por screenshot
- **Redimensionamento**: Máximo 1280x720 pixels
- **Formato**: JPEG para melhor compressão

```typescript
const buffer = await ScreenshotService.captureScreen({
  quality: 85,
  maxWidth: 1280,
  maxHeight: 720,
  format: 'jpeg',
})

const compressed = await ScreenshotService.compressImage(buffer, 500)
```

### 2. Streaming de Respostas

Em vez de aguardar a resposta completa, a IA envia chunks de texto conforme gera:

- **Streaming habilitado**: Respostas aparecem em tempo real
- **Max tokens**: 500 por resposta (evita respostas muito longas)
- **Temperature**: 0.7 (balanceado entre criatividade e consistência)

```typescript
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || ''
  if (content) {
    onChunk(content)  // Atualiza UI em tempo real
  }
}
```

### 3. Histórico de Conversas com Limite

O histórico é armazenado localmente com limite automático:

- **Máximo de conversas**: 50 (mais antigas são removidas)
- **Armazenamento**: localStorage (rápido e local)
- **Sincronização**: Automática ao adicionar mensagens

```typescript
const MAX_HISTORY_ITEMS = 50
const toSave = convos.slice(0, MAX_HISTORY_ITEMS)
localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
```

### 4. Gerenciamento de Mouse Events

O overlay passa cliques através quando não está em foco:

- **Modo Passthrough**: Cliques não interceptados
- **Modo Interativo**: Cliques capturados apenas quando necessário
- **Transição suave**: Sem lag ao mudar de modo

```typescript
const handleMouseEnter = () => {
  setIsInteractive(true)
  toggleMouseEvents(false)  // Captura eventos
}

const handleMouseLeave = () => {
  setIsInteractive(false)
  toggleMouseEvents(true)   // Passa eventos através
}
```

### 5. Lazy Loading de Componentes

Componentes são carregados sob demanda:

- **Menu**: Carregado apenas quando solicitado
- **Histórico**: Renderizado dinamicamente
- **Componentes pesados**: Importação dinâmica

### 6. Cache de Screenshots

Screenshots recentes são cacheados para evitar recapturas:

```typescript
const screenshotCache = new SimpleCache<string>(5 * 60 * 1000) // 5 minutos

const cachedScreenshot = screenshotCache.get('current')
if (!cachedScreenshot) {
  const screenshot = await captureScreenshot()
  screenshotCache.set('current', screenshot)
}
```

### 7. Debounce e Throttle

Operações frequentes são otimizadas:

- **Debounce**: Entrada de texto (aguarda 300ms sem digitação)
- **Throttle**: Captura de tela (máximo 1 por segundo)

```typescript
const debouncedSearch = debounce((query) => {
  performSearch(query)
}, 300)

const throttledCapture = throttle(() => {
  captureScreenshot()
}, 1000)
```

## Monitoramento de Performance

### PerformanceMonitor

Use a classe `PerformanceMonitor` para medir operações:

```typescript
const monitor = new PerformanceMonitor()

const endMeasure = monitor.startMeasure('ai-response')
// ... operação ...
endMeasure()

const metrics = monitor.getMetrics('ai-response')
console.log(`Avg: ${metrics.avg}ms, Min: ${metrics.min}ms, Max: ${metrics.max}ms`)
```

## Dicas de Performance

### Para Usuários

1. **Feche aplicações pesadas** antes de usar o overlay
2. **Reduza a frequência de capturas** de tela
3. **Limpe o histórico** periodicamente (Menu → Clear History)
4. **Use WiFi rápida** para melhor latência com OpenAI

### Para Desenvolvedores

1. **Profile com DevTools**: Abra DevTools com F12
2. **Monitore memória**: Performance tab → Memory
3. **Teste com screenshots grandes**: Simule cenários reais
4. **Medir latência de API**: Use PerformanceMonitor

## Benchmarks Esperados

| Operação | Tempo Esperado |
|----------|---|
| Captura de tela | 100-300ms |
| Compressão de imagem | 50-150ms |
| Primeira resposta IA | 500-1000ms |
| Chunk de streaming | 50-200ms |
| Tradução de texto | 800-1500ms |
| Exportação de conversa | 100-300ms |

## Otimizações Futuras

- [ ] Web Workers para processamento pesado
- [ ] Service Workers para cache offline
- [ ] Compressão WASM para imagens
- [ ] Batch processing de screenshots
- [ ] Local LLM para respostas rápidas
- [ ] IndexedDB para histórico maior
