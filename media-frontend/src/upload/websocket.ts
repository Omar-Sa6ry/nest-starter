import type { MediaWsEvent, MediaStatus } from './types';
import { WS_EVENT_TO_STATUS } from './types';

function resolveSseURL(): string {
  const configured = import.meta.env.VITE_MEDIA_SSE_URL as string | undefined;
  if (configured) return configured;
  if (typeof window === 'undefined') return 'http://localhost:3000/media/events';
  const scheme = window.location.protocol;
  const host = window.location.hostname;
  return `${scheme}//${host}:3000/media/events`;
}

const SSE_URL = resolveSseURL();

export type MediaWsListener = (event: MediaWsEvent) => void;
export type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';
export type ConnectionStateListener = (state: ConnectionState) => void;

export class MediaEventSourceClient {
  private eventSource: EventSource | null = null;
  private token: string | null = null;
  private listeners = new Set<MediaWsListener>();
  private stateListeners = new Set<ConnectionStateListener>();
  private shouldReconnect = false;
  private reconnectAttempt = 0;
  private _state: ConnectionState = 'DISCONNECTED';

  get connectionState(): ConnectionState {
    return this._state;
  }

  connect(token?: string | null): void {
    if (this.eventSource && this._state !== 'DISCONNECTED') return;
    this.token = token || null;
    this.shouldReconnect = true;
    this.reconnectAttempt = 0;
    this.open();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.eventSource?.close();
    this.eventSource = null;
    this.setState('DISCONNECTED');
  }

  onEvent(listener: MediaWsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStateChange(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this._state);
    return () => this.stateListeners.delete(listener);
  }

  private setState(s: ConnectionState): void {
    if (this._state === s) return;
    this._state = s;
    this.stateListeners.forEach((l) => l(s));
  }

  private open(): void {
    this.setState('CONNECTING');
    const url = this.token ? `${SSE_URL}?token=${encodeURIComponent(this.token)}` : SSE_URL;
    const es = new EventSource(url);
    this.eventSource = es;

    es.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState('CONNECTED');
    };

    es.onmessage = (msg) => {
      this.handleRawMessage(msg.data);
    };

    es.addEventListener('media_update', (msg: MessageEvent) => {
      this.handleRawMessage(msg.data);
    });

    es.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;
      this.setState('DISCONNECTED');
      if (this.shouldReconnect) this.scheduleReconnect();
    };
  }

  private handleRawMessage(rawData: string): void {
    try {
      const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      // Map SSE event payload into MediaWsEvent format expected by components
      const status = parsed.status || 'PROCESSING';
      let eventType: MediaWsEvent['event'] = 'PROCESSING_PROGRESS';
      if (status === 'READY') {
        eventType = 'READY';
      } else if (status === 'FAILED') {
        eventType = 'PROCESSING_FAILED';
      } else if (status === 'UPLOADING') {
        eventType = 'PROCESSING_STARTED';
      }

      const event: MediaWsEvent = {
        event: eventType,
        mediaId: parsed.mediaId,
        stage: parsed.message || status,
        progress: parsed.progressPercent ?? 0,
      };
      this.emit(event);
    } catch {
      // ignore malformed payloads
    }
  }

  private scheduleReconnect(): void {
    const base = Math.min(30000, 1000 * 2 ** this.reconnectAttempt);
    const delay = base / 2 + Math.random() * (base / 2);
    this.reconnectAttempt += 1;
    setTimeout(() => {
      if (this.shouldReconnect) this.open();
    }, delay);
  }

  private emit(event: MediaWsEvent): void {
    this.listeners.forEach((l) => l(event));
  }

  static statusOf(event: MediaWsEvent): MediaStatus | null {
    return WS_EVENT_TO_STATUS[event.event] ?? null;
  }
}

export const mediaSocket = new MediaEventSourceClient();
