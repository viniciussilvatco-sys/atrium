# Atrium

Caderno de anotações pessoal no estilo Notion: páginas dentro de páginas, blocos ricos, bancos de dados,
**perfis separados** (Estudo, Trabalho, …) e **sincronização pelo seu Google Drive** entre PC, notebook e celular.
Funciona offline e pode ser instalado como aplicativo.

## Primeiros passos

1. **Configurar o Google Drive (uma vez):** [docs/CONFIGURAR-GOOGLE.md](docs/CONFIGURAR-GOOGLE.md)
2. **Publicar e instalar nos aparelhos:** [docs/PUBLICAR.md](docs/PUBLICAR.md)

Para rodar no PC: `npm install` e depois `npm run dev` → <http://localhost:5173>.

## O que dá para fazer

| Recurso | Como usar |
| --- | --- |
| Páginas e subpáginas | **+** na barra lateral, ou `/página` dentro de uma página. Arraste na barra lateral para reorganizar (solte em cima de outra página para virar subpágina). |
| Blocos | Digite `/`: títulos, listas, checklist, toggle, citação, destaque (callout), divisor, código com cores, tabela, imagem, vídeo, áudio, arquivo, PDF, fórmula LaTeX, link incorporado (YouTube, Vimeo, Spotify, Google Docs, Figma…). |
| Markdown | Atalhos como `#`, `-`, `1.`, `[]`, `>` funcionam ao digitar; colar texto em Markdown vira blocos. |
| Links entre páginas | Digite `@` e escolha a página (ou crie uma nova na hora). |
| Imagens | Cole, arraste ou use `/imagem`. Fotos grandes são comprimidas automaticamente para economizar espaço. |
| Bancos de dados | `/banco de dados`: visões **Tabela**, **Quadro (Kanban)**, **Calendário** e **Lista**, com filtros, ordenação e propriedades (texto, número, seleção, seleção múltipla, status, data, caixa de seleção, URL). Cada item abre como página. |
| Perfis | Seletor no topo da barra lateral. Cada perfil tem suas próprias páginas, ícone e cor. |
| Templates | Aula, Curso, Conhecimento prático, Reunião, Projeto, Diário, Controle de estudos e Tarefas. Salve qualquer página como template pelo menu ⋯. |
| Busca | `Ctrl+K` — títulos e conteúdo, ignora acentos; opção de buscar em todos os perfis. |
| Favoritos e lixeira | ☆ no topo da página; páginas excluídas ficam 30 dias na lixeira. |
| Tema | Claro, escuro ou automático (Configurações). |
| Importar do Notion | Configurações → Importar do Notion: escolha o .zip exportado do Notion em “Markdown & CSV”. Subpáginas, imagens, PDFs, callouts, fórmulas e links entre páginas são mantidos; tudo entra numa página “Importado do Notion”. |
| Exportar e backup | Página ou perfil em Markdown (.zip com imagens), PDF pela impressão, backup completo em .json com restauração. |
| Sincronização | Configurações → Conectar Google Drive. Sincroniza ao abrir, ao voltar para o app, a cada minuto com alterações e no botão ⟳. |

### Atalhos

- `Ctrl+K` — buscar
- `Ctrl+\` — mostrar/ocultar a barra lateral
- `/` — inserir bloco · `@` — citar página
- `Ctrl+B` / `Ctrl+I` / `Ctrl+U` — negrito / itálico / sublinhado
- `Tab` / `Shift+Tab` — aninhar / desaninhar blocos

## Como a sincronização funciona

- Tudo é salvo primeiro no próprio aparelho (IndexedDB), então o app funciona sem internet.
- Cada página, perfil e arquivo vira um arquivo separado numa pasta **oculta e exclusiva do Atrium** no seu Google Drive
  (permissão `drive.appdata` — o app não enxerga seus outros arquivos).
- Se a mesma página for editada em dois aparelhos antes de sincronizar, a versão mais recente fica valendo e a outra
  é guardada em **"Ver outras versões"**, para você restaurar se quiser. Nada é perdido.

## Estrutura do código

```
src/
  db/          banco local (Dexie/IndexedDB), tipos e operações (repo.ts)
  sync/        login Google, API do Drive, motor de sincronização e merge de conflitos
  editor/      editor de blocos (BlockNote) e blocos personalizados
  database/    bancos de dados: visões, filtros, ordenação, propriedades
  components/  interface (barra lateral, página, busca, configurações…)
  export/      exportação Markdown/ZIP e backup
  templates/   templates embutidos
```

Tecnologias: React + TypeScript + Vite, BlockNote, Dexie, KaTeX, MiniSearch, JSZip, vite-plugin-pwa.
