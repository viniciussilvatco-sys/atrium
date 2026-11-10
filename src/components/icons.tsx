// Ícones da interface (biblioteca Lucide, traço fino). Os emojis ficam só para as páginas do usuário.
// Tamanho e espessura vêm do CSS (`.lucide` em theme.css), então basta usar <Search />.
import type { ReactNode } from "react";
import {
  AlignLeft,
  CalendarDays,
  CircleDot,
  Hash,
  Kanban,
  Link,
  List,
  ListChecks,
  Loader,
  SquareCheck,
  Table,
} from "lucide-react";
import type { PropType, ViewType } from "../db/types";

export * from "lucide-react";

export const VIEW_ICONS: Record<ViewType, ReactNode> = {
  table: <Table />,
  board: <Kanban />,
  calendar: <CalendarDays />,
  list: <List />,
};

export const PROP_TYPE_ICONS: Record<PropType, ReactNode> = {
  text: <AlignLeft />,
  number: <Hash />,
  select: <CircleDot />,
  multiselect: <ListChecks />,
  status: <Loader />,
  date: <CalendarDays />,
  checkbox: <SquareCheck />,
  url: <Link />,
};
