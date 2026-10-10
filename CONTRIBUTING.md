# Contribuindo com o sonne-core

Obrigado pelo interesse em contribuir! Este guia explica como participar.

## Como rodar o projeto

```bash
git clone https://github.com/jhonnybastoslopes-creator/sonne-core.git
cd sonne-core
npm install
npm test
```

## Princípios do projeto

1. **Módulos desacoplados** — nada de caminhos fixos ou dependências ocultas.
   Config, persistência e logger são injetados pelo consumidor.
2. **Logger silencioso por padrão** — use `log` de `./logger.js`, nunca
   `console.log` direto.
3. **Tudo testado** — toda função pública precisa de teste em `__tests__/`.
4. **Sem dependências de runtime desnecessárias** — o Baileys é peer dependency
   e opcional; o core não deve exigir pacotes pesados.

## Fluxo de contribuição

1. Abra uma issue descrevendo o bug ou a melhoria.
2. Crie um branch a partir de `main`: `git checkout -b minha-feature`.
3. Faça as mudanças com testes.
4. Rode `npm test` e garanta que tudo passa.
5. Abra um Pull Request descrevendo o que mudou e por quê.

## Padrão de commits

Use mensagens claras no imperativo. Prefixos úteis:

- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` documentação
- `test:` testes
- `refactor:` refatoração sem mudança de comportamento
- `chore:` tarefas de manutenção

## Reportando vulnerabilidades

Não abra issues públicas para falhas de segurança. Entre em contato de forma
reservada com o mantenedor.
