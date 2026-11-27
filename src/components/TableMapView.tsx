import React from 'react';
import {
  Plus,
  Bell,
  Clock,
  ArrowRightLeft,
  QrCode,
  CheckCheck,
  Trash2,
} from 'lucide-react';
import { SolicitudCambio, Table, WaiterCall } from '../types/index.ts';
import { countItemsQty, formatCurrencyBs } from '../utils/formatters.ts';

interface TableMapViewProps {
  tables: Table[];
  pendingChangeRequests: SolicitudCambio[];
  waiterCalls: WaiterCall[];
  isStaffAuthenticated: boolean;
  isAdminAuthenticated: boolean;
  canAccessTables: boolean;
  canAccessCashier: boolean;
  onOpenNewTakeAway: () => void;
  onOpenAddTableModal: () => void;
  onOpenTableInCart: (tableId: number) => void;
  onQuickOpenTable: (table: Table) => void;
  onSelectTableForMenu: (table: Table) => void;
  onOpenQrModal: (table: Table) => void;
  onOpenTableBill: (tableId: number) => void;
  onOpenMoveModal: (table: Table, req?: SolicitudCambio | null) => void;
  onOpenDeleteTable: (table: Table) => void;
  onAttendWaiterCall: (callId: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const TableMapView: React.FC<TableMapViewProps> = ({
  tables,
  pendingChangeRequests,
  waiterCalls,
  isStaffAuthenticated,
  isAdminAuthenticated,
  canAccessTables,
  canAccessCashier,
  onOpenNewTakeAway,
  onOpenAddTableModal,
  onOpenTableInCart,
  onQuickOpenTable,
  onSelectTableForMenu,
  onOpenQrModal,
  onOpenTableBill,
  onOpenMoveModal,
  onOpenDeleteTable,
  onAttendWaiterCall,
  showToast,
}) => {
  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[24px] sm:text-[28px] font-serif font-extrabold tracking-tight text-[#f5efe6]">
              Gestión de Mesas y Códigos QR
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ff7a00]/20 text-[#ff7a00] border border-[#ff7a00]/30 font-sans">
              {tables.length} mesas
            </span>
            {pendingChangeRequests.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-black border border-amber-400 font-sans animate-pulse flex items-center gap-1">
                <Bell className="w-3 h-3" /> {pendingChangeRequests.length}{' '}
                {pendingChangeRequests.length === 1 ? 'cambio pendiente' : 'cambios pendientes'}
              </span>
            )}
          </div>
          <p className="text-sm text-[#a8a29e] mt-1">
            Visualiza el consumo en tiempo real, traslada comandas a mesas libres, cobra o imprime los códigos QR.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenNewTakeAway}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[14px] bg-[#292524] hover:bg-[#3a3632] border border-[#ff7a00]/50 text-[#ff7a00] hover:text-white font-bold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <span>🛍️</span>
            <span>Nuevo Pedido Para Llevar</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddTableModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[14px] bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-bold text-sm shadow-[0_4px_20px_rgba(255,122,0,0.35)] transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Nueva Mesa</span>
          </button>
        </div>
      </div>

      {/* Banner de Solicitudes de Cambio de Mesa Pendientes */}
      {pendingChangeRequests.length > 0 && (
        <div className="bg-[#1c1917] border-2 border-amber-500/50 rounded-[20px] p-4 sm:p-5 shadow-xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#f5efe6] flex items-center gap-2">
                  <span>Solicitudes de Cambio de Mesa</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-[#ff7a00] text-black">
                    {pendingChangeRequests.length}
                  </span>
                </h3>
                <p className="text-xs text-[#a8a29e]">
                  Clientes en salón solicitando traslado de mesa
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingChangeRequests.map((req) => {
              const originTable = tables.find((t) => t.id === req.mesa_origen);
              return (
                <div
                  key={`req-card-${req.id}`}
                  className="bg-[#292524] border border-[#3a3632] rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#ff7a00] text-sm">
                        Mesa #{req.mesa_origen} ({originTable?.name || 'Mesa'})
                      </span>
                      <span className="text-[#a8a29e] text-[10px] flex items-center gap-1 bg-[#1c1917] px-2 py-0.5 rounded border border-[#3a3632]">
                        <Clock className="w-3 h-3 text-amber-400" /> Pendiente
                      </span>
                    </div>
                    <p className="text-[#f5efe6] italic bg-[#1c1917] p-2 rounded-lg border border-[#3a3632]/80 mt-1">
                      "{req.motivo}"
                    </p>
                    {req.celular && (
                      <p className="text-[#a8a29e] text-[11px]">WhatsApp: +591 {req.celular}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (originTable) {
                          onOpenMoveModal(originTable, req);
                        } else {
                          showToast('Mesa de origen no encontrada', 'error');
                        }
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-black text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Mover a otra mesa</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tables.map((table) => {
          const tableChangeReq = pendingChangeRequests.find((r) => r.mesa_origen === table.id);
          const tableCall = waiterCalls.find((c) => c.tableId === table.id);
          const orderItemsCount = table.currentOrder ? countItemsQty(table.currentOrder.items) : 0;

          return (
            <div
              key={`table-card-${table.id}`}
              className="bg-[#292524] border border-[#3a3632] rounded-[20px] p-6 flex flex-col justify-between gap-6 shadow-md transition-colors hover:border-[#ff7a00]/40"
            >
              <div>
                {/* Cabecera interactiva Click-to-Cart */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenTableInCart(table.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenTableInCart(table.id);
                    }
                  }}
                  className="group cursor-pointer rounded-2xl p-2.5 -m-2.5 transition-all hover:bg-[#1c1917]/60 focus:outline-none focus:ring-2 focus:ring-[#ff7a00]/50"
                  title={`Abrir carrito/comanda de ${table.name}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#ff7a00] flex items-center gap-1.5">
                      <span>Mesa #{table.id}</span>
                      <span className="text-[10px] font-semibold lowercase text-[#a8a29e] opacity-0 group-hover:opacity-100 transition-opacity">
                        • abrir
                      </span>
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        table.status === 'free'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : table.status === 'por-pagar'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {table.status === 'free'
                        ? 'Libre'
                        : table.status === 'por-pagar'
                          ? 'Por Pagar'
                          : 'Ocupada'}
                    </span>
                  </div>
                  <h3 className="text-[18px] font-serif font-bold text-[#f5efe6] group-hover:text-[#ff7a00] transition-colors mt-2">
                    {table.name}
                  </h3>
                  <p className="text-xs text-[#a8a29e] mt-1">{table.seats} comensales</p>

                  {table.currentOrder && (
                    <div className="mt-3 p-3 rounded-xl bg-[#1c1917] border border-[#3a3632] group-hover:border-[#ff7a00]/40 transition-colors space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#a8a29e]">Consumo en curso:</span>
                        <span className="text-[#ff7a00] font-black text-sm">
                          {formatCurrencyBs(table.currentOrder.total)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-[#a8a29e]">
                        <span>{orderItemsCount} ítems</span>
                        <span>Hora: {table.currentOrder.time}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Aviso de solicitud de cambio para esta mesa específica */}
                {tableChangeReq && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-2 animate-pulse">
                    <span className="flex items-center gap-1.5 font-bold">
                      <ArrowRightLeft className="w-4 h-4 text-[#ff7a00]" />
                      <span>Solicitud de cambio</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMoveModal(table, tableChangeReq);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#ff7a00] hover:bg-[#ff8c1a] text-black text-[11px] font-black cursor-pointer transition-colors"
                    >
                      Mover
                    </button>
                  </div>
                )}

                {tableCall && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-2 animate-pulse">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Bell className="w-4 h-4 text-[#ff7a00]" />
                      {tableCall.type === 'mozo' ? 'Mozo solicitado' : 'Cuenta solicitada'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAttendWaiterCall(tableCall.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-emerald-600 text-white text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Atender
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {isStaffAuthenticated &&
                  (isAdminAuthenticated || canAccessTables || canAccessCashier) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const isTableOccupied =
                          table.status !== 'free' || table.estado === 'ocupada';
                        if (!isTableOccupied) {
                          onQuickOpenTable(table);
                        } else {
                          onSelectTableForMenu(table);
                        }
                      }}
                      className="w-full py-2.5 px-3 rounded-[12px] bg-[#ff7a00] hover:bg-[#ff8c1a] text-white text-[13px] font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_16px_rgba(255,122,0,0.35)]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {table.status !== 'free' || table.estado === 'ocupada'
                          ? 'Agregar Pedido'
                          : 'Tomar Pedido'}
                      </span>
                    </button>
                  )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenQrModal(table);
                  }}
                  className="w-full py-2.5 px-3 rounded-[12px] bg-[#3a3632] hover:bg-[#ff7a00] text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" /> Ver / Imprimir QR
                </button>

                {table.status !== 'free' ? (
                  isStaffAuthenticated ? (
                    <>
                      {canAccessCashier && table.currentOrder && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenTableBill(table.id);
                          }}
                          className="w-full py-2.5 px-3 rounded-[12px] bg-emerald-600 hover:bg-emerald-700 text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow"
                        >
                          <CheckCheck className="w-4 h-4" /> Cobrar y Liberar Mesa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMoveModal(table, tableChangeReq || null);
                        }}
                        className="w-full py-2 px-3 rounded-[12px] bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00]/50 text-[12px] font-semibold text-[#f5efe6] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-[#ff7a00]" />
                        <span>Mover a otra mesa</span>
                      </button>
                    </>
                  ) : null
                ) : isStaffAuthenticated ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDeleteTable(table);
                    }}
                    className="w-full py-2 px-3 rounded-[12px] bg-[#1c1917] hover:bg-red-950/60 border border-[#3a3632] hover:border-red-500/40 text-[12px] font-semibold text-[#a8a29e] hover:text-red-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Eliminar mesa del restaurante"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Eliminar Mesa</span>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
