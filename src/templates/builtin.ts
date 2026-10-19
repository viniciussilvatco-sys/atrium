import type { DbView, Page, PropDef } from "../db/types";
import { createPage, createRow, duplicatePage, updatePage } from "../db/repo";
import { db } from "../db/schema";
import { cloneBlocks } from "../lib/blocks";

export interface BuiltinTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  kind: "page" | "database";
  content?: unknown[];
  dbSchema?: PropDef[];
  views?: DbView[];
  rows?: { title: string; properties: Record<string, unknown> }[];
}

const t = (text: string, styles: Record<string, boolean> = {}) => ({ type: "text", text, styles });
const h = (level: 1 | 2 | 3, text: string) => ({ type: "heading", props: { level }, content: [t(text)] });
const para = (text = "") => ({ type: "paragraph", content: text ? [t(text)] : [] });
const bullet = (text = "") => ({ type: "bulletListItem", content: text ? [t(text)] : [] });
const num = (text = "") => ({ type: "numberedListItem", content: text ? [t(text)] : [] });
const check = (text = "", checked = false) => ({ type: "checkListItem", props: { checked }, content: text ? [t(text)] : [] });
const callout = (emoji: string, parts: unknown[]) => ({ type: "callout", props: { emoji }, content: parts });
const toggle = (text: string, children: unknown[]) => ({ type: "toggleListItem", content: [t(text)], children });
const divider = () => ({ type: "divider" });
const code = (language: string, text: string) => ({ type: "codeBlock", props: { language }, content: [t(text)] });

const status = (id: string): PropDef => ({
  id,
  name: "Status",
  type: "status",
  options: [
    { id: "todo", name: "A fazer", color: "gray" },
    { id: "doing", name: "Em andamento", color: "blue" },
    { id: "done", name: "Concluído", color: "green" },
  ],
});

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "aula",
    name: "Anotações de aula",
    icon: "🎓",
    description: "Resumo, conceitos-chave, dúvidas e exercícios de uma aula.",
    kind: "page",
    content: [
      callout("📌", [t("Curso: ", { bold: true }), t("…   "), t("Professor(a): ", { bold: true }), t("…   "), t("Data: ", { bold: true }), t("…")]),
      h(2, "Resumo"),
      para("Em poucas linhas, do que se tratou a aula?"),
      h(2, "Conceitos-chave"),
      bullet("Conceito — definição com suas palavras"),
      bullet(),
      h(2, "Anotações"),
      para(),
      h(2, "Dúvidas"),
      check("Pesquisar / perguntar ao professor"),
      h(2, "Exercícios"),
      num(),
      h(2, "Referências"),
      bullet(),
    ],
  },
  {
    id: "curso",
    name: "Curso",
    icon: "📚",
    description: "Visão geral de um curso com objetivos, módulos e materiais.",
    kind: "page",
    content: [
      callout("🎯", [t("Objetivo: ", { bold: true }), t("o que quero ser capaz de fazer ao final do curso?")]),
      h(2, "Informações"),
      bullet("Plataforma / instituição:"),
      bullet("Carga horária:"),
      bullet("Prazo:"),
      h(2, "Módulos"),
      check("Módulo 1"),
      check("Módulo 2"),
      check("Módulo 3"),
      h(2, "Materiais"),
      bullet(),
      h(2, "Projeto prático"),
      para("Como vou aplicar o que aprendi?"),
      divider(),
      toggle("Certificado e conclusão", [para("Data de conclusão, link do certificado…")]),
    ],
  },
  {
    id: "tutorial",
    name: "Conhecimento prático",
    icon: "🛠️",
    description: "Como resolver algo: problema, passo a passo, código e armadilhas.",
    kind: "page",
    content: [
      h(2, "Problema"),
      para("Qual situação isto resolve?"),
      h(2, "Solução em uma frase"),
      callout("💡", [t("…")]),
      h(2, "Passo a passo"),
      num("Primeiro passo"),
      num(),
      h(2, "Exemplo"),
      code("text", "// cole aqui um exemplo, comando ou trecho de código"),
      h(2, "Armadilhas"),
      bullet(),
      h(2, "Fontes"),
      bullet(),
    ],
  },
  {
    id: "reuniao",
    name: "Reunião",
    icon: "🗓️",
    description: "Pauta, notas, decisões e próximos passos.",
    kind: "page",
    content: [
      callout("🗓️", [t("Data: ", { bold: true }), t("…   "), t("Participantes: ", { bold: true }), t("…")]),
      h(2, "Pauta"),
      num(),
      h(2, "Notas"),
      bullet(),
      h(2, "Decisões"),
      bullet(),
      h(2, "Próximos passos"),
      check("Tarefa — responsável — prazo"),
    ],
  },
  {
    id: "projeto",
    name: "Projeto",
    icon: "🚀",
    description: "Objetivo, escopo, cronograma, tarefas e riscos.",
    kind: "page",
    content: [
      callout("🎯", [t("Objetivo: ", { bold: true }), t("…")]),
      h(2, "Escopo"),
      bullet("Inclui:"),
      bullet("Não inclui:"),
      h(2, "Cronograma"),
      check("Marco 1 — data"),
      check("Marco 2 — data"),
      h(2, "Tarefas"),
      check(),
      h(2, "Riscos"),
      bullet(),
      h(2, "Links"),
      bullet(),
    ],
  },
  {
    id: "diario",
    name: "Diário",
    icon: "📔",
    description: "Reflexão diária: como foi o dia, aprendizados e planos.",
    kind: "page",
    content: [
      h(3, "Como me sinto hoje"),
      para(),
      h(3, "Sou grato(a) por"),
      bullet(),
      h(3, "O que aprendi hoje"),
      bullet(),
      h(3, "Prioridades para amanhã"),
      check(),
    ],
  },
  {
    id: "estudos-db",
    name: "Controle de estudos",
    icon: "🧠",
    description: "Banco de dados com matérias, prazos, status e notas (tabela, quadro e calendário).",
    kind: "database",
    dbSchema: [
      status("st"),
      { id: "mat", name: "Matéria", type: "select", options: [] },
      { id: "prazo", name: "Prazo", type: "date" },
      { id: "nota", name: "Nota", type: "number" },
      { id: "link", name: "Material", type: "url" },
    ],
    views: [
      { id: "v1", name: "Tabela", type: "table", filters: [], sorts: [{ propId: "prazo", dir: "asc" }] },
      { id: "v2", name: "Quadro", type: "board", filters: [], sorts: [], groupBy: "st" },
      { id: "v3", name: "Calendário", type: "calendar", filters: [], sorts: [], dateProp: "prazo" },
    ],
    rows: [{ title: "Primeira tarefa de estudo", properties: { st: "todo" } }],
  },
  {
    id: "tarefas-db",
    name: "Tarefas",
    icon: "✅",
    description: "Lista de tarefas com prioridade e prazo, em tabela, quadro Kanban e calendário.",
    kind: "database",
    dbSchema: [
      status("st"),
      {
        id: "prio",
        name: "Prioridade",
        type: "select",
        options: [
          { id: "alta", name: "Alta", color: "red" },
          { id: "media", name: "Média", color: "yellow" },
          { id: "baixa", name: "Baixa", color: "gray" },
        ],
      },
      { id: "prazo", name: "Prazo", type: "date" },
      { id: "tags", name: "Tags", type: "multiselect", options: [] },
    ],
    views: [
      { id: "v1", name: "Quadro", type: "board", filters: [], sorts: [{ propId: "prio", dir: "asc" }], groupBy: "st" },
      { id: "v2", name: "Tabela", type: "table", filters: [], sorts: [] },
      { id: "v3", name: "Calendário", type: "calendar", filters: [], sorts: [], dateProp: "prazo" },
    ],
  },
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Cria uma nova página a partir de um template embutido. */
export async function createFromBuiltin(tpl: BuiltinTemplate, profileId: string, parentId: string | null): Promise<Page> {
  const page = await createPage({
    profileId,
    parentId,
    kind: tpl.kind,
    title: tpl.kind === "database" ? tpl.name : "",
    icon: tpl.icon,
    content: tpl.content ? cloneBlocks(tpl.content) : [],
    dbSchema: tpl.dbSchema ? clone(tpl.dbSchema) : undefined,
    views: tpl.views ? clone(tpl.views) : undefined,
  });
  for (const r of tpl.rows ?? []) await createRow(page, clone(r.properties), r.title);
  return page;
}

/** Aplica um template embutido a uma página vazia já existente. */
export async function applyBuiltinToPage(tpl: BuiltinTemplate, page: Page) {
  if (tpl.kind === "database") {
    await updatePage(page.id, {
      kind: "database",
      icon: page.icon || tpl.icon,
      title: page.title || tpl.name,
      dbSchema: clone(tpl.dbSchema ?? []),
      views: clone(tpl.views ?? []),
    });
    const fresh = await db.pages.get(page.id);
    for (const r of tpl.rows ?? []) await createRow(fresh!, clone(r.properties), r.title);
    return;
  }
  await updatePage(page.id, { icon: page.icon || tpl.icon, content: cloneBlocks(tpl.content ?? []) });
}

/** Cria uma página a partir de um template salvo pelo usuário (inclui subpáginas). */
export async function createFromUserTemplate(templateId: string, profileId: string, parentId: string | null) {
  const src = await db.pages.get(templateId);
  return duplicatePage(templateId, { profileId, parentId, isTemplate: false, title: src?.title ?? "", order: undefined });
}

/** Aplica um template do usuário a uma página vazia existente. */
export async function applyUserTemplateToPage(templateId: string, page: Page) {
  const src = await db.pages.get(templateId);
  if (!src) return;
  await updatePage(page.id, {
    icon: page.icon || src.icon,
    cover: page.cover ?? src.cover,
    title: page.title || src.title,
    content: cloneBlocks(src.content),
    kind: src.kind === "database" ? "database" : page.kind,
    dbSchema: src.dbSchema ? clone(src.dbSchema) : page.dbSchema,
    views: src.views ? clone(src.views) : page.views,
  });
  const kids = await db.pages.where("parentId").equals(templateId).filter((k) => !k.deleted && k.trashedAt === null).toArray();
  for (const k of kids) await duplicatePage(k.id, { parentId: page.id, profileId: page.profileId, isTemplate: false, title: k.title, order: k.order });
}

/** Salva uma cópia da página como template do perfil. */
export async function saveAsTemplate(pageId: string) {
  const src = await db.pages.get(pageId);
  if (!src) return;
  return duplicatePage(pageId, { parentId: null, isTemplate: true, title: src.title || "Template sem título" });
}
