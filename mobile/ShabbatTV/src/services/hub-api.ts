// Hub API client - communicates with the local Shabbat Hub (Raspberry Pi / Docker)

export interface HubDevice {
  id: number;
  name: string;
  address: string;
  identifier: string;
  device_type?: 'appletv' | 'chromecast' | 'androidtv' | 'firetv' | 'roku' | 'samsung' | 'lg';
  has_credentials: boolean;
  paired_at: string;
  last_seen: string | null;
  script_running: boolean;
  pid: number | null;
  select_count: number;
  error_count: number;
  last_log_time: string | null;
}

export interface ScanResult {
  name: string;
  address: string;
  identifier: string;
  protocols: string[];
}

export class HubAPI {
  private baseUrl: string;

  constructor(hubIp: string, port: number = 8080) {
    this.baseUrl = `http://${hubIp}:${port}`;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`Hub API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Device management
  async getDevices(): Promise<HubDevice[]> {
    return this.request('/api/devices');
  }

  async scanNetwork(): Promise<ScanResult[]> {
    return this.request('/api/scan');
  }

  async startPairing(identifier: string, name: string): Promise<{ session_id: string; status: string }> {
    return this.request('/api/pair/start', {
      method: 'POST',
      body: JSON.stringify({ identifier, name }),
    });
  }

  async sendPIN(sessionId: string, pin: string): Promise<{ status: string; device_id?: number }> {
    return this.request('/api/pair/pin', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, pin }),
    });
  }

  async cancelPairing(sessionId: string): Promise<void> {
    await this.request('/api/pair/cancel', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  }

  // Script control
  async startScript(deviceId: number, autoShabbat: boolean = false): Promise<{ pid: number }> {
    return this.request(`/api/script/start/${deviceId}`, {
      method: 'POST',
      body: JSON.stringify({ auto_shabbat: autoShabbat }),
    });
  }

  async stopScript(deviceId: number): Promise<{ stopped: boolean }> {
    return this.request(`/api/script/stop/${deviceId}`, {
      method: 'POST',
    });
  }

  // Device settings
  async renameDevice(deviceId: number, name: string): Promise<void> {
    await this.request(`/api/device/rename/${deviceId}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteDevice(deviceId: number): Promise<void> {
    await this.request(`/api/device/delete/${deviceId}`, {
      method: 'POST',
    });
  }

  async toggleDevice(deviceId: number): Promise<void> {
    await this.request(`/api/device/toggle/${deviceId}`, {
      method: 'POST',
    });
  }

  // Playback
  async getPlaybackState(deviceId: number): Promise<{ state: string; title?: string }> {
    return this.request(`/api/playback/${deviceId}`);
  }

  async sendCommand(deviceId: number, command: string): Promise<void> {
    await this.request(`/api/command/${deviceId}`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  }

  // Shabbat info
  async getShabbatTimes(): Promise<any> {
    return this.request('/api/shabbat');
  }

  // History & stats
  async getHistory(): Promise<any> {
    return this.request('/api/history');
  }

  // Settings
  async getSettings(): Promise<Record<string, string>> {
    return this.request('/api/settings');
  }

  async updateSettings(settings: Record<string, string>): Promise<void> {
    await this.request('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // WebSocket connection for realtime logs
  createWebSocket(): WebSocket {
    const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
    return new WebSocket(wsUrl);
  }
}
