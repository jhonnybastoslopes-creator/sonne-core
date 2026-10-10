# sonne-core

Toolkit modular e profissional para construir bots de WhatsApp com [Baileys](https://github.com/WhiskeySockets/Baileys). Reúne, em módulos independentes e testados, as partes mais difíceis de acertar num bot de produção: botões nativos, proteção anti-ban realista, agendamento, limites de uso e persistência.

> Extraído de um bot real rodando 24/7. Cada módulo é desacoplado, sem dependências ocultas, com logger injetável e testes.

## Instalação

```bash
npm install sonne-core
# o Baileys é peer dependency (instale a versão que você usa):
npm install @whiskeysockets/baileys
```

Requer Node.js >= 18. O módulo `DB` (SQLite nativo) requer Node >= 22.

## Começando

```js
const { Buttons, AntiBan, setLogger } = require('sonne-core')

// (opcional) plugue seu logger — por padrão a lib é silenciosa
setLogger({ info: console.log, error: console.error })

// anti-ban: fila humanizada de envios
const antiban = new AntiBan({ perfil: 'equilibrado' })
antiban.setSocket(sock)
await antiban.enfileirar(jid, { text: 'Olá!' })

// botões (renderizam no WhatsApp mobile; fallback de texto automático)
await Buttons.enviar(sock, jid, null, {
  texto: 'Escolha uma opção:',
  titulo: 'Menu',
  rodape: 'Meu Bot',
  modo: 'ambos', // 'nativo' | 'texto' | 'ambos'
  botoes: [
    Buttons.quickReply('🛍️ Ofertas', '/ofertas'),
    Buttons.urlButton('🌐 Site', 'https://exemplo.com')
  ]
})
```

## Módulos

Todos os módulos (exceto `Buttons`) são **classes** — instancie com `new`.

| Módulo | O que faz |
| --- | --- |
| `Buttons` | Botões nativos (native_flow) do Baileys 7+ com fallback de texto |
| `AntiBan` | Fila serial, jitter, "digitando...", limites por janela, warm-up, cooldown, spintax |
| `RateLimiter` | Anti-flood de comandos por usuário |
| `Storage` | JSON com escrita atômica, backup `.bak`, cache e lock por arquivo |
| `DB` | Persistência SQLite nativa (node:sqlite) chave-valor |
| `Scheduler` | Agendamento por horários HH:MM |

### AntiBan

```js
const antiban = new AntiBan({
  perfil: 'equilibrado',           // 'seguro' | 'equilibrado' | 'turbo'
  config: { maxPorHora: 60 },      // overrides pontuais (opcional)
  store: {                         // persistência de estado (opcional)
    read: () => storage.readJSON('./antiban.json', {}),
    write: (o) => storage.writeJSON('./antiban.json', o)
  },
  onCooldown: ({ minutos, erro }) => console.warn('cooldown', minutos, erro)
})
antiban.setSocket(sock)

await antiban.enfileirar(jid, { text: 'oi' }, { prioridade: false, quoted: msg })
antiban.aplicarPerfil('turbo')
antiban.status()                   // { perfil, enviosDia, emCooldown, ... }
antiban.variarTexto('{oi|olá|e aí} pessoal') // spintax
```

Perfis disponíveis em `AntiBan.PERFIS` (`seguro`, `equilibrado`, `turbo`).

### RateLimiter

```js
const rl = new RateLimiter({ maxComandos: 5, janelaMs: 10000, cooldownMs: 15000 })
const r = rl.verificar(senderJid, ehDono)
if (!r.permitido && r.avisar) reply(r.motivo)
```

### Storage

```js
const store = new Storage()
const dados = store.readJSON('./dados.json', {})
store.writeJSON('./dados.json', { ...dados, atualizado: Date.now() })
// read-modify-write seguro contra concorrência:
await store.updateJSONSafe('./contador.json', (d) => { d.n = (d.n||0)+1; return d })
```

### DB (SQLite nativo — Node 22+)

```js
const db = new DB({ path: './dados/app.db' })
db.init()
db.set('usuarios', '123', { nome: 'Ana' })
db.get('usuarios', '123')          // { nome: 'Ana' }
db.all('usuarios')                 // { '123': { nome: 'Ana' } }
db.podarPorIdade('postados', 30)   // remove entradas com data > 30 dias
db.stats()                         // { ativo, tamanhoKB, tabelas }
```

### Scheduler

```js
const s = new Scheduler()
s.add('18:00', () => dispararPromo())
s.onTick((hora) => console.log('agora são', hora))
s.start()  // checa a cada minuto; s.stop() para parar
```

## Logger

A lib é silenciosa por padrão. Para ligar:

```js
const { setLogger, enableConsoleLogger } = require('sonne-core')
enableConsoleLogger()                               // atalho pronto
setLogger({ debug, info, success, warn, error })    // ou injete o seu
```

## Testes

```bash
npm test
```

44 testes cobrindo todos os módulos.

## Aviso sobre anti-ban

Nenhuma técnica garante 100% contra banimento. O módulo `AntiBan` **reduz** o risco imitando comportamento humano e respeitando limites. Use sempre um número dedicado e cumpra os Termos do WhatsApp.

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md). PRs e issues são bem-vindos.

## Licença

MIT © Sonne Community
