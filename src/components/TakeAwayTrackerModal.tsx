import React from 'react';
import {
  X,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Flame,
  MessageCircle,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Order } from '../types/index.ts';
import {
  buildTakeAwayClientShareWhatsAppUrl,
  formatSpacedCode,
} from '../services/takeAwayService.ts';

interface TakeAwayTrackerModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onAddMoreDishes: () => void;
}

export const TakeAwayTrackerModal: React.FC<TakeAwayTrackerModalProps> = ({
  isOpen,
  order,
  onClose,
  onAddMoreDishes,
}) => {
  if (!isOpen || !order) return null;

  const estadoCocina =
    order.estadoCocina ||
    (order.status === 'servido'
      ? 'listo'
      : order.status === 'pagado'
        ? 'entregado'
        : 'preparando');

  const steps = [
    { key: 'preparando', label: 'Preparando', icon: Flame },
    { key: 'listo', label: 'Listo', icon: Sparkles },
    { key: 'entregado', label: 'Entregado', icon: CheckCircle2 },
  ] as const;

  const currentStepIdx =
    estadoCocina === 'entregado' ? 2 : estadoCocina === 'listo' ? 1 : 0;

  const shareUrl = buildTakeAwayClientShareWhatsAppUrl(order);

  return (
    <div className="fixed inset-0 z-[1320] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-[#1E1E1E] border border-[#3a3632] rounded-[26px] max-w-md w-full max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl text-[#f5efe6]">
        {/* Header */}
        <div className="p-5 border-b border-[#3a3632] bg-[#292524] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#ff7a00]/20 border border-[#ff7a00]/40 text-[#ff7a00] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#ff7a00]">
                  Para Llevar {order.codigoCorrelativo || '#LL-01'}
                </span>
              </div>
              <h3 className="text-base font-serif font-bold text-[#f5efe6] truncate">
                {order.clienteNombre || 'Tu Pedido'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#141414] text-[#a8a29e] hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 pos-scrollbar">
          {/* Código de Entrega de 4 Dígitos */}
          <div className="bg-gradient-to-b from-[#292524] to-[#141414] border-2 border-[#ff7a00]/60 rounded-2xl p-5 text-center space-y-2 shadow-[0_8px_30px_rgba(255,122,0,0.2)]">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a8a29e] block">
              Código de Entrega
            </span>
            <div className="inline-block px-6 py-3 rounded-2xl bg-[#141414] border border-[#ff7a00]/40">
              <span className="text-3xl sm:text-4xl font-mono font-black tracking-[0.28em] text-[#ff7a00]">
                {formatSpacedCode(order.codigoEntrega || '0000')}
              </span>
            </div>
            <p className="text-xs font-semibold text-[#f5efe6] pt-1">
              Muéstralo en mostrador al recibir tu pedido
            </p>
            <div className="flex items-center justify-center gap-2 text-[11px] text-[#a8a29e]">
              <Clock className="w-3.5 h-3.5 text-[#ff7a00]" />
              <span>
                Tiempo estimado inicial: 15 min • Retiro:{' '}
                <strong className="text-[#f5efe6]">{order.notaRetiro || 'En 15 min'}</strong>
              </span>
            </div>
          </div>

          {/* Barra de Progreso en Tiempo Real */}
          <div className="bg-[#292524] border border-[#3a3632] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#f5efe6]">Estado en Cocina</span>
              <span className="font-bold text-[#ff7a00] uppercase text-[11px]">
                {estadoCocina === 'entregado'
                  ? 'Entregado'
                  : estadoCocina === 'listo'
                    ? 'Listo para retirar'
                    : 'Preparando'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isDoneOrCurrent = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div
                    key={step.key}
                    className={`rounded-xl p-2.5 border text-center space-y-1 transition-all ${
                      isCurrent
                        ? 'bg-[#ff7a00]/20 border-[#ff7a00] text-[#ff7a00]'
                        : isDoneOrCurrent
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#141414] border-[#3a3632] text-[#78716c]'
                    }`}
                  >
                    <Icon className="w-4 h-4 mx-auto" />
                    <span className="text-[11px] font-bold block leading-tight">
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detalle de platos y total en Bs. (sin pasarela de pago en móvil del cliente) */}
          <div className="bg-[#292524] border border-[#3a3632] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[#3a3632] pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#a8a29e]">
                Detalle del Pedido
              </span>
              <span className="text-base font-black text-[#ff7a00]">
                Bs. {order.total.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1 pos-scrollbar">
              {order.items.map((item, idx) => (
                <div
                  key={item.orderItemId || `tracker-${order.id}-${item.id}-${idx}`}
                  className="flex items-center justify-between gap-2 text-xs bg-[#141414] px-3 py-2 rounded-xl border border-[#3a3632]/70"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-[#f5efe6] truncate block">
                      {item.qty}x {item.nombre}
                    </span>
                    {item.isAddition && (
                      <span className="text-[10px] text-amber-400 font-semibold">
                        Adición agregada
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-[#ff7a00] shrink-0">
                    Bs. {(item.precioBs * item.qty).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-xl bg-[#141414] border border-[#3a3632] text-[11px] text-[#a8a29e] text-center">
              {order.pagado
                ? `Estado de pago: PAGADO (${order.paymentMethod || 'CAJA'})`
                : 'El pago se realiza directamente en mostrador al retirar tu pedido.'}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#3a3632] bg-[#292524] space-y-2.5">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#22c35e] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Compartir detalle por WhatsApp</span>
          </a>

          {estadoCocina !== 'entregado' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddMoreDishes();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#141414] hover:bg-[#3a3632] border border-[#3a3632] text-[#f5efe6] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#ff7a00]" />
              <span>Agregar más platos a este pedido</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
