import React, { useMemo } from 'react';
import {
  ChefHat,
  Clock,
  ShoppingBag,
  MessageCircle,
  ShieldCheck,
  Trash2,
  DollarSign,
  Flame,
  Check,
} from 'lucide-react';
import { Order } from '../types/index.ts';
import { formatCurrencyBs, isOrderOpen, isTakeAwayOrder } from '../utils/formatters.ts';
import { buildTakeAwayWhatsAppReadyUrl } from '../services/takeAwayService.ts';

export type KitchenFilterTab = 'all' | 'mesa' | 'llevar';

interface OrdersKdsViewProps {
  orders: Order[];
  filterTab: KitchenFilterTab;
  onChangeFilterTab: (tab: KitchenFilterTab) => void;
  canAccessCashier: boolean;
  isAdminAuthenticated: boolean;
  onOpenTableInCart: (tableId: number) => void;
  onOpenTakeAwayInCart: (orderId: string, mode?: 'cart' | 'bill') => void;
  onUpdateOrderStatus: (orderId: string, newStatus: string) => void;
  onUpdateTakeAwayStatus: (orderId: string, estadoCocina: 'preparando' | 'listo' | 'entregado') => void;
  onRequestDeliveryVerify: (order: Order) => void;
  onLiberateTable: (tableId: number) => void;
  onAdminCancelOrder: (orderId: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const OrdersKdsView: React.FC<OrdersKdsViewProps> = ({
  orders,
  filterTab,
  onChangeFilterTab,
  canAccessCashier,
  isAdminAuthenticated,
  onOpenTableInCart,
  onOpenTakeAwayInCart,
  onUpdateOrderStatus,
  onUpdateTakeAwayStatus,
  onRequestDeliveryVerify,
  onLiberateTable,
  onAdminCancelOrder,
  showToast,
}) => {
  const activeOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!isOrderOpen(o)) return false;
      if (isTakeAwayOrder(o) && o.estadoCocina === 'entregado' && o.pagado) {
        return false;
      }
      return true;
    });
  }, [orders]);

  const counts = useMemo(() => {
    let mesa = 0;
    let llevar = 0;
    let inKitchen = 0;
    activeOrders.forEach((o) => {
      if (isTakeAwayOrder(o)) {
        llevar += 1;
        if (o.estadoCocina !== 'listo' && o.estadoCocina !== 'entregado') {
          inKitchen += 1;
        }
      } else {
        mesa += 1;
        if (o.status !== 'servido') {
          inKitchen += 1;
        }
      }
    });
    return { all: activeOrders.length, mesa, llevar, inKitchen };
  }, [activeOrders]);

  const filteredOrders = useMemo(() => {
    if (filterTab === 'llevar') return activeOrders.filter((o) => isTakeAwayOrder(o));
    if (filterTab === 'mesa') return activeOrders.filter((o) => !isTakeAwayOrder(o));
    return activeOrders;
  }, [activeOrders, filterTab]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[24px] sm:text-[28px] font-serif font-extrabold tracking-tight text-[#f5efe6]">
            Comanda de Cocina (KDS)
          </h2>
          <p className="text-sm text-[#a8a29e]">
            Pedidos en tiempo real sincronizados desde salón y Para Llevar.
          </p>
        </div>

        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 self-start sm:self-auto shrink-0">
          {counts.inKitchen} en cocina
        </span>
      </div>

      {/* Pestañas de Filtro KDS */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-[#292524] border border-[#3a3632] w-fit">
        {[
          { id: 'all' as const, label: 'Todas', count: counts.all },
          { id: 'mesa' as const, label: '🍽️ Salón / Mesas', count: counts.mesa },
          { id: 'llevar' as const, label: '🛍️ Para Llevar', count: counts.llevar },
        ].map((tab) => {
          const isActive = filterTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeFilterTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#ff7a00] text-white shadow-md'
                  : 'text-[#a8a29e] hover:text-[#f5efe6]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-black/25 text-white' : 'bg-[#1c1917] text-[#a8a29e]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-[#292524] border border-[#3a3632] rounded-[24px] text-[#a8a29e]">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-40 text-[#ff7a00]" />
          <p className="text-base font-bold text-[#f5efe6]">
            {filterTab === 'llevar'
              ? 'No hay pedidos Para Llevar activos'
              : filterTab === 'mesa'
                ? 'No hay comandas de salón activas'
                : 'No hay comandas activas'}
          </p>
          <p className="text-xs mt-1">
            Los pedidos enviados desde mesas y Para Llevar aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
            if (isTakeAwayOrder(order)) {
              const estadoCocina =
                order.estadoCocina ||
                (order.status === 'servido' ? 'listo' : 'preparando');
              const waReadyUrl = buildTakeAwayWhatsAppReadyUrl(order);

              return (
                <div
                  key={`kitchen-order-${order.id}`}
                  className="bg-[#292524] border-2 border-[#ff7a00]/40 hover:border-[#ff7a00] rounded-[20px] p-6 space-y-4 flex flex-col justify-between shadow-lg transition-colors"
                >
                  <div className="space-y-3">
                    {/* Cabecera Interactiva Para Llevar */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenTakeAwayInCart(order.id, 'cart')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenTakeAwayInCart(order.id, 'cart');
                        }
                      }}
                      className="group cursor-pointer rounded-2xl p-2.5 -m-2.5 transition-all hover:bg-[#1c1917]/60 space-y-2 focus:outline-none focus:ring-2 focus:ring-[#ff7a00]/50"
                      title={`Abrir detalle de ${order.codigoCorrelativo || '#LL-01'}`}
                    >
                      <div className="flex justify-between items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ff7a00]/20 text-[#ff7a00] border border-[#ff7a00]/40 text-xs font-black">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>PARA LLEVAR {order.codigoCorrelativo || '#LL-01'}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              order.pagado
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-red-500/20 text-red-300 border-red-500/40'
                            }`}
                          >
                            {order.pagado ? 'PAGADO' : 'POR COBRAR'}
                          </span>
                          <span className="text-xs text-[#a8a29e] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {order.time}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-base font-serif font-bold text-[#f5efe6] group-hover:text-[#ff7a00] transition-colors truncate">
                            {order.clienteNombre || 'Cliente Mostrador'}
                          </h4>
                          <p className="text-[11px] text-amber-300 font-semibold truncate">
                            Retiro: {order.notaRetiro || 'En 15 min'}
                            {order.clienteTelefono ? ` • +591 ${order.clienteTelefono}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-black text-[#ff7a00] shrink-0">
                          {formatCurrencyBs(order.total)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-[#3a3632] pt-3 space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={item.orderItemId || `kds-ll-${order.id}-${item.id}-${idx}`}
                          className="flex justify-between items-center text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[#f5efe6] font-medium truncate">
                              {item.qty}x {item.nombre}
                            </span>
                            {item.isAddition && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                                Adición
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[#a8a29e] shrink-0">
                            {formatCurrencyBs(item.precioBs * item.qty)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Controles KDS + Avisar Listo + Entrega Segura + Cobro + Anulación Admin */}
                  <div className="pt-4 border-t border-[#3a3632] space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateTakeAwayStatus(order.id, 'preparando')}
                        className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          estadoCocina === 'preparando'
                            ? 'bg-amber-600 text-white font-bold shadow'
                            : 'bg-[#1c1917] text-[#a8a29e] hover:text-white'
                        }`}
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Preparando</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateTakeAwayStatus(order.id, 'listo')}
                        className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          estadoCocina === 'listo'
                            ? 'bg-emerald-600 text-white font-bold shadow'
                            : 'bg-[#1c1917] text-[#a8a29e] hover:text-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Listo</span>
                      </button>
                    </div>

                    {/* Botón verde: Avisar Listo por WhatsApp */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!waReadyUrl) {
                          showToast(
                            'Este pedido no tiene un número de WhatsApp boliviano registrado.',
                            'info'
                          );
                          return;
                        }
                        window.open(waReadyUrl, '_blank');
                      }}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        waReadyUrl
                          ? 'bg-[#25D366] hover:bg-[#22c35e] text-white shadow'
                          : 'bg-[#1c1917] border border-[#3a3632] text-[#78716c] opacity-70'
                      }`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>📲 Avisar Listo por WhatsApp</span>
                    </button>

                    <div className="flex flex-wrap gap-2">
                      {/* Botón Entregar -> Abre modal de código de 4 dígitos */}
                      <button
                        type="button"
                        onClick={() => onRequestDeliveryVerify(order)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Entregar</span>
                      </button>

                      {/* Cobrar si aún no está pagado y tiene permiso de Caja */}
                      {!order.pagado && canAccessCashier && (
                        <button
                          type="button"
                          onClick={() => onOpenTakeAwayInCart(order.id, 'bill')}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Cobrar</span>
                        </button>
                      )}
                    </div>

                    {/* Anulación estrictamente solo Administrador */}
                    {isAdminAuthenticated && (
                      <button
                        type="button"
                        onClick={() => onAdminCancelOrder(order.id)}
                        className="w-full py-2 px-3 rounded-xl bg-red-950/50 hover:bg-red-900 border border-red-700/40 text-red-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Anular pedido (Admin)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            // Tarjeta estándar de Mesa en Salón
            return (
              <div
                key={`kitchen-order-${order.id}`}
                className="bg-[#292524] border border-[#3a3632] hover:border-[#ff7a00]/40 rounded-[20px] p-6 space-y-4 flex flex-col justify-between shadow-lg transition-colors"
              >
                <div className="space-y-3">
                  {/* Cabecera interactiva Click-to-Cart en Comanda KDS */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenTableInCart(order.tableId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenTableInCart(order.tableId);
                      }
                    }}
                    className="group cursor-pointer rounded-2xl p-2.5 -m-2.5 transition-all hover:bg-[#1c1917]/60 space-y-2 focus:outline-none focus:ring-2 focus:ring-[#ff7a00]/50"
                    title={`Abrir detalle y acciones de ${order.tableName}`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm font-bold text-[#ff7a00] truncate">{order.id}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {order.hasAddition && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold animate-pulse">
                            🔥 Adición {order.additionTime}
                          </span>
                        )}
                        <span className="text-xs text-[#a8a29e] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {order.time}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-serif font-bold text-[#f5efe6] group-hover:text-[#ff7a00] transition-colors flex items-center gap-1.5">
                        <span>{order.tableName}</span>
                        <span className="text-[10px] font-sans font-semibold text-[#a8a29e] opacity-0 group-hover:opacity-100 transition-opacity">
                          • abrir
                        </span>
                      </h4>
                      <span className="text-xs font-extrabold text-[#ff7a00]">
                        {formatCurrencyBs(order.total)}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-[#3a3632] pt-3 space-y-2">
                    {order.items.map((item, idx) => (
                      <div
                        key={item.orderItemId || `kds-item-${order.id}-${item.id}-${idx}`}
                        className="flex justify-between items-center text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[#f5efe6] font-medium truncate">
                            {item.qty}x {item.nombre}
                          </span>
                          {item.isAddition && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                              Adición
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#a8a29e] shrink-0">
                          {formatCurrencyBs(item.precioBs * item.qty)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t border-[#3a3632] space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateOrderStatus(order.id, 'en-preparacion');
                      }}
                      className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        order.status === 'en-preparacion'
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-[#1c1917] text-[#a8a29e]'
                      }`}
                    >
                      En Fogones
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateOrderStatus(order.id, 'servido');
                      }}
                      className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        order.status === 'servido'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-[#1c1917] text-[#a8a29e]'
                      }`}
                    >
                      Servido
                    </button>
                    {canAccessCashier && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLiberateTable(order.tableId);
                        }}
                        className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-[#3a3632] hover:bg-emerald-700 text-emerald-300 hover:text-white transition-colors cursor-pointer"
                        title="Cobrar comanda y liberar mesa"
                      >
                        Cobrar
                      </button>
                    )}
                  </div>

                  {isAdminAuthenticated && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdminCancelOrder(order.id);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-red-950/50 hover:bg-red-900 border border-red-700/40 text-red-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Anular pedido (Admin)</span>
                    </button>
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
