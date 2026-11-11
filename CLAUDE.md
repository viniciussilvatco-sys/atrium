# Atrium — guia para o Claude

Caderno pessoal estilo Notion (PWA) com perfis e sincronização via Google Drive. Uso de **uma única pessoa**.
Publicado em <https://viniciussilvatco-sys.github.io/atrium/> (repositório `viniciussilvatco-sys/atrium`, branch `main`).

## Sobre o usuário

- Fala português do Brasil e é **iniciante** em programação: explique em português, passo a passo, sem jargão.
- Toda a interface e os textos do app são em **pt-BR**.
- `git push` para `main` **publica automaticamente** (GitHub Actions → Pages). Só faça commit/push quando ele pedir.
- O usuário abre o app pelo atalho `Atrium.lnk` na pasta do projeto (Chrome em modo app, apontando para a versão
  publicada). **Depois de cada publicação, rode `npm run atalho`** para recriá-lo (`scripts/criar-atalho.ps1`; o
  `.lnk` e o `.ico` gerados ficam fora do git).
- Nunca faça commit de arquivos `.zip` (exportações do Notion com anotações pessoais; já estão no `.gitignore`).

## Comandos

```
npm run dev        # http://localhost:5173
npm test           # Vitest (funções puras: merge, filtros, export, importação do Notion, embeds, recentes do menu "/",
                   #   histórico de versões, lembrete de backup)
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
  `syncEngine.ts` faz pull (por `modifiedTime`, 6 downloads em paralelo via `pool.ts`; perfis → páginas → arquivos;
  `db.remote` só é gravado depois de aplicar, para um download que falhou ser refeito) → merge → push da fila `dirty`. `merge.ts` é puro e testado:
  maior `updatedAt` vence, tombstones (`deleted`) sempre vencem, e edições simultâneas guardam a perdedora em `page.conflicts`.
  Login via Google Identity Services (token de 1 h, escopo `drive.appdata`, sem servidor).
- **Editor:** BlockNote 0.56 (`src/editor/`). Blocos próprios: `callout`, `math` (KaTeX), `embed`, `pdf`, `subpage`,
  `database`; menção inline `pageLink` (gatilho `@`). Imagens/arquivos ficam como `asset://<id>`, resolvidos por `editor/assets.ts`.
  Não usar pacotes `@blocknote/xl-*` (licença GPL).
- **Páginas:** `Page.kind` = `page` | `database` | `row`. Bancos de dados guardam `dbSchema` e `views`;
  cada linha é uma página `row` filha (`src/database/`, filtros/ordenação puros em `query.ts`).
- **Perfis** = espaços isolados (`profileId` em cada página). Templates são páginas com `isTemplate`.
- **Histórico de versões** (menu ⋯ → "Histórico de versões", `HistoryModal.tsx`): tabela local `db.versions`
  (Dexie v2, **não sincronizada**). `updatePage` guarda foto do estado anterior no máximo a cada 10 min; o sync guarda
  foto antes de sobrescrever com conteúdo de outro aparelho; restaurar guarda o estado atual antes. Regras de
  intervalo/limpeza puras em `src/lib/versions.ts` (`pruneVersions` roda ao abrir o app).
- **Exportação/backup:** `src/export/` (Markdown ZIP, JSON). O backup completo grava `lastBackup` em `db.meta`; a barra
  lateral mostra um lembrete discreto após 7 dias ("Depois" adia 3 dias; regras em `src/lib/backup.ts`). **Importação do Notion:** `src/import/`
  (`notionParse.ts` puro e testado; `notionImport.ts` lê o ZIP, inclusive ZIPs aninhados).
- **Visual:** cores/tamanhos são variáveis em `src/styles/theme.css` (`--radius-sm/--radius/--radius-lg`, `--shadow`,
  `--accent-soft` para a página ativa). A área principal é um "cartão" sobre o fundo da barra lateral (no celular, tela cheia).
  Ícones da interface vêm do Lucide via `src/components/icons.tsx` (tamanho pelo CSS `.lucide`); emojis só para as páginas do usuário.
- Estado de interface: stores simples em `src/lib/store.ts` (rota por hash `#/<pageId>`, tema, perfil atual, modais).

## Cuidados já aprendidos

- Ao trocar o conteúdo de uma página por fora (sync, template, versão restaurada), **não remonte** o editor: incremente
  `reloadToken` do `PageEditor`, que relê do banco e faz `replaceBlocks` (remontar usava dados antigos).
- Listas ao vivo (`useLiveQuery`) podem estar atrasadas logo após uma escrita: confira no banco antes de "corrigir"
  estado (ex.: perfil recém-criado em `App.tsx`).
- Salvamentos com atraso (título, editor) precisam ser concluídos ao desmontar, senão a última edição se perde.
- Popovers usam portal e param a propagação de cliques para não reabrir o elemento-âncora.

## Pendências conhecidas

- Arrastar páginas/cartões com o dedo no celular é limitado (HTML5 drag and drop); a alternativa é o menu ⋯ →
  "Mover para…" (`MoveModal.tsx`), que também troca a página de perfil.
- O atalho ``` não cria bloco de código no teste automatizado; `/código` funciona.
- Ícones das páginas não vêm na importação do Notion (o Notion não os exporta).
