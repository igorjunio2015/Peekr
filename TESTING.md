# Testing Guide

## Testes Manuais

### 1. Inicialização da Aplicação

**Passos:**
1. Execute `pnpm dev`
2. Aguarde a janela do Electron aparecer
3. Verifique se o overlay está visível no canto inferior direito

**Resultado esperado:**
- Overlay aparece com UI cyan/preto
- Sem erros no console
- Overlay é transparente e não bloqueia cliques

### 2. Configuração de API Key

**Passos:**
1. Na primeira execução, um modal deve aparecer
2. Insira uma chave OpenAI válida
3. Clique "Save API Key"

**Resultado esperado:**
- Chave é salva em localStorage
- Modal desaparece
- Overlay fica pronto para uso

### 3. Hotkeys Globais

**Passos:**
1. Minimize ou oculte a janela do Electron
2. Pressione `Ctrl+Alt+A` em qualquer lugar
3. Verifique se o overlay aparece/desaparece

**Resultado esperado:**
- Overlay toggling funciona mesmo com app em background
- Sem lag ou atraso

### 4. Envio de Mensagens

**Passos:**
1. Digite uma mensagem no input
2. Pressione Enter ou clique no botão →
3. Aguarde a resposta

**Resultado esperado:**
- Mensagem aparece no chat
- Resposta começa a aparecer em tempo real (streaming)
- Indicador de loading mostra "..."

### 5. Captura de Tela

**Passos:**
1. Pressione `Ctrl+Alt+S` ou clique em um botão de captura
2. Aguarde a análise

**Resultado esperado:**
- Screenshot é capturado
- Análise aparece no chat
- Sem travamento da aplicação

### 6. Histórico de Conversas

**Passos:**
1. Crie várias conversas com diferentes tópicos
2. Clique no botão ⋮ (menu)
3. Clique em "New Chat"
4. Selecione conversas anteriores

**Resultado esperado:**
- Histórico é mantido
- Switching entre conversas é rápido
- Mensagens anteriores aparecem corretamente

### 7. Exportação de Conversa

**Passos:**
1. Abra o menu (⋮)
2. Selecione um formato (Markdown, JSON, etc)
3. Clique "Download Export"

**Resultado esperado:**
- Arquivo é baixado com nome correto
- Conteúdo está formatado corretamente
- Arquivo pode ser aberto em editor de texto

### 8. Tradução de Mensagem

**Passos:**
1. Abra o menu (⋮)
2. Selecione uma mensagem
3. Digite idioma alvo (ex: "Spanish")
4. Clique "Translate"

**Resultado esperado:**
- Tradução é gerada
- Arquivo é baixado
- Tradução está correta

### 9. Modo Interativo vs Passthrough

**Passos:**
1. Passe o mouse sobre o overlay
2. Observe o indicador de status
3. Afaste o mouse
4. Observe novamente

**Resultado esperado:**
- Status muda de "Passthrough" para "Interactive"
- Cliques são capturados apenas quando mouse está sobre overlay
- Sem interferência com outras aplicações

### 10. Minimização do Overlay

**Passos:**
1. Clique no botão − (minimizar)
2. Verifique se overlay vira um botão redondo
3. Clique no botão redondo
4. Verifique se overlay volta ao tamanho normal

**Resultado esperado:**
- Transição suave
- Botão minimizado é clicável
- Overlay restaura corretamente

## Testes de Performance

### Teste de Memória

**Procedimento:**
1. Abra DevTools (F12)
2. Vá para Performance tab
3. Comece a gravar
4. Envie 10 mensagens consecutivas
5. Pare de gravar
6. Analise o gráfico de memória

**Resultado esperado:**
- Memória não cresce indefinidamente
- Garbage collection funciona
- Picos de memória < 100MB

### Teste de CPU

**Procedimento:**
1. Abra DevTools
2. Vá para Performance tab
3. Capture screenshot
4. Analise uso de CPU

**Resultado esperado:**
- Pico de CPU durante captura
- Retorna ao normal rapidamente
- Sem travamento perceptível

### Teste de Latência

**Procedimento:**
1. Use PerformanceMonitor no código
2. Meça tempo de resposta da IA
3. Verifique tempo de captura

**Resultado esperado:**
- Primeira resposta: < 2s
- Chunks de streaming: < 500ms
- Captura de tela: < 500ms

## Testes de Compatibilidade

### Windows 10/11

- [ ] Overlay aparece corretamente
- [ ] Hotkeys funcionam
- [ ] Screenshots são capturados
- [ ] Sem problemas de renderização

### macOS

- [ ] Overlay funciona em fullscreen
- [ ] Permissões de screenshot funcionam
- [ ] Hotkeys globais funcionam
- [ ] Sem problemas de transparência

### Linux

- [ ] Overlay aparece corretamente
- [ ] Hotkeys funcionam
- [ ] Screenshots funcionam
- [ ] Compatibilidade com diferentes DMs (X11, Wayland)

## Testes de Erro

### Sem API Key

**Passos:**
1. Limpe localStorage
2. Reinicie a app
3. Tente enviar mensagem sem configurar API key

**Resultado esperado:**
- Mensagem de erro clara
- Overlay não trava
- Opção para configurar API key

### API Key Inválida

**Passos:**
1. Configure uma chave inválida
2. Tente enviar mensagem

**Resultado esperado:**
- Erro é exibido no chat
- Overlay continua responsivo
- Opção para corrigir API key

### Sem Conexão de Internet

**Passos:**
1. Desconecte internet
2. Tente enviar mensagem

**Resultado esperado:**
- Erro de conexão é exibido
- Overlay não trava
- Reconexão automática quando internet volta

### Limite de Rate

**Passos:**
1. Envie muitas mensagens rapidamente
2. Aguarde resposta de rate limit

**Resultado esperado:**
- Erro é tratado graciosamente
- Usuário é informado
- Retry automático ou manual funciona

## Checklist de QA

- [ ] Overlay inicia sem erros
- [ ] API key é configurada corretamente
- [ ] Hotkeys funcionam globalmente
- [ ] Chat funciona com streaming
- [ ] Screenshots são capturados
- [ ] Histórico é mantido
- [ ] Exportação funciona
- [ ] Tradução funciona
- [ ] Minimização funciona
- [ ] Performance é aceitável
- [ ] Erros são tratados
- [ ] UI é responsiva
- [ ] Sem memory leaks
- [ ] Sem console errors
- [ ] Compatibilidade multiplataforma

## Relatório de Bugs

Ao encontrar um bug, reporte com:

1. **Sistema Operacional**: Windows 10/11, macOS, Linux
2. **Versão da App**: (verifique em package.json)
3. **Passos para reproduzir**: Detalhados
4. **Resultado esperado**: O que deveria acontecer
5. **Resultado atual**: O que aconteceu
6. **Screenshots/Logs**: Se aplicável
7. **Frequência**: Sempre, às vezes, raro

## Próximas Melhorias

- [ ] Testes automatizados com Jest
- [ ] E2E tests com Playwright
- [ ] CI/CD pipeline
- [ ] Performance benchmarks
- [ ] Load testing
