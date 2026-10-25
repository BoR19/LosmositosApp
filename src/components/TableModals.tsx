import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, AlertTriangle, Users, Hash, MapPin, Check } from 'lucide-react';
import { Table } from '../types/index.ts';

interface AddTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTables: Table[];
  onAddTable: (table: { id: number; name: string; seats: number }) => Promise<void> | void;
}

export const AddTableModal: React.FC<AddTableModalProps> = ({
  isOpen,
  onClose,
  existingTables,
  onAddTable,
}) => {
  const nextId = existingTables.length > 0 
    ? Math.max(...existingTables.map(t => t.id)) + 1 
    : 1;

  const [tableNumber, setTableNumber] = useState<number>(nextId);
  const [sector, setSector] = useState<string>('Terraza');
  const [customName, setCustomName] = useState<string>('');
  const [seats, setSeats] = useState<number>(4);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const calcNextId = existingTables.length > 0 
        ? Math.max(...existingTables.map(t => t.id)) + 1 
        : 1;
      setTableNumber(calcNextId);
      setCustomName(`Mesa ${calcNextId} - ${sector}`);
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, existingTables]);

  const handleSectorChange = (newSector: string) => {
    setSector(newSector);
    setCustomName(`Mesa ${tableNumber} - ${newSector}`);
  };

  const handleNumberChange = (num: number) => {
    setTableNumber(num);
    setCustomName(`Mesa ${num} - ${sector}`);
    if (existingTables.some(t => t.id === num)) {
      setErrorMsg(`La Mesa #${num} ya existe en el restaurante.`);
    } else {
      setErrorMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tableNumber <= 0) {
      setErrorMsg('El número de mesa debe ser mayor a 0.');
      return;
    }
    if (existingTables.some(t => t.id === tableNumber)) {
      setErrorMsg(`La Mesa #${tableNumber} ya existe. Elige otro número.`);
      return;
    }
    if (seats <= 0) {
      setErrorMsg('Debe tener al menos 1 comensal.');
      return;
    }

    const finalName = customName.trim() || `Mesa ${tableNumber} - ${sector}`;
    
    setIsSubmitting(true);
    try {
      await onAddTable({
        id: tableNumber,
        name: finalName,
        seats: Number(seats),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al agregar la mesa');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const SECTOR_OPTIONS = [
    'Terraza Principal',
    'Terraza Vista',
    'Salón Central',
    'Salón Interior',
    'Patio Colonial',
    'VIP Bodega',
    'Barra / Parrilla'
  ];

  const SEAT_OPTIONS = [2, 4, 6, 8, 10, 12];

  return (
    <div className="fixed inset-0 z-[1250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#292524] border border-[#3a3632] rounded-[24px] max-w-lg w-full p-6 sm:p-7 space-y-6 shadow-2xl relative text-[#f5efe6]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-[#1c1917] text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff7a00]/20 text-[#ff7a00] text-[11px] font-bold uppercase tracking-wider">
            <Plus className="w-3.5 h-3.5" /> Nueva Mesa
          </div>
          <h3 className="text-[22px] sm:text-[24px] font-serif font-extrabold text-[#f5efe6]">
            Agregar Mesa al Restaurante
          </h3>
          <p className="text-xs text-[#a8a29e]">
            La nueva mesa generará automáticamente su código QR único para que los clientes puedan ordenar.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Table Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#a8a29e] flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-[#ff7a00]" /> Número de Mesa:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={tableNumber}
                onChange={(e) => handleNumberChange(parseInt(e.target.value) || 1)}
                className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl px-4 py-2.5 text-white font-bold text-base outline-none transition-colors"
                required
              />
              <span className="text-xs text-[#a8a29e] shrink-0 font-medium">
                Sugerido: #{nextId}
              </span>
            </div>
          </div>

          {/* Sector Quick Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#a8a29e] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#ff7a00]" /> Sector / Ubicación:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SECTOR_OPTIONS.map((sec) => (
                <button
                  type="button"
                  key={sec}
                  onClick={() => handleSectorChange(sec)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    sector === sec 
                      ? 'bg-[#ff7a00] text-white font-bold shadow' 
                      : 'bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#3a3632]'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>
          </div>

          {/* Table Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#a8a29e]">
              Nombre descriptivo de la mesa:
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Ej: Mesa 13 - Terraza Principal"
              className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors"
              required
            />
          </div>

          {/* Seats / Capacity */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#a8a29e] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#ff7a00]" /> Capacidad (Comensales):
            </label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 flex-wrap">
                {SEAT_OPTIONS.map((num) => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setSeats(num)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      seats === num 
                        ? 'bg-amber-600 text-white' 
                        : 'bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#3a3632]'
                    }`}
                  >
                    {num} pers.
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="50"
                value={seats}
                onChange={(e) => setSeats(parseInt(e.target.value) || 1)}
                className="w-20 bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl px-3 py-1.5 text-center text-white font-bold text-sm outline-none transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="py-2.5 px-4 rounded-[14px] bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] text-[#a8a29e] hover:text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2.5 px-4 rounded-[14px] bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,122,0,0.35)] transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Crear Mesa #{tableNumber}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteTableModalProps {
  table: Table | null;
  onClose: () => void;
  onConfirmDelete: (tableId: number) => Promise<void> | void;
}

export const DeleteTableModal: React.FC<DeleteTableModalProps> = ({
  table,
  onClose,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  if (!table) return null;

  const isOccupied = table.status !== 'free';

  const handleDelete = async () => {
    if (isOccupied) return;
    setIsDeleting(true);
    try {
      await onConfirmDelete(table.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#292524] border border-[#3a3632] rounded-[24px] max-w-md w-full p-6 space-y-5 shadow-2xl relative text-[#f5efe6]">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-[#1c1917] text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto shadow-inner">
          <Trash2 className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
            Confirmar Eliminación
          </span>
          <h3 className="text-[20px] font-serif font-extrabold text-[#f5efe6]">
            ¿Eliminar {table.name}?
          </h3>
          <p className="text-xs text-[#a8a29e] max-w-xs mx-auto">
            Mesa #{table.id} con capacidad para {table.seats} comensales.
          </p>
        </div>

        {isOccupied ? (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Mesa con consumo activo</span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-relaxed">
              Esta mesa tiene comensales o comanda en curso ({table.status === 'por-pagar' ? 'Por Pagar' : 'Ocupada'}).
              Debes cobrar y liberar la mesa antes de poder eliminarla.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-[#1c1917] border border-[#3a3632] text-xs text-[#a8a29e] space-y-1 text-center">
            <p>
              Esta mesa se eliminará del sistema y su código QR dejará de recibir nuevos pedidos.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="py-2.5 px-4 rounded-[14px] bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] text-[#a8a29e] hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={isOccupied || isDeleting}
            className={`py-2.5 px-4 rounded-[14px] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer ${
              isOccupied 
                ? 'bg-[#3a3632] text-[#78716c] cursor-not-allowed opacity-50' 
                : 'bg-red-600 hover:bg-red-700 text-white active:scale-95'
            }`}
          >
            {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Mesa'}
          </button>
        </div>
      </div>
    </div>
  );
};
