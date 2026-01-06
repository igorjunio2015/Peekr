# Peekr 👁️

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Electron](https://img.shields.io/badge/Electron-29-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

**Your AI assistant that peeks over your shoulder — always ready to help**

*Um assistente de IA que espia por cima do seu ombro — sempre pronto para ajudar*

[English](#english) | [Português](#português)

</div>

---

## English

### 🎯 Overview

**Peekr** is a cross-platform desktop application that provides an always-on-top AI assistant overlay. Like having a smart colleague peeking over your shoulder, ready to help with meetings, translations, visual analysis, and decision-making — without getting in your way.

### ✨ Features

| Feature | Description |
|---------|-------------|
| 🎙️ **Voice Recording** | Record audio with microphone and system audio capture |
| 🔊 **Audio Waveform** | Beautiful waveform visualization using WaveSurfer.js |
| 📸 **Screenshot Analysis** | Capture and analyze screenshots with GPT-4 Vision |
| 🌐 **Real-time Translation** | Translate conversations and content on-the-fly |
| 💬 **AI Chat** | Stream responses from OpenAI in real-time |
| 📝 **Export Conversations** | Export chat history as Markdown, JSON, or TXT |
| ⌨️ **Global Hotkeys** | Keyboard shortcuts that work in any application |
| 🖥️ **Multi-monitor Support** | Works across multiple displays |
| 🎨 **Transparent Overlay** | Always visible on top of other applications |
| 💾 **Persistent History** | SQLite database for conversation storage |

### 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/peekr.git
cd peekr

# Install dependencies
pnpm install

# Run in development mode
pnpm dev
```

### ⚙️ Requirements

- Node.js 18+
- pnpm (recommended) or npm/yarn
- OpenAI API Key

### ⌨️ Hotkeys

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+A` | Toggle overlay visibility |
| `Ctrl+Alt+S` | Capture screenshot and analyze |
| `Ctrl+Alt+R` | Start/Stop recording |
| `Ctrl+Alt+T` | Toggle translation mode |

### 🏗️ Architecture

```
peekr/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Window manager & IPC handlers
│   │   ├── preload.ts           # Security bridge
│   │   ├── hotkeys.ts           # Global hotkey registration
│   │   ├── database-service.ts  # SQLite database
│   │   ├── export-service.ts    # Export functionality
│   │   ├── screenshot-service.ts # Screen capture
│   │   └── window-manager.ts    # Window management
│   ├── renderer/                # React renderer process
│   │   ├── components/
│   │   │   ├── Overlay.tsx      # Main overlay component
│   │   │   ├── AudioWaveformWaveSurfer.tsx # Audio visualization
│   │   │   ├── Settings.tsx     # Settings panel
│   │   │   └── OverlayMenu.tsx  # Context menu
│   │   ├── hooks/
│   │   │   ├── useAudioRecording.ts    # Audio recording
│   │   │   ├── useAIStreaming.ts       # OpenAI streaming
│   │   │   ├── useTranslation.ts       # Translation
│   │   │   ├── useDatabase.ts          # Database operations
│   │   │   └── useExport.ts            # Export functionality
│   │   └── services/
│   │       └── openai-service.ts # OpenAI API integration
│   └── shared/
│       └── types.ts             # Shared TypeScript types
├── package.json
└── tsconfig.json
```

### 🛠️ Tech Stack

- **Electron** - Cross-platform desktop framework
- **React 18** - UI library with hooks
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first styling
- **WaveSurfer.js** - Audio waveform visualization
- **OpenAI API** - GPT-4, GPT-4 Vision, Whisper
- **SQLite** - Local database (better-sqlite3)
- **Vite** - Fast build tool

### 📦 Build for Production

```bash
# Build the application
pnpm build

# Package for distribution
pnpm package
```

### 🔒 Security

- API keys stored locally only (never sent to external servers)
- Electron `contextIsolation` enabled
- Preload script validates all IPC communications
- No telemetry or tracking

### 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## Português

### 🎯 Visão Geral

**Peekr** é uma aplicação desktop multiplataforma que fornece um assistente de IA sempre visível sobre outras janelas. Como ter um colega inteligente espiando por cima do seu ombro, pronto para ajudar com reuniões, traduções, análise visual e tomada de decisão — sem atrapalhar.

### ✨ Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| 🎙️ **Gravação de Voz** | Grave áudio com microfone e captura de áudio do sistema |
| 🔊 **Waveform de Áudio** | Visualização bonita de ondas usando WaveSurfer.js |
| 📸 **Análise de Screenshots** | Capture e analise screenshots com GPT-4 Vision |
| 🌐 **Tradução em Tempo Real** | Traduza conversas e conteúdo instantaneamente |
| 💬 **Chat com IA** | Respostas em streaming da OpenAI em tempo real |
| 📝 **Exportar Conversas** | Exporte histórico como Markdown, JSON ou TXT |
| ⌨️ **Hotkeys Globais** | Atalhos de teclado que funcionam em qualquer aplicação |
| 🖥️ **Suporte Multi-monitor** | Funciona em múltiplos displays |
| 🎨 **Overlay Transparente** | Sempre visível sobre outras aplicações |
| 💾 **Histórico Persistente** | Banco de dados SQLite para armazenamento |

### 🚀 Início Rápido

```bash
# Clonar o repositório
git clone https://github.com/yourusername/peekr.git
cd peekr

# Instalar dependências
pnpm install

# Executar em modo desenvolvimento
pnpm dev
```

### ⚙️ Requisitos

- Node.js 18+
- pnpm (recomendado) ou npm/yarn
- Chave de API OpenAI

### ⌨️ Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+Alt+A` | Ativar/Desativar overlay |
| `Ctrl+Alt+S` | Capturar screenshot e analisar |
| `Ctrl+Alt+R` | Iniciar/Parar gravação |
| `Ctrl+Alt+T` | Ativar modo tradução |

### 🏗️ Arquitetura

```
peekr/
├── src/
│   ├── main/                    # Processo principal do Electron
│   │   ├── index.ts             # Gerenciador de janelas & IPC
│   │   ├── preload.ts           # Bridge de segurança
│   │   ├── hotkeys.ts           # Registro de hotkeys globais
│   │   ├── database-service.ts  # Banco de dados SQLite
│   │   ├── export-service.ts    # Funcionalidade de exportação
│   │   ├── screenshot-service.ts # Captura de tela
│   │   └── window-manager.ts    # Gerenciamento de janelas
│   ├── renderer/                # Processo de renderização (React)
│   │   ├── components/
│   │   │   ├── Overlay.tsx      # Componente principal do overlay
│   │   │   ├── AudioWaveformWaveSurfer.tsx # Visualização de áudio
│   │   │   ├── Settings.tsx     # Painel de configurações
│   │   │   └── OverlayMenu.tsx  # Menu de contexto
│   │   ├── hooks/
│   │   │   ├── useAudioRecording.ts    # Gravação de áudio
│   │   │   ├── useAIStreaming.ts       # Streaming OpenAI
│   │   │   ├── useTranslation.ts       # Tradução
│   │   │   ├── useDatabase.ts          # Operações de banco
│   │   │   └── useExport.ts            # Funcionalidade de exportação
│   │   └── services/
│   │       └── openai-service.ts # Integração com API OpenAI
│   └── shared/
│       └── types.ts             # Tipos TypeScript compartilhados
├── package.json
└── tsconfig.json
```

### 🛠️ Stack Tecnológico

- **Electron** - Framework desktop multiplataforma
- **React 18** - Biblioteca UI com hooks
- **TypeScript** - Segurança de tipos
- **TailwindCSS** - Estilização utility-first
- **WaveSurfer.js** - Visualização de waveform de áudio
- **OpenAI API** - GPT-4, GPT-4 Vision, Whisper
- **SQLite** - Banco de dados local (better-sqlite3)
- **Vite** - Build tool rápido

### 📦 Build para Produção

```bash
# Compilar a aplicação
pnpm build

# Empacotar para distribuição
pnpm package
```

### 🔒 Segurança

- Chaves de API armazenadas apenas localmente (nunca enviadas para servidores externos)
- `contextIsolation` do Electron habilitado
- Preload script valida todas as comunicações IPC
- Sem telemetria ou rastreamento

### 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/NovaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona NovaFeature'`)
4. Push para a branch (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

### 📄 Licença

Licença MIT - veja [LICENSE](LICENSE) para detalhes.

---

<div align="center">

**Made with ❤️ by the community**

[Report Bug](https://github.com/yourusername/peekr/issues) · [Request Feature](https://github.com/yourusername/peekr/issues)

</div>
