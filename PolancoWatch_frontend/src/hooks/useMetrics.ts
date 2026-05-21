import { useState, useEffect } from 'react';
import { signalRService } from '../services/signalr';

export interface DockerContainerMetrics {
    containerId: string;
    name: string;
    image: string;
    status: string;
    state: string;
    cpuPercentage: number;
    memoryUsageBytes: number;
    networkIO: string;
    blockIO: string;
}

export interface CpuMetrics {
    totalUsagePercentage: number;
    coreUsagePercentages: number[];
    loadAverage: number[];
}

export interface MemoryMetrics {
    totalRamBytes: number;
    usedRamBytes: number;
    freeRamBytes: number;
    usagePercentage: number;
}

export interface DockerStats {
    totalContainers: number;
    runningContainers: number;
    stoppedContainers: number;
    totalImages: number;
}

export interface ServerMetricsSnapshot {
    cpu: CpuMetrics;
    memory: MemoryMetrics;
    disks: any[];
    networks: any[];
    systemInfo: any;
    topProcesses: any[];
    dockerContainers: DockerContainerMetrics[];
    dockerStats: DockerStats;
    timestampUtc: string;
}

export interface DataPoint {
    timestamp: Date;
    value: number;
}

export const useMetrics = () => {
    const [metrics, setMetrics] = useState<ServerMetricsSnapshot | null>(null);
    const [alerts, setAlerts] = useState<string[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    // Chart Data Arrays
    const [cpuHistory, setCpuHistory] = useState<DataPoint[]>([]);
    const [memoryHistory, setMemoryHistory] = useState<DataPoint[]>([]);
    const [networkInHistory, setNetworkInHistory] = useState<DataPoint[]>([]);
    const [networkOutHistory, setNetworkOutHistory] = useState<DataPoint[]>([]);

    useEffect(() => {
        let mounted = true;

        const onMetrics = (newMetrics: ServerMetricsSnapshot) => {
            if (mounted) {
                setMetrics(newMetrics);
                setIsConnected(true);

                const now = new Date();
                setCpuHistory(prev => [...prev, { timestamp: now, value: newMetrics.cpu?.totalUsagePercentage || 0 }].slice(-30));
                setMemoryHistory(prev => [...prev, { timestamp: now, value: newMetrics.memory?.usagePercentage || 0 }].slice(-30));
                
                if (newMetrics.networks && newMetrics.networks.length > 0) {
                    const net = newMetrics.networks[0];
                    setNetworkInHistory(prev => [...prev, { timestamp: now, value: (net.incomingBytesPerSecond || 0) / 1024 / 1024 }].slice(-30));
                    setNetworkOutHistory(prev => [...prev, { timestamp: now, value: (net.outgoingBytesPerSecond || 0) / 1024 / 1024 }].slice(-30));
                }
            }
        };

        const onAlert = (alert: string) => {
            if (mounted) {
                setAlerts(prev => [alert, ...prev].slice(0, 50));
            }
        };

        const init = async () => {
            try {
                await signalRService.connect(onMetrics, onAlert);
                if (mounted) setIsConnected(true);
            } catch (err) {
                if (mounted) setIsConnected(false);
            }
        };

        init();

        return () => {
            mounted = false;
            setIsConnected(false);
            signalRService.disconnect(onMetrics, onAlert);
        };
    }, []);

    return {
        metrics,
        alerts,
        isConnected,
        cpuHistory,
        memoryHistory,
        networkInHistory,
        networkOutHistory
    };
};
