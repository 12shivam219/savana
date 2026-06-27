import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Product, ProductVariant, ToastMessage, ThemeMode, ProductImage } from '../types';
import { supabase } from '../lib/supabase';
import { FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_RATE } from '../lib/utils';

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
  getItemCount: () => number;
  getSubtotal: () => number;
  getTax: (rate?: number) => number;
  getShipping: (freeThreshold?: number, baseRate?: number) => number;
  getTotal: () => number;
  getItem: (variantId: string) => CartItem | undefined;
  mergeCart: (userId: string) => Promise<void>;
}

let syncPromise = Promise.resolve();

const syncCartToDb = (items: CartItem[]) => {
  syncPromise = syncPromise.then(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      let { data: cart } = await supabase
        .from('carts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cart) {
        const { data: newCart } = await supabase
          .from('carts')
          .insert({ user_id: user.id, session_id: `session_${Date.now()}` })
          .select('id')
          .single();
        if (!newCart) return;
        cart = newCart;
      }

      // Perform atomic sync using RPC function
      const itemsToSync = items.map(item => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity
      }));

      const { error: syncError } = await supabase.rpc('sync_user_cart', {
        p_cart_id: cart.id,
        p_items: itemsToSync
      });
      if (syncError) throw syncError;
    } catch (err) {
      console.error('Error syncing cart to database:', err);
    }
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

      getItemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          const price = item.product.sale_price || item.product.base_price;
          return total + price * item.quantity;
        }, 0);
      },

      getTax: (rate = 18) => {
        return Math.round(get().getSubtotal() * (rate / 100));
      },

      getShipping: (freeThreshold = FREE_SHIPPING_THRESHOLD, baseRate = DEFAULT_SHIPPING_RATE) => {
        return get().getSubtotal() >= freeThreshold ? 0 : baseRate;
      },

      getTotal: () => {
        return get().getSubtotal() + get().getTax() + get().getShipping();
      },

      getItem: (variantId) => {
        return get().items.find((item) => item.variantId === variantId);
      },

      mergeCart: async (userId) => {
        return new Promise<void>((resolve, reject) => {
          syncPromise = syncPromise.then(async () => {
            try {
              // 1. Fetch remote cart
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
                // Fetch remote cart items with product and variant
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
                // Create a new cart if it doesn't exist
                const { data: newCart } = await supabase
                  .from('carts')
                  .insert({ user_id: userId, session_id: get().sessionId })
                  .select('id')
                  .single();
                if (newCart) {
                  cartId = newCart.id;
                }
              }

              // 2. Map remote items to CartItem format
              const mappedRemoteItems: CartItem[] = [];
              if (remoteItems.length > 0) {
                // Collect all product IDs to fetch images for
                const productIds = remoteItems.map(item => item.product_id);
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

              // 3. Reconcile guest cart items and remote items
              const guestItems = get().items;
              const mergedMap = new Map<string, CartItem>();

              // Add remote items first
              for (const item of mappedRemoteItems) {
                mergedMap.set(item.variantId, item);
              }

              // Merge guest items
              for (const item of guestItems) {
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

              // 4. Update Zustand store state
              set({ items: finalItems });

              // 5. Update database cart items to match the final merged items
              if (cartId) {
                await supabase.from('cart_items').delete().eq('cart_id', cartId);
                if (finalItems.length > 0) {
                  const itemsToInsert = finalItems.map(item => ({
                    cart_id: cartId,
                    product_id: item.productId,
                    variant_id: item.variantId,
                    quantity: item.quantity,
                  }));
                  await supabase.from('cart_items').insert(itemsToInsert);
                }
              }
              resolve();
            } catch (err) {
              console.error('Error merging cart:', err);
              reject(err);
            }
          });
        });
      },
    }),
    {
      name: 'savana-cart',
      storage: createJSONStorage(() => localStorage),
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
      storage: createJSONStorage(() => localStorage),
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
