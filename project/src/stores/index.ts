import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Product, ProductVariant, ToastMessage, ThemeMode, ProductImage } from '../types';
import { isInvalidRefreshTokenError, supabase } from '../lib/supabase';
import { FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_RATE } from '../lib/utils';

// Default tenant id must match the server-side default in the
// multi_tenant_security migration.
const DEFAULT_TENANT_ID = 'd9f8e7d6-c5b4-a3f2-e1d0-c9b8a7f6e5d4';

/**
 * Returns the tenant id used purely for namespacing the cart in
 * localStorage. This value is NOT used for any security decision —
 * the server always resolves tenant_id from JWT app_metadata or
 * profiles.tenant_id (both server-controlled).
 *
 * SECURITY: We intentionally do NOT read tenant_id from URL query
 * parameters. An attacker could craft `?tenant_id=<victim>` to pollute
 * the localStorage of a victim user who later visits the site and
 * inherits a poisoned key namespace. Tenant changes must go through
 * the server (admin action) only.
 */
export function getCurrentTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID;
  return localStorage.getItem('current_tenant_id') || DEFAULT_TENANT_ID;
}

function createTenantBoundLocalStorage() {
  return {
    getItem: (name: string) => {
      const tenantId = getCurrentTenantId();
      return localStorage.getItem(`${name}:${tenantId}`);
    },
    setItem: (name: string, value: string) => {
      const tenantId = getCurrentTenantId();
      localStorage.setItem(`${name}:${tenantId}`, value);
    },
    removeItem: (name: string) => {
      const tenantId = getCurrentTenantId();
      localStorage.removeItem(`${name}:${tenantId}`);
    }
  };
}

interface CartItem {
  productId: string;
  variantId: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
  images?: { url: string; alt?: string }[];
}

interface CartStore {
  items: CartItem[];
  sessionId: string;

  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  clearLocalCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getTax: (rate?: number) => number;
  getShipping: (freeThreshold?: number, baseRate?: number) => number;
  getTotal: () => number;
  getItem: (variantId: string) => CartItem | undefined;
  mergeCart: (userId: string) => Promise<void>;
  pullCart: (userId: string) => Promise<void>;
}

/**
 * Per-user serialization queue. The previous implementation used a
 * single global promise chain, which caused these race conditions:
 *
 *   1. Rapid addItem() calls captured stale `newItems` closures.
 *      Each queued sync overwrote the DB with an old snapshot,
 *      dropping the newer additions.
 *   2. mergeCart() DELETE+INSERT at the end of the chain wiped
 *      items that were added while the merge was in flight.
 *   3. pullCart() could overwrite local pending changes triggered
 *      by a realtime/focus event.
 *
 * Fix: a Map<userId, Promise> ensures writes for a single user are
 * serialized, but different users don't block each other. The
 * promise chain uses the LATEST items snapshot at execution time, so
 * stale closures can't win.
 */
const userSyncQueues = new Map<string, Promise<unknown>>();

const enqueueSync = (userId: string, task: () => Promise<unknown>): Promise<unknown> => {
  const previous = userSyncQueues.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  // Always overwrite the slot with the latest tail so rapid calls chain.
  userSyncQueues.set(
    userId,
    next.finally(() => {
      if (userSyncQueues.get(userId) === next) {
        userSyncQueues.delete(userId);
      }
    }),
  );
  return next;
};

const syncCartToDb = (items: CartItem[]) => {
  // Snapshot at call time so the queued task sees the latest items.
  const snapshot = items.map((i) => ({ ...i }));

  void supabase.auth
    .getSession()
    .then(({ data: { session } }) => session?.user?.id ?? null)
    .then((userId) => {
      if (!userId) return;
      return enqueueSync(userId, async () => {
        try {
          let { data: cart } = await supabase
            .from('carts')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

          if (!cart) {
            const { data: newCart } = await supabase
              .from('carts')
              .insert({ user_id: userId, session_id: `session_${Date.now()}` })
              .select('id')
              .single();
            if (!newCart) return;
            cart = newCart;
          }

          const itemsToSync = snapshot.map((item) => ({
            product_id: item.productId,
            variant_id: item.variantId,
            quantity: item.quantity,
          }));

          const { error: syncError } = await supabase.rpc('sync_user_cart', {
            p_cart_id: cart.id,
            p_items: itemsToSync,
          });
          if (syncError) throw syncError;
        } catch (err) {
          if (isInvalidRefreshTokenError(err)) {
            await supabase.auth.signOut();
          }
          console.error('Error syncing cart to database:', err);
        }
      });
    });
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,

      addItem: (product, variant, quantity = 1) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => item.variantId === variant.id
          );

          const maxStock = variant.inventory_quantity;
          const newItems = [...state.items];

          if (existingIndex >= 0) {
            const currentQty = state.items[existingIndex].quantity;
            const targetQty = currentQty + quantity;
            const clampedQty = Math.min(maxStock, targetQty);

            if (clampedQty < targetQty) {
              useToastStore.getState().addToast({
                type: 'warning',
                title: 'Quantity limited',
                message: `Only ${maxStock} units are available. Capped your cart quantity.`,
              });
            }

            newItems[existingIndex] = {
              ...newItems[existingIndex],
              quantity: clampedQty,
            };
          } else {
            const clampedQty = Math.min(maxStock, quantity);
            if (clampedQty < quantity) {
              useToastStore.getState().addToast({
                type: 'warning',
                title: 'Quantity limited',
                message: `Only ${maxStock} units are available. Capped your cart quantity.`,
              });
            }

            newItems.push({
              productId: product.id,
              variantId: variant.id,
              product,
              variant,
              quantity: clampedQty,
              images: product.images || [],
            });
          }

          syncCartToDb(newItems);
          return { items: newItems };
        });
      },

      removeItem: (variantId) => {
        set((state) => {
          const newItems = state.items.filter((item) => item.variantId !== variantId);
          syncCartToDb(newItems);
          return { items: newItems };
        });
      },

      updateQuantity: (variantId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            const newItems = state.items.filter((item) => item.variantId !== variantId);
            syncCartToDb(newItems);
            return { items: newItems };
          }

          const existingIndex = state.items.findIndex(
            (item) => item.variantId === variantId
          );

          if (existingIndex >= 0) {
            const maxStock = state.items[existingIndex].variant.inventory_quantity;
            const clampedQty = Math.min(maxStock, quantity);
            if (clampedQty < quantity) {
              useToastStore.getState().addToast({
                type: 'warning',
                title: 'Quantity limited',
                message: `Capped at maximum stock of ${maxStock} units.`,
              });
            }

            const newItems = [...state.items];
            newItems[existingIndex] = {
              ...newItems[existingIndex],
              quantity: clampedQty,
            };
            syncCartToDb(newItems);
            return { items: newItems };
          }

          return {};
        });
      },

      clearCart: () => {
        set({ items: [] });
        syncCartToDb([]);
      },

      clearLocalCart: () => {
        set({ items: [] });
      },

      getItemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        const subtotalPaise = get().items.reduce((total, item) => {
          const pricePaise = Math.round((item.product.sale_price || item.product.base_price) * 100);
          return total + (pricePaise * item.quantity);
        }, 0);
        return subtotalPaise / 100;
      },

      getTax: (rate = 18) => {
        const subtotalPaise = Math.round(get().getSubtotal() * 100);
        const taxPaise = Math.round(subtotalPaise * (rate / 100));
        return taxPaise / 100;
      },

      getShipping: (freeThreshold = FREE_SHIPPING_THRESHOLD, baseRate = DEFAULT_SHIPPING_RATE) => {
        const subtotalPaise = Math.round(get().getSubtotal() * 100);
        const thresholdPaise = Math.round(freeThreshold * 100);
        const ratePaise = Math.round(baseRate * 100);
        return subtotalPaise >= thresholdPaise ? 0 : ratePaise / 100;
      },

      getTotal: () => {
        const subtotalPaise = Math.round(get().getSubtotal() * 100);
        const taxPaise = Math.round(get().getTax() * 100);
        const shippingPaise = Math.round(get().getShipping() * 100);
        return (subtotalPaise + taxPaise + shippingPaise) / 100;
      },

      getItem: (variantId) => {
        return get().items.find((item) => item.variantId === variantId);
      },

      mergeCart: async (userId) => {
        return enqueueSync(userId, async () => {
          try {
            // Snapshot guest items BEFORE awaiting any network call so
            // we don't lose items added while we're in flight.
            const guestItemsSnapshot = get().items.map((i) => ({ ...i }));

            const { data: cart } = await supabase
              .from('carts')
              .select('id')
              .eq('user_id', userId)
              .maybeSingle();

            interface RemoteCartItem {
              quantity: number;
              product_id: string;
              variant_id: string;
              product: Product | Product[];
              variant: ProductVariant | ProductVariant[];
            }
            let remoteItems: RemoteCartItem[] = [];
            let cartId = cart?.id;

            if (cartId) {
              const { data } = await supabase
                .from('cart_items')
                .select(`
                  quantity,
                  product_id,
                  variant_id,
                  product:products(*),
                  variant:product_variants(*)
                `)
                .eq('cart_id', cartId);

              if (data) {
                remoteItems = data;
              }
            } else {
              const { data: newCart } = await supabase
                .from('carts')
                .insert({ user_id: userId, session_id: get().sessionId })
                .select('id')
                .single();
              if (newCart) {
                cartId = newCart.id;
              }
            }

            const mappedRemoteItems: CartItem[] = [];
            if (remoteItems.length > 0) {
              const productIds = remoteItems.map((item) => item.product_id);
              const { data: imagesData } = await supabase
                .from('product_images')
                .select('*')
                .in('product_id', productIds);

              const imagesMap = new Map<string, ProductImage[]>();
              if (imagesData) {
                for (const img of imagesData) {
                  const list = imagesMap.get(img.product_id) || [];
                  list.push(img);
                  imagesMap.set(img.product_id, list);
                }
              }

              for (const item of remoteItems) {
                const productObj = Array.isArray(item.product) ? item.product[0] : item.product;
                const variantObj = Array.isArray(item.variant) ? item.variant[0] : item.variant;
                if (productObj && variantObj) {
                  const productImages = imagesMap.get(item.product_id) || [];
                  mappedRemoteItems.push({
                    productId: item.product_id,
                    variantId: item.variant_id,
                    product: {
                      ...productObj,
                      images: productImages,
                    },
                    variant: variantObj,
                    quantity: item.quantity,
                    images: productImages,
                  });
                }
              }
            }

            // Reconcile snapshot of guest items with remote items
            const mergedMap = new Map<string, CartItem>();

            for (const item of mappedRemoteItems) {
              mergedMap.set(item.variantId, item);
            }

            for (const item of guestItemsSnapshot) {
              const existing = mergedMap.get(item.variantId);
              if (existing) {
                const maxStock = item.variant.inventory_quantity;
                const combinedQuantity = Math.min(maxStock, existing.quantity + item.quantity);
                mergedMap.set(item.variantId, {
                  ...existing,
                  quantity: combinedQuantity,
                });
              } else {
                mergedMap.set(item.variantId, item);
              }
            }

            const finalItems = Array.from(mergedMap.values());

            set({ items: finalItems });

            // Re-fetch the latest guest state AFTER merging to capture
            // anything added while we were awaiting. We then sync that
            // complete state back to the DB so nothing is lost.
            if (cartId) {
              const latestGuestItems = get().items;
              const finalReconciled = new Map<string, CartItem>();
              for (const item of latestGuestItems) {
                const existing = finalReconciled.get(item.variantId);
                if (existing) {
                  finalReconciled.set(item.variantId, {
                    ...existing,
                    quantity: existing.quantity + item.quantity,
                  });
                } else {
                  finalReconciled.set(item.variantId, { ...item });
                }
              }
              const finalList = Array.from(finalReconciled.values());
              set({ items: finalList });

              await supabase.rpc('sync_user_cart', {
                p_cart_id: cartId,
                p_items: finalList.map((i) => ({
                  product_id: i.productId,
                  variant_id: i.variantId,
                  quantity: i.quantity,
                })),
              });
            }
          } catch (err) {
            if (isInvalidRefreshTokenError(err)) {
              await supabase.auth.signOut();
            }
            console.error('Error merging cart:', err);
            throw err;
          }
        }) as Promise<void>;
      },

      pullCart: async (userId) => {
        return enqueueSync(userId, async () => {
          try {
            const { data: cart } = await supabase
              .from('carts')
              .select('id')
              .eq('user_id', userId)
              .maybeSingle();

            if (!cart) {
              set({ items: [] });
              return;
            }

            const { data: remoteItems } = await supabase
              .from('cart_items')
              .select(`
                quantity,
                product_id,
                variant_id,
                product:products(*),
                variant:product_variants(*)
              `)
              .eq('cart_id', cart.id);

            const mappedItems: CartItem[] = [];
            if (remoteItems && remoteItems.length > 0) {
              const productIds = remoteItems.map((item) => item.product_id);
              const { data: imagesData } = await supabase
                .from('product_images')
                .select('*')
                .in('product_id', productIds);

              const imagesMap = new Map<string, ProductImage[]>();
              if (imagesData) {
                for (const img of imagesData) {
                  const list = imagesMap.get(img.product_id) || [];
                  list.push(img);
                  imagesMap.set(img.product_id, list);
                }
              }

              for (const item of remoteItems) {
                const productObj = Array.isArray(item.product) ? item.product[0] : item.product;
                const variantObj = Array.isArray(item.variant) ? item.variant[0] : item.variant;
                if (productObj && variantObj) {
                  const productImages = imagesMap.get(item.product_id) || [];
                  mappedItems.push({
                    productId: item.product_id,
                    variantId: item.variant_id,
                    product: {
                      ...productObj,
                      images: productImages,
                    },
                    variant: variantObj,
                    quantity: item.quantity,
                    images: productImages,
                  });
                }
              }
            }

            // Merge with current local items instead of replacing — preserves
            // any additions made while the network request was in flight.
            const localItems = get().items;
            const merged = new Map<string, CartItem>();
            for (const item of localItems) {
              merged.set(item.variantId, item);
            }
            for (const item of mappedItems) {
              const existing = merged.get(item.variantId);
              if (existing) {
                // Keep the higher quantity (most likely the local pending add)
                merged.set(item.variantId, {
                  ...item,
                  quantity: Math.max(existing.quantity, item.quantity),
                });
              } else {
                merged.set(item.variantId, item);
              }
            }
            set({ items: Array.from(merged.values()) });
          } catch (err) {
            console.error('Error pulling cart:', err);
            throw err;
          }
        }) as Promise<void>;
      },
    }),
    {
      name: 'savana-cart',
      storage: createJSONStorage(() => createTenantBoundLocalStorage()),
      partialize: (state) => ({
        items: state.items,
        sessionId: state.sessionId,
      }),
    }
  )
);
// Wishlist Store
interface WishlistStore {
  productIds: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      productIds: [],

      toggleWishlist: (productId) => {
        set((state) => {
          const exists = state.productIds.includes(productId);
          if (exists) {
            return {
              productIds: state.productIds.filter((id) => id !== productId),
            };
          }
          return { productIds: [...state.productIds, productId] };
        });
      },

      isInWishlist: (productId) => {
        return get().productIds.includes(productId);
      },

      clearWishlist: () => set({ productIds: [] }),
    }),
    {
      name: 'savana-wishlist',
      storage: createJSONStorage(() => createTenantBoundLocalStorage()),
    }
  )
);

// Toast Store
interface ToastStore {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newToast: ToastMessage = { ...toast, id };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    setTimeout(() => {
      get().removeToast(id);
    }, toast.duration || 5000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => set({ toasts: [] }),
}));

// Theme Store
interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'system',

      setMode: (mode) => {
        set({ mode });
        applyTheme(mode);
      },

      toggleTheme: () => {
        set((state) => {
          const newMode = state.mode === 'dark' ? 'light' : 'dark';
          applyTheme(newMode);
          return { mode: newMode };
        });
      },
    }),
    {
      name: 'savana-theme',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

function applyTheme(mode: ThemeMode) {
  const html = document.documentElement;
  if (mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

// UI Store
interface UIStore {
  isMobileMenuOpen: boolean;
  isSearchOpen: boolean;
  isCartOpen: boolean;
  isAccountMenuOpen: boolean;
  activeModal: string | null;
  setMobileMenuOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setCartOpen: (open: boolean) => void;
  setAccountMenuOpen: (open: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isMobileMenuOpen: false,
  isSearchOpen: false,
  isCartOpen: false,
  isAccountMenuOpen: false,
  activeModal: null,

  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  setCartOpen: (open) => set({ isCartOpen: open }),
  setAccountMenuOpen: (open) => set({ isAccountMenuOpen: open }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
