/**
 * IBM Maximo Connector
 * Integrates with IBM Maximo Asset Management via REST API
 * Activated when MAXIMO_BASE_URL, MAXIMO_USERNAME, MAXIMO_PASSWORD are set
 */

export interface MaximoConfig {
  baseUrl: string;
  username: string;
  password: string;
  maxvarName?: string;
}

export interface MaximoWorkOrder {
  wonum: string;
  description: string;
  status: string;
  priority: number;
  assetnum?: string;
  location?: string;
  reportdate?: string;
  targstartdate?: string;
  targcompdate?: string;
  actlabhrs?: number;
}

export interface MaximoAsset {
  assetnum: string;
  description: string;
  assettype?: string;
  siteid?: string;
  location?: string;
  manufacturer?: string;
  modelnum?: string;
  serialnum?: string;
  installdate?: string;
}

export class MaximoConnector {
  private config: MaximoConfig;
  private csrfToken: string | null = null;
  private sessionCookie: string | null = null;

  constructor(config: MaximoConfig) {
    this.config = config;
  }

  /**
   * Test connection to Maximo
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/maximo/oslc/whoami`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json() as any;
        return { success: true, message: `Connected to Maximo as ${data?.displayName || this.config.username}` };
      }
      return { success: false, message: `Maximo returned HTTP ${response.status}` };
    } catch (error: any) {
      return { success: false, message: `Maximo connection failed: ${error?.message || 'Unknown error'}` };
    }
  }

  /**
   * Authenticate and retrieve session token
   */
  private async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/maximo/j_security_check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `j_username=${encodeURIComponent(this.config.username)}&j_password=${encodeURIComponent(this.config.password)}`,
        redirect: 'manual',
        signal: AbortSignal.timeout(10000)
      });

      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.sessionCookie = setCookie.split(';')[0];
      }

      const csrfResponse = await fetch(`${this.config.baseUrl}/maximo/oslc/os/mxwo?lean=1&oslc.pageSize=1`, {
        headers: {
          'Cookie': this.sessionCookie || '',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });

      const maxcsrf = csrfResponse.headers.get('x-public-maxauth-token') || csrfResponse.headers.get('x-csrf-token');
      if (maxcsrf) {
        this.csrfToken = maxcsrf;
      }

      return response.status === 302 || response.status === 200;
    } catch (error: any) {
      console.error('Maximo authentication error:', error?.message);
      return false;
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    } else {
      headers['Authorization'] = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
    }

    if (this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }

    return headers;
  }

  /**
   * Fetch work orders from Maximo
   */
  async fetchWorkOrders(params: { limit?: number; status?: string; since?: string } = {}): Promise<MaximoWorkOrder[]> {
    try {
      let query = `${this.config.baseUrl}/maximo/oslc/os/mxwo?lean=1&oslc.pageSize=${params.limit || 50}`;

      const filters: string[] = [];
      if (params.status) filters.push(`status="${params.status}"`);
      if (params.since) filters.push(`reportdate>="${params.since}"`);
      if (filters.length > 0) {
        query += `&oslc.where=${encodeURIComponent(filters.join(' and '))}`;
      }

      query += '&oslc.properties=wonum,description,status,priority,assetnum,location,reportdate,targstartdate,targcompdate,actlabhrs';

      const response = await fetch(query, {
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      return (data?.member || []) as MaximoWorkOrder[];
    } catch (error: any) {
      console.error('Maximo fetchWorkOrders error:', error?.message);
      return [];
    }
  }

  /**
   * Fetch assets from Maximo
   */
  async fetchAssets(params: { limit?: number; siteid?: string } = {}): Promise<MaximoAsset[]> {
    try {
      let query = `${this.config.baseUrl}/maximo/oslc/os/mxasset?lean=1&oslc.pageSize=${params.limit || 50}`;

      if (params.siteid) {
        query += `&oslc.where=${encodeURIComponent(`siteid="${params.siteid}"`)}`;
      }

      query += '&oslc.properties=assetnum,description,assettype,siteid,location,manufacturer,modelnum,serialnum,installdate';

      const response = await fetch(query, {
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as any;
      return (data?.member || []) as MaximoAsset[];
    } catch (error: any) {
      console.error('Maximo fetchAssets error:', error?.message);
      return [];
    }
  }

  /**
   * Push a work order status update to Maximo
   */
  async updateWorkOrderStatus(wonum: string, newStatus: string): Promise<boolean> {
    try {
      const url = `${this.config.baseUrl}/maximo/oslc/os/mxwo/${wonum}?lean=1`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...this.getAuthHeaders(),
          'x-method-override': 'PATCH'
        },
        body: JSON.stringify({ status: newStatus }),
        signal: AbortSignal.timeout(10000)
      });

      return response.ok;
    } catch (error: any) {
      console.error('Maximo updateWorkOrderStatus error:', error?.message);
      return false;
    }
  }

  getStatus(): { configured: boolean; baseUrl: string } {
    return {
      configured: !!(this.config.baseUrl && this.config.username && this.config.password),
      baseUrl: this.config.baseUrl
    };
  }
}

/**
 * Factory — returns null if env vars not set
 */
export function createMaximoConnector(): MaximoConnector | null {
  const baseUrl = process.env.MAXIMO_BASE_URL;
  const username = process.env.MAXIMO_USERNAME;
  const password = process.env.MAXIMO_PASSWORD;

  if (!baseUrl || !username || !password) {
    return null;
  }

  return new MaximoConnector({
    baseUrl,
    username,
    password,
    maxvarName: process.env.MAXIMO_MAXVAR_NAME || 'MAINTRIX'
  });
}
