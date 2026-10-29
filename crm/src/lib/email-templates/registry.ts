import type { ComponentType } from "react";

import { template as crmDailyTemplate } from "./crm-daily";
import { template as crmWeeklyTemplate } from "./crm-weekly";

export interface TemplateEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cada modelo tem suas próprias props
  component: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dados livres do modelo
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dados livres do modelo
  previewData?: Record<string, any>;
  /** Destinatário fixo (sobrepõe o informado na chamada). */
  to?: string;
}

/** Modelos de e-mail do CRM (resumo diário e semanal). */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "crm-daily": crmDailyTemplate,
  "crm-weekly": crmWeeklyTemplate,
};
