import React from 'react';
import { ShoppingBag, ChevronRight, MapPin } from 'lucide-react';
import { CartItem, Order, Table } from '../types/index.ts';
import { countItemsQty, formatCurrencyBs } from '../utils/formatters.ts';

interface FloatingCartBarProps {
  cart: CartItem[];
  cartTotal: number;
  isOpen: boolean;
  onOpenCart: () => void;
  selectedTable?: Table | null;
  takeAwayOrder?: Order | null;
  isTakeAwaySelected?: boolean;
  visible?: boolean;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({
  cart,
  cartTotal,
  isOpen,
  onOpenCart,
  selectedTable = null,
  takeAwayOrder = null,
  isTakeAwaySelected = false,
  visible = true,
}) => {
  // Ocultar por completo si está apagado desde Admin o si el modal del carrito ya está abierto
  if (!visible || isOpen) return null;

  const totalCount = countItemsQty(cart);
  const activeOrder = takeAwayOrder || selectedTable?.currentOrder || null;
  const contextLabel = takeAwayOrder
    ? `🛍️ Para Llevar ${takeAwayOrder.codigoCorrelativo || '#LL-01'}`
    : isTakeAwaySelected
      ? '🛍️ Para Llevar'
      : selectedTable
        ? selectedTable.name
        : 'Carrito';

  return (
    <div className="fixed bottom-[74px] left-3 right-3 sm:max-w-lg sm:mx-auto lg:left-auto lg:right-6 lg:bottom-6 lg:w-[380px] z-[990] pointer-events-none transition-all duration-300">
      {cart.length > 0 ? (
        <div className="pointer-events-auto">
          <button
            onClick={onOpenCart}
            className="w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-[#ff7a00] via-amber-500 to-[#ff7a00] hover:from-[#ff8c1a] text-white font-bold shadow-[0_12px_40px_rgba(255,122,0,0.85)] flex items-center justify-between border-2 border-white/40 backdrop-blur-xl animate-pulse active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center relative shrink-0">
                <ShoppingBag className="w-5 h-5 text-white" />
                <span className="absolute -top-1 -right-1 bg-white text-[#ff7a00] text-[10px] font-black px-1.5 py-0.2 rounded-full shadow">
                  {totalCount}
                </span>
              </div>
              <div className="text-left min-w-0">
                <p className="text-[11px] text-white/95 font-medium leading-tight truncate flex items-center gap-1">
                  <span>{totalCount} {totalCount === 1 ? 'plato listo' : 'platos listos'}</span>
                  {(selectedTable || takeAwayOrder || isTakeAwaySelected) && (
                    <span className="font-bold">• {contextLabel}</span>
                  )}
                </p>
                <p className="text-[17px] font-black tracking-tight leading-tight">
                  {formatCurrencyBs(cartTotal)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-black/25 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/20 shrink-0">
              <span>Ver Carrito</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      ) : (
        <div className="pointer-events-auto flex justify-end">
          <button
            onClick={onOpenCart}
            className="px-4 py-3 rounded-full bg-[#292524] hover:bg-[#3a3632] border-2 border-[#ff7a00] text-white font-bold shadow-[0_8px_30px_rgba(0,0,0,0.7)] flex items-center gap-2.5 active:scale-95 transition-all cursor-pointer max-w-full"
          >
            <div className="w-7 h-7 rounded-full bg-[#ff7a00]/25 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-[#ff7a00]" />
            </div>
            <div className="text-left min-w-0">
              <span className="text-xs font-bold text-[#f5efe6] block leading-tight truncate">
                {contextLabel}
              </span>
              {activeOrder && (
                <span className="text-[10px] font-bold text-[#ff7a00] flex items-center gap-1 leading-tight">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  Comanda: {formatCurrencyBs(activeOrder.total)}
                </span>
              )}
            </div>
            <span className="text-[10px] font-extrabold bg-[#3a3632] px-2 py-0.5 rounded-full text-[#a8a29e] shrink-0">
              {activeOrder ? activeOrder.items.length : 0}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
