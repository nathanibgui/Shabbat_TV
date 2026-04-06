/**
 * useHubWebSocket — Real-time connection to Hub WebSocket
 * Auto-connects, reconnects with exponential backoff, updates Zustand store
 */
import { useEffect, useRef, useCallback } from 'react';
import { useStore } from './useStore';
import { HubAPI } from '../services/hub-api';

interface WSMessage {
  type: 'log' | 'event' | 'state' | 'device_update';
  device_id?: number;
  data?: any;
  message?: string;
  timestamp?: string;
}

export function useHubWebSocket() {
  const { hubIp, setHubStatus, setDevices, updateDevice } = useStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const isMounted = useRef(true);

  const connect = useCallback(() => {
    if (!hubIp || !isMounted.current) return;

    try {
      const hub = new HubAPI(hubIp);
      const ws = hub.createWebSocket();
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted.current) return;
        setHubStatus('online');
        reconnectDelay.current = 1000; // Reset backoff on successful connect
      };

      ws.onmessage = (event) => {
        if (!isMounted.current) return;
        try {
          const msg: WSMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch {
          // Non-JSON message, ignore
        }
      };

      ws.onerror = () => {
        if (!isMounted.current) return;
        setHubStatus('offline');
      };

      ws.onclose = () => {
        if (!isMounted.current) return;
        setHubStatus('offline');
        wsRef.current = null;
        scheduleReconnect();
      };
    } catch {
      setHubStatus('offline');
      scheduleReconnect();
    }
  }, [hubIp]);

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case 'device_update':
        // Hub sends updated device list or single device update
        if (msg.data?.devices) {
          setDevices(msg.data.devices);
        } else if (msg.device_id && msg.data) {
          updateDevice(msg.device_id, msg.data);
        }
        break;

      case 'state':
        // Playback state change for a device
        if (msg.device_id && msg.data) {
          updateDevice(msg.device_id, {
            script_running: msg.data.script_running,
            select_count: msg.data.select_count,
          });
        }
        break;

      case 'event':
      case 'log':
        // Could store logs in state if needed for a log viewer
        break;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!isMounted.current) return;
    setHubStatus('connecting');
    reconnectTimeout.current = setTimeout(() => {
      // Exponential backoff: 1s → 2s → 4s → 8s → max 30s
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
      connect();
    }, reconnectDelay.current);
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (hubIp) {
      connect();
    }
    return () => {
      isMounted.current = false;
      disconnect();
    };
  }, [hubIp]);

  return { disconnect, reconnect: connect };
}
