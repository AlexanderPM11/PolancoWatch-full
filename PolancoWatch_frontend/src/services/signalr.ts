import * as signalR from "@microsoft/signalr";

const HUB_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/metricshub`
  : 'http://localhost:5246/metricshub';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private metricsListeners: Set<(metrics: any) => void> = new Set();
  private alertListeners: Set<(message: string) => void> = new Set();

  private ensureConnection() {
    if (this.connection) return this.connection;

    const token = localStorage.getItem('token');
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token || ""
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on("ReceiveMetrics", (metrics) => {
      this.metricsListeners.forEach(l => l(metrics));
    });

    this.connection.on("ReceiveAlert", (msg) => {
      this.alertListeners.forEach(l => l(msg));
    });

    return this.connection;
  }

  public async connect(onMetrics: (m: any) => void, onAlert: (a: string) => void) {
    this.metricsListeners.add(onMetrics);
    this.alertListeners.add(onAlert);

    const conn = this.ensureConnection();

    if (conn.state === signalR.HubConnectionState.Connected) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = conn.start()
      .then(() => {
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error("SignalR Connection Error:", err);
        }
        throw err;
      })
      .finally(() => {
        this.startPromise = null;
      });

    return this.startPromise;
  }

  public async disconnect(onMetrics: (m: any) => void, onAlert: (a: string) => void) {
    this.metricsListeners.delete(onMetrics);
    this.alertListeners.delete(onAlert);

    if (this.metricsListeners.size === 0 && this.alertListeners.size === 0 && this.connection) {
      const conn = this.connection;
      // Delay stop slightly to handle rapid React re-mounts without AbortError
      setTimeout(async () => {
        if (this.metricsListeners.size === 0 && this.alertListeners.size === 0 && conn.state !== signalR.HubConnectionState.Disconnected) {
          try {
            await conn.stop();
            if (this.connection === conn) this.connection = null;
          } catch (e) {
            console.warn("Error stopping SignalR:", e);
          }
        }
      }, 1000);
    }
  }
}

export const signalRService = new SignalRService();
