export class HardwareClient {
  constructor() { this.closeToken = null; }
  async request(route, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('http://127.0.0.1:8788' + route, {
        method: body ? 'POST' : 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Hardware action was not confirmed.');
      return data;
    } catch (error) {
      if(error instanceof TypeError || error?.name === 'AbortError')throw new Error('Hardware bridge is unavailable. Start Start-PassHardware.cjs and allow local-network access if the browser asks.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async status() { return this.request('/status'); }
  async open(receipt) {
    if (!receipt) throw new Error('PASS recorded the result but supplied no hardware approval. Install the backend update before retrying a new transaction.');
    const result = await this.request('/open', { receipt });
    if (!result.acknowledged) throw new Error('ESP32 did not acknowledge OPEN.');
    this.closeToken = result.close_token;
    return result;
  }
  async close() {
    if (!this.closeToken) throw new Error('Close from the window that opened the barrier, or type C in the hardware PowerShell window after checking the path.');
    return this.request('/close', { close_token: this.closeToken });
  }
}
