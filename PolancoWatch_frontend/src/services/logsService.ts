import * as signalR from "@microsoft/signalr";

const LOGS_HUB_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/logshub`
  : 'http://localhost:5246/logshub';

class LogsService {
  private connection: signalR.HubConnection | null = null;
  private currentContainerId: string | null = null;
  private logListener: ((log: string) => void) | null = null;

  public async startLogs(containerId: string, onLogReceived: (log: string) => void) {
    // If already watching this container, just update the listener
    if (this.currentContainerId === containerId && this.connection?.state === signalR.HubConnectionState.Connected) {
      this.logListener = onLogReceived;
      return;
    }

    // Stop previous connection if any
    await this.stopLogs();

    this.currentContainerId = containerId;
    this.logListener = onLogReceived;

    const token = localStorage.getItem('token');
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(LOGS_HUB_URL, {
        accessTokenFactory: () => token || ""
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.on("LogReceived", (logMessage: string) => {
      if (this.logListener) {
        this.logListener(logMessage);
      }
    });

    try {
      await this.connection.start();
      console.log(`Connected to LogsHub for container: ${containerId}`);
      
      // Request logs for the specific container
      await this.connection.invoke("GetContainerLogs", containerId);
    } catch (err) {
      console.error("Error connecting to LogsHub:", err);
      // Notify listener of error
      onLogReceived(`Error connecting to logs: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  public async stopLogs() {
    if (this.connection) {
      try {
        await this.connection.stop();
        console.log("Disconnected from LogsHub");
      } catch (err) {
        console.warn("Error stopping LogsHub connection:", err);
      } finally {
        this.connection = null;
        this.currentContainerId = null;
        this.logListener = null;
      }
    }
  }
}

export const logsService = new LogsService();
