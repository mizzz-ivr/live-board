export const USER_PAGE_TEMPLATE_ASSET_BINARY_STORE_LIMIT_BYTES = 64 * 1024 * 1024;

const DATABASE_NAME = 'live-board-user-page-template-assets';
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = 'assets';

export interface UserPageTemplateAssetPayload {
  readonly assetId: string;
  readonly bytes: Uint8Array;
}

export interface UserPageTemplateAssetPayloadStore {
  get(assetId: string): Promise<Uint8Array | null>;
  putMany(payloads: readonly UserPageTemplateAssetPayload[]): Promise<void>;
  listAssetIds(): Promise<string[]>;
  deleteMany(assetIds: readonly string[]): Promise<void>;
}

interface StoredAssetPayload {
  readonly id: string;
  readonly byteLength: number;
  readonly bytes: ArrayBuffer;
}

let browserStore: UserPageTemplateAssetPayloadStore | null = null;

export function getBrowserUserPageTemplateAssetPayloadStore(): UserPageTemplateAssetPayloadStore {
  if (browserStore === null) browserStore = new IndexedDbUserPageTemplateAssetPayloadStore();
  return browserStore;
}

class IndexedDbUserPageTemplateAssetPayloadStore implements UserPageTemplateAssetPayloadStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async get(assetId: string): Promise<Uint8Array | null> {
    const database = await this.database();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE_NAME, 'readonly');
      const request = transaction.objectStore(OBJECT_STORE_NAME).get(assetId);
      request.onsuccess = () => {
        if (request.result === undefined) {
          resolve(null);
          return;
        }
        try {
          const record = validateStoredPayload(request.result);
          resolve(new Uint8Array(record.bytes.slice(0)));
        } catch (error: unknown) {
          reject(error);
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Assetバイナリの読み込みに失敗しました。'));
    });
  }

  async putMany(payloads: readonly UserPageTemplateAssetPayload[]): Promise<void> {
    if (payloads.length === 0) return;
    const normalized = payloads.map(validatePayloadInput);
    const database = await this.database();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(OBJECT_STORE_NAME);
      const getAllRequest = store.getAll();
      let explicitError: Error | null = null;

      getAllRequest.onsuccess = () => {
        try {
          const existing = new Map<string, StoredAssetPayload>();
          let totalBytes = 0;
          for (const value of getAllRequest.result) {
            const record = validateStoredPayload(value);
            existing.set(record.id, record);
            totalBytes += record.byteLength;
          }

          for (const payload of normalized) {
            const previous = existing.get(payload.assetId);
            totalBytes -= previous?.byteLength ?? 0;
            totalBytes += payload.bytes.byteLength;
            existing.set(payload.assetId, {
              id: payload.assetId,
              byteLength: payload.bytes.byteLength,
              bytes: new Uint8Array(payload.bytes).buffer,
            });
          }

          if (totalBytes > USER_PAGE_TEMPLATE_ASSET_BINARY_STORE_LIMIT_BYTES) {
            explicitError = new Error('マイテンプレートAssetの保存容量が64MiBを超えます。');
            transaction.abort();
            return;
          }

          for (const payload of normalized) {
            store.put({
              id: payload.assetId,
              byteLength: payload.bytes.byteLength,
              bytes: new Uint8Array(payload.bytes).buffer,
            } satisfies StoredAssetPayload);
          }
        } catch (error: unknown) {
          explicitError = asError(error, 'Assetバイナリの保存準備に失敗しました。');
          transaction.abort();
        }
      };
      getAllRequest.onerror = () => {
        explicitError = getAllRequest.error ?? new Error('Assetバイナリの容量確認に失敗しました。');
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(explicitError ?? transaction.error ?? new Error('Assetバイナリの保存に失敗しました。'));
      transaction.onabort = () => reject(explicitError ?? transaction.error ?? new Error('Assetバイナリの保存を中断しました。'));
    });
  }

  async listAssetIds(): Promise<string[]> {
    const database = await this.database();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE_NAME, 'readonly');
      const request = transaction.objectStore(OBJECT_STORE_NAME).getAllKeys();
      request.onsuccess = () => {
        try {
          resolve(request.result.map((key) => {
            if (typeof key !== 'string') throw new Error('不正なAssetバイナリキーを検出しました。');
            return key;
          }));
        } catch (error: unknown) {
          reject(error);
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Assetバイナリ一覧の取得に失敗しました。'));
    });
  }

  async deleteMany(assetIds: readonly string[]): Promise<void> {
    if (assetIds.length === 0) return;
    const database = await this.database();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(OBJECT_STORE_NAME);
      for (const assetId of new Set(assetIds)) store.delete(assetId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Assetバイナリの削除に失敗しました。'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Assetバイナリの削除を中断しました。'));
    });
  }

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise !== null) return this.databasePromise;
    if (typeof globalThis.indexedDB === 'undefined') {
      throw new Error('IndexedDBを利用できないためAsset付きマイテンプレートを保存できません。');
    }

    this.databasePromise = new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(OBJECT_STORE_NAME)) {
          database.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(request.error ?? new Error('Asset用IndexedDBを開けませんでした。'));
      request.onblocked = () => reject(new Error('Asset用IndexedDBの更新が他のウィンドウによりブロックされています。'));
    });
    return this.databasePromise;
  }
}

function validatePayloadInput(payload: UserPageTemplateAssetPayload): UserPageTemplateAssetPayload {
  if (!/^asset:[0-9a-f]{64}$/.test(payload.assetId)) {
    throw new Error(`不正なAsset IDです: ${payload.assetId}`);
  }
  if (!(payload.bytes instanceof Uint8Array) || payload.bytes.byteLength < 1) {
    throw new Error(`不正なAssetバイナリです: ${payload.assetId}`);
  }
  return { assetId: payload.assetId, bytes: new Uint8Array(payload.bytes) };
}

function validateStoredPayload(value: unknown): StoredAssetPayload {
  if (typeof value !== 'object' || value === null) throw new Error('不正なAssetバイナリレコードです。');
  const record = value as Partial<StoredAssetPayload>;
  if (typeof record.id !== 'string' || !/^asset:[0-9a-f]{64}$/.test(record.id)) {
    throw new Error('不正なAssetバイナリIDです。');
  }
  if (!Number.isSafeInteger(record.byteLength) || (record.byteLength ?? 0) < 1) {
    throw new Error('不正なAssetバイナリサイズです。');
  }
  if (!(record.bytes instanceof ArrayBuffer) || record.bytes.byteLength !== record.byteLength) {
    throw new Error('Assetバイナリのサイズが一致しません。');
  }
  return record as StoredAssetPayload;
}

function asError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}
