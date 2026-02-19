import { db } from '../db';
import { communicationChannels, notificationDeliveryLogs, type CommunicationChannel, type InsertNotificationDeliveryLog } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface AlertPayload {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  eventType: string;
  equipmentName?: string;
  equipmentId?: number;
  actionRequired?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

interface DispatchResult {
  channelId: number;
  platform: string;
  channelName: string;
  status: 'sent' | 'failed';
  error?: string;
  responseCode?: number;
}

function formatSlackPayload(alert: AlertPayload): object {
  const severityEmoji: Record<string, string> = {
    info: ':information_source:',
    warning: ':warning:',
    critical: ':rotating_light:',
    emergency: ':fire:'
  };
  const emoji = severityEmoji[alert.severity] || ':bell:';
  const color = alert.severity === 'critical' || alert.severity === 'emergency' ? '#dc2626' :
                alert.severity === 'warning' ? '#f59e0b' : '#3b82f6';

  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${emoji} ${alert.title}`, emoji: true }
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: alert.message }
    }
  ];

  const fields: any[] = [
    { type: "mrkdwn", text: `*Severity:*\n${alert.severity.toUpperCase()}` },
    { type: "mrkdwn", text: `*Event:*\n${alert.eventType}` }
  ];

  if (alert.equipmentName) {
    fields.push({ type: "mrkdwn", text: `*Equipment:*\n${alert.equipmentName}` });
  }
  if (alert.actionRequired) {
    fields.push({ type: "mrkdwn", text: `*Action:*\n${alert.actionRequired}` });
  }

  blocks.push({ type: "section", fields });
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `Maintrix Alert | ${new Date().toLocaleString('fr-FR')}` }]
  });

  return {
    text: `${emoji} ${alert.title}`,
    attachments: [{ color, blocks }]
  };
}

function formatTeamsPayload(alert: AlertPayload): object {
  const severityColor: Record<string, string> = {
    info: '0078D4',
    warning: 'FFC107',
    critical: 'DC3545',
    emergency: 'FF0000'
  };

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: severityColor[alert.severity] || '0078D4',
    summary: alert.title,
    sections: [{
      activityTitle: `⚡ ${alert.title}`,
      activitySubtitle: `Severity: ${alert.severity.toUpperCase()} | ${alert.eventType}`,
      facts: [
        ...(alert.equipmentName ? [{ name: "Equipment", value: alert.equipmentName }] : []),
        { name: "Severity", value: alert.severity.toUpperCase() },
        { name: "Event Type", value: alert.eventType },
        ...(alert.actionRequired ? [{ name: "Action Required", value: alert.actionRequired }] : []),
        { name: "Time", value: new Date().toLocaleString('fr-FR') }
      ],
      markdown: true,
      text: alert.message
    }]
  };
}

function formatTelegramPayload(alert: AlertPayload): string {
  const severityEmoji: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
    emergency: '🔥'
  };
  const emoji = severityEmoji[alert.severity] || '🔔';

  let text = `${emoji} *${escapeMarkdown(alert.title)}*\n\n`;
  text += `${escapeMarkdown(alert.message)}\n\n`;
  text += `🏷 *Sévérité:* ${alert.severity.toUpperCase()}\n`;
  text += `📋 *Type:* ${escapeMarkdown(alert.eventType)}\n`;
  if (alert.equipmentName) text += `⚙️ *Équipement:* ${escapeMarkdown(alert.equipmentName)}\n`;
  if (alert.actionRequired) text += `🔧 *Action:* ${escapeMarkdown(alert.actionRequired)}\n`;
  text += `\n🕐 ${new Date().toLocaleString('fr-FR')}\n_— Maintrix_`;
  return text;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function formatWhatsAppPayload(alert: AlertPayload): string {
  const severityEmoji: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
    emergency: '🔥'
  };
  const emoji = severityEmoji[alert.severity] || '🔔';

  let text = `${emoji} *${alert.title}*\n\n`;
  text += `${alert.message}\n\n`;
  text += `Sévérité: ${alert.severity.toUpperCase()}\n`;
  text += `Type: ${alert.eventType}\n`;
  if (alert.equipmentName) text += `Équipement: ${alert.equipmentName}\n`;
  if (alert.actionRequired) text += `Action requise: ${alert.actionRequired}\n`;
  text += `\n${new Date().toLocaleString('fr-FR')} — Maintrix`;
  return text;
}

function formatGenericWebhookPayload(alert: AlertPayload): object {
  return {
    source: 'maintrix',
    timestamp: new Date().toISOString(),
    alert: {
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      eventType: alert.eventType,
      equipmentName: alert.equipmentName,
      equipmentId: alert.equipmentId,
      actionRequired: alert.actionRequired,
      metadata: alert.metadata
    }
  };
}

async function sendToSlack(channel: CommunicationChannel, alert: AlertPayload): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!channel.webhookUrl) return { ok: false, status: 0, error: 'No webhook URL configured' };
  try {
    const payload = formatSlackPayload(alert);
    const response = await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: response.ok, status: response.status, error: response.ok ? undefined : await response.text() };
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
}

async function sendToTeams(channel: CommunicationChannel, alert: AlertPayload): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!channel.webhookUrl) return { ok: false, status: 0, error: 'No webhook URL configured' };
  try {
    const payload = formatTeamsPayload(alert);
    const response = await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: response.ok, status: response.status, error: response.ok ? undefined : await response.text() };
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
}

async function sendToTelegram(channel: CommunicationChannel, alert: AlertPayload): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!channel.botToken || !channel.chatId) return { ok: false, status: 0, error: 'Bot token and chat ID required' };
  try {
    const text = formatTelegramPayload(alert);
    const response = await fetch(`https://api.telegram.org/bot${channel.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channel.chatId, text, parse_mode: 'MarkdownV2' })
    });
    const data = await response.json();
    return { ok: data.ok, status: response.status, error: data.ok ? undefined : data.description };
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
}

async function sendToWhatsApp(channel: CommunicationChannel, alert: AlertPayload): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!channel.webhookUrl) return { ok: false, status: 0, error: 'No webhook URL configured' };
  try {
    const text = formatWhatsAppPayload(alert);
    const response = await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, chatId: channel.chatId })
    });
    return { ok: response.ok, status: response.status, error: response.ok ? undefined : await response.text() };
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
}

async function sendToWebhook(channel: CommunicationChannel, alert: AlertPayload): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!channel.webhookUrl) return { ok: false, status: 0, error: 'No webhook URL configured' };
  try {
    const payload = formatGenericWebhookPayload(alert);
    const response = await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: response.ok, status: response.status, error: response.ok ? undefined : await response.text() };
  } catch (error: any) {
    return { ok: false, status: 0, error: error.message };
  }
}

async function logDelivery(channelId: number, platform: string, alert: AlertPayload, status: 'sent' | 'failed', error?: string, responseCode?: number) {
  try {
    await db.insert(notificationDeliveryLogs).values({
      channelId,
      platform,
      eventType: alert.eventType,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      status,
      errorMessage: error,
      responseCode,
    });
  } catch (e) {
    console.error('Failed to log delivery:', e);
  }
}

export class CommunicationDispatcher {
  private static instance: CommunicationDispatcher;

  static getInstance(): CommunicationDispatcher {
    if (!CommunicationDispatcher.instance) {
      CommunicationDispatcher.instance = new CommunicationDispatcher();
    }
    return CommunicationDispatcher.instance;
  }

  async dispatchAlert(alert: AlertPayload, tenantId?: string): Promise<DispatchResult[]> {
    const channels = await this.getEnabledChannels(tenantId);
    const results: DispatchResult[] = [];

    for (const channel of channels) {
      const severityFilter = (channel.severityFilter as string[]) || ['critical', 'warning'];
      const eventFilter = (channel.eventFilter as string[]) || [];

      if (!severityFilter.includes(alert.severity)) continue;
      if (eventFilter.length > 0 && !eventFilter.includes(alert.eventType)) continue;

      const result = await this.sendToChannel(channel, alert);
      results.push(result);
    }

    return results;
  }

  private async sendToChannel(channel: CommunicationChannel, alert: AlertPayload): Promise<DispatchResult> {
    let sendResult: { ok: boolean; status: number; error?: string };

    switch (channel.platform) {
      case 'slack':
        sendResult = await sendToSlack(channel, alert);
        break;
      case 'teams':
        sendResult = await sendToTeams(channel, alert);
        break;
      case 'telegram':
        sendResult = await sendToTelegram(channel, alert);
        break;
      case 'whatsapp':
        sendResult = await sendToWhatsApp(channel, alert);
        break;
      case 'webhook':
        sendResult = await sendToWebhook(channel, alert);
        break;
      default:
        sendResult = { ok: false, status: 0, error: `Unknown platform: ${channel.platform}` };
    }

    const status = sendResult.ok ? 'sent' as const : 'failed' as const;
    await logDelivery(channel.id, channel.platform, alert, status, sendResult.error, sendResult.status);

    return {
      channelId: channel.id,
      platform: channel.platform,
      channelName: channel.name,
      status,
      error: sendResult.error,
      responseCode: sendResult.status
    };
  }

  async getEnabledChannels(tenantId?: string): Promise<CommunicationChannel[]> {
    if (tenantId) {
      return db.select().from(communicationChannels)
        .where(and(eq(communicationChannels.isEnabled, true), eq(communicationChannels.tenantId, tenantId)));
    }
    return db.select().from(communicationChannels).where(eq(communicationChannels.isEnabled, true));
  }

  async getAllChannels(): Promise<CommunicationChannel[]> {
    return db.select().from(communicationChannels).orderBy(desc(communicationChannels.createdAt));
  }

  async getChannel(id: number): Promise<CommunicationChannel | undefined> {
    const [channel] = await db.select().from(communicationChannels).where(eq(communicationChannels.id, id));
    return channel;
  }

  async createChannel(data: any): Promise<CommunicationChannel> {
    const [channel] = await db.insert(communicationChannels).values(data).returning();
    return channel;
  }

  async updateChannel(id: number, data: any): Promise<CommunicationChannel | undefined> {
    const [channel] = await db.update(communicationChannels).set({ ...data, updatedAt: new Date() }).where(eq(communicationChannels.id, id)).returning();
    return channel;
  }

  async deleteChannel(id: number): Promise<boolean> {
    const result = await db.delete(communicationChannels).where(eq(communicationChannels.id, id)).returning();
    return result.length > 0;
  }

  async testChannel(id: number): Promise<DispatchResult> {
    const channel = await this.getChannel(id);
    if (!channel) throw new Error('Channel not found');

    const testAlert: AlertPayload = {
      title: 'Test de connexion Maintrix',
      message: 'Ceci est un message de test envoyé depuis Maintrix pour vérifier la connexion de votre canal de communication.',
      severity: 'info',
      eventType: 'test',
      equipmentName: 'Système de test',
      actionRequired: 'Aucune action requise - ceci est un test',
      timestamp: new Date()
    };

    return this.sendToChannel(channel, testAlert);
  }

  async getDeliveryLogs(channelId?: number, limit: number = 50): Promise<any[]> {
    if (channelId) {
      return db.select().from(notificationDeliveryLogs)
        .where(eq(notificationDeliveryLogs.channelId, channelId))
        .orderBy(desc(notificationDeliveryLogs.sentAt))
        .limit(limit);
    }
    return db.select().from(notificationDeliveryLogs)
      .orderBy(desc(notificationDeliveryLogs.sentAt))
      .limit(limit);
  }

  async getDeliveryStats(): Promise<{ total: number; sent: number; failed: number; byPlatform: Record<string, { sent: number; failed: number }> }> {
    const logs = await db.select().from(notificationDeliveryLogs);
    const stats = {
      total: logs.length,
      sent: logs.filter(l => l.status === 'sent').length,
      failed: logs.filter(l => l.status === 'failed').length,
      byPlatform: {} as Record<string, { sent: number; failed: number }>
    };

    for (const log of logs) {
      if (!stats.byPlatform[log.platform]) {
        stats.byPlatform[log.platform] = { sent: 0, failed: 0 };
      }
      if (log.status === 'sent') stats.byPlatform[log.platform].sent++;
      else stats.byPlatform[log.platform].failed++;
    }

    return stats;
  }
}

export const communicationDispatcher = CommunicationDispatcher.getInstance();
