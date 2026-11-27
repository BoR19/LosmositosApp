import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Delete,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  ShoppingBag,
} from 'lucide-react';
import { Order } from '../types/index.ts';

interface TakeAwayDeliveryModalProps {
  order: Order | null;
  onClose: () => void;
  canRevealCode: boolean;
  onConfirmDelivery: (order: Order) => Promise<void> | void;
}

export const TakeAwayDeliveryModal: React.FC<TakeAwayDeliveryModalProps> = ({
  order,
  onClose,
  canRevealCode,
  onConfirmDelivery,
}) => {
  const [enteredCode, setEnteredCode] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showEmergencyCode, setShowEmergencyCode] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (order) {
      setEnteredCode('');
      setErrorMsg(null);
      setShowEmergencyCode(false);
      setIsSubmitting(false);
    }
  }, [order]);

  useEffect(() => {
    if (!order) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        setErrorMsg(null);
        setEnteredCode((prev) => (prev.length < 4 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        setErrorMsg(null);
        setEnteredCode((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [order, onClose]);

  if (!order) return null;

  const expectedCode = String(order.codigoEntrega || '').trim();

  const handleDigit = (digit: string) => {
    setErrorMsg(null);
    setEnteredCode((prev) => (prev.length < 4 ? prev + digit : prev));
  };

  const handleBackspace = () => {
    setErrorMsg(null);
    setEnteredCode((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg(null);
    setEnteredCode('');
  };

  const handleVerifyAndDeliver = async () => {
    if (enteredCode.length !== 4) {
      setErrorMsg('Ingresa los 4 dígitos del código de entrega.');
      return;
    }
    if (enteredCode !== expectedCode) {
      setErrorMsg(
        'Código incorrecto. Verifica los 4 dígitos que muestra el cliente antes de entregar.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmDelivery(order);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1350] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-[#1E1E1E] border border-[#3a3632] rounded-[24px] max-w-sm w-full p-6 space-y-5 shadow-2xl text-[#f5efe6]">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 rounded-xl bg-[#141414] text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff7a00]/20 text-[#ff7a00] text-[11px] font-bold uppercase tracking-wider">
            <ShoppingBag className="w-3.5 h-3.5" /> Entrega Segura {order.codigoCorrelativo || '#LL-01'}
          </div>
          <h3 className="text-xl font-serif font-extrabold text-[#f5efe6]">
            Verificar Código de 4 Dígitos
          </h3>
          <p className="text-xs text-[#a8a29e]">
            Cliente: <strong className="text-[#f5efe6]">{order.clienteNombre || 'Cliente'}</strong> • Total:{' '}
            <strong className="text-[#ff7a00]">Bs. {order.total.toFixed(2)}</strong>
          </p>
          {!order.pagado && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[11px] font-bold mt-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Pendiente de cobro en Caja</span>
            </div>
          )}
        </div>

        {/* 4 Visual PIN Slots */}
        <div className="grid grid-cols-4 gap-2.5 max-w-[240px] mx-auto">
          {[0, 1, 2, 3].map((idx) => {
            const char = enteredCode[idx] || '';
            const isFilled = Boolean(char);
            return (
              <div
                key={idx}
                className={`h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-mono font-black transition-all ${
                  errorMsg
                    ? 'bg-red-950/30 border-red-500 text-red-300'
                    : isFilled
                      ? 'bg-[#141414] border-[#ff7a00] text-[#ff7a00] shadow-[0_0_15px_rgba(255,122,0,0.25)]'
                      : 'bg-[#141414] border-[#3a3632] text-[#57534e]'
                }`}
              >
                {char || '•'}
              </div>
            );
          })}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-start gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={isSubmitting}
              className="h-12 rounded-xl bg-[#141414] hover:bg-[#292524] active:scale-95 border border-[#3a3632] text-lg font-mono font-bold text-[#f5efe6] transition-all cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-[#141414] hover:bg-[#292524] active:scale-95 border border-[#3a3632] text-xs font-bold text-[#a8a29e] hover:text-white transition-all cursor-pointer"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-[#141414] hover:bg-[#292524] active:scale-95 border border-[#3a3632] text-lg font-mono font-bold text-[#f5efe6] transition-all cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={isSubmitting}
            className="h-12 rounded-xl bg-[#141414] hover:bg-[#292524] active:scale-95 border border-[#3a3632] flex items-center justify-center text-[#a8a29e] hover:text-white transition-all cursor-pointer"
            aria-label="Borrar último dígito"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Confirm CTA */}
        <button
          type="button"
          onClick={handleVerifyAndDeliver}
          disabled={isSubmitting || enteredCode.length !== 4}
          className="w-full py-3.5 px-4 rounded-[14px] bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#292524] disabled:text-[#78716c] text-white font-black text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{isSubmitting ? 'Verificando...' : 'Confirmar y Entregar Pedido'}</span>
        </button>

        {/* Discreet emergency code reveal strictly for Admin / Cashier */}
        {canRevealCode && (
          <div className="pt-1 text-center border-t border-[#3a3632]">
            <button
              type="button"
              onClick={() => setShowEmergencyCode((v) => !v)}
              className="text-[11px] text-[#78716c] hover:text-[#a8a29e] inline-flex items-center gap-1.5 py-1 cursor-pointer transition-colors"
            >
              {showEmergencyCode ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-[#ff7a00]" />
                  <span>
                    Código de emergencia: <strong className="font-mono text-[#ff7a00]">{expectedCode}</strong> (ocultar)
                  </span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Ver código (Solo Admin / Cajero)</span>
                </>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#78716c]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Validación obligatoria contra el ticket o pantalla del cliente</span>
        </div>
      </div>
    </div>
  );
};
