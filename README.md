# SEGA-CLI ⚡

**Um agente AI terminal-first alimentado por modelos locais do Ollama.**

Fork do [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
(Apache 2.0), modificado para utilizar exclusivamente modelos locais via
[Ollama](https://ollama.ai).

---

## 🚀 O que é?

SEGA-CLI é um clone funcional do Gemini CLI do Google, mas em vez de depender da
API do Google Gemini, ele roda 100% local usando qualquer modelo do Ollama
instalado no seu computador.

### Diferenças do Original

| Feature      | Gemini CLI (Original)    | SEGA-CLI (Este Fork)   |
| ------------ | ------------------------ | ---------------------- |
| Motor AI     | Google Gemini API        | Ollama (Local)         |
| Autenticação | Google OAuth / API Key   | Nenhuma (local)        |
| Privacidade  | Dados enviados ao Google | 100% offline           |
| Custo        | Quota limitada / pago    | Gratuito               |
| Modelos      | Gemini Pro/Flash         | Qualquer modelo Ollama |

---

## 📋 Pré-requisitos

1. **Node.js** ≥ 20.0.0
2. **Ollama** instalado e rodando ([ollama.ai](https://ollama.ai))
3. Pelo menos um modelo baixado no Ollama:
   ```bash
   ollama pull qwen2.5:latest
   # ou qualquer outro modelo
   ```

---

## 🔧 Instalação

```bash
# Clonar o repositório
git clone https://github.com/84luska84/sega-cli.git
cd sega-cli

# Instalar dependências
npm install

# Buildar
npm run build
```

---

## ⚡ Uso

### Modo Básico

```bash
# Definir o modelo Ollama e iniciar
OLLAMA_MODEL=qwen2.5:latest npm run start
```

### Variáveis de Ambiente

| Variável          | Descrição                                     | Padrão                   |
| ----------------- | --------------------------------------------- | ------------------------ |
| `OLLAMA_MODEL`    | **Obrigatória.** Nome do modelo Ollama a usar | -                        |
| `OLLAMA_BASE_URL` | URL base do servidor Ollama                   | `http://localhost:11434` |

### Exemplos com Diferentes Modelos

```bash
# Qwen 2.5 (leve, 7B)
OLLAMA_MODEL=qwen2.5:latest npm run start

# Qwen 3 (8B, com tool calling)
OLLAMA_MODEL=qwen3:8b npm run start

# DeepSeek Coder (code-focused)
OLLAMA_MODEL=huihui_ai/qwen2.5-coder-abliterate:14b npm run start

# Devstral (24B, Mistral para code)
OLLAMA_MODEL=devstral-small-2:latest npm run start
```

### Listar Modelos Disponíveis

```bash
curl http://localhost:11434/api/tags | python3 -m json.tool
```

---

## 🛠️ Como Funciona

O SEGA-CLI intercepta as chamadas que o Gemini CLI faria à API do Google e as
redireciona para o endpoint OpenAI-compatible do Ollama
(`/v1/chat/completions`).

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  SEGA-CLI   │────▶│  Ollama API  │────▶│ Modelo Local│
│  (Terminal) │◀────│  (localhost)  │◀────│  (GPU/CPU)  │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Arquivos Modificados

Os seguintes arquivos foram alterados em relação ao projeto original:

- `packages/core/src/core/ollamaContentGenerator.ts` — **[NOVO]** Gerador de
  conteúdo para Ollama
- `packages/core/src/core/contentGenerator.ts` — Adicionado `AuthType.OLLAMA` e
  factory
- `packages/core/src/config/config.ts` — Bypass de serviços Google para Ollama
- `packages/cli/src/ui/auth/useAuth.ts` — Bypass de autenticação Google
- `package.json` — Rebranding para SEGA-CLI
- `README.md` — Esta documentação
- `NOTICE` — Atribuição ao projeto original

---

## ⚠️ Limitações Conhecidas

1. **Tool Calling**: Depende do suporte do modelo. Modelos como `qwen2.5-coder`,
   `qwen3`, `mistral` suportam. Modelos menores podem falhar.
2. **Embeddings**: Não suportado (usado apenas para busca de contexto avançada).
3. **Performance**: Depende do hardware local (GPU recomendada).
4. **Tamanho de Contexto**: Limitado ao contexto do modelo local (tipicamente
   4K-128K tokens).

---

## 📜 Licença

Este projeto é distribuído sob a licença **Apache 2.0**, mantendo a mesma
licença do projeto original.

Consulte o arquivo [LICENSE](LICENSE) para detalhes completos e o arquivo
[NOTICE](NOTICE) para atribuições.

---

## 🙏 Atribuição

Este projeto é um fork de
[google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli),
copyright 2025 Google LLC, licenciado sob Apache 2.0.
