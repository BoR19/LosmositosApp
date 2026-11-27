import React, { useMemo } from 'react';
import {
  Award,
  Bell,
  FileText,
  Search,
  ShoppingBag,
  Clock,
  X,
  ArrowRight,
} from 'lucide-react';
import { MENU_CATEGORIAS, formatTableOptionLabel } from '../data/menuData.ts';
import { CartItem, MenuItem, Order, Table } from '../types/index.ts';
import { ProductCard } from './ProductCard.tsx';
import { ActiveOrderBanner } from './ActiveOrderBanner.tsx';
import { formatCurrencyBs } from '../utils/formatters.ts';
import { formatSpacedCode } from '../services/takeAwayService.ts';

interface MenuCatalogViewProps {
  menu: MenuItem[];
  cart: CartItem[];
  tables: Table[];
  currentTableId: number | null;
  selectedTableObject: Table | null;
  activeOrderForCurrentTable: Order | null;
  activeClientTakeAwayOrder: Order | null;
  isClientMode: boolean;
  isStaffAuthenticated: boolean;
  isDesktopPos: boolean;
  isTakeAwayMode: boolean;
  selectedCategory: string;
  posMenuSearch: string;
  onSelectCategory: (cat: string) => void;
  onSearchChange: (val: string) => void;
  onAddToCart: (product: MenuItem) => void;
  onUpdateCartQty: (id: string, delta: number) => void;
  onTableChange: (tableId: number) => void;
  onCallWaiter: (table: Table) => void;
  onRequestBill: (table: Table) => void;
  onOpenBillFallback: () => void;
  onCancelOrder: (orderId: string) => void;
  onOpenTakeAwayTracker: () => void;
  onActivateTakeAway: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const MenuCatalogView: React.FC<MenuCatalogViewProps> = ({
  menu,
  cart,
  tables,
  currentTableId,
  selectedTableObject,
  activeOrderForCurrentTable,
  activeClientTakeAwayOrder,
  isClientMode,
  isStaffAuthenticated,
  isDesktopPos,
  isTakeAwayMode,
  selectedCategory,
  posMenuSearch,
  onSelectCategory,
  onSearchChange,
  onAddToCart,
  onUpdateCartQty,
  onTableChange,
  onCallWaiter,
  onRequestBill,
  onOpenBillFallback,
  onCancelOrder,
  onOpenTakeAwayTracker,
  onActivateTakeAway,
  showToast,
}) => {
  const categoriesWithAll = useMemo(() => ['TODOS', ...MENU_CATEGORIAS], []);

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => map.set(item.id, item.qty));
    return map;
  }, [cart]);

  const searchedMenu = useMemo(() => {
    if (!isDesktopPos || !posMenuSearch.trim()) return menu;
    const term = posMenuSearch.trim().toLowerCase();
    return menu.filter(
      (item) =>
        item.nombre.toLowerCase().includes(term) ||
        item.categoria.toLowerCase().includes(term) ||
        (item.descripcion || '').toLowerCase().includes(term)
    );
  }, [menu, isDesktopPos, posMenuSearch]);

  const filteredMenu = useMemo(() => {
    if (selectedCategory === 'TODOS') return searchedMenu;
    return searchedMenu.filter((item) => item.categoria === selectedCategory);
  }, [searchedMenu, selectedCategory]);

  const groupedByCategory = useMemo(() => {
    return MENU_CATEGORIAS.map((cat) => ({
      cat,
      items: searchedMenu.filter((item) => item.categoria === cat),
    })).filter((group) => group.items.length > 0);
  }, [searchedMenu]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabecera POS Desktop con Buscador en Tiempo Real (oculta Hero Banner de cliente) */}
      {isDesktopPos ? (
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[#292524] border border-[#3a3632] rounded-[20px] p-5 shadow-lg">
          <div className="min-w-0">
            <h2 className="text-[22px] font-serif font-extrabold tracking-tight text-[#f5efe6] truncate">
              Carta y Toma de Pedidos
            </h2>
            <p className="text-xs text-[#a8a29e] mt-0.5 truncate">
              {isTakeAwayMode
                ? 'Modo activo en panel: 🛍️ Para Llevar (Mostrador)'
                : selectedTableObject
                  ? `Mesa activa en panel: ${selectedTableObject.name}`
                  : 'Selecciona una mesa o Para Llevar en el panel derecho'}
            </p>
          </div>
          <div className="relative w-full xl:w-80 shrink-0">
            <Search className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={posMenuSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar plato, bebida o categoría..."
              className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl pl-10 pr-9 py-2.5 text-sm text-[#f5efe6] placeholder-[#78716c] focus:outline-none transition-colors"
            />
            {posMenuSearch && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#a8a29e] hover:text-white cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Hero Banner (Modo Cliente / Móvil) */
        <div className="relative rounded-[24px] overflow-hidden bg-gradient-to-r from-[#292524] to-[#1c1917] border border-[#3a3632] p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-3 z-10 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff7a00]/20 text-[#ff7a00] text-[12px] font-semibold tracking-wide uppercase">
              <Award className="w-3.5 h-3.5" /> Sabor Auténtico Tarijeño
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-serif font-extrabold tracking-tight text-[#f5efe6] leading-[1.15]">
              Pide directamente a cocina desde tu smartphone
            </h2>
            <p className="text-[13px] sm:text-[14px] text-[#a8a29e] leading-relaxed">
              {isTakeAwayMode
                ? 'Agrega tus platos al carrito y retira tu pedido Para Llevar en mostrador con tu código de 4 dígitos.'
                : 'Escanea el código QR de tu mesa, agrega tus platos al carrito y envíalos a cocina sin demoras.'}
            </p>
            <div className="pt-2 flex flex-wrap gap-2.5 items-center">
              {!isClientMode && !isTakeAwayMode && (
                <div
                  className={`flex items-center gap-2 border rounded-xl px-3 py-2 transition-colors ${
                    currentTableId === null
                      ? 'bg-amber-950/40 border-amber-500/60'
                      : 'bg-[#1c1917] border-[#3a3632]'
                  }`}
                >
                  <span className="text-xs text-[#a8a29e]">Mesa:</span>
                  <select
                    value={currentTableId ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      if (val !== null) onTableChange(val);
                    }}
                    className="bg-transparent text-sm font-bold text-[#ff7a00] focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled className="bg-[#1c1917] text-stone-400">
                      -- Seleccionar Mesa --
                    </option>
                    {tables.map((t) => (
                      <option
                        key={`table-option-${t.id}`}
                        value={t.id}
                        className="bg-[#1c1917] text-white"
                      >
                        {formatTableOptionLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {currentTableId !== null && !isTakeAwayMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const effectiveId = isClientMode
                        ? Number(localStorage.getItem('churo_mesa')) || currentTableId
                        : currentTableId;
                      if (effectiveId === null) {
                        showToast('Por favor selecciona tu mesa antes de llamar al mozo.', 'error');
                        return;
                      }
                      const table = tables.find((t) => t.id === Number(effectiveId));
                      if (table) onCallWaiter(table);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#3a3632] hover:bg-[#ff7a00] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#ff7a00]" /> Llamar Mozo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const effectiveId = isClientMode
                        ? Number(localStorage.getItem('churo_mesa')) || currentTableId
                        : currentTableId;
                      if (effectiveId === null) {
                        showToast('Por favor selecciona tu mesa para pedir la cuenta.', 'error');
                        return;
                      }
                      const table = tables.find((t) => t.id === Number(effectiveId));
                      if (table) onRequestBill(table);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#3a3632] hover:bg-emerald-600 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" /> Pedir Cuenta
                  </button>
                </>
              ) : (
                !isStaffAuthenticated && (
                  <button
                    type="button"
                    onClick={onActivateTakeAway}
                    className="px-4 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-white text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <span>🛍️</span>
                    <span>
                      {activeClientTakeAwayOrder
                        ? `Seguimiento ${activeClientTakeAwayOrder.codigoCorrelativo || '#LL-01'}`
                        : 'Pedir Para Llevar (Retiro en local)'}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Banner en vivo de Pedido Para Llevar del cliente */}
      {!isStaffAuthenticated && activeClientTakeAwayOrder && (
        <div
          onClick={onOpenTakeAwayTracker}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenTakeAwayTracker();
            }
          }}
          className="rounded-[22px] bg-gradient-to-r from-[#292524] via-[#231f1d] to-[#1c1917] border-2 border-[#ff7a00]/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl cursor-pointer hover:border-[#ff7a00] transition-colors"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#ff7a00]/20 border border-[#ff7a00]/40 text-[#ff7a00] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-[#ff7a00]">
                  🛍️ PARA LLEVAR {activeClientTakeAwayOrder.codigoCorrelativo || '#LL-01'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  {activeClientTakeAwayOrder.estadoCocina === 'listo'
                    ? 'Listo para retirar'
                    : activeClientTakeAwayOrder.estadoCocina === 'entregado'
                      ? 'Entregado'
                      : 'Preparando'}
                </span>
              </div>
              <p className="text-sm font-bold text-[#f5efe6] truncate mt-0.5">
                Código de entrega:{' '}
                <span className="font-mono text-[#ff7a00] tracking-widest">
                  [ {formatSpacedCode(activeClientTakeAwayOrder.codigoEntrega || '0000')} ]
                </span>
              </p>
              <p className="text-[11px] text-[#a8a29e] flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-[#ff7a00]" />
                <span>
                  Estimado: 15 min • {activeClientTakeAwayOrder.notaRetiro || 'En 15 min'} •{' '}
                  {formatCurrencyBs(activeClientTakeAwayOrder.total)}
                </span>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#ff7a00] text-white text-xs font-black shrink-0 shadow">
            <span>Ver Seguimiento</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      )}

      {/* Active Table Order Banner: Real-time Comanda Tracker */}
      {activeOrderForCurrentTable && !isTakeAwayMode && (
        <ActiveOrderBanner
          order={activeOrderForCurrentTable}
          tableName={
            tables.find((t) => t.id === Number(currentTableId))?.name || `Mesa #${currentTableId}`
          }
          onOpenAdditions={() => {
            showToast('Selecciona platos o bebidas abajo para adicionarlos a tu mesa');
            const menuSec = document.getElementById('menu-list-section');
            if (menuSec) menuSec.scrollIntoView({ behavior: 'smooth' });
          }}
          onOpenBill={() => {
            const table =
              currentTableId !== null ? tables.find((t) => t.id === Number(currentTableId)) : null;
            if (table) {
              onRequestBill(table);
            } else {
              onOpenBillFallback();
            }
          }}
          onCancelOrder={onCancelOrder}
        />
      )}

      {/* Categories Carousel */}
      <div
        id="menu-list-section"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar lg:flex-wrap lg:overflow-x-visible w-full pb-2 scroll-mt-24"
      >
        {categoriesWithAll.map((category) => (
          <button
            key={`cat-pill-${category}`}
            type="button"
            onClick={() => onSelectCategory(category)}
            className={`px-4 py-2 rounded-[14px] text-[13px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === category
                ? 'bg-[#ff7a00] text-white shadow-lg'
                : 'bg-[#292524] text-[#a8a29e] hover:bg-[#3a3632] hover:text-[#f5efe6] border border-[#3a3632]'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Menu Grid: If TODOS, grouped neatly by Category; If specific, direct list */}
      {selectedCategory === 'TODOS' ? (
        searchedMenu.length === 0 ? (
          <div className="text-center py-14 bg-[#292524] border border-[#3a3632] rounded-[24px] text-[#a8a29e]">
            <Search className="w-10 h-10 mx-auto mb-2.5 opacity-40 text-[#ff7a00]" />
            <p className="text-sm font-bold text-[#f5efe6]">No se encontraron platos</p>
            <p className="text-xs mt-1">Prueba con otro término de búsqueda.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {groupedByCategory.map(({ cat, items }) => (
              <div key={`category-group-${cat}`} className="space-y-4">
                <div className="flex items-center gap-3 border-b border-[#3a3632] pb-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-[#ff7a00]" />
                  <h3 className="text-xl font-serif font-bold text-[#f5efe6] tracking-tight">
                    {cat}
                  </h3>
                  <span className="text-xs text-[#a8a29e] bg-[#292524] px-3 py-1 rounded-full border border-[#3a3632]">
                    {items.length} platos
                  </span>
                </div>
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 ${
                    isDesktopPos ? 'xl:grid-cols-3' : 'lg:grid-cols-3'
                  } gap-6`}
                >
                  {items.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={onAddToCart}
                      onUpdateQty={onUpdateCartQty}
                      cartQty={cartQtyMap.get(product.id) || 0}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredMenu.length === 0 ? (
        <div className="text-center py-14 bg-[#292524] border border-[#3a3632] rounded-[24px] text-[#a8a29e]">
          <Search className="w-10 h-10 mx-auto mb-2.5 opacity-40 text-[#ff7a00]" />
          <p className="text-sm font-bold text-[#f5efe6]">Sin resultados en {selectedCategory}</p>
          <p className="text-xs mt-1">Limpia el buscador o cambia de categoría.</p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            isDesktopPos ? 'xl:grid-cols-3' : 'lg:grid-cols-3'
          } gap-6`}
        >
          {filteredMenu.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
              onUpdateQty={onUpdateCartQty}
              cartQty={cartQtyMap.get(product.id) || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
};
