import React, { useState, useEffect } from 'react';
import { 
  X, ShoppingBag, Plus, Minus, Trash2, Send, CheckCircle2, Utensils, 
  FileText, Sparkles, DollarSign, QrCode, AlertTriangle, ShieldCheck, 
  Lock, KeyRound, Bell, ArrowRight, Check, Printer, MessageSquare, Smartphone,
  ArrowRightLeft
} from 'lucide-react';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CartItem, Table, Order } from '../types/index.ts';
import { formatTableOptionLabel } from '../data/menuData.ts';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  modalMode: 'cart' | 'bill';
  cart: CartItem[];
  cartTotal: number;
  tables: Table[];
  currentTableId: number | null;
  activeOrder?: Order | null;
  onTableChange: (tableId: number) => void;
  onUpdateQty: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onPlaceOrder: () => void;
  onPayment: (method: 'QR' | 'EFECTIVO') => void;
  cashAmount: string;
  setCashAmount: (val: string) => void;
  onViewMenu: () => void;
  onSwitchToBill?: () => void;
  isClientMode?: boolean;
  isStaffAuthenticated?: boolean;
  staffName?: string;
  onStaffLoginSuccess?: (session: any) => void;
  onCallWaiterForBill?: () => void;
  onRequestTableChange?: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({
  isOpen,
  onClose,
  modalMode,
  cart,
  cartTotal,
  tables,
  currentTableId,
  activeOrder,
  onTableChange,
  onUpdateQty,
  onRemoveItem,
  onPlaceOrder,
  onPayment,
  cashAmount,
  setCashAmount,
  onViewMenu,
  onSwitchToBill,
  isClientMode: propIsClientMode,
  isStaffAuthenticated = false,
  staffName = 'Personal',
  onStaffLoginSuccess,
  onCallWaiterForBill,
  onRequestTableChange,
}) => {
  // Method tab for billing view ('EFECTIVO' | 'QR')
  const [billMethod, setBillMethod] = useState<'EFECTIVO' | 'QR'>('EFECTIVO');

  // Detect staff vs client mode
  const mesaQR = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mesa') : null;
  const isStaff = isStaffAuthenticated || 
    (typeof localStorage !== 'undefined' && (
      localStorage.getItem('admin_role') === 'mozo' || 
      localStorage.getItem('admin_role') === 'admin' || 
      localStorage.getItem('admin_role') === 'cajero' ||
      localStorage.getItem('churo_role') === 'staff'
    )) ||
    (typeof window !== 'undefined' && (
      window.location.pathname.includes('/admin') || 
      window.location.pathname.includes('/mesas')
    ));
  const isClient = propIsClientMode !== undefined 
    ? propIsClientMode 
    : Boolean(!isStaff && (mesaQR || (typeof localStorage !== 'undefined' && localStorage.getItem('churo_mesa'))));
  const effectiveMesaQR = mesaQR || (typeof localStorage !== 'undefined' ? localStorage.getItem('churo_mesa') : null) || currentTableId;
  const effectiveTableNumber = isClient ? (Number(effectiveMesaQR) || currentTableId) : currentTableId;

  
  // Rule 2: QR verification in mobile banking by staff
  const [qrVerified, setQrVerified] = useState<boolean>(false);
  
  // Feedback visual temporal al llamar al mozo
  const [waiterRequested, setWaiterRequested] = useState<boolean>(false);
  
  // Rule 3: Inline staff PIN login if waiter is on table/customer device
  const [showInlinePin, setShowInlinePin] = useState<boolean>(false);
  const [inlinePin, setInlinePin] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Requerimientos de Recibo y Cliente
  const [tipoEntrega, setTipoEntrega] = useState<'whatsapp' | 'ticket' | 'ambas'>('ambas');
  const [clienteCelular, setClienteCelular] = useState<string>('');
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState<boolean>(false);

  // Cargar número de celular del cliente (localStorage o Firestore mesas_activas)
  useEffect(() => {
    const targetMesaId = isClient ? (Number(effectiveMesaQR) || currentTableId) : currentTableId;
    if (isOpen && modalMode === 'bill' && targetMesaId !== null) {
      const savedPhone = localStorage.getItem('churo_celular') || '';
      if (savedPhone) {
        setClienteCelular(savedPhone);
        setTipoEntrega('ambas');
      } else {
        const fetchMesaCelular = async () => {
          try {
            const ref = doc(db, 'mesas_activas', `mesa_${targetMesaId}`);
            const snap = await getDoc(ref);
            if (snap.exists() && snap.data().cliente_celular) {
              const phone = snap.data().cliente_celular;
              setClienteCelular(phone);
              setTipoEntrega('ambas');
              return;
            }
          } catch (e) {
            console.warn('Error al leer cliente_celular de mesas_activas:', e);
          }
          setClienteCelular('');
          setTipoEntrega('ticket');
        };
        fetchMesaCelular();
      }
    }
  }, [isOpen, modalMode, currentTableId, isClient, effectiveMesaQR]);

  // Close on Escape key & manage scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Reset verification state when modal opens
      setQrVerified(false);
      setWaiterRequested(false);
      setShowInlinePin(false);
      setInlinePin('');
      setPinError(null);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTable = effectiveTableNumber !== null ? tables.find(t => t.id === Number(effectiveTableNumber)) || null : null;
  const isAdditionMode = Boolean(activeOrder && modalMode === 'cart');
  
  // Safe order fallback
  const effectiveOrder = activeOrder || (currentTable ? currentTable.currentOrder : null);
  const itemsToShow = modalMode === 'bill' ? (effectiveOrder?.items || []) : cart;
  const totalToShow = modalMode === 'bill' ? (effectiveOrder?.total || 0) : cartTotal;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);


  // =========================================================================
  // 💰 REGLA 1: LÓGICA DE PAGO EN EFECTIVO (Cálculo y Validación Dinámica)
  // =========================================================================
  const cleanCashStr = cashAmount.trim();
  const cashNum = cleanCashStr === '' ? 0 : parseFloat(cleanCashStr);
  const hasEnteredCash = cleanCashStr !== '' && !isNaN(cashNum);
  
  // Comparaciones estrictas con el consumo total
  const isUnderpaid = hasEnteredCash && cashNum < totalToShow;
  const isPaidOrOver = hasEnteredCash && cashNum >= totalToShow;

  const montoFaltante = isUnderpaid ? (totalToShow - cashNum).toFixed(2) : '0.00';
  const montoVuelto = isPaidOrOver ? (cashNum - totalToShow).toFixed(2) : '0.00';

  // Quick PIN submit inside modal
  const handleInlinePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inlinePin.trim();
    if (clean === '7777') {
      const session = { name: 'Administrador', role: 'admin' as const, authType: 'pin' as const };
      localStorage.setItem('elchuro_staff_session', JSON.stringify(session));
      if (onStaffLoginSuccess) onStaffLoginSuccess(session);
      setShowInlinePin(false);
      setPinError(null);
    } else if (clean === '1234') {
      const session = { name: 'Personal de Cocina / Mozo', role: 'cocina' as const, authType: 'pin' as const };
      localStorage.setItem('elchuro_staff_session', JSON.stringify(session));
      if (onStaffLoginSuccess) onStaffLoginSuccess(session);
      setShowInlinePin(false);
      setPinError(null);
    } else {
      setPinError('PIN incorrecto. (Admin: 7777 | Mozo: 1234)');
    }
  };

  // Implementación de handleConfirmarYEntregar
  const handleConfirmarYEntregar = async () => {
    // a) Validar pago
    if (billMethod === 'EFECTIVO' && !isPaidOrOver) {
      return;
    }
    if (billMethod === 'QR' && !qrVerified) {
      return;
    }

    setIsConfirmingDelivery(true);

    try {
      // b) Cobrar: actualiza Firestore mesas y comanda en parent
      onPayment(billMethod);

      // Evento de pago y liberación de sesión: BEST PRACTICE
      try {
        const mesaActual = String(effectiveTableNumber || currentTable?.id || '');
        localStorage.setItem('churo_sesion_activa', 'false');
        localStorage.removeItem('churo_carrito');
        if (mesaActual) {
          localStorage.setItem('churo_ultima_mesa', mesaActual);
        }
        localStorage.setItem('churo_fecha_pago', new Date().toISOString());
        localStorage.removeItem('churo_fecha_inicio');
        // Mantén churo_celular para pre-llenar la próxima vez
      } catch (stErr) {
        console.warn("Error updating session storage on checkout:", stErr);
      }

      // c) Generar texto limpio de recibo
      const mesaName = currentTable ? currentTable.name : `Mesa #${effectiveTableNumber}`;
      const fechaStr = new Date().toLocaleString('es-BO', { 
        dateStyle: 'short', 
        timeStyle: 'short' 
      });

      const itemsListText = itemsToShow
        .map((i: any) => `• ${i.qty}x ${i.nombre} - Bs. ${(i.precioBs * i.qty).toFixed(2)}`)
        .join('\n');

      const textoRecibo = 
`🔥 *EL CHURO MOSITO* 🔥
*Recibo Digital de Consumo*
----------------------------------
📍 *Mesa:* ${mesaName}
📅 *Fecha:* ${fechaStr}
💳 *Método de Pago:* ${billMethod}
----------------------------------
*Detalle de Consumo:*
${itemsListText}
----------------------------------
💰 *Total:* Bs. ${totalToShow.toFixed(2)}
${billMethod === 'EFECTIVO' && hasEnteredCash ? `💵 *Efectivo Entregado:* Bs. ${cashNum.toFixed(2)}\n🪙 *Cambio:* Bs. ${montoVuelto}\n` : ''}----------------------------------
¡Muchas gracias por tu visita!
Gastronomía de Altura • Tarija`;

      // d) Si tipoEntrega es whatsapp o ambas y hay celular
      if ((tipoEntrega === 'whatsapp' || tipoEntrega === 'ambas') && clienteCelular) {
        const cleanPhone = clienteCelular.replace(/\D/g, '');
        const waUrl = `https://wa.me/591${cleanPhone}?text=${encodeURIComponent(textoRecibo)}`;
        window.open(waUrl, '_blank');
      }

      // e) Si tipoEntrega es ticket o ambas: guarda en print_queue
      if (tipoEntrega === 'ticket' || tipoEntrega === 'ambas') {
        console.log('Imprimir ticket 80mm:', textoRecibo);
        try {
          await addDoc(collection(db, 'print_queue'), {
            mesa: effectiveTableNumber,
            tableName: mesaName,
            textoRecibo,
            total: totalToShow,
            fecha: serverTimestamp(),
            status: 'pending'
          });
        } catch (pErr) {
          console.warn('Error al guardar en print_queue:', pErr);
        }
      }

      // f) Guarda en Firestore tickets_history
      try {
        await addDoc(collection(db, 'tickets_history'), {
          mesa: effectiveTableNumber,
          tableName: mesaName,
          total: totalToShow,
          celular: clienteCelular || null,
          tipoEntrega,
          metodoPago: billMethod,
          fecha: serverTimestamp(),
          reimpresiones: 0
        });
      } catch (tErr) {
        console.warn('Error al guardar en tickets_history:', tErr);
      }
    } catch (err) {
      console.error('Error al confirmar y entregar recibo:', err);
    } finally {
      setIsConfirmingDelivery(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm flex justify-end animate-fadeIn">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container: fixed 100dvh for zero mobile overflow cut-off */}
      <div className="relative w-full max-w-[520px] bg-[#1c1917] h-[100dvh] max-h-[100dvh] flex flex-col justify-between border-l border-[#3a3632] shadow-2xl z-10 overflow-hidden">
        
        {/* Header (Always Visible) */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-[#3a3632] flex items-center justify-between bg-[#292524]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              modalMode === 'bill' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : isAdditionMode 
                  ? 'bg-amber-500/20 text-amber-400' 
                  : 'bg-[#ff7a00]/20 text-[#ff7a00]'
            }`}>
              {modalMode === 'bill' ? <FileText className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-[17px] sm:text-[18px] font-serif font-bold text-[#f5efe6] leading-tight truncate">
                {modalMode === 'bill' 
                  ? 'Cuenta de la Mesa' 
                  : isAdditionMode 
                    ? 'Adición a la Comanda' 
                    : 'Tu Pedido en Carrito'}
              </h3>
              <p className="text-[11px] text-[#a8a29e] flex items-center gap-1.5 truncate">
                <span>{currentTable ? currentTable.name : (currentTableId ? `Mesa #${currentTableId}` : 'Mesa no asignada')}</span>
                {modalMode === 'cart' && totalItemsCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-[#ff7a00] font-semibold">{totalItemsCount} {totalItemsCount === 1 ? 'ítem' : 'ítems'}</span>
                  </>
                )}
                {modalMode === 'bill' && isStaffAuthenticated && (
                  <span className="text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> {staffName}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1c1917] hover:bg-[#3a3632] text-[#a8a29e] hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 overscroll-contain">
          {/* Table Selector Box inside Cart: Locked badge in client mode, Select dropdown in staff mode */}
          {isClient ? (
            <div className="p-3.5 rounded-xl border border-[#ff7a00]/30 bg-[#292524] space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a8a29e] font-medium flex items-center gap-1.5">
                  <span>Tu Mesa:</span>
                </span>
                <div className="flex items-center gap-2 bg-[#1c1917] border border-[#ff7a00]/40 px-3 py-1.5 rounded-lg font-bold text-[#ff7a00] shadow-sm">
                  <span>{currentTable ? currentTable.name : `Mesa ${effectiveMesaQR}`} - Salón Central</span>
                  <span title="Mesa fijada por QR">🔒</span>
                </div>
              </div>
              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onRequestTableChange) onRequestTableChange();
                  }}
                  className="text-[11px] text-[#a8a29e] hover:text-[#ff7a00] underline transition-colors cursor-pointer flex items-center gap-1 font-medium"
                >
                  <ArrowRightLeft className="w-3 h-3 text-[#ff7a00]" />
                  <span>¿Cambiar de mesa?</span>
                </button>
              </div>
            </div>
          ) : (
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
              currentTableId === null ? 'bg-amber-950/30 border-amber-500/50' : 'bg-[#292524] border-[#3a3632]'
            }`}>
              <span className="text-[#a8a29e] font-medium flex items-center gap-1.5">
                <span>Mesa:</span>
                {currentTableId === null && (
                  <span className="text-amber-400 font-bold text-[10px]">(Requerida para cobrar/pedir)</span>
                )}
              </span>
              <select
                value={currentTableId ?? ''}
                onChange={(e) => onTableChange(Number(e.target.value))}
                className="bg-[#1c1917] text-[#ff7a00] font-bold border border-[#3a3632] rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#ff7a00] cursor-pointer"
              >
                <option value="" disabled className="bg-[#1c1917] text-stone-400">
                  -- Selecciona la Mesa --
                </option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>
                    {formatTableOptionLabel(t)}
                  </option>
                ))}
              </select>
            </div>
          )}


          {/* Active Order Notice if table has an active comanda */}
          {activeOrder && modalMode === 'cart' && (
            <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Mesa con Comanda Activa (Bs. {activeOrder.total.toFixed(2)})</span>
              </div>
              <p className="text-[11px] text-[#d6d3d1] leading-relaxed">
                Los nuevos platos o bebidas que agregues se enviarán como una <strong>adición a la misma comanda</strong> sin duplicar la mesa en cocina.
              </p>
            </div>
          )}

          {itemsToShow.length === 0 ? (
            <div className="text-center py-12 px-4 text-[#a8a29e]">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#ff7a00]/15 flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-[#ff7a00]" />
              </div>
              <p className="text-lg font-bold text-[#f5efe6] mb-1">
                {modalMode === 'bill' ? 'No hay consumos pendientes' : 'No tienes platos en el carrito'}
              </p>
              <p className="text-xs text-[#a8a29e] max-w-xs mx-auto mb-6 leading-relaxed">
                {modalMode === 'bill'
                  ? 'Esta mesa no tiene comandas pendientes de pago en este momento.'
                  : activeOrder
                    ? 'Tu comanda actual ya está registrada. Agrega nuevos platos o bebidas desde el menú para adicionarlos a tu mesa.'
                    : 'Explora nuestro menú tradicional y a la leña para añadir tus platos favoritos.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => {
                    onClose();
                    onViewMenu();
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-bold text-sm shadow-lg transition-transform active:scale-95 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Utensils className="w-4 h-4" /> Ver Menú Completo
                </button>
                {activeOrder && onSwitchToBill && modalMode === 'cart' && (
                  <button
                    onClick={onSwitchToBill}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#292524] hover:bg-[#3a3632] text-emerald-400 font-bold text-sm border border-emerald-500/30 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Ver Cuenta Activa (Bs. {activeOrder.total.toFixed(2)})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header de Cuenta de Mesa */}
              {modalMode === 'bill' && (
                <div className="bg-[#292524] p-3.5 sm:p-4 rounded-2xl border border-[#3a3632] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#a8a29e] block">
                      Consumo Total de la Cuenta
                    </span>
                    <span className="text-[13px] font-semibold text-[#f5efe6]">
                      {currentTable ? currentTable.name : `Mesa #${currentTableId}`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[22px] sm:text-[24px] font-black text-[#ff7a00] font-sans block leading-none">
                      Bs. {totalToShow.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-[#a8a29e]">
                      {itemsToShow.length} {itemsToShow.length === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#a8a29e] block">
                  {modalMode === 'bill' ? 'Detalle de Platos y Bebidas consumidos:' : 'Productos en tu Carrito:'}
                </span>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {itemsToShow.map((item: any, index: number) => (
                    <div
                      key={item.orderItemId || (modalMode === 'cart' ? `cart-${item.id}` : `bill-${item.id}-${item.isAddition ? 'add' : 'base'}-${index}`)}
                      className="flex items-center justify-between bg-[#292524] p-3 rounded-[14px] border border-[#3a3632] gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[13px] font-bold text-[#f5efe6] truncate">
                            {item.nombre}
                          </h4>
                          {item.isAddition && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                              Adición
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[#ff7a00] font-extrabold">
                            Bs. {(item.precioBs * item.qty).toFixed(2)}
                          </span>
                          <span className="text-[11px] text-[#a8a29e]">
                            ({item.qty}x Bs. {item.precioBs.toFixed(2)})
                          </span>
                        </div>
                      </div>

                      {modalMode === 'cart' ? (
                        <div className="flex items-center gap-1.5 bg-[#1c1917] px-2 py-1 rounded-xl border border-[#3a3632] shrink-0">
                          {item.qty === 1 ? (
                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="p-1 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                              title="Eliminar del carrito"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onUpdateQty(item.id, -1)}
                              className="p-1 text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-xs font-bold w-4 text-center text-[#f5efe6]">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => onUpdateQty(item.id, 1)}
                            className="p-1 text-[#ff7a00] hover:text-[#ff8c1a] transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-[#a8a29e] bg-[#1c1917] px-2.5 py-1 rounded-lg border border-[#3a3632] shrink-0">
                          {item.qty}x
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* =========================================================================
               * 💳 VISTA DE COBRO DE LA CUENTA (modalMode === 'bill')
               * ========================================================================= */}
              {modalMode === 'bill' && (
                <div className="pt-3 space-y-4 border-t border-[#3a3632]">
                  
                  {/* CASO A: PERSONAL AUTORIZADO (PIN / ADMIN / MOZO) */}
                  {isStaffAuthenticated ? (
                    <div className="space-y-4">
                      {/* Pestañas de Método de Cobro */}
                      <div className="flex rounded-xl bg-[#292524] p-1 border border-[#3a3632]">
                        <button
                          type="button"
                          onClick={() => setBillMethod('EFECTIVO')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            billMethod === 'EFECTIVO' 
                              ? 'bg-emerald-600 text-white shadow-md' 
                              : 'text-[#a8a29e] hover:text-white'
                          }`}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Efectivo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBillMethod('QR')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            billMethod === 'QR' 
                              ? 'bg-emerald-600 text-white shadow-md' 
                              : 'text-[#a8a29e] hover:text-white'
                          }`}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR Simple</span>
                        </button>
                      </div>

                      {/* COBRO EN EFECTIVO */}
                      {billMethod === 'EFECTIVO' && (
                        <div className="bg-[#292524] p-4 rounded-2xl border border-[#3a3632] space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#f5efe6] flex items-center gap-1.5">
                              <DollarSign className="w-4 h-4 text-emerald-400" />
                              Cobro en Efectivo
                            </span>
                            <span className="text-xs font-black text-[#ff7a00]">
                              Total: Bs. {totalToShow.toFixed(2)}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] text-[#a8a29e] font-medium block">
                              Monto entregado en Bs.:
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#a8a29e]">
                                Bs.
                              </span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="Monto entregado en Bs."
                                value={cashAmount}
                                onChange={(e) => setCashAmount(e.target.value)}
                                className={`w-full bg-[#1c1917] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#f5efe6] font-bold focus:outline-none transition-colors border ${
                                  isUnderpaid 
                                    ? 'border-red-500 focus:border-red-500 text-red-200' 
                                    : isPaidOrOver 
                                      ? 'border-emerald-500 focus:border-emerald-500 text-emerald-200' 
                                      : 'border-[#3a3632] focus:border-emerald-500'
                                }`}
                              />
                            </div>

                            {/* Accesos rápidos de efectivo */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              <span className="text-[10px] text-[#78716c] mr-1">Rápido:</span>
                              <button
                                type="button"
                                onClick={() => setCashAmount(totalToShow.toFixed(2))}
                                className="px-2.5 py-1 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                              >
                                Exacto (Bs. {totalToShow.toFixed(2)})
                              </button>
                              {[50, 100, 200, 500].filter(val => val >= totalToShow).slice(0, 3).map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setCashAmount(val.toString())}
                                  className="px-2.5 py-1 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] text-[11px] font-semibold text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
                                >
                                  Bs. {val}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Mensajes Dinámicos Centrados */}
                          {isUnderpaid && (
                            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/50 animate-fadeIn">
                              <p className="text-red-500 font-bold text-center text-xs">
                                ⚠️ Faltan Bs. {montoFaltante}
                              </p>
                            </div>
                          )}

                          {isPaidOrOver && (
                            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 animate-fadeIn">
                              <p className="text-emerald-400 font-bold text-center text-xs">
                                Cambio a devolver: Bs. {montoVuelto}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* PAGO CON QR Y CONFIRMACIÓN */}
                      {billMethod === 'QR' && (
                        <div className="bg-[#292524] p-4 rounded-2xl border border-[#3a3632] space-y-3.5 text-center">
                          <div className="flex items-center justify-between text-left">
                            <span className="text-xs font-bold text-[#f5efe6] flex items-center gap-1.5">
                              <QrCode className="w-4 h-4 text-emerald-400" />
                              QR Simple / Banco Sol
                            </span>
                            <span className="text-xs font-black text-[#ff7a00]">
                              Bs. {totalToShow.toFixed(2)}
                            </span>
                          </div>

                          <div className="bg-white p-3 rounded-xl w-36 h-36 mx-auto flex items-center justify-center shadow">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`PAGO_MESA_${currentTableId}_TOTAL_${totalToShow.toFixed(2)}`)}`}
                              alt="QR Pago"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <p className="text-[11px] text-[#a8a29e]">
                            El comensal escanea desde su app bancaria (Banco Sol, BNB, BCP, Banco Unión, Mercantil, etc.)
                          </p>

                          {/* Casilla obligatoria de verificación de transferencia en banca móvil */}
                          <div className="bg-[#1c1917] p-3 rounded-xl border border-[#3a3632] text-left">
                            <label className="flex items-start gap-2.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={qrVerified}
                                onChange={(e) => setQrVerified(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded border-[#3a3632] bg-[#292524] text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-emerald-500 shrink-0"
                              />
                              <div className="text-xs min-w-0">
                                <span className="font-bold text-[#f5efe6] block leading-tight">
                                  Verificación en Banca Móvil
                                </span>
                                <span className="text-[11px] text-[#a8a29e] block mt-0.5 leading-relaxed">
                                  He verificado en la app bancaria la acreditación de <strong className="text-emerald-400 font-bold">Bs. {totalToShow.toFixed(2)}</strong>.
                                </span>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* =========================================================================
                       * 📦 NUEVO BLOQUE: ¿CÓMO ENTREGAR RECIBO? (Dark #1E1E1E)
                       * ========================================================================= */}
                      <div className="bg-[#1E1E1E] border border-zinc-800 rounded-xl p-4 mt-4 text-left shadow-lg">
                        <p className="text-white font-bold text-xs sm:text-sm">¿Cómo entregar recibo?</p>
                        <p className="text-zinc-400 text-xs mt-0.5 font-mono">
                          +591 {clienteCelular || 'Sin número'}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => setTipoEntrega('whatsapp')}
                            disabled={!clienteCelular}
                            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              !clienteCelular
                                ? 'bg-zinc-800/50 text-zinc-600 opacity-50 cursor-not-allowed border border-zinc-800'
                                : tipoEntrega === 'whatsapp'
                                  ? 'bg-[#25D366] text-white shadow-lg font-black'
                                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            WhatsApp
                          </button>
                          <button
                            type="button"
                            onClick={() => setTipoEntrega('ticket')}
                            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              tipoEntrega === 'ticket'
                                ? 'bg-zinc-600 text-white shadow-lg font-black'
                                : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            Ticket 80mm
                          </button>
                          <button
                            type="button"
                            onClick={() => setTipoEntrega('ambas')}
                            disabled={!clienteCelular}
                            className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              !clienteCelular
                                ? 'bg-zinc-800/50 text-zinc-600 opacity-50 cursor-not-allowed border border-zinc-800'
                                : tipoEntrega === 'ambas'
                                  ? 'bg-[#FF7A00] text-black font-black shadow-[0_0_15px_rgba(255,122,0,0.5)]'
                                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            Ambas
                          </button>
                        </div>
                      </div>

                      {/* =========================================================================
                       * 🔥 BOTÓN FINAL: CONFIRMAR Y ENTREGAR
                       * ========================================================================= */}
                      <button
                        type="button"
                        onClick={handleConfirmarYEntregar}
                        disabled={
                          isConfirmingDelivery || 
                          (billMethod === 'EFECTIVO' && !isPaidOrOver) || 
                          (billMethod === 'QR' && !qrVerified)
                        }
                        className={`w-full mt-4 py-4 px-4 rounded-xl font-black text-sm text-black transition-all flex items-center justify-center gap-2 border border-amber-300/30 active:scale-98 ${
                          (billMethod === 'EFECTIVO' && isPaidOrOver) || (billMethod === 'QR' && qrVerified)
                            ? 'bg-[#FF7A00] hover:bg-[#ff8c1a] shadow-[0_0_20px_rgba(255,122,0,0.6)] cursor-pointer'
                            : 'bg-zinc-800 text-zinc-500 opacity-60 cursor-not-allowed shadow-none border-zinc-800'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5 text-black" />
                        <span>{isConfirmingDelivery ? 'Procesando...' : 'Confirmar y Entregar'}</span>
                      </button>

                    </div>
                  ) : (
                    /* =========================================================================
                     * 3. CONTROL DE SEGURIDAD Y VISTA DE COMENSAL:
                     * ========================================================================= */
                    <div className="space-y-4">
                      {/* Banner Informativo para Comensal */}
                      <div className="bg-[#292524] p-4 rounded-2xl border border-[#3a3632] space-y-3 text-center">
                        <div className="bg-white p-3 rounded-xl w-36 h-36 mx-auto flex items-center justify-center shadow-lg">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`PAGO_MESA_${currentTableId}_TOTAL_${totalToShow.toFixed(2)}`)}`}
                            alt="QR Simple Pago"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-[#f5efe6] block">
                            Escanea con tu aplicación de banca móvil
                          </span>
                          <span className="text-sm font-extrabold text-emerald-400 block">
                            Monto a Pagar: Bs. {totalToShow.toFixed(2)}
                          </span>
                          <p className="text-[11px] text-[#a8a29e] max-w-xs mx-auto">
                            Acepta Banco Sol, BNB, BCP, Banco Unión, Banco FIE, Banco Mercantil Santa Cruz y Simple QR.
                          </p>
                        </div>
                      </div>

                      {/* Nota de Cobro Exclusivo por Personal */}
                      <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/30 text-amber-200/90 text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-300">
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Instrucciones para Comensales</span>
                        </div>
                        <p className="text-[11px] text-[#d6d3d1] leading-relaxed">
                          Puedes transferir con el código QR superior o pagar en efectivo con tu mozo.
                          <strong> El personal del restaurante verificará el pago y liberará la mesa en el sistema.</strong>
                        </p>
                      </div>

                      {/* Botón para solicitar atención del mozo para pagar */}
                      {onCallWaiterForBill && (
                        <button
                          type="button"
                          onClick={() => {
                            setWaiterRequested(true);
                            onCallWaiterForBill();
                            setTimeout(() => setWaiterRequested(false), 5000);
                          }}
                          disabled={waiterRequested}
                          className={`w-full py-3.5 px-4 rounded-[14px] font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                            waiterRequested 
                              ? 'bg-emerald-600 text-white cursor-default' 
                              : 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white'
                          }`}
                        >
                          {waiterRequested ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-200" />
                              <span>¡Mozo Notificado! En breve se acercará a tu mesa</span>
                            </>
                          ) : (
                            <>
                              <Bell className="w-4 h-4 animate-bounce" />
                              <span>Llamar al Mozo para Pagar / Traer Cuenta</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Acceso Rápido con PIN para Mozo o Cajero en la mesa */}
                      <div className="pt-2 text-center">
                        {!showInlinePin ? (
                          <button
                            type="button"
                            onClick={() => setShowInlinePin(true)}
                            className="text-[11px] text-[#78716c] hover:text-[#a8a29e] flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                          >
                            <Lock className="w-3 h-3" />
                            <span>¿Eres mozo o personal del restaurante? Ingresar con PIN</span>
                          </button>
                        ) : (
                          <form onSubmit={handleInlinePinSubmit} className="bg-[#1c1917] p-3 rounded-xl border border-[#3a3632] space-y-2 text-left animate-fadeIn">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#f5efe6] flex items-center gap-1">
                                <KeyRound className="w-3.5 h-3.5 text-[#ff7a00]" /> PIN de Personal (Caja / Mozo)
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowInlinePin(false)}
                                className="text-[11px] text-[#78716c] hover:text-white"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="password"
                                maxLength={6}
                                placeholder="PIN (ej: 7777 o 1234)"
                                value={inlinePin}
                                onChange={(e) => setInlinePin(e.target.value)}
                                className="flex-1 bg-[#292524] border border-[#3a3632] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#ff7a00]"
                                autoFocus
                              />
                              <button
                                type="submit"
                                className="px-3.5 py-1.5 bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-bold text-xs rounded-lg cursor-pointer"
                              >
                                Acceder
                              </button>
                            </div>
                            {pinError && (
                              <p className="text-[10px] text-red-400 font-medium">{pinError}</p>
                            )}
                          </form>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Bottom Footer for Cart Ordering */}
        {itemsToShow.length > 0 && modalMode === 'cart' && (
          <div className="shrink-0 p-4 sm:p-5 bg-[#292524] border-t border-[#3a3632] shadow-[0_-8px_25px_rgba(0,0,0,0.5)] space-y-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-[#a8a29e] block">
                  {isAdditionMode ? 'Total de esta adición' : 'Total a Pagar'}
                </span>
                <span className="text-xs text-amber-400 font-medium">
                  {totalItemsCount} {totalItemsCount === 1 ? 'plato' : 'platos'} nuevos
                </span>
              </div>
              <div className="text-right">
                <span className="text-[20px] sm:text-[22px] font-black text-[#ff7a00] font-sans">
                  Bs. {totalToShow.toFixed(2)}
                </span>
                {isAdditionMode && activeOrder && (
                  <span className="text-[10px] text-[#a8a29e] block">
                    Total comanda final: Bs. {(activeOrder.total + totalToShow).toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onPlaceOrder}
              disabled={cart.length === 0}
              className="w-full py-3.5 sm:py-4 px-4 rounded-[16px] bg-gradient-to-r from-[#ff7a00] via-[#ff8c1a] to-[#ff7a00] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold text-[15px] sm:text-[16px] shadow-[0_6px_25px_rgba(255,122,0,0.5)] flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-white/20"
            >
              <Send className="w-5 h-5 text-white animate-pulse" />
              <span>{isAdditionMode ? 'Enviar Adición a Cocina' : 'Enviar Pedido a Cocina'}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
