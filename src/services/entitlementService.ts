/**
 * 課金の境界だけを用意しておく。今回は課金機能を実装しない。
 * 将来 StoreKit / Capacitor 側の実装へ差し替える前提の仮実装で、
 * Web 試作では常に無料状態を返す。
 */

export type EntitlementListener = (isPremium: boolean) => void;

export interface EntitlementService {
  isPremium(): boolean;
  restorePurchases(): Promise<boolean>;
  /** 変更通知を購読する。戻り値を呼ぶと購読解除。 */
  observeEntitlementChanges(listener: EntitlementListener): () => void;
}

/** Web 試作用。常に無料状態。購入画面も決済も持たない。 */
export class FreeTierEntitlementService implements EntitlementService {
  private readonly listeners = new Set<EntitlementListener>();

  isPremium(): boolean {
    return false;
  }

  async restorePurchases(): Promise<boolean> {
    return false;
  }

  observeEntitlementChanges(listener: EntitlementListener): () => void {
    this.listeners.add(listener);
    listener(this.isPremium());
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export function createEntitlementService(): EntitlementService {
  return new FreeTierEntitlementService();
}
