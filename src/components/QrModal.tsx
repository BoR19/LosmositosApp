import React from 'react';
import { QrCode, Printer, X } from 'lucide-react';
import { Table } from '../types/index.ts';

interface QrModalProps {
  table: Table | null;
  onClose: () => void;
  onPrint: (table: Table) => void;
}

export const QrModal: React.FC<QrModalProps> = ({ table, onClose, onPrint }) => {
  if (!table) return null;

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://el-churo-mosito.app';
  const displayHost = typeof window !== 'undefined' ? window.location.host : 'el-churo-mosito.app';
  const targetUrl = `${originUrl}/?mesa=${table.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(targetUrl)}`;

  return (
    <div className="fixed inset-0 z-[1250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#292524] border border-[#3a3632] rounded-[24px] max-w-md w-full p-6 space-y-6 text-center shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-[#1c1917] text-[#a8a29e] hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff7a00]">
            Mesa #{table.id}
          </span>
          <h3 className="text-[22px] font-serif font-extrabold text-[#f5efe6]">{table.name}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl flex flex-col items-center justify-center space-y-3 shadow-inner">
          <img
            src={qrUrl}
            alt={`QR Mesa ${table.id}`}
            className="w-40 h-40 mx-auto rounded-xl shadow-md"
          />
          <div className="text-center">
            <span className="text-xs text-black font-extrabold block">
              Mesa #{table.id} • El Churo Mosito
            </span>
            <span className="text-[11px] text-gray-500 font-mono">
              {displayHost}/?mesa={table.id}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => onPrint(table)}
            className="py-3 px-4 rounded-[14px] bg-[#3a3632] hover:bg-[#4a4540] text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4 text-[#ff7a00]" />
            <span>Imprimir QR</span>
          </button>
          <button
            onClick={onClose}
            className="py-3 px-4 rounded-[14px] bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-bold text-sm cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
