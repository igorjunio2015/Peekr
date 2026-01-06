# AI Overlay Agent - TODO

## Visão Geral
Este documento descreve as tarefas pendentes para melhorar o AI Overlay Agent.

---

## 🎯 Tarefas Prioritárias

### 1. ✅ Corrigir Layout do Chat (URGENTE)
- [ ] Adicionar padding/margem adequados nas mensagens
- [ ] Separar visualmente mensagens do usuário e do assistente
- [ ] Melhorar espaçamento geral do overlay
- [ ] Garantir que resultado do screenshot apareça no chat

### 2. 🔧 Implementar SQLite com Knex para Persistência
- [ ] Instalar dependências: `better-sqlite3`, `knex`
- [ ] Criar schema do banco de dados:
  - Tabela `conversations`: id, title, created_at, updated_at
  - Tabela `messages`: id, conversation_id, role, content, created_at
  - Tabela `settings`: id, key, value
- [ ] Criar serviço de database no processo main
- [ ] Migrar de localStorage para SQLite
- [ ] Expor API via IPC para o renderer

### 3. 🎤 Implementar Gravação de Áudio Avançada
- [ ] Adicionar hotkey para iniciar/parar gravação (Ctrl+Alt+R)
- [ ] Implementar particionamento de áudio a cada 10 segundos
- [ ] Implementar detecção de pausa na voz (VAD - Voice Activity Detection)
- [ ] Enviar chunks de áudio para transcrição automaticamente
- [ ] Acumular transcrições e enviar para IA com coerência
- [ ] Usar modelo `whisper-1` ou `gpt-4o-transcribe` para STT

### 4. ⚙️ Tela de Configurações
- [ ] Criar componente Settings.tsx
- [ ] Campos de configuração:
  - System Prompt personalizado
  - API Key da OpenAI
  - Modelo preferido (gpt-4o, gpt-4-turbo, etc)
  - Idioma de transcrição
  - Hotkeys personalizáveis
- [ ] Salvar configurações no SQLite
- [ ] Botão de configurações no header do overlay

### 5. 📋 Sidebar de Conversas
- [ ] Criar sidebar à esquerda com lista de conversas
- [ ] Dropdown/toggle para mostrar/ocultar sidebar
- [ ] Permitir criar nova conversa
- [ ] Permitir deletar conversa
- [ ] Permitir renomear conversa
- [ ] Indicador visual da conversa ativa

---

## 📝 Detalhes Técnicos

### Schema do Banco de Dados (SQLite)

```sql
-- Tabela de conversas
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Tabela de mensagens
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Tabela de configurações
CREATE TABLE settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL
);

-- Índices
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_settings_key ON settings(key);
```

### Fluxo de Gravação de Áudio com VAD

```
1. Usuário pressiona Ctrl+Alt+R ou clica no botão 🎤
2. Inicia gravação contínua
3. A cada 10 segundos OU quando detecta pausa na voz:
   - Envia chunk de áudio para Whisper API
   - Recebe transcrição parcial
   - Acumula no buffer de texto
4. Quando usuário para gravação:
   - Envia texto acumulado para GPT-4o
   - Exibe resposta no chat
```

### API OpenAI para STT

```javascript
// Transcrição com Whisper
const transcription = await openai.audio.transcriptions.create({
  file: audioFile,
  model: "whisper-1",
  language: "pt",
  response_format: "text"
});

// Ou com streaming (gpt-4o-transcribe)
const stream = await openai.audio.transcriptions.create({
  file: audioFile,
  model: "gpt-4o-transcribe",
  response_format: "text",
  stream: true
});
```

---

## 🔄 Ordem de Implementação

1. **Fase 1 - Layout e UX** (Imediato)
   - Corrigir layout do chat
   - Garantir que screenshot mostra resultado
   - Melhorar espaçamento

2. **Fase 2 - Persistência** (Prioridade Alta)
   - Configurar SQLite + Knex
   - Migrar conversas para banco
   - Implementar sidebar de conversas

3. **Fase 3 - Áudio Avançado** (Prioridade Média)
   - Hotkey de gravação
   - Particionamento de áudio
   - VAD e transcrição automática

4. **Fase 4 - Configurações** (Prioridade Média)
   - Tela de configurações
   - System prompt customizável
   - Persistir configurações

---

## 📦 Dependências Necessárias

```bash
# SQLite
pnpm add better-sqlite3 knex

# Tipos
pnpm add -D @types/better-sqlite3
```

---

## ✅ Tarefas Concluídas

- [x] Corrigir erros TypeScript originais
- [x] Configurar build do Electron
- [x] Configurar Tailwind CSS v4
- [x] Corrigir handler 'get-overlay-state'
- [x] Implementar click-through do overlay
- [x] Bolinha minimizada clicável
- [x] Captura de screenshot com GPT-4o Vision
- [x] Controles básicos de gravação de áudio
- [x] Hook useAudioRecording
- [x] Função transcribeAudio no serviço OpenAI
