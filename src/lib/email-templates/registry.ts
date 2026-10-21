import type { ComponentType } from 'react'
import { dailyNewsletterTemplate } from './daily-newsletter'
import { template as leadWelcomeTemplate } from './lead-welcome'
import { template as leadReminderTemplate } from './lead-reminder'
import { weeklyRankingTemplate } from './weekly-ranking'
import { template as contactNotificationTemplate } from './contact-notification'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'daily-newsletter': dailyNewsletterTemplate,
  'lead-welcome': leadWelcomeTemplate,
  'lead-reminder': leadReminderTemplate,
  'weekly-ranking': weeklyRankingTemplate,
  'contact-notification': contactNotificationTemplate,
}

