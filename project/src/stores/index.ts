import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Product, ProductVariant, ToastMessage, ThemeMode } from '../types';

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
}

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

          if (existingIndex >= 0) {
            const newItems = [...state.items];
            newItems[existingIndex] = {
              ...newItems[existingIndex],
              quantity: newItems[existingIndex].quantity + quantity,
            };
            return { items: newItems };
          }

          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                variantId: variant.id,
                product,
                variant,
                quantity,
                images: product.images || [],
              },
            ],
          };
        });
      },

      removeItem: (variantId) => {
        set((state) => ({
          items: state.items.filter((item) => item.variantId !== variantId),
        }));
      },

      updateQuantity: (variantId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => item.variantId !== variantId),
            };
          }
          return {
            items: state.items.map((item) =>
              item.variantId === variantId ? { ...item, quantity } : item
            ),
          };
        });
      },

      clearCart: () => set({ items: [] }),

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

      getShipping: (freeThreshold = 999, baseRate = 99) => {
        return get().getSubtotal() >= freeThreshold ? 0 : baseRate;
      },

      getTotal: () => {
        return get().getSubtotal() + get().getTax() + get().getShipping();
      },

      getItem: (variantId) => {
        return get().items.find((item) => item.variantId === variantId);
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
