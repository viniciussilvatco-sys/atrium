// Tipos centrais do Atrium. Tudo o que é sincronizado tem `updatedAt` e `deviceId`
// para que o merge "última versão vence" funcione entre dispositivos.

export type PropType =
  | "text"
  | "number"
  | "select"
  | "multiselect"
  | "status"
  | "date"
  | "checkbox"
  | "url";

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface PropDef {
  id: string;
  name: string;
  type: PropType;
  options?: SelectOption[];
}

export type FilterOp =
  | "contains"
  | "notContains"
  | "equals"
  | "notEquals"
  | "isEmpty"
  | "notEmpty"
  | "checked"
  | "unchecked"
  | "gt"
  | "lt"
  | "before"
  | "after";

export interface DbFilter {
  id: string;
  propId: string; // "title" para o título da linha
  op: FilterOp;
  value?: string;
}

export interface DbSort {
  propId: string; // "title" para o título da linha
  dir: "asc" | "desc";
}

export type ViewType = "table" | "board" | "calendar" | "list";

export interface DbView {
  id: string;
  name: string;
  type: ViewType;
  filters: DbFilter[];
  sorts: DbSort[];
  groupBy?: string; // propriedade select/status usada no quadro
  dateProp?: string; // propriedade date usada no calendário
  hiddenProps?: string[];
}

export type PageKind = "page" | "database" | "row";

export interface ConflictCopy {
  at: number;
  deviceId: string;
  title: string;
  content: unknown[];
}

export interface Page {
  id: string;
  profileId: string;
  parentId: string | null;
  kind: PageKind;
  title: string;
  icon: string;
  cover: string | null;
  content: unknown[]; // blocos do BlockNote
  text: string; // texto puro para a busca
  properties: Record<string, unknown>; // valores das propriedades (linhas de banco de dados)
  dbSchema?: PropDef[];
  views?: DbView[];
  favorite: boolean;
  isTemplate?: boolean;
  fullWidth?: boolean;
  order: number;
  trashedAt: number | null;
  deleted?: boolean; // tombstone: excluída definitivamente
  conflicts?: ConflictCopy[];
  createdAt: number;
  updatedAt: number;
  deviceId: string;
}

export interface Profile {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  deleted?: boolean;
  updatedAt: number;
  deviceId: string;
}

export interface Asset {
  id: string;
  profileId: string;
  pageId: string | null;
  name: string;
  mime: string;
  size: number;
  blob?: Blob; // ausente enquanto ainda não foi baixado do Drive
  deleted?: boolean;
  updatedAt: number;
  deviceId: string;
}

/** Registro na fila de envio: algo mudou localmente e precisa subir para o Drive. */
export interface DirtyEntry {
  key: string; // "page:<id>" | "profile:<id>" | "asset:<id>"
  at: number;
}

/** Mapeia um registro local para o arquivo correspondente no Drive. */
export interface RemoteEntry {
  key: string;
  fileId: string;
  modifiedTime: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export type SyncRecordType = "page" | "profile" | "asset";
