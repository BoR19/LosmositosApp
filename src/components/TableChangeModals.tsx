import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  X, 
  Send, 
  Clock, 
  Phone, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Table, SolicitudCambio } from '../types';

/* =========================================================================
 * 1. MODAL CLIENTE: Solicitar cambio de mesa
 * ========================================================================= */
interface RequestTableChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mesaOrigen: number;
  initialCelular?: string;
  onSubmit: (motivo: string, celular?: string) => Promise<void>;
}

export const RequestTableChangeModal: React.FC<RequestTableChangeModalProps> = ({
  isOpen,
  onClose,
  mesaOrigen,
  initialCelular = '',
  onSubmit
}) => {
  const [motivo, setMotivo] = useState('');
  const [celular, setCelular] = useState(initialCelular);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const savedPhone = localStorage.getItem('churo_celular') || initialCelular;
      setCelular(savedPhone);
      setMotivo('');
      setIsSubmitting(false);
    }
  }, [isOpen, initialCelular]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(motivo.trim() || 'Solicitud de cliente', celular);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#1c1917] border border-[#3a3632] w-full max-w-md rounded-[24px] p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#3a3632]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff7a00]/15 text-[#ff7a00] flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-[#f5efe6]">
                Solicitar Cambio de Mesa
              </h3>
              <p className="text-xs text-[#a8a29e]">
                Mesa actual: <span className="font-bold text-[#ff7a00]">Mesa #{mesaOrigen}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#292524] text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[#292524] border border-[#3a3632] rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center justify-between text-[#a8a29e]">
              <span>WhatsApp de contacto:</span>
              <span className="font-bold text-[#f5efe6]">{celular ? `+591 ${celular}` : 'No registrado'}</span>
            </div>
            <p className="text-[11px] text-[#78716c]">
              El mozo se acercará a tu mesa para ayudarte a coordinar el cambio sin perder tu pedido.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#f5efe6] flex items-center gap-1.5">
              <span>Motivo del cambio (opcional)</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Deseamos una mesa más amplia, sombra, cerca a la ventana, etc."
              rows={3}
              className="w-full bg-[#292524] border border-[#3a3632] rounded-xl p-3 text-sm text-[#f5efe6] placeholder-[#78716c] focus:outline-none focus:border-[#ff7a00] transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-[#292524] hover:bg-[#3a3632] text-xs font-bold text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-black text-xs font-black transition-all shadow-[0_0_15px_rgba(255,122,0,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar Solicitud</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* =========================================================================
 * 2. MODAL MOZO / STAFF: Mover mesa a otra mesa libre
 * ========================================================================= */
interface MoveTableStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTable: Table | null;
  allTables: Table[];
  requestId?: string;
  requestDetails?: SolicitudCambio | null;
  onConfirmMove: (sourceTableId: number, targetTableId: number, requestId?: string) => Promise<void>;
}

export const MoveTableStaffModal: React.FC<MoveTableStaffModalProps> = ({
  isOpen,
  onClose,
  sourceTable,
  allTables,
  requestId,
  requestDetails,
  onConfirmMove
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Filtrar solo mesas LIBRES (excluyendo la mesa de origen)
  const freeTables = allTables.filter(t => t.id !== sourceTable?.id && t.status === 'free');

  useEffect(() => {
    if (isOpen) {
      if (freeTables.length > 0) {
        setSelectedTargetId(freeTables[0].id);
      } else {
        setSelectedTargetId(null);
      }
      setIsMoving(false);
    }
  }, [isOpen, sourceTable]);

  if (!isOpen || !sourceTable) return null;

  const handleConfirm = async () => {
    if (!selectedTargetId) return;
    setIsMoving(true);
    try {
      await onConfirmMove(sourceTable.id, selectedTargetId, requestId);
      onClose();
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#1c1917] border border-[#3a3632] w-full max-w-md rounded-[24px] p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#3a3632]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-[#f5efe6]">
                Mover a Otra Mesa
              </h3>
              <p className="text-xs text-[#a8a29e]">
                Traslado de comanda activa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#292524] text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info de la mesa origen */}
        <div className="bg-[#292524] border border-[#3a3632] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a8a29e]">Mesa Origen:</span>
            <span className="font-bold text-[#ff7a00] text-sm">
              {sourceTable.name} (Mesa #{sourceTable.id})
            </span>
          </div>
          {sourceTable.currentOrder && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#3a3632]/60">
              <span className="text-[#a8a29e]">Consumo a trasladar:</span>
              <span className="font-black text-[#f5efe6]">
                Bs. {sourceTable.currentOrder.total.toFixed(2)} ({sourceTable.currentOrder.items.length} ítems)
              </span>
            </div>
          )}
          {requestDetails && (
            <div className="mt-2 pt-2 border-t border-[#3a3632] text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Solicitud del cliente:</span>
              </div>
              <p className="text-[#f5efe6] italic bg-[#1c1917] p-2 rounded-lg border border-[#3a3632]">
                "{requestDetails.motivo}"
              </p>
              {requestDetails.celular && (
                <p className="text-[11px] text-[#a8a29e]">
                  Celular: +591 {requestDetails.celular}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Selección de mesa destino */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#f5efe6] block">
            Selecciona la Mesa Destino (Solo Mesas Libres):
          </label>
          {freeTables.length === 0 ? (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>No hay mesas libres disponibles en este momento para realizar el traslado.</span>
            </div>
          ) : (
            <select
              value={selectedTargetId ?? ''}
              onChange={(e) => setSelectedTargetId(Number(e.target.value))}
              className="w-full bg-[#292524] border border-[#3a3632] text-[#f5efe6] font-bold text-sm rounded-xl p-3 focus:outline-none focus:border-[#ff7a00] cursor-pointer"
            >
              {freeTables.map(t => (
                <option key={`free-opt-${t.id}`} value={t.id} className="bg-[#1c1917] text-white">
                  {t.name} ({t.seats} sillas) - LIBRE
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isMoving}
            className="flex-1 py-3 px-4 rounded-xl bg-[#292524] hover:bg-[#3a3632] text-xs font-bold text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isMoving || !selectedTargetId || freeTables.length === 0}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isMoving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirmar Traslado</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
 * 3. MODAL CLIENTE TRAS ESCANEAR NUEVO QR CON COMANDA ACTIVA
 * "¿Moverte de Mesa X a Mesa Y?"
 * ========================================================================= */
interface ClientConfirmMoveModalProps {
  isOpen: boolean;
  fromMesa: number;
  toMesa: number;
  onConfirmMove: () => Promise<void>;
  onStay: () => void;
}

export const ClientConfirmMoveModal: React.FC<ClientConfirmMoveModalProps> = ({
  isOpen,
  fromMesa,
  toMesa,
  onConfirmMove,
  onStay
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirmMove();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2600] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#1c1917] border-2 border-[#ff7a00]/50 w-full max-w-sm rounded-[28px] p-6 sm:p-7 shadow-[0_0_35px_rgba(255,122,0,0.3)] space-y-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#ff7a00]/20 text-[#ff7a00] flex items-center justify-center mx-auto shadow-inner">
          <ArrowRightLeft className="w-7 h-7 animate-pulse" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-xl font-serif font-black text-[#f5efe6]">
            ¿Moverte a la Mesa {toMesa}?
          </h3>
          <p className="text-xs text-[#a8a29e] leading-relaxed">
            Has escaneado el QR de la <strong className="text-[#f5efe6]">Mesa {toMesa}</strong>, pero actualmente tienes una comanda activa en la <strong className="text-[#ff7a00]">Mesa {fromMesa}</strong>.
          </p>
        </div>

        <div className="bg-[#292524] border border-[#3a3632] rounded-2xl p-4 text-xs space-y-2">
          <div className="flex items-center justify-center gap-3 font-bold text-sm">
            <span className="text-[#a8a29e]">Mesa {fromMesa}</span>
            <ArrowRightLeft className="w-4 h-4 text-[#ff7a00]" />
            <span className="text-[#ff7a00]">Mesa {toMesa}</span>
          </div>
          <p className="text-[11px] text-[#78716c]">
            Tus platos y consumos pedidos se trasladarán automáticamente a tu nueva mesa.
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="w-full py-3.5 px-4 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-black font-black text-sm shadow-[0_0_20px_rgba(255,122,0,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Sí, mover comanda a Mesa {toMesa}</span>
              </>
            )}
          </button>

          <button
            onClick={onStay}
            disabled={isProcessing}
            className="w-full py-2.5 px-4 rounded-xl bg-[#292524] hover:bg-[#3a3632] text-xs font-semibold text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
          >
            Permanecer en Mesa {fromMesa}
          </button>
        </div>
      </div>
    </div>
  );
};
