# Changelog

Todas as mudanças relevantes deste pacote são documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
e o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] - não publicado

### Adicionado
- Estrutura inicial do pacote (`src/`, testes, CI, licença MIT).
- Módulo `Buttons`: botões nativos (native_flow) do Baileys 7+ com fallback de
  texto automático e API desacoplada (sem dependência de configManager).
- `setLogger` / `enableConsoleLogger`: logger injetável e silencioso por padrão.
