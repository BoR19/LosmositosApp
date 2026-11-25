import React, { useState } from 'react';
import { Lock, ArrowRightLeft, MessageCircle, Pencil, CheckCircle2, X } from 'lucide-react';
import { actualizarTelefonoMesaActiva } from '../services/tableSessionService.ts';

interface ClientTopBarProps {
  mesaNumber: number;
  tableName?: string;
  clientPhone: string;
  onPhoneUpdated: (newPhone: string) => void;
  onRequestTableChange: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ClientTopBar: React.FC<ClientTopBarProps> = ({
  mesaNumber,
  tableName,
  clientPhone,
  onPhoneUpdated,
  onRequestTableChange,
  showToast,
}) => {
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [draftPhone, setDraftPhone] = useState(clientPhone);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const cleanDraft = draftPhone.replace(/\D/g, '').slice(0, 8);
  const isValidPhone =
    cleanDraft.length === 8 && (cleanDraft.startsWith('6') || cleanDraft.startsWith('7'));

  const handleOpenEditor = () => {
    setDraftPhone(clientPhone || '');
    setErrorMsg('');
    setIsEditingPhone(true);
  };

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone) {
      setErrorMsg(
        cleanDraft.length < 8
          ? 'Ingresa los 8 dígitos del celular.'
          : 'El número debe comenzar con 6 o 7.'
      );
      return;
    }

    setIsSaving(true);
    try {
      await actualizarTelefonoMesaActiva({
        mesaNumber,
        celular: cleanDraft,
      });
      onPhoneUpdated(cleanDraft);
      setIsEditingPhone(false);
      showToast(`WhatsApp actualizado a +591 ${cleanDraft} (tu pedido sigue intacto).`);
    } catch (err) {
      console.error('Error al actualizar número en mesa activa:', err);
      showToast('No se pudo actualizar el número. Intenta de nuevo.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="bg-[#171412]/95 border-b border-[#3a3632]">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Indicador de Mesa Bloqueada + Cambio de Mesa */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#292524] border border-[#ff7a00]/35 text-[#ff7a00] font-bold">
              <Lock className="w-3 h-3 shrink-0" />
              <span className="truncate">{tableName || `Mesa ${mesaNumber}`}</span>
            </div>
            <button
              type="button"
              onClick={onRequestTableChange}
              className="text-[11px] text-[#a8a29e] hover:text-[#ff7a00] transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
            >
              <ArrowRightLeft className="w-3 h-3 text-[#ff7a00]" />
              <span className="hidden sm:inline">¿Cambiar de mesa?</span>
              <span className="sm:hidden">Cambiar mesa</span>
            </button>
          </div>

          {/* Botón discreto de WhatsApp / Cambiar número */}
          <button
            type="button"
            onClick={handleOpenEditor}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#292524]/80 hover:bg-[#3a3632] border border-[#3a3632] hover:border-emerald-500/40 text-[#d6d3d1] hover:text-white transition-all cursor-pointer active:scale-95"
            title="Cambiar número de WhatsApp para recibir tu cuenta"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {clientPhone ? (
              <span className="font-mono font-semibold text-[11px] text-[#f5efe6]">
                +591 {clientPhone}
              </span>
            ) : (
              <span className="text-[11px] text-[#a8a29e]">Agregar WhatsApp</span>
            )}
            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#ff7a00] font-semibold pl-0.5">
              <Pencil className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">{clientPhone ? 'Cambiar número' : 'Agregar'}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Modal rápido para editar el número sin perder el carrito */}
      {isEditingPhone && (
        <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#292524] border border-[#ff7a00]/40 rounded-[22px] max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-serif font-bold text-[#f5efe6] flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>Número para tu cuenta</span>
                </h3>
                <p className="text-[11px] text-[#a8a29e] mt-0.5">
                  Actualiza tu WhatsApp para {tableName || `Mesa ${mesaNumber}`} sin perder tus platos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingPhone(false)}
                className="p-1.5 rounded-lg bg-[#1c1917] text-[#a8a29e] hover:text-white cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePhone} className="space-y-3">
              <div className="flex items-center rounded-xl bg-[#1c1917] border border-[#3a3632] focus-within:border-[#ff7a00] p-1.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold font-mono text-[#f5efe6] border-r border-[#3a3632] shrink-0">
                  <span>🇧🇴</span>
                  <span>+591</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={cleanDraft}
                  onChange={(e) => {
                    setDraftPhone(e.target.value.replace(/\D/g, '').slice(0, 8));
                    setErrorMsg('');
                  }}
                  placeholder="7245XXXX"
                  maxLength={8}
                  autoFocus
                  className="w-full bg-transparent px-3 py-1.5 text-sm font-mono font-bold text-[#f5efe6] placeholder-[#52453d] focus:outline-none tracking-wider"
                />
                {isValidPhone && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                )}
              </div>

              {errorMsg && (
                <p className="text-[11px] text-red-400 font-medium">{errorMsg}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#1c1917] border border-[#3a3632] text-xs font-semibold text-[#a8a29e] hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !isValidPhone}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-lg"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Número'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
