import React, { useState } from 'react';
import { 
  Clock, 
  ChefHat, 
  UtensilsCrossed, 
  FileText, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  Trash2,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Order } from '../types/index.ts';

interface ActiveOrderBannerProps {
  order: Order | null;
  tableName: string;
  onOpenAdditions: () => void;
  onOpenBill: () => void;
  onCancelOrder: (orderId: string) => void;
}

export const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({
  order,
  tableName,
  onOpenAdditions,
  onOpenBill,
  onCancelOrder,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!order) return null;

  const totalItemsCount = order.items.reduce((s, i) => s + i.qty, 0);

  // Status configuration
  const getStatusInfo = () => {
    switch (order.status) {
      case 'pendiente':
        return {
          step: 1,
          label: 'Recibido en Cocina',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          dotColor: 'bg-amber-400',
          desc: 'Tu pedido está registrado y en turno para entrar a los fogones.',
          canEditOrCancel: true
        };
      case 'en-preparacion':
        return {
          step: 2,
          label: 'En Preparación a la Leña',
          badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          dotColor: 'bg-orange-500 animate-pulse',
          desc: 'Los cocineros están preparando tus platos en la cocina.',
          canEditOrCancel: false
        };
      case 'servido':
        return {
          step: 3,
          label: 'Servido en Mesa',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          dotColor: 'bg-emerald-400',
          desc: 'Platos servidos. ¡Que disfrutes tu comida!',
          canEditOrCancel: false
        };
      case 'por-pagar':
        return {
          step: 4,
          label: 'Cuenta Solicitada',
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          dotColor: 'bg-purple-400',
          desc: 'Cuenta en curso de pago o atención de mozo.',
          canEditOrCancel: false
        };
      default:
        return {
          step: 1,
          label: 'En Proceso',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          dotColor: 'bg-amber-400',
          desc: 'Comanda activa.',
          canEditOrCancel: false
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="relative rounded-[22px] overflow-hidden bg-gradient-to-b from-[#292524] via-[#231f1d] to-[#1c1917] border-2 border-[#ff7a00]/40 shadow-2xl p-4 sm:p-6 space-y-4">
      {/* Top Tag & Live Pulse */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[#3a3632]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff7a00] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff7a00]"></span>
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-[#ff7a00]">
            {tableName} • Comanda en Curso
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#a8a29e] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {order.time}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.badgeColor} flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="space-y-1.5 text-center">
          <div className={`h-1.5 rounded-full transition-all ${
            statusInfo.step >= 1 ? 'bg-[#ff7a00]' : 'bg-[#3a3632]'
          }`} />
          <span className={`text-[10px] font-bold uppercase tracking-tight block ${
            statusInfo.step >= 1 ? 'text-[#ff7a00]' : 'text-[#78716c]'
          }`}>
            1. Recibido
          </span>
        </div>
        <div className="space-y-1.5 text-center">
          <div className={`h-1.5 rounded-full transition-all ${
            statusInfo.step >= 2 ? 'bg-[#ff7a00]' : 'bg-[#3a3632]'
          }`} />
          <span className={`text-[10px] font-bold uppercase tracking-tight block ${
            statusInfo.step >= 2 ? 'text-[#ff7a00]' : 'text-[#78716c]'
          }`}>
            2. En Fogones
          </span>
        </div>
        <div className="space-y-1.5 text-center">
          <div className={`h-1.5 rounded-full transition-all ${
            statusInfo.step >= 3 ? 'bg-emerald-500' : 'bg-[#3a3632]'
          }`} />
          <span className={`text-[10px] font-bold uppercase tracking-tight block ${
            statusInfo.step >= 3 ? 'text-emerald-400' : 'text-[#78716c]'
          }`}>
            3. Servido
          </span>
        </div>
      </div>

      {/* Main Info Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1c1917]/70 p-3.5 sm:p-4 rounded-xl border border-[#3a3632]">
        <div className="space-y-1">
          <p className="text-xs text-[#d6d3d1] font-medium leading-relaxed">
            {statusInfo.desc}
          </p>
          <div className="flex items-center gap-2 text-xs text-[#a8a29e]">
            <span>{totalItemsCount} {totalItemsCount === 1 ? 'plato/bebida' : 'platos/bebidas'} consumidos</span>
            {order.hasAddition && (
              <span className="bg-[#ff7a00]/20 text-[#ff7a00] px-2 py-0.2 rounded-full text-[10px] font-bold">
                + Adición añadida
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#3a3632]">
          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase font-bold text-[#a8a29e] block">Total Cuenta</span>
            <span className="text-[18px] sm:text-[20px] font-black text-[#ff7a00]">
              Bs. {order.total.toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-1.5 rounded-lg bg-[#292524] hover:bg-[#3a3632] text-xs font-semibold text-[#f5efe6] flex items-center gap-1 border border-[#3a3632] transition-colors"
          >
            <span>{showDetails ? 'Ocultar' : 'Ver detalle'}</span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Collapsible Order Detail List */}
      {showDetails && (
        <div className="bg-[#1c1917] p-3.5 rounded-xl border border-[#3a3632] space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-xs font-bold text-[#a8a29e] pb-1.5 border-b border-[#3a3632]">
            <span>Platos y Bebidas en Comanda</span>
            <span>Subtotal</span>
          </div>
          <div className="divide-y divide-[#292524] space-y-1">
            {order.items.map((item, idx) => (
              <div key={item.orderItemId || `banner-item-${order.id}-${item.id}-${item.isAddition ? 'add' : 'init'}-${idx}`} className="flex items-center justify-between py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#ff7a00]">{item.qty}x</span>
                  <span className="text-[#f5efe6] font-medium">{item.nombre}</span>
                  {item.isAddition && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                      Adición
                    </span>
                  )}
                </div>
                <span className="text-[#d6d3d1] font-semibold">
                  Bs. {(item.precioBs * item.qty).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {/* Adicionar productos button */}
        <button
          onClick={onOpenAdditions}
          className="flex-1 min-w-[140px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#ff7a00] to-amber-600 hover:from-[#ff8c1a] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Platos / Bebidas</span>
        </button>

        {/* Pedir Cuenta / Pagar button */}
        <button
          onClick={onOpenBill}
          className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>Pedir Cuenta / Pagar</span>
        </button>

        {/* Cancel button: Only allowed while status is 'pendiente' */}
        {statusInfo.canEditOrCancel && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="py-2.5 px-3 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-700/50 text-red-300 font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
            title="Cancelar comanda antes de cocinarse"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Cancelar Pedido</span>
          </button>
        )}
      </div>

      {/* Cancel Confirmation Prompt */}
      {showCancelConfirm && (
        <div className="p-3.5 bg-red-950/90 border border-red-600/70 rounded-xl space-y-2.5 animate-fadeIn">
          <div className="flex items-center gap-2 text-red-200 text-xs font-bold">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>¿Estás seguro de cancelar esta comanda para {tableName}?</span>
          </div>
          <p className="text-[11px] text-red-300/90 leading-tight">
            Como el pedido aún no entra a cocción, puedes cancelarlo y la mesa quedará libre nuevamente.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="px-3 py-1.5 rounded-lg bg-[#292524] text-xs text-[#a8a29e] hover:text-white"
            >
              No, mantener
            </button>
            <button
              onClick={() => {
                setShowCancelConfirm(false);
                onCancelOrder(order.id);
              }}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow"
            >
              Sí, cancelar comanda
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
