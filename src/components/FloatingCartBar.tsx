import React from 'react';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { CartItem } from '../types/index.ts';

interface FloatingCartBarProps {
  cart: CartItem[];
  cartTotal: number;
  isOpen: boolean;
  onOpenCart: () => void;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({
  cart,
  cartTotal,
  isOpen,
  onOpenCart,
}) => {
  // If the cart modal is already open, do not show the floating bar to avoid visual overlap
  if (isOpen) return null;

  const totalCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="fixed bottom-[74px] left-3 right-3 z-[990] md:hidden pointer-events-none transition-all duration-300">
      {cart.length > 0 ? (
        <div className="pointer-events-auto">
          <button
            onClick={onOpenCart}
            className="w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-[#ff7a00] via-amber-500 to-[#ff7a00] hover:from-[#ff8c1a] text-white font-bold shadow-[0_12px_40px_rgba(255,122,0,0.85)] flex items-center justify-between border-2 border-white/40 backdrop-blur-xl animate-pulse active:scale-[0.98] transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/25 flex items-center justify-center relative">
                <ShoppingBag className="w-5 h-5 text-white" />
                <span className="absolute -top-1 -right-1 bg-white text-[#ff7a00] text-[10px] font-black px-1.5 py-0.2 rounded-full shadow">
                  {totalCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[11px] text-white/95 font-medium leading-tight">
                  {totalCount} {totalCount === 1 ? 'plato listo' : 'platos listos'}
                </p>
                <p className="text-[17px] font-black tracking-tight leading-tight">
                  Bs. {cartTotal.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-black/25 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/20">
              <span>Ver Carrito</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      ) : (
        <div className="pointer-events-auto flex justify-end">
          <button
            onClick={onOpenCart}
            className="px-4 py-3 rounded-full bg-[#292524] hover:bg-[#3a3632] border-2 border-[#ff7a00] text-white font-bold shadow-[0_8px_30px_rgba(0,0,0,0.7)] flex items-center gap-2.5 active:scale-95 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-[#ff7a00]/25 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-[#ff7a00]" />
            </div>
            <span className="text-xs font-bold text-[#f5efe6]">Carrito</span>
            <span className="text-[10px] font-extrabold bg-[#3a3632] px-2 py-0.5 rounded-full text-[#a8a29e]">
              0
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
