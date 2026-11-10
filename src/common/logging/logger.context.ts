import { AsyncLocalStorage } from 'async_hooks';

export interface ILogContext {
  traceId?: string;
  userId?: string;
  method?: string;
  path?: string;
  [key: string]: unknown;
}

export type LogContext = ILogContext;

export class LoggerContext {
  private static storage = new AsyncLocalStorage<ILogContext>();

  public static run(context: ILogContext, callback: () => void) {
    this.storage.run(context, callback);
  }

  public static getStore(): ILogContext | undefined {
    return this.storage.getStore();
  }

  public static setStore(store: ILogContext) {
    const current = this.storage.getStore();
    if (current) {
      Object.assign(current, store);
    }
  }

  public static getTraceId(): string | undefined {
    return this.storage.getStore()?.traceId;
  }
}
