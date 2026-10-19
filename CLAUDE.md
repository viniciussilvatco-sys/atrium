# Atrium — guia para o Claude

Caderno pessoal estilo Notion (PWA) com perfis e sincronização via Google Drive. Uso de **uma única pessoa**.
Publicado em <https://viniciussilvatco-sys.github.io/atrium/> (repositório `viniciussilvatco-sys/atrium`, branch `main`).

## Sobre o usuário

- Fala português do Brasil e é **iniciante** em programação: explique em português, passo a passo, sem jargão.
- Toda a interface e os textos do app são em **pt-BR**.
- `git push` para `main` **publica automaticamente** (GitHub Actions → Pages). Só faça commit/push quando ele pedir.

## Comandos

```
npm run dev        # http://localhost:5173
npm test           # Vitest (funções puras: merge, filtros, export, importação do Notion, embeds)
npm run typecheck  # tsc -b
npm run build      # tsc + vite build (gera dist/, PWA com service worker)
```

- No **Git Bash**, `BASE_PATH=/atrium/ ...` é convertido para `C:/Program Files/Git/atrium/` — use PowerShell
  (`$env:BASE_PATH='/atrium/'`) para testar o build com subcaminho localmente. No CI (Linux) não há problema.
- Testes de interface foram feitos com `playwright-core` + Chrome instalado (`C:/Program Files/Google/Chrome/Application/chrome.exe`),
  instalado no scratchpad, **não** no projeto. A sincronização é testada com um Drive falso via `context.route`
  e um `window.google` falso via `addInitScript`.

## Arquitetura

- **Local-first:** tudo é gravado no IndexedDB (Dexie, `src/db/schema.ts`) e o app funciona offline.
  Toda escrita passa por `src/db/repo.ts`, que carimba `updatedAt`/`deviceId` e grava a pendência em `db.dirty`.
- **Sync** (`src/sync/`): cada página/perfil/arquivo é um arquivo no `appDataFolder` do Drive
  (`page-<id>.json`, `profile-<id>.json`, `asset-<id>` com metadados em `appProperties`).
  `syncEngine.ts` faz pull (por `modifiedTime`) → merge → push da fila `dirty`. `merge.ts` é puro e testado:
  maior `updatedAt` vence, tombstones (`deleted`) sempre vencem, e edições simultâneas guardam a perdedora em `page.conflicts`.
  Login via Google Identity Services (token de 1 h, escopo `drive.appdata`, sem servidor).
- **Editor:** BlockNote 0.56 (`src/editor/`). Blocos próprios: `callout`, `math` (KaTeX), `embed`, `pdf`, `subpage`,
  `database`; menção inline `pageLink` (gatilho `@`). Imagens/arquivos ficam como `asset://<id>`, resolvidos por `editor/assets.ts`.
  Não usar pacotes `@blocknote/xl-*` (licença GPL).
- **Páginas:** `Page.kind` = `page` | `database` | `row`. Bancos de dados guardam `dbSchema` e `views`;
  cada linha é uma página `row` filha (`src/database/`, filtros/ordenação puros em `query.ts`).
- **Perfis** = espaços isolados (`profileId` em cada página). Templates são páginas com `isTemplate`.
- **Exportação/backup:** `src/export/` (Markdown ZIP, JSON). **Importação do Notion:** `src/import/`
  (`notionParse.ts` puro e testado; `notionImport.ts` lê o ZIP, inclusive ZIPs aninhados).
- Estado de interface: stores simples em `src/lib/store.ts` (rota por hash `#/<pageId>`, tema, perfil atual, modais).

## Cuidados já aprendidos

- Ao trocar o conteúdo de uma página por fora (sync, template, versão restaurada), **não remonte** o editor: incremente
  `reloadToken` do `PageEditor`, que relê do banco e faz `replaceBlocks` (remontar usava dados antigos).
- Listas ao vivo (`useLiveQuery`) podem estar atrasadas logo após uma escrita: confira no banco antes de "corrigir"
  estado (ex.: perfil recém-criado em `App.tsx`).
- Salvamentos com atraso (título, editor) precisam ser concluídos ao desmontar, senão a última edição se perde.
- Popovers usam portal e param a propagação de cliques para não reabrir o elemento-âncora.

## Pendências conhecidas

- Arrastar páginas/cartões com o dedo no celular é limitado (HTML5 drag and drop); não há alternativa por menu para
  colocar uma página dentro de outra.
- O atalho ``` não cria bloco de código no teste automatizado; `/código` funciona.
- Ícones das páginas não vêm na importação do Notion (o Notion não os exporta).
