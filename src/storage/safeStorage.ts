/**
 * localStorage への薄いラッパー。
 * - localStorage が使えない環境（プライベートモード等）でも例外で止まらない
 * - テストからはメモリ実装を差し込める
 */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** ブラウザの localStorage。使えない場合はメモリ実装へ落とす。 */
export function createBrowserStore(): KeyValueStore {
  try {
    const probe = '__kotoba_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    const storage = globalThis.localStorage;
    return {
      getItem: (key) => {
        try {
          return storage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          storage.setItem(key, value);
        } catch {
          /* 容量超過などは黙って無視し、ゲーム進行は止めない */
        }
      },
      removeItem: (key) => {
        try {
          storage.removeItem(key);
        } catch {
          /* 同上 */
        }
      },
    };
  } catch {
    return createMemoryStore();
  }
}
