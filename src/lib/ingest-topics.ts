export const INGEST_TOPICS = [
  { value: "geral", label: "Panorama geral de IA" },
  { value: "bigtech", label: "Big techs (OpenAI, Google, Meta...)" },
  { value: "brasil", label: "IA no Brasil" },
  { value: "regulacao", label: "Regulação e leis" },
  { value: "mercado", label: "Mercado e investimentos" },
  { value: "startup", label: "Startups e rodadas" },
  { value: "pesquisa", label: "Pesquisa e modelos" },
  { value: "ferramentas", label: "Ferramentas e agentes" },
] as const;

export type IngestInput = {
  limit: number;
  hours: number;
  topics: string[];
  minWords: number;
  requireImage: boolean;
};

export type IngestOutcome = {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  message?: string;
};