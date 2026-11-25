import React, { useState, useEffect } from 'react';
import { X, Utensils, User, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Table } from '../types/index.ts';

interface QuickOpenTableModalProps {
  table: Table | null;
  onClose: () => void;
  onConfirm: (params: {
    table: Table;
    nota?: string;
    celular?: string;
  }) => Promise<void> | void;
}

const BOLIVIA_PHONE_REGEX = /^[67]\d{7}$/;

export const QuickOpenTableModal: React.FC<QuickOpenTableModalProps> = ({
  table,
  onClose,
  onConfirm,
}) => {
  const [nota, setNota] = useState<string>('');
  const [celular, setCelular] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (table) {
      setNota('');
      setCelular('');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [table]);

  if (!table) return null;

  const cleanCelular = celular.replace(/\D/g, '').slice(0, 8);
  const isValidPhone = BOLIVIA_PHONE_REGEX.test(cleanCelular);

  const handleSkipAndOpen = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onConfirm({ table });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanCelular.length > 0 && !isValidPhone) {
      setErrorMsg(
        'Ingresa un número de celular válido de Bolivia (8 dígitos empezando con 6 o 7) o déjalo vacío.'
      );
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onConfirm({
        table,
        nota: nota.trim() || undefined,
        celular: cleanCelular || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1260] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-[#1E1E1E] border border-[#3a3632] rounded-[24px] max-w-md w-full p-6 space-y-5 shadow-2xl text-[#f5efe6]">
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
        <div className="space-y-1 pr-8">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ff7a00]/20 text-[#ff7a00] text-[11px] font-bold uppercase tracking-wider">
            <Utensils className="w-3 h-3" /> Apertura Rápida en Caja
          </span>
          <h3 className="text-xl font-serif font-extrabold text-[#f5efe6]">
            {table.name}
          </h3>
          <p className="text-xs text-[#a8a29e]">
            Abre la mesa al instante para tomar el pedido. Si el cliente luego escanea el QR, continuará su cuenta automáticamente.
          </p>
        </div>

        {/* Botón Principal Directo (1 clic) */}
        <button
          type="button"
          onClick={handleSkipAndOpen}
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 rounded-[14px] bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-black text-sm shadow-[0_6px_22px_rgba(255,122,0,0.45)] flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          <span>{isSubmitting ? 'Abriendo mesa...' : 'Saltar y Abrir Menú'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <div className="relative flex items-center py-0.5">
          <div className="flex-grow border-t border-[#3a3632]" />
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#78716c]">
            Opcional: Datos del comensal
          </span>
          <div className="flex-grow border-t border-[#3a3632]" />
        </div>

        <form onSubmit={handleSaveAndOpen} className="space-y-3.5">
          {/* Nombre / Nota */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[#a8a29e] flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#ff7a00]" />
              <span>Nombre / Nota (opcional)</span>
            </label>
            <input
              type="text"
              maxLength={80}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: Familia López / Mesa cumpleaños"
              disabled={isSubmitting}
              className="w-full bg-[#141414] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#57534e] outline-none transition-colors"
            />
          </div>

          {/* Teléfono WhatsApp */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[#a8a29e] flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#ff7a00]" />
              <span>Teléfono WhatsApp (opcional)</span>
            </label>
            <div className="flex items-center rounded-xl bg-[#141414] border border-[#3a3632] focus-within:border-[#ff7a00] px-3 py-1 transition-colors">
              <span className="text-xs font-mono font-bold text-[#a8a29e] pr-2.5 border-r border-[#3a3632] shrink-0">
                +591
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={8}
                value={cleanCelular}
                onChange={(e) => {
                  setCelular(e.target.value.replace(/\D/g, '').slice(0, 8));
                  setErrorMsg(null);
                }}
                placeholder="7245XXXX"
                disabled={isSubmitting}
                className="w-full bg-transparent px-2.5 py-1.5 text-sm font-mono font-bold text-white placeholder-[#57534e] outline-none tracking-wider"
              />
              {isValidPhone && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
            </div>
          </div>

          {errorMsg && (
            <p className="text-[11px] text-red-400 font-medium leading-snug">
              {errorMsg}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-2.5 px-3 rounded-xl bg-[#141414] hover:bg-[#292524] border border-[#3a3632] text-[#a8a29e] hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 px-3 rounded-xl bg-[#292524] hover:bg-[#3a3632] border border-[#ff7a00]/50 text-[#ff7a00] hover:text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar y Abrir Menú'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
