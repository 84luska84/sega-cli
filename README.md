# SEGA-CLI ⚡

**Um agente AI terminal-first e assistente de programação alimentado por modelos
locais do Ollama.**

Fork do [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
(Apache 2.0), totalmente modificado e localizado para o Português do Brasil
(PT-BR) para operar de forma 100% autônoma e local usando a sua infraestrutura
do [Ollama](https://ollama.ai).

---

## 🚀 O que é?

SEGA-CLI é um agente avançado de terminal que clona as funcionalidades do Gemini
CLI do Google, mas em vez de enviar seus códigos e arquiteturas para a API na
nuvem, ele atua 100% offline utilizando IAs open-source do seu próprio
computador. Ele pode criar arquivos, ler código e rodar comandos diretamente.

### Diferenças do Original

| Feature             | Gemini CLI (Original)    | SEGA-CLI (Este Fork)           |
| ------------------- | ------------------------ | ------------------------------ |
| Motor AI            | Google Gemini API        | Ollama (Local)                 |
| Autenticação        | Google OAuth / API Key   | Nenhuma (100% Offline)         |
| Privacidade         | Dados enviados ao Google | Máxima Privacidade             |
| Idioma da Interface | Inglês                   | Português (PT-BR)              |
| Modelos Suportados  | Gemini Pro/Flash         | Qwen, Mistral, Llama, DeepSeek |
| Modo de Operação    | Chatbot de Nuvem         | Agente Autônomo com Tools      |

---

## 📋 Pré-requisitos

1. **Node.js** ≥ 20.0.0
2. **Ollama** instalado e rodando em background
   ([ollama.com](https://ollama.com))
3. Pelo menos um modelo com suporte a ferramentas (tool calling) baixado no
   Ollama:
   ```bash
   ollama pull qwen2.5:latest
   ollama pull devstral-small-2:latest
   ```

---

## 🔧 Instalação Global

Para acessar o SEGA-CLI de qualquer diretório da sua máquina de forma simples,
instale o projeto globalmente:

```bash
# Clonar o repositório
git clone https://github.com/84luska84/sega-cli.git
cd sega-cli

# Instalar dependências
npm install

# Buildar o código-fonte
npm run build

# Linkar o comando globalmente
npm link
```

---

## ⚡ Uso Básico

Após instalar via `npm link`, basta abrir o seu terminal em **qualquer pasta**
de projeto e digitar:

```bash
OLLAMA_MODEL=qwen2.5:latest sega
```

> **Dica:** Para não precisar digitar a variável toda vez, adicione
> `export OLLAMA_MODEL="qwen2.5:latest"` ao seu `~/.bashrc` ou `~/.zshrc`.

### Exemplo de Comandos no Chat

- `> crie um arquivo main.py com um script de hello world`
- `> explique o que a função X do meu arquivo atual faz`
- `> /memory show` (para ver o contexto do projeto carregado via `SEGA.md`)
- `> /stats model` (para ver os tempos de resposta e métricas da IA local)

---

## 🛠️ Como Funciona (Arquitetura)

O SEGA-CLI intercepta as requisições que o framework faria para o ecossistema do
Google, bloqueia camadas de telemetria indesejadas, e redireciona os payloads
convertidos para o endpoint OpenAI-compatible do Ollama
(`/v1/chat/completions`).

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  SEGA-CLI   │────▶│  Ollama API  │────▶│ Modelo Local│
│  (Terminal) │◀────│  (localhost)  │◀────│  (GPU/CPU)  │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Injeção de Persona e Correção de Tool Calling

Modelos abertos menores tendem a imprimir códigos estruturados de ferramentas
(ex: `write_file`) em JSON puro na resposta se não forem guiados perfeitamente.
O SEGA-CLI implementa um **bypass avançado de prompt de sistema** que garante
que qualquer modelo de código do Ollama reconheça o uso de interface nativa de
_Function Calling_, permitindo a manipulação de arquivos transparente sem poluir
o console.

---

## ⚠️ Limitações Conhecidas

1. **Tool Calling**: Requer suporte avançado no modelo do Ollama. Recomenda-se
   IAs modernas focadas em código como `qwen2.5-coder`, `qwen3`, `mistral`,
   `llama3`. Modelos inferiores a 7B podem não ter contexto de ferramentas
   suficiente.
2. **Contexto**: Totalmente atrelado ao poder da sua GPU/CPU e ao tamanho de
   janela do modelo selecionado.

---

## 📜 Licença

Este projeto é distribuído sob a licença **Apache 2.0**, mantendo a mesma
licença do projeto original. Consulte o arquivo [LICENSE](LICENSE) para detalhes
completos e o arquivo [NOTICE](NOTICE) para atribuições.

---

## 🙏 Atribuição

Este projeto é um fork de
[google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli),
copyright 2025 Google LLC, licenciado sob Apache 2.0.
