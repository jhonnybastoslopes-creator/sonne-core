# sonne-core

Toolkit modular e profissional para construir bots de WhatsApp com [Baileys](https://github.com/WhiskeySockets/Baileys). Reune, em módulos independentes e testados, as partes mais difíceis de acertar num bot de produção: botões nativos, proteção anti-ban realista, agendamento, filtros e persistência.

> Extraído de um bot real rodando 24/7. Cada módulo é desacoplado, sem dependências ocultas e com testes.

## Instalação

```bash
npm install sonne-core
# o Baileys é uma peer dependency (instale a versão que você usa):
npm install @whiskeysockets/baileys
```

Requer Node.js >= 18.

## Começando

```js
const { Buttons, setLogger } = require('sonne-core')

// (opcional) plugue seu logger — por padrão a lib é silenciosa
setLogger({ info: console.log, error: console.error })

// enviar botões (renderizam no WhatsApp mobile; fallback de texto automático)
await Buttons.enviar(socket, jid, null, {
  texto: 'Escolha uma opção:',
  titulo: 'Menu',
  rodape: 'Meu Bot',
  modo: 'ambos', // 'nativo' | 'texto' | 'ambos'
  botoes: [
    Buttons.quickReply('🛍️ Ofertas', '/ofertas'),
    Buttons.urlButton('🌐 Site', 'https://exemplo.com'),
    Buttons.listButton('Mais', [
      { title: 'Opções', rows: [
        { title: 'Ajuda', description: 'Fale com o suporte', id: '/ajuda' }
      ]}
    ])
  ]
})
```

## Módulos

| Módulo | Descrição | Status |
| --- | --- | --- |
| `Buttons` | Botões nativos (native_flow) do Baileys 7+ com fallback de texto | ✅ disponível |
| `AntiBan` | Fila de envio, jitter, limites por janela, warm-up, cooldown | 🚧 em migração |
| `Scheduler` | Agendamento por horários de pico | 🚧 em migração |
| `DB` | Persistência SQLite nativa (node:sqlite) chave-valor | 🚧 em migração |
| `Storage` | JSON com escrita atômica + lock por arquivo | 🚧 em migração |
| `RateLimiter` | Anti-flood de comandos por usuário | 🚧 em migração |

Os módulos marcados como "em migração" existem no bot original e estão sendo portados para a lib com API desacoplada (sem caminhos fixos, com injeção de dependências).

## API: Buttons

- `quickReply(texto, id)` — botão de resposta rápida (envia `id` como mensagem)
- `urlButton(texto, url)` — botão que abre um link
- `copyButton(texto, codigo)` — botão de copiar código
- `callButton(texto, telefone)` — botão de ligação
- `listButton(titulo, secoes)` — menu de lista (seções com linhas)
- `enviar(socket, jid, info, opcoes)` — envia os botões (com fallback)
- `enviarCapturandoKey(socket, jid, opcoes)` — envia e retorna a mensagem (com `.key`)
- `montarMenuTexto(texto, botoes, rodape)` — gera o menu em texto

Opções de `enviar`: `{ texto, titulo, rodape, botoes, imagem, modo }`.

## Logger

A lib é silenciosa por padrão. Para ligar:

```js
const { setLogger, enableConsoleLogger } = require('sonne-core')
enableConsoleLogger()                    // atalho pronto
// ou injete o seu:
setLogger({ debug, info, success, warn, error })
```

## Testes

```bash
npm test
```

## Aviso sobre anti-ban

Nenhuma técnica garante 100% contra banimento. O módulo `AntiBan` **reduz** o risco imitando comportamento humano e respeitando limites. Use sempre um número dedicado e cumpra os Termos do WhatsApp.

## Licença

MIT © Sonne Community
