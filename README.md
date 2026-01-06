# AI Overlay Agent

Uma extensão overlay multiplataforma para Windows, Mac e Linux que funciona como um agente de IA em tempo real. Similar ao Crosshair X da Steam, mas focado 100% em agentes de IA para ajudar em reuniões, tradução em tempo real, análise visual e tomada de decisão.

## Funcionalidades

✅ **Overlay Transparente** - Fica sempre visível sobre outras aplicações  
✅ **Streaming em Tempo Real** - Respostas da IA aparecem conforme são geradas  
✅ **Captura de Tela** - Analisa screenshots com GPT-4V  
✅ **Tradução em Tempo Real** - Traduz conversas e conteúdo  
✅ **Criação de Arquivos** - Salva transcrições e sugestões  
✅ **Hotkeys Globais** - Atalhos de teclado que funcionam em qualquer aplicação  
✅ **Multiplataforma** - Windows, macOS, Linux  
✅ **Otimizado para Performance** - Leve e responsivo  

## Requisitos

- Node.js 16+
- pnpm (ou npm/yarn)
- Chave de API OpenAI

## Instalação

```bash
# Clonar ou extrair o projeto
cd ai-overlay-agent

# Instalar dependências
pnpm install

# Executar em modo desenvolvimento
pnpm dev
```

## Uso

### Configuração Inicial

1. Ao iniciar a aplicação, você será solicitado a inserir sua chave de API OpenAI
2. A chave é armazenada localmente e nunca é enviada para servidores externos
3. Clique em "Save API Key" para continuar

### Hotkeys

| Atalho | Ação |
|--------|------|
| `Ctrl+Alt+A` | Ativar/Desativar overlay |
| `Ctrl+Alt+S` | Capturar screenshot e analisar |
| `Ctrl+Alt+T` | Ativar tradução (em desenvolvimento) |

### Interface

O overlay aparece no canto inferior direito da tela com:

- **Chat em tempo real** - Converse com a IA
- **Análise de screenshots** - Envie capturas de tela para análise
- **Histórico de mensagens** - Veja conversas anteriores
- **Status de atividade** - Indicador de ativo/inativo

## Arquitetura

```
ai-overlay-agent/
├── src/
│   ├── main/           # Processo principal do Electron
│   │   ├── index.ts    # Gerenciador de janelas e hotkeys
│   │   └── preload.ts  # Bridge de segurança
│   ├── renderer/       # Processo de renderização (React)
│   │   ├── components/ # Componentes React
│   │   ├── hooks/      # Hooks customizados
│   │   ├── App.tsx     # Componente principal
│   │   └── main.tsx    # Entrada do React
│   └── shared/         # Código compartilhado
│       └── types.ts    # Tipos TypeScript
├── public/             # Arquivos estáticos
├── package.json        # Dependências
└── tsconfig.json       # Configuração TypeScript
```

## Stack Tecnológico

- **Electron** - Framework multiplataforma
- **React** - UI responsiva
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **OpenAI API** - Streaming de respostas
- **Vite** - Build tool

## Build para Produção

```bash
# Compilar para produção
pnpm build

# Testar build
pnpm preview
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (opcional):

```env
VITE_API_ENDPOINT=https://api.openai.com/v1
```

## Segurança

- A chave de API é armazenada apenas localmente no `localStorage`
- Nenhuma comunicação com servidores externos, exceto OpenAI
- O Electron usa `contextIsolation` para segurança
- Preload script valida todas as comunicações IPC

## Próximas Funcionalidades

- [ ] Suporte a múltiplas LLMs (Claude, Gemini, etc)
- [ ] Tradução automática com streaming
- [ ] Reconhecimento de voz
- [ ] Criação automática de arquivos
- [ ] Histórico persistente
- [ ] Temas customizáveis
- [ ] Integração com Zoom/Teams
- [ ] Análise de documentos

## Troubleshooting

### Overlay não aparece
- Verifique se o Electron foi iniciado corretamente
- Tente pressionar `Ctrl+Alt+A` para ativar

### API key não funciona
- Verifique se a chave é válida em https://platform.openai.com/account/api-keys
- Certifique-se de ter créditos disponíveis

### Performance lenta
- Feche outras aplicações pesadas
- Reduza a resolução da captura de tela
- Verifique sua conexão de internet

## Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

MIT License - veja LICENSE para detalhes

## Suporte

Para reportar bugs ou sugerir features, abra uma issue no GitHub.

## Roadmap

- v1.1: Suporte a múltiplas LLMs
- v1.2: Tradução em tempo real
- v1.3: Integração com plataformas de videoconferência
- v2.0: Análise de vídeo em tempo real
