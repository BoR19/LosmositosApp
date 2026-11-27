import React, { useState, useEffect, useMemo } from 'react';
import {
  X, ShoppingBag, Plus, Minus, Trash2, Send, CheckCircle2, Utensils,
  FileText, Sparkles, DollarSign, QrCode, ShieldCheck,
  Bell, Check, ArrowRightLeft, ChefHat, Flame, Percent, Pencil, MessageCircle, Clock, Printer
} from 'lucide-react';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.ts';
import { CartItem, Table, Order } from '../types/index.ts';
import { formatTableOptionLabel } from '../data/menuData.ts';
import { clearClientSessionStorage } from '../services/tableSessionService.ts';
import {
  TAKE_AWAY_RETIRE_NOTES,
  buildTakeAwayWhatsAppReadyUrl,
} from '../services/takeAwayService.ts';
import {
  countItemsQty,
  formatCurrencyBs,
  isValidBoliviaPhone,
  sanitizeBoliviaPhone,
} from '../utils/formatters.ts';

interface CartModalProps {
  isOpen: boolean;
  isDocked?: boolean;
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
  onPayment: (method: 'QR' | 'EFECTIVO', discountBs?: number) => Promise<void> | void;
  cashAmount: string;
  setCashAmount: (val: string) => void;
  onViewMenu: () => void;
  onSwitchToBill?: () => void;
  onSwitchMode?: (mode: 'cart' | 'bill') => void;
  isClientMode?: boolean;
  isStaffAuthenticated?: boolean;
  isAdminAuthenticated?: boolean;
  canTakeOrders?: boolean;
  canManageKitchen?: boolean;
  canCharge?: boolean;
  staffName?: string;
  onCallWaiterForBill?: () => void;
  onRequestTableChange?: () => void;
  onUpdateOrderStatus?: (orderId: string, newStatus: string) => void;
  onRemoveOrderItem?: (orderId: string, itemIndex: number) => void;
  onOpenTableMove?: (table: Table) => void;
  // Para Llevar (Take Away)
  takeAwayMode?: 'new' | string | null;
  activeTakeAwayOrders?: Order[];
  clientTakeAwayOrder?: Order | null;
  onSelectTakeAway?: (mode: 'new' | string | null) => void;
  onCreateTakeAwayOrder?: (params: {
    clienteNombre: string;
    clienteTelefono?: string;
    notaRetiro: string;
    cobrarAhora?: boolean;
    metodoPago?: 'EFECTIVO' | 'QR';
    cashGivenBs?: number;
    imprimirOEnviar?: boolean;
  }) => Promise<void>;
  onAddItemsToTakeAway?: (orderId: string) => Promise<void>;
  onUpdateTakeAwayItemQty?: (orderId: string, itemIndex: number, delta: number) => Promise<void>;
  onUpdateTakeAwayStatus?: (orderId: string, estadoCocina: 'preparando' | 'listo' | 'entregado') => Promise<void>;
  onRequestDeliveryVerify?: (order: Order) => void;
  onCollectTakeAwayPayment?: (params: {
    order: Order;
    method: 'EFECTIVO' | 'QR';
    discountBs: number;
    cashGivenBs?: number;
    tipoEntrega: 'whatsapp' | 'ticket' | 'ambas';
    phone?: string;
  }) => Promise<void>;
  onCancelTakeAwayOrder?: (orderId: string) => Promise<void>;
  onOpenTakeAwayTracker?: () => void;
}

const ORDER_STATUS_LABEL: Record<string, { label: string; badgeClass: string }> = {
  pendiente: {
    label: 'Pendiente',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  'en-preparacion': {
    label: 'En Fogones',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  servido: {
    label: 'Servido',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  'por-pagar': {
    label: 'Por Pagar',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
};

export const CartModal: React.FC<CartModalProps> = ({
  isOpen,
  isDocked = false,
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
  onSwitchMode,
  isClientMode: propIsClientMode,
  isStaffAuthenticated = false,
  isAdminAuthenticated = false,
  canTakeOrders = false,
  canManageKitchen = false,
  canCharge = true,
  staffName = 'Personal',
  onCallWaiterForBill,
  onRequestTableChange,
  onUpdateOrderStatus,
  onRemoveOrderItem,
  onOpenTableMove,
  takeAwayMode = null,
  activeTakeAwayOrders = [],
  clientTakeAwayOrder = null,
  onSelectTakeAway,
  onCreateTakeAwayOrder,
  onAddItemsToTakeAway,
  onUpdateTakeAwayItemQty,
  onUpdateTakeAwayStatus,
  onRequestDeliveryVerify,
  onCollectTakeAwayPayment,
  onCancelTakeAwayOrder,
  onOpenTakeAwayTracker,
}) => {
  // =========================================================================
  // ALL HOOKS UNCONDITIONALLY AT TOP (Rules of Hooks safe)
  // =========================================================================
  const [billMethod, setBillMethod] = useState<'EFECTIVO' | 'QR'>('EFECTIVO');
  const [discountInput, setDiscountInput] = useState<string>('');
  const [qrVerified, setQrVerified] = useState<boolean>(false);
  const [waiterRequested, setWaiterRequested] = useState<boolean>(false);
  const [tipoEntrega, setTipoEntrega] = useState<'whatsapp' | 'ticket' | 'ambas'>('ambas');
  const [clienteCelular, setClienteCelular] = useState<string>('');
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState<boolean>(false);

  // Estados Para Llevar (Nuevo pedido)
  const [takeAwayNombre, setTakeAwayNombre] = useState<string>('');
  const [takeAwayTelefono, setTakeAwayTelefono] = useState<string>(() => {
    try {
      return typeof localStorage !== 'undefined'
        ? sanitizeBoliviaPhone(localStorage.getItem('churo_celular') || '')
        : '';
    } catch {
      return '';
    }
  });
  const [takeAwayNotaRetiro, setTakeAwayNotaRetiro] = useState<string>('En 15 min');
  const [takeAwayCobrarAhora, setTakeAwayCobrarAhora] = useState<boolean>(false);
  const [takeAwayMetodoPago, setTakeAwayMetodoPago] = useState<'EFECTIVO' | 'QR'>('EFECTIVO');
  const [takeAwayCashGiven, setTakeAwayCashGiven] = useState<string>('');
  const [takeAwayQrOk, setTakeAwayQrOk] = useState<boolean>(false);
  const [takeAwayImprimirOEnviar, setTakeAwayImprimirOEnviar] = useState<boolean>(true);
  const [takeAwayFormError, setTakeAwayFormError] = useState<string>('');
  const [isSubmittingTakeAway, setIsSubmittingTakeAway] = useState<boolean>(false);

  const mesaQR = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mesa') : null;
  const isStaff = Boolean(
    isStaffAuthenticated ||
      (typeof window !== 'undefined' && (
        window.location.pathname.includes('/admin') ||
        window.location.pathname.includes('/mesas')
      ))
  );
  const isClient = propIsClientMode !== undefined
    ? propIsClientMode
    : Boolean(!isStaff && (mesaQR || (typeof localStorage !== 'undefined' && localStorage.getItem('churo_mesa'))));
  const effectiveMesaQR = mesaQR || (typeof localStorage !== 'undefined' ? localStorage.getItem('churo_mesa') : null) || currentTableId;
  const effectiveTableNumber = isClient ? (Number(effectiveMesaQR) || currentTableId) : currentTableId;

  const allowTakeOrders = isClient || !isStaffAuthenticated || (isStaffAuthenticated && (isAdminAuthenticated || canTakeOrders));
  const allowKitchenControls = Boolean(isStaffAuthenticated && !isClient && (isAdminAuthenticated || canManageKitchen));
  const allowChargeControls = Boolean(isStaffAuthenticated && (isAdminAuthenticated || canCharge));
  const allowRemoveSentItems = Boolean(isStaffAuthenticated && !isClient && isAdminAuthenticated);
  const allowMoveTable = Boolean(isStaffAuthenticated && !isClient && isAdminAuthenticated && onOpenTableMove);

  const selectedTakeAwayOrder = useMemo(() => {
    if (isStaffAuthenticated) {
      if (!takeAwayMode || takeAwayMode === 'new') return null;
      return activeTakeAwayOrders.find((o) => o.id === takeAwayMode) || null;
    }
    return clientTakeAwayOrder || null;
  }, [isStaffAuthenticated, takeAwayMode, activeTakeAwayOrders, clientTakeAwayOrder]);

  const isTakeAwayFlow = Boolean(
    takeAwayMode !== null || (!isStaffAuthenticated && !isClient && currentTableId === null)
  );
  const isNewTakeAwayForm = Boolean(
    isTakeAwayFlow && !selectedTakeAwayOrder && (takeAwayMode === 'new' || !isStaffAuthenticated)
  );

  // Cargar número de celular del cliente
  useEffect(() => {
    if (!(isDocked || isOpen) || modalMode !== 'bill') return;

    if (selectedTakeAwayOrder) {
      const phone = sanitizeBoliviaPhone(selectedTakeAwayOrder.clienteTelefono || '');
      setClienteCelular(phone);
      setTipoEntrega(isValidBoliviaPhone(phone) ? 'ambas' : 'ticket');
      return;
    }

    const targetMesaId = isClient ? (Number(effectiveMesaQR) || currentTableId) : currentTableId;
    if (targetMesaId !== null) {
      const fetchMesaCelular = async () => {
        if (isClient) {
          const savedPhone = localStorage.getItem('churo_celular') || '';
          if (savedPhone) {
            setClienteCelular(savedPhone);
            setTipoEntrega('ambas');
            return;
          }
        }
        try {
          const ref = doc(db, 'mesas_activas', `mesa_${targetMesaId}`);
          const snap = await getDoc(ref);
          if (snap.exists() && snap.data().cliente_celular) {
            const phone = String(snap.data().cliente_celular);
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
  }, [isOpen, isDocked, modalMode, currentTableId, isClient, effectiveMesaQR, selectedTakeAwayOrder]);

  // Reset UI helper states & manage Escape/scroll lock
  useEffect(() => {
    setQrVerified(false);
    setWaiterRequested(false);
    setDiscountInput('');
    setTakeAwayFormError('');

    if (isDocked || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isDocked, onClose, currentTableId, modalMode, takeAwayMode]);

  const currentTable = useMemo(() => {
    if (effectiveTableNumber === null) return null;
    return tables.find((t) => t.id === Number(effectiveTableNumber)) || null;
  }, [tables, effectiveTableNumber]);

  const effectiveOrder = selectedTakeAwayOrder || activeOrder || (currentTable ? currentTable.currentOrder : null);
  const isAdditionMode = Boolean(effectiveOrder && modalMode === 'cart' && !isNewTakeAwayForm);
  const subtotalToShow = modalMode === 'bill' ? (effectiveOrder?.total || 0) : cartTotal;

  const discountValue = useMemo(() => {
    if (modalMode !== 'bill' || !allowChargeControls) return 0;
    const parsed = parseFloat(discountInput);
    if (isNaN(parsed) || parsed <= 0) return 0;
    return Math.min(parsed, subtotalToShow);
  }, [discountInput, modalMode, allowChargeControls, subtotalToShow]);

  const totalToShow = useMemo(() => {
    if (modalMode === 'bill') {
      return Math.max(0, Number((subtotalToShow - discountValue).toFixed(2)));
    }
    return subtotalToShow;
  }, [modalMode, subtotalToShow, discountValue]);

  const itemsToShow = modalMode === 'bill' ? (effectiveOrder?.items || []) : cart;
  const totalItemsCount = useMemo(() => countItemsQty(cart), [cart]);

  const cleanReceiptPhone = sanitizeBoliviaPhone(clienteCelular);
  const isValidReceiptPhone = isValidBoliviaPhone(cleanReceiptPhone);
  const hasPartialReceiptPhone = cleanReceiptPhone.length > 0 && !isValidReceiptPhone;

  const staffSelectValue = useMemo(() => {
    if (takeAwayMode === 'new') return 'NEW_LLEVAR';
    if (takeAwayMode && takeAwayMode !== 'new') return `LLEVAR:${takeAwayMode}`;
    return currentTableId !== null ? String(currentTableId) : '';
  }, [takeAwayMode, currentTableId]);

  if (!isDocked && !isOpen) return null;

  // =========================================================================
  // LÓGICA DE PAGO EN EFECTIVO (Cálculo y Validación Dinámica)
  // =========================================================================
  const cleanCashStr = cashAmount.trim();
  const cashNum = cleanCashStr === '' ? 0 : parseFloat(cleanCashStr);
  const hasEnteredCash = cleanCashStr !== '' && !isNaN(cashNum);

  const isUnderpaid = hasEnteredCash && cashNum < totalToShow;
  const isPaidOrOver = hasEnteredCash && cashNum >= totalToShow;

  const montoFaltante = isUnderpaid ? (totalToShow - cashNum).toFixed(2) : '0.00';
  const montoVuelto = isPaidOrOver ? (cashNum - totalToShow).toFixed(2) : '0.00';

  const cleanTakeAwayPhone = sanitizeBoliviaPhone(takeAwayTelefono);
  const isValidTakeAwayPhone = isValidBoliviaPhone(cleanTakeAwayPhone);
  const hasPartialTakeAwayPhone = cleanTakeAwayPhone.length > 0 && !isValidTakeAwayPhone;
  const parsedTakeAwayCash = parseFloat(takeAwayCashGiven);
  const isTakeAwayCashValid =
    !takeAwayCobrarAhora ||
    takeAwayMetodoPago !== 'EFECTIVO' ||
    (!isNaN(parsedTakeAwayCash) && parsedTakeAwayCash >= cartTotal);

  const handleConfirmarYEntregar = async () => {
    if (!allowChargeControls) return;
    if (billMethod === 'EFECTIVO' && !isPaidOrOver) return;
    if (billMethod === 'QR' && !qrVerified) return;

    setIsConfirmingDelivery(true);

    try {
      // Caso Para Llevar: delegado al flujo de cobro Take Away
      if (selectedTakeAwayOrder && onCollectTakeAwayPayment) {
        await onCollectTakeAwayPayment({
          order: selectedTakeAwayOrder,
          method: billMethod,
          discountBs: discountValue,
          cashGivenBs: billMethod === 'EFECTIVO' && hasEnteredCash ? cashNum : undefined,
          tipoEntrega,
          phone: isValidReceiptPhone ? cleanReceiptPhone : undefined,
        });
        return;
      }

      const mesaNum = Number(effectiveTableNumber || currentTable?.id || 0);
      const mesaName = currentTable ? currentTable.name : `Mesa #${mesaNum}`;
      const fechaStr = new Date().toLocaleString('es-BO', {
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const itemsListText = itemsToShow
        .map((i: any) => `- ${i.qty}x ${i.nombre} - ${formatCurrencyBs(i.precioBs * i.qty)}`)
        .join('\n');

      const rawRecibo =
`*EL CHURO MOSITO*
🧾 Recibo Digital de Consumo
----------------------------------
*Mesa:* ${mesaName}
*Fecha:* ${fechaStr}
*Método de Pago:* ${billMethod}
----------------------------------
*Detalle de Consumo:*
${itemsListText}
----------------------------------
${discountValue > 0 ? `*Descuento:* -${formatCurrencyBs(discountValue)}\n` : ''}*Total:* ${formatCurrencyBs(totalToShow)}
${billMethod === 'EFECTIVO' && hasEnteredCash ? `*Efectivo Entregado:* ${formatCurrencyBs(cashNum)}\n*Cambio:* Bs. ${montoVuelto}\n` : ''}----------------------------------
¡Muchas gracias por tu visita!
Gastronomía de Altura • Tarija`;

      const textoRecibo = rawRecibo.replace(/\uFFFD/g, '');

      if ((tipoEntrega === 'whatsapp' || tipoEntrega === 'ambas') && isValidReceiptPhone) {
        const waUrl = `https://wa.me/591${cleanReceiptPhone}?text=${encodeURIComponent(textoRecibo)}`;
        window.open(waUrl, '_blank');
      }

      if (tipoEntrega === 'ticket' || tipoEntrega === 'ambas') {
        try {
          await addDoc(collection(db, 'print_queue'), {
            mesa: mesaNum,
            tableName: mesaName,
            textoRecibo,
            total: totalToShow,
            descuento: discountValue,
            fecha: serverTimestamp(),
            status: 'pending',
          });
        } catch (pErr) {
          console.warn('Error al guardar en print_queue:', pErr);
        }
      }

      try {
        await addDoc(collection(db, 'tickets_history'), {
          mesa: mesaNum,
          tableName: mesaName,
          total: totalToShow,
          descuento: discountValue,
          celular: isValidReceiptPhone ? cleanReceiptPhone : null,
          tipoEntrega,
          metodoPago: billMethod,
          fecha: serverTimestamp(),
          reimpresiones: 0,
        });
      } catch (tErr) {
        console.warn('Error al guardar en tickets_history:', tErr);
      }

      await onPayment(billMethod, discountValue);

      if (!isStaffAuthenticated && mesaNum) {
        clearClientSessionStorage(mesaNum);
      }
    } catch (err) {
      console.error('Error al confirmar y entregar recibo:', err);
    } finally {
      setIsConfirmingDelivery(false);
    }
  };

  const handleSubmitNewTakeAway = async () => {
    if (cart.length === 0) {
      setTakeAwayFormError('Agrega al menos un plato del menú antes de confirmar.');
      return;
    }
    const trimmedName = takeAwayNombre.trim();
    if (trimmedName.length < 2) {
      setTakeAwayFormError('Ingresa el nombre del cliente para retirar el pedido.');
      return;
    }
    if (hasPartialTakeAwayPhone) {
      setTakeAwayFormError(
        'Ingresa un número de celular válido de Bolivia (8 dígitos empezando con 6 o 7) o déjalo vacío.'
      );
      return;
    }
    if (isStaffAuthenticated && takeAwayCobrarAhora && allowChargeControls) {
      if (takeAwayMetodoPago === 'EFECTIVO' && !isTakeAwayCashValid) {
        setTakeAwayFormError('Ingresa el monto en efectivo igual o mayor al total.');
        return;
      }
      if (takeAwayMetodoPago === 'QR' && !takeAwayQrOk) {
        setTakeAwayFormError('Confirma la verificación del pago QR Simple en banca móvil.');
        return;
      }
    }

    if (!onCreateTakeAwayOrder) return;
    setTakeAwayFormError('');
    setIsSubmittingTakeAway(true);
    try {
      await onCreateTakeAwayOrder({
        clienteNombre: trimmedName,
        clienteTelefono: isValidTakeAwayPhone ? cleanTakeAwayPhone : undefined,
        notaRetiro: takeAwayNotaRetiro.trim() || 'En 15 min',
        cobrarAhora: Boolean(isStaffAuthenticated && allowChargeControls && takeAwayCobrarAhora),
        metodoPago: takeAwayMetodoPago,
        cashGivenBs:
          takeAwayMetodoPago === 'EFECTIVO' && !isNaN(parsedTakeAwayCash)
            ? parsedTakeAwayCash
            : undefined,
        imprimirOEnviar: isStaffAuthenticated ? takeAwayImprimirOEnviar : false,
      });
      setTakeAwayNombre('');
      setTakeAwayCashGiven('');
      setTakeAwayQrOk(false);
      setTakeAwayCobrarAhora(false);
    } finally {
      setIsSubmittingTakeAway(false);
    }
  };

  const orderStatusInfo = effectiveOrder
    ? (ORDER_STATUS_LABEL[effectiveOrder.status || 'pendiente'] || ORDER_STATUS_LABEL.pendiente)
    : null;

  const headerSubtitle = selectedTakeAwayOrder
    ? `🛍️ Para Llevar ${selectedTakeAwayOrder.codigoCorrelativo || '#LL-01'} • ${selectedTakeAwayOrder.clienteNombre || 'Mostrador'}`
    : isNewTakeAwayForm
      ? '🛍️ Nuevo Pedido Para Llevar'
      : currentTable
        ? currentTable.name
        : currentTableId
          ? `Mesa #${currentTableId}`
          : 'Mesa no asignada';

  const panelContent = (
    <div
      className={
        isDocked
          ? 'w-full h-full bg-[#1c1917] flex flex-col justify-between border-l border-[#3a3632] overflow-hidden'
          : 'relative w-full max-w-[520px] bg-[#1c1917] h-[100dvh] max-h-[100dvh] flex flex-col justify-between border-l border-[#3a3632] shadow-2xl z-10 overflow-hidden'
      }
    >
      {/* Header (Always Visible) */}
      <div className="shrink-0 p-4 sm:p-5 border-b border-[#3a3632] flex items-center justify-between bg-[#292524]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              modalMode === 'bill'
                ? 'bg-emerald-500/20 text-emerald-400'
                : isAdditionMode
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-[#ff7a00]/20 text-[#ff7a00]'
            }`}
          >
            {modalMode === 'bill' ? <FileText className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-[17px] sm:text-[18px] font-serif font-bold text-[#f5efe6] leading-tight truncate">
              {modalMode === 'bill'
                ? selectedTakeAwayOrder
                  ? `Cobro ${selectedTakeAwayOrder.codigoCorrelativo || 'Para Llevar'}`
                  : 'Cuenta de la Mesa'
                : selectedTakeAwayOrder
                  ? `Para Llevar ${selectedTakeAwayOrder.codigoCorrelativo || '#LL-01'}`
                  : isNewTakeAwayForm
                    ? 'Nuevo Pedido Para Llevar'
                    : isAdditionMode
                      ? 'Comanda y Adición'
                      : 'Tu Pedido en Carrito'}
            </h3>
            <p className="text-[11px] text-[#a8a29e] flex items-center gap-1.5 truncate">
              <span className="truncate">{headerSubtitle}</span>
              {modalMode === 'cart' && totalItemsCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-[#ff7a00] font-semibold shrink-0">
                    {totalItemsCount} {totalItemsCount === 1 ? 'ítem' : 'ítems'}
                  </span>
                </>
              )}
              {isStaffAuthenticated && (
                <span className="text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3 h-3" /> {staffName}
                </span>
              )}
            </p>
          </div>
        </div>
        {!isDocked && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1c1917] hover:bg-[#3a3632] text-[#a8a29e] hover:text-white transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 overscroll-contain pos-scrollbar">
        {/* Selector de Destino / Mesa / Para Llevar */}
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
        ) : isStaffAuthenticated ? (
          <div className="space-y-2.5">
            <div
              className={`min-w-0 p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                !staffSelectValue
                  ? 'bg-amber-950/30 border-amber-500/50'
                  : 'bg-[#292524] border-[#3a3632]'
              }`}
            >
              <span className="text-[#a8a29e] font-medium flex items-center gap-1.5 shrink-0">
                <span>Destino:</span>
                {!staffSelectValue && (
                  <span className="text-amber-400 font-bold text-[10px]">(Requerido)</span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <select
                  value={staffSelectValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'NEW_LLEVAR') {
                      onSelectTakeAway?.('new');
                    } else if (val.startsWith('LLEVAR:')) {
                      onSelectTakeAway?.(val.replace('LLEVAR:', ''));
                    } else if (val) {
                      onSelectTakeAway?.(null);
                      onTableChange(Number(val));
                    }
                  }}
                  className="w-full truncate pr-8 bg-[#1c1917] text-[#ff7a00] font-bold border border-[#3a3632] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#ff7a00] cursor-pointer"
                >
                  <option value="" disabled className="bg-[#1c1917] text-stone-400">
                    -- Selecciona Mesa o Para Llevar --
                  </option>
                  <option value="NEW_LLEVAR" className="bg-[#1c1917] text-[#ff7a00] font-bold">
                    🛍️ + Nuevo Pedido Para Llevar
                  </option>
                  {activeTakeAwayOrders.length > 0 && (
                    <optgroup label="Pedidos Para Llevar Activos" className="bg-[#1c1917] text-white">
                      {activeTakeAwayOrders.map((ll) => (
                        <option key={`ll-opt-${ll.id}`} value={`LLEVAR:${ll.id}`}>
                          {`🛍️ ${ll.codigoCorrelativo || '#LL'} • ${ll.clienteNombre || 'Mostrador'}`}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Mesas del Salón" className="bg-[#1c1917] text-white">
                    {tables.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {formatTableOptionLabel(t)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Pestañas rápidas entre Comanda/Adición y Cobro/Cuenta */}
            {effectiveOrder &&
              (allowChargeControls || allowTakeOrders) &&
              onSwitchMode &&
              (!selectedTakeAwayOrder || !selectedTakeAwayOrder.pagado) && (
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#292524] border border-[#3a3632]">
                  <button
                    type="button"
                    onClick={() => onSwitchMode('cart')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      modalMode === 'cart'
                        ? 'bg-[#ff7a00] text-white shadow'
                        : 'text-[#a8a29e] hover:text-[#f5efe6]'
                    }`}
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>{selectedTakeAwayOrder ? 'Detalle y Edición' : 'Comanda y Adición'}</span>
                  </button>
                  {allowChargeControls && (
                    <button
                      type="button"
                      onClick={() => onSwitchMode('bill')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        modalMode === 'bill'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-[#a8a29e] hover:text-[#f5efe6]'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Cobro y Cuenta</span>
                    </button>
                  )}
                </div>
              )}
          </div>
        ) : (
          /* Cliente sin mesa QR (Modo Para Llevar) */
          <div className="p-3.5 rounded-xl border border-[#ff7a00]/30 bg-[#292524] flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#ff7a00] font-bold">
              <span>🛍️</span>
              <span>
                {selectedTakeAwayOrder
                  ? `Para Llevar ${selectedTakeAwayOrder.codigoCorrelativo || '#LL-01'}`
                  : 'Pedido Para Llevar (Retiro en local)'}
              </span>
            </div>
            {selectedTakeAwayOrder && onOpenTakeAwayTracker && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTakeAwayTracker();
                }}
                className="px-2.5 py-1 rounded-lg bg-[#ff7a00]/20 hover:bg-[#ff7a00] text-[#ff7a00] hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
              >
                Ver Código
              </button>
            )}
          </div>
        )}

        {/* =====================================================================
         * BLOQUE DE COMANDA ACTIVA PARA LLEVAR (#LL-XX)
         * ===================================================================== */}
        {selectedTakeAwayOrder && modalMode === 'cart' && (
          <div className="bg-[#292524] border-2 border-[#ff7a00]/45 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-start justify-between gap-2 border-b border-[#3a3632] pb-2.5">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-[#ff7a00] flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {selectedTakeAwayOrder.codigoCorrelativo || '#LL-01'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedTakeAwayOrder.estadoCocina === 'listo'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : selectedTakeAwayOrder.estadoCocina === 'entregado'
                          ? 'bg-zinc-700 text-zinc-200 border-zinc-600'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {selectedTakeAwayOrder.estadoCocina === 'listo'
                      ? 'Listo para retirar'
                      : selectedTakeAwayOrder.estadoCocina === 'entregado'
                        ? 'Entregado'
                        : 'Preparando'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedTakeAwayOrder.pagado
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}
                  >
                    {selectedTakeAwayOrder.pagado ? 'PAGADO' : 'POR COBRAR'}
                  </span>
                </div>
                <p className="text-sm font-bold text-[#f5efe6] truncate">
                  {selectedTakeAwayOrder.clienteNombre || 'Cliente Mostrador'}
                </p>
                <p className="text-[11px] text-[#a8a29e] flex items-center gap-1.5 flex-wrap">
                  <Clock className="w-3 h-3 text-[#ff7a00]" />
                  <span>{selectedTakeAwayOrder.notaRetiro || 'En 15 min'}</span>
                  {selectedTakeAwayOrder.clienteTelefono && (
                    <span>• +591 {selectedTakeAwayOrder.clienteTelefono}</span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase text-[#a8a29e] block font-bold">Total</span>
                <span className="text-base font-black text-[#ff7a00]">
                  {formatCurrencyBs(selectedTakeAwayOrder.total)}
                </span>
              </div>
            </div>

            {/* Ítems del pedido Para Llevar con edición -/+ antes de cerrar */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 pos-scrollbar">
              {selectedTakeAwayOrder.items.map((item, idx) => {
                const canEditQty =
                  isStaffAuthenticated &&
                  allowTakeOrders &&
                  !selectedTakeAwayOrder.pagado &&
                  selectedTakeAwayOrder.estadoCocina !== 'entregado' &&
                  Boolean(onUpdateTakeAwayItemQty);

                return (
                  <div
                    key={item.orderItemId || `ll-item-${selectedTakeAwayOrder.id}-${item.id}-${idx}`}
                    className="flex items-center justify-between gap-2 bg-[#1c1917] px-3 py-2 rounded-xl border border-[#3a3632]/80 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#f5efe6] truncate">
                          {item.qty}x {item.nombre}
                        </span>
                        {item.isAddition && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold shrink-0">
                            Adición
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#a8a29e]">
                        {formatCurrencyBs(item.precioBs)} c/u •{' '}
                        <strong className="text-[#ff7a00]">
                          {formatCurrencyBs(item.precioBs * item.qty)}
                        </strong>
                      </span>
                    </div>

                    {canEditQty && onUpdateTakeAwayItemQty && (
                      <div className="flex items-center gap-1 bg-[#292524] px-1.5 py-1 rounded-lg border border-[#3a3632] shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateTakeAwayItemQty(selectedTakeAwayOrder.id, idx, -1)}
                          className="p-1 text-[#a8a29e] hover:text-red-400 transition-colors cursor-pointer"
                          title={item.qty <= 1 ? 'Quitar plato' : 'Restar cantidad'}
                        >
                          {item.qty <= 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        </button>
                        <span className="text-[11px] font-bold w-4 text-center text-[#f5efe6]">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateTakeAwayItemQty(selectedTakeAwayOrder.id, idx, 1)}
                          className="p-1 text-[#ff7a00] hover:text-[#ff8c1a] transition-colors cursor-pointer"
                          title="Sumar cantidad"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Controles Staff para Pedido Para Llevar */}
            {isStaffAuthenticated && (
              <div className="pt-2 border-t border-[#3a3632] space-y-2">
                {allowKitchenControls && onUpdateTakeAwayStatus && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateTakeAwayStatus(selectedTakeAwayOrder.id, 'preparando')}
                      className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        selectedTakeAwayOrder.estadoCocina === 'preparando'
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#3a3632]'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Preparando</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateTakeAwayStatus(selectedTakeAwayOrder.id, 'listo')}
                      className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        selectedTakeAwayOrder.estadoCocina === 'listo'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#3a3632]'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Listo</span>
                    </button>
                  </div>
                )}

                {(() => {
                  const waUrl = buildTakeAwayWhatsAppReadyUrl(selectedTakeAwayOrder);
                  if (!waUrl) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => window.open(waUrl, '_blank')}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#22c35e] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>📲 Avisar Listo por WhatsApp</span>
                    </button>
                  );
                })()}

                <div className="flex flex-wrap gap-2">
                  {onRequestDeliveryVerify && selectedTakeAwayOrder.estadoCocina !== 'entregado' && (
                    <button
                      type="button"
                      onClick={() => onRequestDeliveryVerify(selectedTakeAwayOrder)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Entregar</span>
                    </button>
                  )}

                  {!selectedTakeAwayOrder.pagado && allowChargeControls && onSwitchMode && (
                    <button
                      type="button"
                      onClick={() => onSwitchMode('bill')}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Cobrar Cuenta</span>
                    </button>
                  )}
                </div>

                {isAdminAuthenticated && onCancelTakeAwayOrder && (
                  <button
                    type="button"
                    onClick={() => onCancelTakeAwayOrder(selectedTakeAwayOrder.id)}
                    className="w-full py-2 px-3 rounded-xl bg-red-950/50 hover:bg-red-900 border border-red-700/40 text-red-300 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Anular pedido (Admin)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
         * BLOQUE DE COMANDA ACTIVA EN MESA DE SALÓN
         * ===================================================================== */}
        {!selectedTakeAwayOrder && effectiveOrder && modalMode === 'cart' && (
          <div className="bg-[#292524] border border-[#3a3632] rounded-2xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between gap-2 border-b border-[#3a3632] pb-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-[#ff7a00] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    Comanda Activa
                  </span>
                  {orderStatusInfo && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${orderStatusInfo.badgeClass}`}>
                      {orderStatusInfo.label}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#a8a29e] mt-0.5 truncate">
                  #{effectiveOrder.id.slice(0, 12)} • {effectiveOrder.time}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase text-[#a8a29e] block font-bold">Consumo</span>
                <span className="text-base font-black text-[#ff7a00]">
                  {formatCurrencyBs(effectiveOrder.total)}
                </span>
              </div>
            </div>

            {/* Listado de platos ya enviados a cocina */}
            <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1 pos-scrollbar">
              {effectiveOrder.items.map((item, idx) => {
                const orderItemId = 'orderItemId' in item ? item.orderItemId : undefined;
                const isAddition = 'isAddition' in item ? Boolean(item.isAddition) : false;
                return (
                  <div
                    key={orderItemId || `active-ord-${effectiveOrder.id}-${item.id}-${idx}`}
                    className="flex items-center justify-between gap-2 bg-[#1c1917] px-3 py-2 rounded-xl border border-[#3a3632]/80 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#f5efe6] truncate">
                          {item.qty}x {item.nombre}
                        </span>
                        {isAddition && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold shrink-0">
                            Adición
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#a8a29e]">
                        {formatCurrencyBs(item.precioBs)} c/u
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-[#ff7a00]">
                        {formatCurrencyBs(item.precioBs * item.qty)}
                      </span>
                      {allowRemoveSentItems && onRemoveOrderItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveOrderItem(effectiveOrder.id, idx)}
                          className="p-1.5 rounded-lg bg-[#292524] hover:bg-red-950 text-red-400 hover:text-red-300 border border-[#3a3632] hover:border-red-500/40 transition-colors cursor-pointer"
                          title="Anular ítem de la comanda (Solo Administrador)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {allowKitchenControls && onUpdateOrderStatus && (
              <div className="pt-2 border-t border-[#3a3632] space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#a8a29e] flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5 text-[#ff7a00]" />
                  Control de Cocina (KDS)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateOrderStatus(effectiveOrder.id, 'en-preparacion')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      effectiveOrder.status === 'en-preparacion'
                        ? 'bg-amber-600 text-white shadow'
                        : 'bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#3a3632]'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>En Fogones</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateOrderStatus(effectiveOrder.id, 'servido')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      effectiveOrder.status === 'servido'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#3a3632]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Servido</span>
                  </button>
                </div>
              </div>
            )}

            {!isClient && isStaffAuthenticated ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {allowTakeOrders && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewMenu();
                    }}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Adición</span>
                  </button>
                )}

                {allowMoveTable && currentTable && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTableMove?.(currentTable);
                    }}
                    className="py-2 px-3 rounded-xl bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00]/50 text-[#f5efe6] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-[#ff7a00]" />
                    <span>Mover Mesa</span>
                  </button>
                )}

                {allowChargeControls && onSwitchMode ? (
                  <button
                    type="button"
                    onClick={() => onSwitchMode('bill')}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Ir a Cobrar Cuenta</span>
                  </button>
                ) : (allowTakeOrders && onSwitchToBill) && (
                  <button
                    type="button"
                    onClick={onSwitchToBill}
                    className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-[#1c1917] hover:bg-[#3a3632] border border-emerald-500/40 text-emerald-400 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Solicitar Cuenta</span>
                  </button>
                )}
              </div>
            ) : onCallWaiterForBill && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setWaiterRequested(true);
                    onCallWaiterForBill();
                    setTimeout(() => setWaiterRequested(false), 5000);
                  }}
                  disabled={waiterRequested}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                    waiterRequested
                      ? 'bg-emerald-600 border-emerald-500 text-white cursor-default'
                      : 'bg-[#1c1917] hover:bg-[#3a3632] border-emerald-500/40 text-emerald-400'
                  }`}
                >
                  {waiterRequested ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>¡Cuenta solicitada! Un mozo se acerca</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" />
                      <span>Solicitar Cuenta</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
         * LISTA DE PLATOS EN CARRITO LOCAL O CUENTA A COBRAR
         * ===================================================================== */}
        {itemsToShow.length === 0 ? (
          modalMode === 'cart' && effectiveOrder ? (
            allowTakeOrders ? (
              <div className="p-4 rounded-2xl bg-[#292524]/60 border border-dashed border-[#3a3632] text-center space-y-2">
                <p className="text-xs text-[#a8a29e]">
                  {selectedTakeAwayOrder
                    ? '¿Deseas sumar más platos a este pedido Para Llevar? Agrégalos desde el menú sin crear otro código.'
                    : '¿El comensal pidió algo más? Usa Agregar Adición para sumar platos del menú sin duplicar la mesa en cocina.'}
                </p>
              </div>
            ) : null
          ) : (
            <div className="text-center py-12 px-4 text-[#a8a29e]">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#ff7a00]/15 flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-[#ff7a00]" />
              </div>
              <p className="text-lg font-bold text-[#f5efe6] mb-1">
                {modalMode === 'bill' ? 'No hay consumos pendientes' : 'No tienes platos en el carrito'}
              </p>
              <p className="text-xs text-[#a8a29e] max-w-xs mx-auto mb-6 leading-relaxed">
                {modalMode === 'bill'
                  ? 'No hay comandas pendientes de pago en este momento.'
                  : isNewTakeAwayForm
                    ? 'Agrega tus platos favoritos del menú y luego completa tu nombre para retirar en mostrador.'
                    : currentTable
                      ? `Mesa lista (${currentTable.name}). Explora el menú para agregar los platos de este pedido.`
                      : 'Explora nuestro menú tradicional y a la leña para añadir tus platos favoritos.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {allowTakeOrders && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewMenu();
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-bold text-sm shadow-lg transition-transform active:scale-95 inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Utensils className="w-4 h-4" /> Ver Menú Completo
                  </button>
                )}
                {effectiveOrder && onSwitchToBill && modalMode === 'cart' && (
                  <button
                    type="button"
                    onClick={onSwitchToBill}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#292524] hover:bg-[#3a3632] text-emerald-400 font-bold text-sm border border-emerald-500/30 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Ver Cuenta Activa ({formatCurrencyBs(effectiveOrder.total)})
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {/* Header de Cuenta (Mesa o Para Llevar) */}
            {modalMode === 'bill' && (
              <div className="bg-[#292524] p-3.5 sm:p-4 rounded-2xl border border-[#3a3632] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#a8a29e] block">
                    {discountValue > 0 ? 'Total Neto con Descuento' : 'Consumo Total de la Cuenta'}
                  </span>
                  <span className="text-[13px] font-semibold text-[#f5efe6]">
                    {selectedTakeAwayOrder
                      ? `🛍️ Para Llevar ${selectedTakeAwayOrder.codigoCorrelativo || '#LL-01'} (${selectedTakeAwayOrder.clienteNombre || 'Cliente'})`
                      : currentTable
                        ? currentTable.name
                        : `Mesa #${currentTableId}`}
                  </span>
                  {discountValue > 0 && (
                    <span className="text-[10px] text-emerald-400 font-semibold block">
                      Subtotal {formatCurrencyBs(subtotalToShow)} - Desc. {formatCurrencyBs(discountValue)}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[22px] sm:text-[24px] font-black text-[#ff7a00] font-sans block leading-none">
                    {formatCurrencyBs(totalToShow)}
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
                {modalMode === 'bill'
                  ? 'Detalle de Platos y Bebidas consumidos:'
                  : selectedTakeAwayOrder
                    ? `Nuevos platos a sumar a ${selectedTakeAwayOrder.codigoCorrelativo || '#LL'}:`
                    : isAdditionMode
                      ? 'Nuevos platos a adicionar:'
                      : 'Productos en tu Carrito:'}
              </span>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 pos-scrollbar">
                {itemsToShow.map((item: any, index: number) => (
                  <div
                    key={
                      item.orderItemId ||
                      (modalMode === 'cart'
                        ? `cart-${item.id}`
                        : `bill-${item.id}-${item.isAddition ? 'add' : 'base'}-${index}`)
                    }
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
                          {formatCurrencyBs(item.precioBs * item.qty)}
                        </span>
                        <span className="text-[11px] text-[#a8a29e]">
                          ({item.qty}x {formatCurrencyBs(item.precioBs)})
                        </span>
                      </div>
                    </div>

                    {modalMode === 'cart' && allowTakeOrders ? (
                      <div className="flex items-center gap-1.5 bg-[#1c1917] px-2 py-1 rounded-xl border border-[#3a3632] shrink-0">
                        {item.qty === 1 ? (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Eliminar del carrito"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
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
                          type="button"
                          onClick={() => onUpdateQty(item.id, 1)}
                          className="p-1 text-[#ff7a00] hover:text-[#ff8c1a] transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold text-[#a8a29e] bg-[#1c1917] px-2.5 py-1 rounded-lg border border-[#3a3632]">
                          {item.qty}x
                        </span>
                        {modalMode === 'bill' &&
                          allowRemoveSentItems &&
                          effectiveOrder &&
                          !selectedTakeAwayOrder &&
                          onRemoveOrderItem && (
                            <button
                              type="button"
                              onClick={() => onRemoveOrderItem(effectiveOrder.id, index)}
                              className="p-1.5 rounded-lg bg-[#1c1917] hover:bg-red-950 text-red-400 border border-[#3a3632] hover:border-red-500/40 transition-colors cursor-pointer"
                              title="Anular ítem de la comanda (Solo Administrador)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* =====================================================================
             * FORMULARIO DE NUEVO PEDIDO PARA LLEVAR (Cuando cart > 0 y es nuevo)
             * ===================================================================== */}
            {modalMode === 'cart' && isNewTakeAwayForm && (
              <div className="bg-[#292524] border border-[#ff7a00]/40 rounded-2xl p-4 space-y-3.5 shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#ff7a00] flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Datos para Retiro en Local</span>
                  </span>
                  <span className="text-[10px] text-[#a8a29e]">Estimado: 15 min</span>
                </div>

                {/* Nombre requerido */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#f5efe6] block">
                    Nombre del cliente <span className="text-[#ff7a00]">*</span>
                  </label>
                  <input
                    type="text"
                    value={takeAwayNombre}
                    onChange={(e) => {
                      setTakeAwayNombre(e.target.value);
                      setTakeAwayFormError('');
                    }}
                    placeholder="Ej: Carlos Méndez"
                    maxLength={60}
                    className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl px-3 py-2 text-xs font-semibold text-[#f5efe6] placeholder-[#78716c] focus:outline-none"
                  />
                </div>

                {/* Teléfono WhatsApp opcional */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#f5efe6] block">
                    WhatsApp (+591, opcional para avisar cuando esté listo)
                  </label>
                  <div className="flex items-center rounded-xl bg-[#1c1917] border border-[#3a3632] focus-within:border-[#ff7a00] px-2.5 py-1">
                    <span className="text-xs font-mono font-bold text-[#a8a29e] pr-2 border-r border-[#3a3632] shrink-0">
                      +591
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={8}
                      value={cleanTakeAwayPhone}
                      onChange={(e) => {
                        setTakeAwayTelefono(sanitizeBoliviaPhone(e.target.value));
                        setTakeAwayFormError('');
                      }}
                      placeholder="7245XXXX"
                      className="w-full bg-transparent px-2.5 py-1.5 text-xs font-mono font-bold text-[#f5efe6] placeholder-[#57534e] focus:outline-none tracking-wider"
                    />
                    {isValidTakeAwayPhone && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </div>
                  {hasPartialTakeAwayPhone && (
                    <p className="text-[10px] text-amber-400 font-medium">
                      Ingresa 8 dígitos empezando con 6 o 7.
                    </p>
                  )}
                </div>

                {/* Nota / Tiempo de retiro */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#f5efe6] block">
                    Hora / Nota de retiro
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TAKE_AWAY_RETIRE_NOTES.map((pill) => (
                      <button
                        key={pill}
                        type="button"
                        onClick={() => setTakeAwayNotaRetiro(pill)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                          takeAwayNotaRetiro === pill
                            ? 'bg-[#ff7a00] text-white border-[#ff7a00]'
                            : 'bg-[#1c1917] text-[#a8a29e] border-[#3a3632] hover:text-white'
                        }`}
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={takeAwayNotaRetiro}
                    onChange={(e) => setTakeAwayNotaRetiro(e.target.value)}
                    placeholder="Ej: Paso a las 13:30 sin cebolla..."
                    maxLength={80}
                    className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl px-3 py-2 text-xs text-[#f5efe6] placeholder-[#78716c] focus:outline-none"
                  />
                </div>

                {/* Switches exclusivos de Personal (NUNCA visibles para clientes) */}
                {isStaffAuthenticated && (
                  <div className="pt-2 border-t border-[#3a3632] space-y-2.5">
                    {allowChargeControls && (
                      <div className="bg-[#1c1917] border border-[#3a3632] rounded-xl p-3 space-y-2.5">
                        <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
                          <span className="text-xs font-bold text-[#f5efe6] flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Cobrar inmediatamente en caja</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={takeAwayCobrarAhora}
                            onChange={(e) => setTakeAwayCobrarAhora(e.target.checked)}
                            className="w-4 h-4 accent-[#ff7a00] cursor-pointer"
                          />
                        </label>

                        {takeAwayCobrarAhora && (
                          <div className="space-y-2 pt-1 border-t border-[#3a3632]">
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => setTakeAwayMetodoPago('EFECTIVO')}
                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                                  takeAwayMetodoPago === 'EFECTIVO'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#292524] text-[#a8a29e]'
                                }`}
                              >
                                EFECTIVO
                              </button>
                              <button
                                type="button"
                                onClick={() => setTakeAwayMetodoPago('QR')}
                                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                                  takeAwayMetodoPago === 'QR'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[#292524] text-[#a8a29e]'
                                }`}
                              >
                                QR Simple
                              </button>
                            </div>

                            {takeAwayMetodoPago === 'EFECTIVO' ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={cartTotal}
                                    step="any"
                                    value={takeAwayCashGiven}
                                    onChange={(e) => setTakeAwayCashGiven(e.target.value)}
                                    placeholder={`Monto recibido (min ${cartTotal.toFixed(2)})`}
                                    className="flex-1 bg-[#292524] border border-[#3a3632] focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#f5efe6] focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setTakeAwayCashGiven(cartTotal.toFixed(2))}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#292524] border border-[#3a3632] text-[11px] font-bold text-emerald-400 cursor-pointer"
                                  >
                                    Exacto
                                  </button>
                                </div>
                                {!isNaN(parsedTakeAwayCash) && parsedTakeAwayCash >= cartTotal && (
                                  <p className="text-[11px] font-bold text-emerald-400">
                                    Cambio: {formatCurrencyBs(parsedTakeAwayCash - cartTotal)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <label className="flex items-center gap-2 text-[11px] text-[#f5efe6] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={takeAwayQrOk}
                                  onChange={(e) => setTakeAwayQrOk(e.target.checked)}
                                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                                />
                                <span>Verificado en Banca Móvil ({formatCurrencyBs(cartTotal)})</span>
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <label className="flex items-center justify-between gap-2 bg-[#1c1917] border border-[#3a3632] rounded-xl p-3 cursor-pointer select-none">
                      <span className="text-xs font-bold text-[#f5efe6] flex items-center gap-1.5">
                        <Printer className="w-3.5 h-3.5 text-[#ff7a00]" />
                        <span>Imprimir Ticket 80mm / WhatsApp</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={takeAwayImprimirOEnviar}
                        onChange={(e) => setTakeAwayImprimirOEnviar(e.target.checked)}
                        className="w-4 h-4 accent-[#ff7a00] cursor-pointer"
                      />
                    </label>
                  </div>
                )}

                {takeAwayFormError && (
                  <p className="text-xs text-red-400 font-semibold bg-red-950/50 border border-red-500/40 rounded-xl p-2.5">
                    {takeAwayFormError}
                  </p>
                )}
              </div>
            )}

            {/* =========================================================================
             * 💳 VISTA DE COBRO DE LA CUENTA (modalMode === 'bill')
             * ========================================================================= */}
            {modalMode === 'bill' && (
              <div className="pt-3 space-y-4 border-t border-[#3a3632]">
                {allowChargeControls ? (
                  <div className="space-y-4">
                    {/* Descuento Opcional */}
                    <div className="bg-[#292524] p-3.5 rounded-2xl border border-[#3a3632] flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[#f5efe6] flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-[#ff7a00]" />
                          Descuento (Opcional)
                        </span>
                        <span className="text-[10px] text-[#a8a29e] block">
                          Descuento directo en Bs. antes de cobrar
                        </span>
                      </div>
                      <div className="relative w-32 shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#a8a29e]">
                          Bs.
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={subtotalToShow}
                          step="any"
                          placeholder="0.00"
                          value={discountInput}
                          onChange={(e) => setDiscountInput(e.target.value)}
                          className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl pl-9 pr-2.5 py-2 text-xs text-right text-[#f5efe6] font-bold focus:outline-none"
                        />
                      </div>
                    </div>

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
                            Total: {formatCurrencyBs(totalToShow)}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-medium text-[#a8a29e] block">
                            Efectivo entregado por el cliente (Bs.):
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#a8a29e]">
                              Bs.
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder={`Ej: ${Math.ceil(totalToShow)}`}
                              value={cashAmount}
                              onChange={(e) => setCashAmount(e.target.value)}
                              className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#f5efe6] font-bold focus:outline-none transition-colors"
                            />
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => setCashAmount(totalToShow.toFixed(2))}
                              className="px-2.5 py-1 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] text-[11px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                            >
                              Exacto ({formatCurrencyBs(totalToShow)})
                            </button>
                            {[50, 100, 200, 500]
                              .filter((val) => val >= totalToShow)
                              .slice(0, 3)
                              .map((val) => (
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
                            {formatCurrencyBs(totalToShow)}
                          </span>
                        </div>

                        <div className="bg-white p-3 rounded-xl w-36 h-36 mx-auto flex items-center justify-center shadow">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                              selectedTakeAwayOrder
                                ? `PAGO_LLEVAR_${selectedTakeAwayOrder.codigoCorrelativo || 'LL'}_TOTAL_${totalToShow.toFixed(2)}`
                                : `PAGO_MESA_${currentTableId}_TOTAL_${totalToShow.toFixed(2)}`
                            )}`}
                            alt="QR Pago"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-[11px] text-[#a8a29e]">
                          El comensal escanea desde su app bancaria (Banco Sol, BNB, BCP, Banco Unión, Mercantil, etc.)
                        </p>

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
                                He verificado en la app bancaria la acreditación de{' '}
                                <strong className="text-emerald-400 font-bold">
                                  {formatCurrencyBs(totalToShow)}
                                </strong>
                                .
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* ¿CÓMO ENTREGAR RECIBO? */}
                    <div className="bg-[#1E1E1E] border border-zinc-800 rounded-xl p-4 mt-4 text-left shadow-lg space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white font-bold text-xs sm:text-sm">¿Cómo entregar recibo?</p>
                        {isValidReceiptPhone && (
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Válido
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center rounded-xl bg-[#141414] border border-zinc-700 focus-within:border-[#FF7A00] px-2.5 py-1.5 transition-colors">
                          <span className="text-xs font-mono font-bold text-zinc-300 pr-2 border-r border-zinc-700 shrink-0">
                            +591
                          </span>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={8}
                            value={cleanReceiptPhone}
                            onChange={(e) => {
                              const nextVal = sanitizeBoliviaPhone(e.target.value);
                              setClienteCelular(nextVal);
                              if (!isValidBoliviaPhone(nextVal) && tipoEntrega !== 'ticket') {
                                setTipoEntrega('ticket');
                              }
                            }}
                            placeholder="Editar celular (ej: 72451234)"
                            className="w-full bg-transparent px-2.5 py-1 text-xs font-mono font-bold text-white placeholder-zinc-600 focus:outline-none tracking-wider"
                          />
                          <Pencil className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        </div>
                        {hasPartialReceiptPhone && (
                          <p className="text-[10px] text-amber-400 font-medium">
                            Ingresa un número de celular válido de Bolivia (8 dígitos empezando con 6 o 7).
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setTipoEntrega('whatsapp')}
                          disabled={!isValidReceiptPhone}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            !isValidReceiptPhone
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
                          disabled={!isValidReceiptPhone}
                          className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            !isValidReceiptPhone
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

                    {/* BOTÓN FINAL: CONFIRMAR Y ENTREGAR */}
                    <button
                      type="button"
                      onClick={handleConfirmarYEntregar}
                      disabled={
                        isConfirmingDelivery ||
                        (billMethod === 'EFECTIVO' && !isPaidOrOver) ||
                        (billMethod === 'QR' && !qrVerified) ||
                        ((tipoEntrega === 'whatsapp' || tipoEntrega === 'ambas') && !isValidReceiptPhone)
                      }
                      className={`w-full mt-4 py-4 px-4 rounded-xl font-black text-sm text-black transition-all flex items-center justify-center gap-2 border border-amber-300/30 active:scale-98 ${
                        ((billMethod === 'EFECTIVO' && isPaidOrOver) || (billMethod === 'QR' && qrVerified)) &&
                        (tipoEntrega === 'ticket' || isValidReceiptPhone)
                          ? 'bg-[#FF7A00] hover:bg-[#ff8c1a] shadow-[0_0_20px_rgba(255,122,0,0.6)] cursor-pointer'
                          : 'bg-zinc-800 text-zinc-500 opacity-60 cursor-not-allowed shadow-none border-zinc-800'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5 text-black" />
                      <span>
                        {isConfirmingDelivery
                          ? 'Procesando...'
                          : selectedTakeAwayOrder
                            ? 'Confirmar Cobro Para Llevar'
                            : 'Confirmar y Entregar'}
                      </span>
                    </button>
                  </div>
                ) : (
                  /* VISTA ESTRICTAMENTE RESTRINGIDA: COMENSAL O PERSONAL SIN PERMISO DE CAJA */
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-[#292524] border border-[#3a3632] space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs text-[#ff7a00]">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span>
                          {isStaffAuthenticated
                            ? 'Cobro Exclusivo de Caja / Administración'
                            : 'Resumen de Consumo en Mesa'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#d6d3d1] leading-relaxed">
                        {isStaffAuthenticated
                          ? 'Tu cuenta no tiene habilitado el permiso de Caja y Cobros. Un Cajero o Administrador debe procesar el pago y liberar la mesa.'
                          : 'El pago de tu consumo acumulado se realiza directamente en tu mesa o en Caja con nuestro personal.'}
                      </p>
                    </div>

                    {onCallWaiterForBill && !selectedTakeAwayOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          setWaiterRequested(true);
                          onCallWaiterForBill();
                          setTimeout(() => setWaiterRequested(false), 5000);
                        }}
                        disabled={waiterRequested}
                        className={`w-full py-3.5 px-4 rounded-[14px] font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                          waiterRequested
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-[#ff7a00] hover:bg-[#ff8c1a] active:scale-95 text-white'
                        }`}
                      >
                        {waiterRequested ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-100" />
                            <span>¡Cuenta solicitada! Un mozo se acercará a tu mesa</span>
                          </>
                        ) : (
                          <>
                            <Bell className="w-4 h-4" />
                            <span>{isStaffAuthenticated ? 'Solicitar Cobro en Caja' : 'Solicitar Cuenta'}</span>
                          </>
                        )}
                      </button>
                    )}

                    {!isStaffAuthenticated && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onSwitchMode) onSwitchMode('cart');
                          onClose();
                          onViewMenu();
                        }}
                        className="w-full py-2.5 px-4 rounded-[14px] bg-[#292524] hover:bg-[#3a3632] border border-[#3a3632] text-[#f5efe6] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#ff7a00]" />
                        <span>Seguir Pidiendo / Agregar Adición</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Bottom Footer for Cart Ordering */}
      {itemsToShow.length > 0 && modalMode === 'cart' && allowTakeOrders && (
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
                {formatCurrencyBs(totalToShow)}
              </span>
              {isAdditionMode && effectiveOrder && (
                <span className="text-[10px] text-[#a8a29e] block">
                  Total comanda final: {formatCurrencyBs(effectiveOrder.total + totalToShow)}
                </span>
              )}
            </div>
          </div>

          {isNewTakeAwayForm ? (
            <button
              type="button"
              onClick={handleSubmitNewTakeAway}
              disabled={cart.length === 0 || isSubmittingTakeAway}
              className="w-full py-3.5 sm:py-4 px-4 rounded-[16px] bg-gradient-to-r from-[#ff7a00] via-[#ff8c1a] to-[#ff7a00] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold text-[15px] sm:text-[16px] shadow-[0_6px_25px_rgba(255,122,0,0.5)] flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-white/20"
            >
              <ShoppingBag className="w-5 h-5 text-white" />
              <span>
                {isSubmittingTakeAway
                  ? 'Confirmando Pedido...'
                  : 'Confirmar Pedido Para Llevar'}
              </span>
            </button>
          ) : selectedTakeAwayOrder && onAddItemsToTakeAway ? (
            <button
              type="button"
              onClick={() => onAddItemsToTakeAway(selectedTakeAwayOrder.id)}
              disabled={cart.length === 0}
              className="w-full py-3.5 sm:py-4 px-4 rounded-[16px] bg-gradient-to-r from-[#ff7a00] via-[#ff8c1a] to-[#ff7a00] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold text-[15px] sm:text-[16px] shadow-[0_6px_25px_rgba(255,122,0,0.5)] flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-white/20"
            >
              <Send className="w-5 h-5 text-white animate-pulse" />
              <span>Sumar Platos a {selectedTakeAwayOrder.codigoCorrelativo || '#LL'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onPlaceOrder}
              disabled={cart.length === 0}
              className="w-full py-3.5 sm:py-4 px-4 rounded-[16px] bg-gradient-to-r from-[#ff7a00] via-[#ff8c1a] to-[#ff7a00] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold text-[15px] sm:text-[16px] shadow-[0_6px_25px_rgba(255,122,0,0.5)] flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-white/20"
            >
              <Send className="w-5 h-5 text-white animate-pulse" />
              <span>{isAdditionMode ? 'Enviar Adición a Cocina' : 'Enviar Pedido a Cocina'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (isDocked) {
    return panelContent;
  }

  return (
    <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm flex justify-end animate-fadeIn">
      <div className="absolute inset-0" onClick={onClose} />
      {panelContent}
    </div>
  );
};
