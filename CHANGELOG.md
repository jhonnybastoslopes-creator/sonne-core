# Changelog

Todas as mudanças relevantes deste pacote são documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [0.4.0]

### Adicionado
- `AntiBan` agora é **ADAPTATIVO**: mantém uma "saúde" (0-100) que sobe a cada
  envio bem-sucedido (acelera, aumenta limites) e cai a cada erro/rate-limit
  (desacelera, reduz limites e, em casos graves, pausa com cooldown maior).
  Maximiza o volume de envio sem tomar ban, recuando sozinho ao primeiro sinal
  de risco. Pode ser desligado com `{ adaptativo: false }`. A saúde é persistida.
- `status()` do AntiBan agora reporta `saude`, `ritmo` e `adaptativo`.

## [0.3.1]

### Corrigido
- `Buttons.enviar` e `Buttons.enviarCapturandoKey` agora detectam canais
  (`@newsletter`) e enviam em texto automaticamente. Canais não renderizam
  botões interativos (o WhatsApp mostrava "sua versão não é compatível").

## [0.3.0]

### Adicionado
- Módulo `SessionManager` (classe): sessões conversacionais "pergunta → aguarda
  resposta", ideal para configuração guiada por botões. Zero dependências.
- Módulo `GroupCache` (classe): cache em memória de `groupMetadata` do Baileys
  com TTL, poda por limite e fallback para cache antigo em caso de falha.
- Módulo `Cleanup` (classe): limpeza automática de temporários e truncamento de
  logs grandes numa VPS, totalmente parametrizável.
- Tipos TypeScript dos 3 módulos novos.
- Agora são 62 testes.

## [0.2.1]

### Corrigido
- Peer dependency do Baileys aceita pré-releases (`>=6.0.0-0`), compatível com
  versões RC como `7.0.0-rc.x`.

## [0.2.0]

### Adicionado
- Módulo `AntiBan` (classe): fila serial, jitter, "digitando...", limites por
  janela (minuto/hora/dia), anti-flood por destino, pausa noturna, warm-up,
  cooldown por erros e spintax. Config, persistência (`store`) e `onCooldown`
  injetáveis.
- Módulo `RateLimiter` (classe): anti-flood de comandos por usuário.
- Módulo `Storage` (classe): JSON com escrita atômica, backup `.bak`, cache por
  mtime e lock por arquivo (incl. `updateJSONSafe` contra lost update).
- Módulo `DB` (classe): persistência SQLite nativa (node:sqlite) chave-valor,
  com meta, poda por idade, compactação e importação.
- Módulo `Scheduler` (classe): agendamento genérico por horários HH:MM + `onTick`.
- Definições de tipos TypeScript (`types/index.d.ts`).
- `CONTRIBUTING.md`.
- Suite com 44 testes.

## [0.1.0]

### Adicionado
- Estrutura inicial do pacote (`src/`, testes, CI, licença MIT).
- Módulo `Buttons`: botões nativos (native_flow) do Baileys 7+ com fallback de
  texto automático e API desacoplada.
- `setLogger` / `enableConsoleLogger`: logger injetável e silencioso por padrão.
