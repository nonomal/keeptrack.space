/**
 * Storage Provider Interface
 *
 * All storage implementations (LocalStorage, D1, WebSocket, etc.) must implement this interface.
 * Adapted from Signal Range's sync module for KeepTrack's key-value persistence model.
 */

export interface StorageProvider {
  /** Initialize the provider (establish connections, load initial state, etc.) */
  initialize(): Promise<void>;

  /** Read all key-value pairs from storage */
  readAll(): Promise<Map<string, string>>;

  /** Read a single key from storage */
  read(key: string): Promise<string | null>;

  /** Write a single key-value pair to storage */
  write(key: string, value: string): Promise<void>;

  /** Write multiple key-value pairs to storage (batch) */
  writeBatch(entries: Map<string, string>): Promise<void>;

  /** Remove a key from storage */
  remove(key: string): Promise<void>;

  /** Clear all stored data */
  clear(): Promise<void>;

  /**
   * Subscribe to changes from external sources (other tabs, server push, etc.)
   * Returns an unsubscribe function.
   */
  subscribe(callback: (key: string, value: string | null) => void): () => void;

  /** Check if the provider is currently connected/available */
  isConnected(): boolean;

  /** Clean up resources (close connections, remove listeners, etc.) */
  dispose(): Promise<void>;
}

/** Configuration options for storage providers */
export interface StorageProviderConfig {
  onError?: (error: Error) => void;
  onReconnect?: () => void;
  syncInterval?: number;
  autoSync?: boolean;
}
