import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit, Eye, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatPrice } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { Product, ProductImage, ProductVariant } from '../../types';
import { SafeProductImage } from '../product';

interface EditingProduct {
  id: string;
  base_price: number;
  sale_price: number | null;
  stock: number;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Array<{
    product: Product;
    images: ProductImage[];
    variants: ProductVariant[];
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditingProduct | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('products')
        .select('*, product_images(*), product_variants(*)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data: productsData } = await query;

      if (productsData && productsData.length > 0) {
        const productsWithDetails = productsData.map((product) => ({
          product,
          images: product.product_images || [],
          variants: product.product_variants || [],
        }));

        setProducts(productsWithDetails);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  async function toggleProductStatus(productId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !currentStatus })
        .eq('id', productId);

      if (error) throw error;
      loadProducts();
    } catch (error) {
      console.error('Error updating product:', error);
    }
  }

  function startEditingProduct(productId: string, basePrice: number, salePrice: number | null, totalStock: number) {
    setEditingId(productId);
    setEditFormData({
      id: productId,
      base_price: basePrice,
      sale_price: salePrice,
      stock: totalStock,
    });
  }

  async function saveProductChanges() {
    if (!editFormData) return;

    try {
      setSavingId(editFormData.id);

      const { error: priceError } = await supabase
        .from('products')
        .update({
          base_price: editFormData.base_price,
          sale_price: editFormData.sale_price,
        })
        .eq('id', editFormData.id);

      if (priceError) throw priceError;

      const product = products.find((p) => p.product.id === editFormData.id);
      if (product && product.variants.length > 0) {
        const stockPerVariant = Math.floor(editFormData.stock / product.variants.length);
        const remainingStock = editFormData.stock % product.variants.length;

        for (let i = 0; i < product.variants.length; i++) {
          const variant = product.variants[i];
          const inventoryQty = stockPerVariant + (i === 0 ? remainingStock : 0);

          await supabase
            .from('product_variants')
            .update({ inventory_quantity: inventoryQty })
            .eq('id', variant.id);
        }
      }

      setEditingId(null);
      setEditFormData(null);
      loadProducts();
    } catch (error) {
      console.error('Error saving product changes:', error);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-neutral-500 mt-1">Manage your product catalog</p>
        </div>
        <Link
          to="/admin/products/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Product
        </Link>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-neutral-500 mb-4">No products found</p>
            <Link
              to="/admin/products/new"
              className="text-primary-600 hover:underline"
            >
              Add your first product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Product</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Category</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Price</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Stock</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-neutral-600">Status</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {products.map(({ product, images, variants }) => {
                  const primaryImage = images.find((img) => img.is_primary) || images[0];
                  const totalStock = variants.reduce((sum, v) => sum + v.inventory_quantity, 0);

                  return (
                    <tr key={product.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SafeProductImage
                            src={primaryImage?.url || '/placeholder.svg'}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                            fallbackSize="sm"
                          />
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-neutral-500">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize">{product.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          {editingId === product.id && editFormData ? (
                            <div key={`edit-price-${product.id}`} className="space-y-2">
                              <div>
                                <label className="text-xs font-medium">Original Price (₹)</label>
                                <input
                                  type="number"
                                  value={editFormData.base_price}
                                  onChange={(e) => setEditFormData({ ...editFormData, base_price: Number(e.target.value) })}
                                  className="w-full px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-800"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium">Sale Price (₹)</label>
                                <input
                                  type="number"
                                  value={editFormData.sale_price || ''}
                                  onChange={(e) => setEditFormData({ ...editFormData, sale_price: e.target.value ? Number(e.target.value) : null })}
                                  className="w-full px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-800"
                                  placeholder="Leave empty for no sale"
                                />
                              </div>
                            </div>
                          ) : (
                            <div key={`view-price-${product.id}`}>
                              <p>{formatPrice(product.sale_price || product.base_price)}</p>
                              {product.sale_price && (
                                <p className="text-sm text-neutral-500 line-through">
                                  {formatPrice(product.base_price)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === product.id && editFormData ? (
                          <div key={`edit-stock-${product.id}`}>
                            <label className="text-xs font-medium">Stock Qty</label>
                            <input
                              type="number"
                              value={editFormData.stock}
                              onChange={(e) => setEditFormData({ ...editFormData, stock: Number(e.target.value) })}
                              className="w-full px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded text-sm bg-white dark:bg-neutral-800"
                            />
                          </div>
                        ) : (
                          <span key={`view-stock-${product.id}`} className={cn(
                            totalStock <= 10 ? 'text-warning-600' : 'text-success-600'
                          )}>
                            {totalStock} units
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleProductStatus(product.id, product.is_active)}
                          className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            product.is_active
                              ? 'bg-success-100 text-success-700'
                              : 'bg-neutral-100 text-neutral-600'
                          )}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {editingId === product.id ? (
                            <div key={`edit-actions-${product.id}`} className="flex items-center gap-2">
                              <button
                                key={`save-btn-${product.id}`}
                                onClick={() => saveProductChanges()}
                                disabled={savingId === product.id}
                                className="p-2 hover:bg-success-100 dark:hover:bg-success-900/30 rounded-lg text-success-600 disabled:opacity-50"
                                title="Save changes"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                key={`cancel-btn-${product.id}`}
                                onClick={() => {
                                  setEditingId(null);
                                  setEditFormData(null);
                                }}
                                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg text-error-600"
                                title="Cancel editing"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div key={`view-actions-${product.id}`} className="flex items-center gap-2">
                              <Link
                                key={`view-link-${product.id}`}
                                to={`/product/${product.slug}`}
                                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                                title="View product"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              <button
                                key={`edit-btn-${product.id}`}
                                onClick={() => startEditingProduct(product.id, product.base_price, product.sale_price, totalStock)}
                                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                                title="Edit product"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
