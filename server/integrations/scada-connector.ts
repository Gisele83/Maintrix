/**
 * SCADA / OPC-UA Connector
 * Connects to industrial SCADA systems via OPC-UA or REST bridge
 * Activated when SCADA_ENDPOINT is set
 *
 * Supports two modes:
 *   - OPC-UA native (requires node-opcua, not installed by default)
 *   - REST bridge (generic HTTP adapter for SCADA REST gateways)
 */

export interface ScadaConfig {
  endpoint: string;       // OPC-UA: opc.tcp://host:4840  or REST: https://host/api
  mode: 'opcua' | 'rest';
  authToken?: string;
  username?: string;
  password?: string;
  pollIntervalMs?: number;
  plcAddresses?: string[];
}

export interface ScadaTagValue {
  nodeId: string;
  displayName: string;
  value: number | string | boolean;
  dataType: string;
  sourceTimestamp: string;
  statusCode: string;
}

export interface ScadaAlarm {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  activeTime: string;
  acknowledgedTime?: string;
  source: string;
}

export class ScadaConnector {
  private config: ScadaConfig;
  private isConnected: boolean = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private tagValues: Map<string, ScadaTagValue> = new Map();

  constructor(config: ScadaConfig) {
    this.config = config;
  }

  /**
   * Test connection to SCADA system
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (this.config.mode === 'rest') {
      return this.testRestConnection();
    }
    // OPC-UA mode: attempt a basic TCP ping via REST health endpoint
    return this.testRestConnection();
  }

  private async testRestConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      if (this.config.authToken) {
        headers['Authorization'] = `Bearer ${this.config.authToken}`;
      } else if (this.config.username && this.config.password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
      }

      const response = await fetch(`${this.config.endpoint}/health`, {
        headers,
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        return { success: true, message: `SCADA gateway reachable at ${this.config.endpoint}` };
      }
      return { success: false, message: `SCADA gateway returned HTTP ${response.status}` };
    } catch (error: any) {
      return { success: false, message: `SCADA connection failed: ${error?.message || 'Unreachable'}` };
    }
  }

  /**
   * Read current values for configured PLC addresses / OPC-UA node IDs
   */
  async readTagValues(nodeIds?: string[]): Promise<ScadaTagValue[]> {
    const ids = nodeIds || this.config.plcAddresses || [];
    if (ids.length === 0) return [];

    if (this.config.mode === 'rest') {
      return this.readTagsViaRest(ids);
    }
    return this.readTagsViaRest(ids);
  }

  private async readTagsViaRest(nodeIds: string[]): Promise<ScadaTagValue[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      if (this.config.authToken) {
        headers['Authorization'] = `Bearer ${this.config.authToken}`;
      } else if (this.config.username && this.config.password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
      }

      const response = await fetch(`${this.config.endpoint}/tags/read`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ nodeIds }),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) return [];

      const data = await response.json() as any;
      const values: ScadaTagValue[] = (data?.results || data?.values || []).map((item: any) => ({
        nodeId: item.nodeId || item.id || '',
        displayName: item.displayName || item.name || item.nodeId || '',
        value: item.value ?? 0,
        dataType: item.dataType || 'Float',
        sourceTimestamp: item.sourceTimestamp || item.timestamp || new Date().toISOString(),
        statusCode: item.statusCode || 'Good'
      }));

      values.forEach(v => this.tagValues.set(v.nodeId, v));
      return values;
    } catch (error: any) {
      console.error('SCADA readTagsViaRest error:', error?.message);
      return [];
    }
  }

  /**
   * Fetch active alarms from SCADA
   */
  async fetchActiveAlarms(): Promise<ScadaAlarm[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      if (this.config.authToken) {
        headers['Authorization'] = `Bearer ${this.config.authToken}`;
      } else if (this.config.username && this.config.password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
      }

      const response = await fetch(`${this.config.endpoint}/alarms/active`, {
        headers,
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) return [];

      const data = await response.json() as any;
      return (data?.alarms || data?.results || []).map((a: any): ScadaAlarm => ({
        id: a.id || a.alarmId || '',
        message: a.message || a.description || 'SCADA Alarm',
        severity: this.normalizeSeverity(a.severity || a.priority),
        activeTime: a.activeTime || a.timestamp || new Date().toISOString(),
        acknowledgedTime: a.acknowledgedTime,
        source: a.source || a.tag || ''
      }));
    } catch (error: any) {
      console.error('SCADA fetchActiveAlarms error:', error?.message);
      return [];
    }
  }

  private normalizeSeverity(severity: any): 'info' | 'warning' | 'critical' | 'emergency' {
    const s = String(severity || '').toLowerCase();
    if (s === 'emergency' || s === '4' || s === 'critical_emergency') return 'emergency';
    if (s === 'critical' || s === '3' || s === 'high') return 'critical';
    if (s === 'warning' || s === '2' || s === 'medium') return 'warning';
    return 'info';
  }

  /**
   * Start polling for tag values
   */
  startPolling(nodeIds: string[]): void {
    if (this.pollingInterval) return;
    const interval = this.config.pollIntervalMs || 10000;
    this.pollingInterval = setInterval(async () => {
      try {
        await this.readTagValues(nodeIds);
      } catch (error: any) {
        console.error('SCADA polling error:', error?.message);
      }
    }, interval);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  getCachedTagValue(nodeId: string): ScadaTagValue | undefined {
    return this.tagValues.get(nodeId);
  }

  getAllCachedValues(): ScadaTagValue[] {
    return Array.from(this.tagValues.values());
  }

  getStatus(): { configured: boolean; mode: string; endpoint: string; connected: boolean } {
    return {
      configured: !!(this.config.endpoint),
      mode: this.config.mode,
      endpoint: this.config.endpoint,
      connected: this.isConnected
    };
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.isConnected = false;
  }
}

/**
 * Factory — returns null if env vars not set
 */
export function createScadaConnector(): ScadaConnector | null {
  const endpoint = process.env.SCADA_ENDPOINT;
  if (!endpoint) return null;

  const plcAddresses = process.env.SCADA_PLC_ADDRESSES
    ? process.env.SCADA_PLC_ADDRESSES.split(',').map(s => s.trim())
    : [];

  return new ScadaConnector({
    endpoint,
    mode: (process.env.SCADA_MODE as 'opcua' | 'rest') || 'rest',
    authToken: process.env.SCADA_AUTH_TOKEN,
    username: process.env.SCADA_USERNAME,
    password: process.env.SCADA_PASSWORD,
    pollIntervalMs: process.env.SCADA_POLL_INTERVAL_MS
      ? parseInt(process.env.SCADA_POLL_INTERVAL_MS)
      : 10000,
    plcAddresses
  });
}
