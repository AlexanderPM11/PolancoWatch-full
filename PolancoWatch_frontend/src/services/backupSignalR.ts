import * as signalR from "@microsoft/signalr";

const HUB_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/backuphub`
  : 'http://localhost:5246/backuphub';

class BackupSignalRService {
  private connection: signalR.HubConnection | null = null;
  private progressListeners: Set<(backupId: string, percentage: number, message: string) => void> = new Set();

  private ensureConnection() {
    if (this.connection) return this.connection;

    const token = localStorage.getItem('token');
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token || ""
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on("ReceiveBackupProgress", (backupId, percentage, message) => {
      this.progressListeners.forEach(l => l(backupId, percentage, message));
    });

    return this.connection;
  }

  public async connect(onProgress: (id: string, p: number, m: string) => void) {
    this.progressListeners.add(onProgress);
    const conn = this.ensureConnection();

    if (conn.state === signalR.HubConnectionState.Connected) return;

    try {
      await conn.start();
    } catch (err) {
      console.error("Backup SignalR Connection Error:", err);
    }
  }

  public disconnect(onProgress: (id: string, p: number, m: string) => void) {
    this.progressListeners.delete(onProgress);
    if (this.progressListeners.size === 0 && this.connection) {
      this.connection.stop();
      this.connection = null;
    }
  }
}

export const backupSignalRService = new BackupSignalRService();
