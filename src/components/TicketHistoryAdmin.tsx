import React, { useState, useEffect } from 'react';
import { 
  FileText, Search, Calendar, DollarSign, Smartphone, Printer, 
  MessageSquare, QrCode, ArrowDownRight, RefreshCw, CheckCircle2,
  Filter, Award, Hash, Table as TableIcon
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase.ts';
import { TicketHistoryItem } from '../types/index.ts';

export const TicketHistoryAdmin: React.FC = () => {
  const [tickets, setTickets] = useState<TicketHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterPago, setFilterPago] = useState<'TODOS' | 'EFECTIVO' | 'QR'>('TODOS');
  const [filterEntrega, setFilterEntrega] = useState<'TODOS' | 'whatsapp' | 'ticket' | 'ambas'>('TODOS');

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'tickets_history'), orderBy('fecha', 'desc'), limit(150));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          mesa: data.mesa || 0,
          tableName: data.tableName || `Mesa ${data.mesa}`,
          total: data.total || 0,
          celular: data.celular || null,
          tipoEntrega: data.tipoEntrega || 'ticket',
          metodoPago: data.metodoPago || 'EFECTIVO',
          fecha: data.fecha?.toDate ? data.fecha.toDate() : (data.fecha ? new Date(data.fecha) : new Date()),
          reimpresiones: data.reimpresiones || 0
        } as TicketHistoryItem;
      });
      setTickets(history);
      setLoading(false);
    }, (error) => {
      console.warn('Error al escuchar tickets_history:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(t.mesa).includes(searchTerm) ||
      (t.celular && t.celular.includes(searchTerm));

    const matchesPago = filterPago === 'TODOS' || t.metodoPago === filterPago;
    const matchesEntrega = filterEntrega === 'TODOS' || t.tipoEntrega === filterEntrega;

    return matchesSearch && matchesPago && matchesEntrega;
  });

  const totalVentas = tickets.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  const totalEfectivo = tickets.filter(t => t.metodoPago === 'EFECTIVO').reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  const totalQR = tickets.filter(t => t.metodoPago === 'QR').reduce((sum, t) => sum + (Number(t.total) || 0), 0);
  const totalWhatsApp = tickets.filter(t => t.tipoEntrega === 'whatsapp' || t.tipoEntrega === 'ambas').length;

  return (
    <div className="bg-[#292524] border border-[#3a3632] rounded-[24px] p-5 sm:p-7 space-y-6 shadow-xl animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3a3632] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl sm:text-2xl font-serif font-black text-[#f5efe6] flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-[#ff7a00]" />
              <span>Historial de Recibos y Ventas</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ff7a00]/15 text-[#ff7a00] border border-[#ff7a00]/30">
              {tickets.length} registros
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#a8a29e] mt-1">
            Registro imborrable en la colección <code className="bg-black/40 text-[#ff7a00] px-1.5 py-0.5 rounded text-xs font-mono">tickets_history</code> de Firestore.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
          <span className="text-[11px] text-[#a8a29e] uppercase font-bold tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Total Recaudado
          </span>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            Bs. {totalVentas.toFixed(2)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
          <span className="text-[11px] text-[#a8a29e] uppercase font-bold tracking-wider flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-sky-400" /> Cobros QR vs Efectivo
          </span>
          <p className="text-lg font-black text-[#f5efe6] mt-1">
            <span className="text-sky-400">Bs. {totalQR.toFixed(0)} QR</span>
            <span className="text-[#a8a29e] text-xs font-normal mx-1">/</span>
            <span className="text-amber-400">Bs. {totalEfectivo.toFixed(0)} Ef.</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
          <span className="text-[11px] text-[#a8a29e] uppercase font-bold tracking-wider flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-[#25D366]" /> Envíos WhatsApp
          </span>
          <p className="text-2xl font-black text-[#25D366] mt-1">
            {totalWhatsApp} <span className="text-xs text-[#a8a29e] font-normal">recibos</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
          <span className="text-[11px] text-[#a8a29e] uppercase font-bold tracking-wider flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-[#ff7a00]" /> Promedio por Ticket
          </span>
          <p className="text-2xl font-black text-[#ff7a00] mt-1">
            Bs. {tickets.length > 0 ? (totalVentas / tickets.length).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a8a29e]" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por mesa, N° o celular de cliente..."
            className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#f5efe6] placeholder-[#78716c] outline-none"
          />
        </div>

        {/* Filter Pago */}
        <div className="flex items-center gap-1 bg-[#1c1917] border border-[#3a3632] p-1 rounded-xl shrink-0">
          <button
            onClick={() => setFilterPago('TODOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterPago === 'TODOS' ? 'bg-[#3a3632] text-white' : 'text-[#a8a29e] hover:text-[#f5efe6]'
            }`}
          >
            Todos los Pagos
          </button>
          <button
            onClick={() => setFilterPago('EFECTIVO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterPago === 'EFECTIVO' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-[#a8a29e] hover:text-[#f5efe6]'
            }`}
          >
            Efectivo
          </button>
          <button
            onClick={() => setFilterPago('QR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterPago === 'QR' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-[#a8a29e] hover:text-[#f5efe6]'
            }`}
          >
            QR
          </button>
        </div>

        {/* Filter Entrega */}
        <div className="flex items-center gap-1 bg-[#1c1917] border border-[#3a3632] p-1 rounded-xl shrink-0">
          <button
            onClick={() => setFilterEntrega('TODOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterEntrega === 'TODOS' ? 'bg-[#3a3632] text-white' : 'text-[#a8a29e] hover:text-[#f5efe6]'
            }`}
          >
            Todas Entregas
          </button>
          <button
            onClick={() => setFilterEntrega('whatsapp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterEntrega === 'whatsapp' ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40' : 'text-[#a8a29e] hover:text-[#f5efe6]'
            }`}
          >
            WhatsApp
          </button>
          <button
            onClick={() => setFilterEntrega('ticket')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterEntrega === 'ticket' ? 'bg-zinc-700 text-white' : 'text-[#a8a29e] hover:text-[#f5efe6]'
            }`}
          >
            Ticket
          </button>
        </div>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="py-12 text-center text-[#a8a29e] flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-[#ff7a00]" />
          <p className="text-sm font-medium">Cargando historial de tickets...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="py-12 text-center bg-[#1c1917] border border-[#3a3632] rounded-2xl p-6">
          <FileText className="w-10 h-10 text-[#57534e] mx-auto mb-2" />
          <h4 className="text-base font-bold text-[#f5efe6]">No hay registros guardados</h4>
          <p className="text-xs text-[#a8a29e] mt-1 max-w-sm mx-auto">
            Los tickets emitidos al cobrar mesas aparecerán automáticamente en esta lista y se guardarán en Firestore.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((t) => {
            const dateObj = t.fecha instanceof Date ? t.fecha : new Date();
            const dateStr = dateObj.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

            return (
              <div 
                key={t.id}
                className="bg-[#1c1917] border border-[#3a3632] hover:border-[#57534e] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
              >
                {/* Info Mesa y Fecha */}
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-[#292524] border border-[#3a3632] flex items-center justify-center shrink-0">
                    <TableIcon className="w-5 h-5 text-[#ff7a00]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-bold text-[#f5efe6]">{t.tableName}</h4>
                      
                      {/* Método Pago Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.metodoPago === 'QR' 
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' 
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {t.metodoPago}
                      </span>

                      {/* Tipo Entrega Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.tipoEntrega === 'whatsapp'
                          ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40'
                          : t.tipoEntrega === 'ambas'
                            ? 'bg-[#ff7a00]/20 text-[#ff7a00] border border-[#ff7a00]/40'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}>
                        {t.tipoEntrega === 'whatsapp' ? '📱 WhatsApp' : t.tipoEntrega === 'ambas' ? '📱+🧾 Ambas' : '🧾 Ticket 80mm'}
                      </span>
                    </div>

                    {/* Sub-info: Celular + Fecha */}
                    <div className="flex items-center gap-3 text-xs text-[#a8a29e] mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#78716c]" />
                        {dateStr} a las {timeStr}
                      </span>

                      {t.celular && (
                        <span className="flex items-center gap-1 text-[#25D366] font-medium bg-[#25D366]/10 px-2 py-0.5 rounded-md">
                          <Smartphone className="w-3.5 h-3.5" />
                          +591 {t.celular}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Monto & Acciones */}
                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-[#3a3632] pt-3 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-[#a8a29e] uppercase font-bold tracking-wider block">Monto Total</span>
                    <span className="text-xl font-black text-[#ff7a00]">Bs. {(Number(t.total) || 0).toFixed(2)}</span>
                  </div>

                  {t.celular && (
                    <a
                      href={`https://wa.me/591${t.celular.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                      title="Enviar mensaje de WhatsApp al cliente"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
