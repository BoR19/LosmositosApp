import React, { useState, useEffect, useMemo } from 'react';
import { 
  Utensils, QrCode, ShoppingBag, Clock, Sparkles, AlertCircle, 
  ChefHat, Layers, Award, Bell, FileText, CheckCheck, LogIn, LogOut, Lock,
  Plus, Trash2, Pencil, Search, DollarSign, Image as ImageIcon, SlidersHorizontal,
  Building2, Home, ArrowRightLeft
} from 'lucide-react';
import { db, auth, googleProvider } from './firebase.ts';
import { collection, onSnapshot, addDoc, updateDoc, doc, setDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

import { MENU_CATEGORIAS, INITIAL_MENU, INITIAL_TABLES, formatTableOptionLabel } from './data/menuData.ts';
import { MenuItem, CartItem, Table, Order, OrderItem, WaiterCall, NotificationState, RestaurantProfile, SolicitudCambio } from './types/index.ts';
import { ProductCard } from './components/ProductCard.tsx';
import { CartModal } from './components/CartModal.tsx';
import { FloatingCartBar } from './components/FloatingCartBar.tsx';
import { MobileDock } from './components/MobileDock.tsx';
import { QrModal } from './components/QrModal.tsx';
import { ActiveOrderBanner } from './components/ActiveOrderBanner.tsx';
import { StaffLoginView, StaffSession } from './components/StaffLoginView.tsx';
import { AddTableModal, DeleteTableModal } from './components/TableModals.tsx';
import { AddEditDishModal, QuickPriceModal, DeleteDishModal } from './components/DishModals.tsx';
import { RestaurantProfileAdmin } from './components/RestaurantProfileAdmin.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import { TicketHistoryAdmin } from './components/TicketHistoryAdmin.tsx';
import { RequestTableChangeModal, MoveTableStaffModal, ClientConfirmMoveModal } from './components/TableChangeModals.tsx';



export default function App() {
  // Authentication & Core Data States
  const [user, setUser] = useState<User | null>(null);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(() => {
    try {
      const saved = localStorage.getItem('elchuro_staff_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const isStaffAuthenticated = Boolean(user || staffSession);
  const isAdminAuthenticated = Boolean(user || staffSession?.role === 'admin');
  const [activeTab, setActiveTab] = useState<string>('menu'); 
  // Carrito persistente con ciclo de vida de sesión y verificación de expiración (> 4 horas sin pagar)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      if (typeof localStorage === 'undefined') return [];
      
      const sesionActiva = localStorage.getItem('churo_sesion_activa');
      if (sesionActiva === 'false') {
        localStorage.removeItem('churo_carrito');
        return [];
      }

      // Fallback: si churo_fecha > 4 horas y nunca pagó, limpia carrito
      const fechaRef = localStorage.getItem('churo_fecha_inicio') || localStorage.getItem('churo_fecha');
      if (fechaRef) {
        const elapsedHours = (Date.now() - new Date(fechaRef).getTime()) / (1000 * 60 * 60);
        if (elapsedHours > 4) {
          localStorage.removeItem('churo_carrito');
          localStorage.setItem('churo_sesion_activa', 'false');
          return [];
        }
      }

      const savedCart = localStorage.getItem('churo_carrito');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch {
      return [];
    }
  });

  // Sincronizar automáticamente cambios del carrito con churo_carrito en localStorage
  useEffect(() => {
    try {
      if (cart.length > 0) {
        localStorage.setItem('churo_carrito', JSON.stringify(cart));
      } else {
        localStorage.removeItem('churo_carrito');
      }
    } catch {
      // ignore
    }
  }, [cart]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>(INITIAL_MENU);
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);

  // 1. Detección de Modo Cliente vs Modo Staff
  const mesaQR = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mesa');
      return m && !isNaN(Number(m)) ? Number(m) : null;
    } catch {
      return null;
    }
  }, []);

  const isStaff = Boolean(
    user || 
    staffSession || 
    (typeof localStorage !== 'undefined' && (
      localStorage.getItem('admin_role') === 'mozo' || 
      localStorage.getItem('admin_role') === 'admin' || 
      localStorage.getItem('admin_role') === 'cajero' ||
      localStorage.getItem('churo_role') === 'staff'
    )) ||
    (typeof window !== 'undefined' && (
      window.location.pathname.includes('/admin') || 
      window.location.pathname.includes('/mesas')
    ))
  );

  const isClientMode = Boolean(
    (mesaQR !== null || (typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('churo_mesa')))) && 
    !isStaff
  );

  // UI & Interaction States
  // Initialize from ?mesa= query parameter as single source of truth, or stored mesa if session is active
  const [currentTableId, setCurrentTableId] = useState<number | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mesaParam = params.get('mesa');
      const savedMesa = typeof localStorage !== 'undefined' ? localStorage.getItem('churo_mesa') : null;
      const sesionActiva = typeof localStorage !== 'undefined' ? localStorage.getItem('churo_sesion_activa') : null;

      // 1. Usa siempre searchParams.get('mesa') como verdad para mostrar Mesa X, nunca localStorage viejo
      if (mesaParam && !isNaN(Number(mesaParam))) {
        return Number(mesaParam);
      }

      // 2. Solo si no hay ?mesa= en URL y la sesión no fue cerrada por pago, usar mesa previa
      if (sesionActiva !== 'false' && savedMesa && !isNaN(Number(savedMesa))) {
        return Number(savedMesa);
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [customerModalOpen, setCustomerModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'cart' | 'bill'>('cart');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [qrModalTable, setQrModalTable] = useState<Table | null>(null);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState<boolean>(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);

  // Estados para Solicitudes de Cambio de Mesa
  const [changeRequests, setChangeRequests] = useState<SolicitudCambio[]>([]);
  const pendingChangeRequests = useMemo(() => {
    return changeRequests.filter(r => r.estado === 'pendiente');
  }, [changeRequests]);

  const [isRequestChangeModalOpen, setIsRequestChangeModalOpen] = useState<boolean>(false);
  const [moveStaffModal, setMoveStaffModal] = useState<{
    isOpen: boolean;
    sourceTable: Table | null;
    requestId?: string;
    requestDetails?: SolicitudCambio | null;
  }>({
    isOpen: false,
    sourceTable: null,
  });

  const [clientMovePrompt, setClientMovePrompt] = useState<{
    isOpen: boolean;
    fromMesa: number;
    toMesa: number;
  } | null>(null);

  // Estados para la gestión de Platos, Bebidas y Precios del Menú:
  const [dishModalOpen, setDishModalOpen] = useState<boolean>(false);
  const [dishToEdit, setDishToEdit] = useState<MenuItem | null>(null);
  const [dishToDelete, setDishToDelete] = useState<MenuItem | null>(null);
  const [dishToQuickPrice, setDishToQuickPrice] = useState<MenuItem | null>(null);
  const [adminMenuSearch, setAdminMenuSearch] = useState<string>('');
  const [adminMenuCategory, setAdminMenuCategory] = useState<string>('TODOS');

  // Estados para Perfil del Restaurante e Identidad de Marca:
  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfile>({
    nombre: 'El Churo Mosito',
    slogan: 'GASTRONOMÍA DE ALTURA • TARIJA',
    telefono: '+591 71234567',
    logoUrl: '',
    colorPrimario: '#ff7a00',
    colorSecundario: '#10b981',
    modoFondo: 'dark-zinc',
  });
  const [adminSubTab, setAdminSubTab] = useState<'inventario' | 'perfil' | 'historial'>('inventario');

  // Estado para la pantalla de bienvenida y captura de WhatsApp al escanear QR (?mesa=X)
  const [showWelcomeScreen, setShowWelcomeScreen] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mesaParam = params.get('mesa');
      if (mesaParam && !isNaN(Number(mesaParam))) {
        const mesaNumStr = String(mesaParam);
        const welcomeDoneSession = sessionStorage.getItem(`welcome_done_${mesaNumStr}`) === 'true' || 
                                   sessionStorage.getItem(`churo_welcome_dismissed_${mesaNumStr}`) === 'true';
        const savedPhone = localStorage.getItem('churo_celular');
        const storedMesa = localStorage.getItem('churo_mesa');
        const sesionActiva = localStorage.getItem('churo_sesion_activa');

        // Si ya completó la bienvenida en esta sesión de pestaña para esta mesa específica:
        if (welcomeDoneSession) {
          return false;
        }

        // Al mostrar bienvenida, si churo_sesion_activa === 'false' (pagó antes) o mesaParam != storedMesa,
        // permite escanear cualquier mesa nueva de inmediato y mostrar bienvenida limpia
        if (sesionActiva === 'false' || storedMesa !== mesaNumStr || !savedPhone) {
          return true;
        }

        return false;
      }
    } catch {
      // ignore
    }
    return false;
  });


  // Show Toast Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleLogout = async () => {
    try {
      if (user) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("Error al cerrar sesión de Firebase:", e);
    }
    localStorage.removeItem('elchuro_staff_session');
    setStaffSession(null);
    setActiveTab('menu');
    showToast('Sesión de personal cerrada.');
  };

  // Firebase Real-time Subscriptions
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const unsubscribeOrders = onSnapshot(collection(db, 'pedidos'), (snapshot) => {
      const liveOrders = snapshot.docs.map(d => {
        const data = d.data();
        const rawItems = (data.items || []) as OrderItem[];
        const items = rawItems.map((item, idx) => ({
          ...item,
          orderItemId: item.orderItemId || `ord-${d.id}-${item.id}-${item.isAddition ? 'add' : 'init'}-${idx}`
        }));
        return {
          id: d.id,
          ...data,
          items
        } as Order;
      });
      setOrders(liveOrders);

      // Auto-update table occupied status based on active orders (until order is paid or cancelled)
      setTables(prev => prev.map(t => {
        const tableActiveOrder = liveOrders.find(o => o.tableId === t.id && o.status !== 'pagado' && o.status !== 'cancelado');
        if (tableActiveOrder) {
          const status = tableActiveOrder.status === 'por-pagar' ? 'por-pagar' : 'occupied';
          return { ...t, status, currentOrder: tableActiveOrder };
        }
        return { ...t, status: 'free', currentOrder: null };
      }));
    }, (error) => {
      console.warn("Pedidos snapshot listener error:", error);
    });

    // 📡 Sincronización en vivo del Menú con la base de datos (Firestore):
    // Como si fuera una pizarra mágica: cuando alguien en la oficina cambia un precio,
    // o añade un plato nuevo, todos los celulares lo ven al instante sin recargar la página.
    const unsubscribeMenu = onSnapshot(collection(db, 'menu'), async (snapshot) => {
      if (snapshot.docs.length === 0) {
        // Si la base de datos está totalmente vacía por primera vez, subimos los platos iniciales:
        for (const item of INITIAL_MENU) {
          try {
            await setDoc(doc(db, 'menu', item.id), item);
          } catch (e) {
            console.error("Error al sembrar ítem de menú:", e);
          }
        }
      } else {
        // Cargamos todos los platos existentes en la nube garantizando IDs únicos y estables:
        const seenIds = new Set<string>();
        const uniqueItems: MenuItem[] = [];
        snapshot.docs.forEach(d => {
          const data = d.data();
          const stableId = d.id || data.id;
          if (stableId && !seenIds.has(stableId)) {
            seenIds.add(stableId);
            uniqueItems.push({ ...data, id: stableId } as MenuItem);
          }
        });
        setMenu(uniqueItems);
      }
    });

    const unsubscribeCalls = onSnapshot(collection(db, 'llamadas'), (snapshot) => {
      const liveCalls = snapshot.docs
        .map(d => {
          const data = d.data();
          const rawStatus = (data.status || '').toLowerCase();
          const isPending = !rawStatus || rawStatus === 'pendiente' || rawStatus === 'pending';
          return {
            id: d.id,
            tableId: Number(data.tableId),
            tableName: data.tableName || `Mesa #${data.tableId}`,
            type: (data.type === 'mozo' ? 'mozo' : 'cuenta') as 'mozo' | 'cuenta',
            time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
            status: isPending ? ('pendiente' as const) : ('atendido' as const)
          } as WaiterCall;
        })
        .filter(c => c.status === 'pendiente')
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setWaiterCalls(liveCalls);
    }, (error) => {
      console.warn("Llamadas snapshot listener error:", error);
    });

    const unsubscribeTables = onSnapshot(collection(db, 'mesas'), async (snapshot) => {
      if (snapshot.docs.length === 0) {
        // Seed initial tables if collection is empty
        for (const item of INITIAL_TABLES) {
          try {
            await setDoc(doc(db, 'mesas', String(item.id)), {
              id: item.id,
              name: item.name,
              seats: item.seats
            });
          } catch (e) {
            console.error("Error al sembrar mesa inicial:", e);
          }
        }
      } else {
        const liveTables: Table[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: Number(data.id || d.id),
            name: data.name || `Mesa ${d.id}`,
            seats: Number(data.seats || 4),
            status: 'free' as const,
            currentOrder: null
          };
        }).sort((a, b) => a.id - b.id);

        setTables(prev => {
          return liveTables.map(lt => {
            const existing = prev.find(p => p.id === lt.id);
            if (existing && existing.status !== 'free') {
              return { ...lt, status: existing.status, currentOrder: existing.currentOrder };
            }
            return lt;
          });
        });
      }
    }, (error) => {
      console.warn("Mesas snapshot listener error:", error);
    });

    const unsubscribeProfile = onSnapshot(doc(db, 'configuracion', 'perfil'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRestaurantProfile({
          nombre: data.nombre || 'El Churo Mosito',
          slogan: data.slogan || 'GASTRONOMÍA DE ALTURA • TARIJA',
          telefono: data.telefono || '+591 71234567',
          logoUrl: data.logoUrl || '',
          colorPrimario: data.colorPrimario || '#ff7a00',
          colorSecundario: data.colorSecundario || '#10b981',
          modoFondo: data.modoFondo || 'dark-zinc',
          updatedAt: data.updatedAt,
        });
      }
    }, (error) => {
      console.warn("Perfil snapshot listener error:", error);
    });

    const unsubscribeRequests = onSnapshot(collection(db, 'solicitudes_cambio'), (snapshot) => {
      const liveReqs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as SolicitudCambio[];
      setChangeRequests(liveReqs);
    }, (error) => {
      console.warn("Solicitudes cambio snapshot listener error:", error);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMenu();
      unsubscribeOrders();
      unsubscribeCalls();
      unsubscribeTables();
      unsubscribeProfile();
      unsubscribeRequests();
    };
  }, []);

  // Detect Mesa from URL query params (e.g. ?mesa=3) with Best Practice session lifecycle
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlMesa = params.get('mesa');
      const storedMesa = localStorage.getItem('churo_mesa');
      const sesionActiva = localStorage.getItem('churo_sesion_activa');
      const savedPhone = localStorage.getItem('churo_celular');

      // Fallback: si churo_fecha > 4 horas y nunca pagó, limpia carrito
      const fechaRef = localStorage.getItem('churo_fecha_inicio') || localStorage.getItem('churo_fecha');
      if (fechaRef) {
        const elapsed = (Date.now() - new Date(fechaRef).getTime()) / (1000 * 60 * 60);
        if (elapsed > 4) {
          localStorage.removeItem('churo_carrito');
          localStorage.setItem('churo_sesion_activa', 'false');
          setCart([]);
        }
      }

      // Sync role in localStorage
      if (isStaff) {
        localStorage.setItem('churo_role', 'staff');
      } else if (isClientMode) {
        localStorage.setItem('churo_role', 'cliente');
      }

      if (urlMesa && !isNaN(Number(urlMesa))) {
        const urlMesaNum = Number(urlMesa);

        // Si mesaParam != storedMesa:
        if (storedMesa && storedMesa !== urlMesa) {
          const storedMesaNum = Number(storedMesa);
          const activeOrderOldMesa = orders.find(
            o => o.tableId === storedMesaNum && 
            o.status !== 'pagado' && 
            o.status !== 'cancelado'
          );

          if (activeOrderOldMesa) {
            // Cliente tiene comanda activa en la mesa anterior:
            // Mostrar modal "¿Moverte de Mesa X a Mesa Y?" en vez de bienvenida normal
            setShowWelcomeScreen(false);
            setClientMovePrompt({
              isOpen: true,
              fromMesa: storedMesaNum,
              toMesa: urlMesaNum
            });
            return;
          }

          localStorage.setItem('churo_mesa', urlMesa);
          localStorage.removeItem('churo_carrito');
          setCart([]);
        } else if (!storedMesa) {
          localStorage.setItem('churo_mesa', urlMesa);
        }

        // Usa siempre searchParams.get('mesa') como verdad para mostrar Mesa X
        setCurrentTableId(urlMesaNum);

        // Al mostrar bienvenida, si churo_sesion_activa === 'false', permite escanear cualquier mesa nueva de inmediato
        const welcomeDoneSession = sessionStorage.getItem(`welcome_done_${urlMesa}`) === 'true' || 
                                   sessionStorage.getItem(`churo_welcome_dismissed_${urlMesa}`) === 'true';

        if (!welcomeDoneSession) {
          if (sesionActiva === 'false' || storedMesa !== urlMesa || !savedPhone) {
            setShowWelcomeScreen(true);
          }
        }
      } else if (storedMesa && !isNaN(Number(storedMesa))) {
        // Fallback a mesa guardada solo si la sesión sigue activa y no se ha pagado
        if (sesionActiva !== 'false') {
          setCurrentTableId(Number(storedMesa));
        }
      }
    } catch (e) {
      console.warn("Error en detección y gestión de sesión de mesa:", e);
    }
  }, [isClientMode, isStaff, orders]);

  // Bloquear cambio de mesa si es cliente
  const handleTableChange = (tableId: number) => {
    if (isClientMode) {
      const lockedMesa = mesaQR ? String(mesaQR) : (localStorage.getItem('churo_mesa') || null);
      if (lockedMesa && Number(lockedMesa) !== tableId) {
        showToast(`Tu mesa es la Mesa ${lockedMesa}. Solo el personal puede cambiar de mesa.`, 'error');
        return;
      }
    }
    setCurrentTableId(tableId);
  };



  // Active Order for Current Selected Table
  const activeOrderForCurrentTable = useMemo(() => {
    if (currentTableId === null) return null;
    return orders.find(
      o => o.tableId === Number(currentTableId) && 
      o.status !== 'pagado' && 
      o.status !== 'cancelado'
    ) || null;
  }, [orders, currentTableId]);

  // Cart Calculations & Handlers
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.precioBs * item.qty), 0);
  }, [cart]);

  const addToCart = (product: MenuItem) => {
    if (!product.disponible) {
      showToast('Este producto no está disponible en este momento.', 'error');
      return;
    }

    // Al agregar plato: marcar sesión activa y guardar mesa
    try {
      const params = new URLSearchParams(window.location.search);
      const mesaParam = params.get('mesa') || (currentTableId !== null ? String(currentTableId) : null);
      localStorage.setItem('churo_sesion_activa', 'true');
      if (mesaParam) {
        localStorage.setItem('churo_mesa', mesaParam);
      }
      if (!localStorage.getItem('churo_fecha_inicio')) {
        localStorage.setItem('churo_fecha_inicio', new Date().toISOString());
      }
    } catch {
      // ignore
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    showToast(`Agregado: ${product.nombre}`);
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
    showToast('Producto eliminado del carrito');
  };

  // Place Order or Send Addition to Firestore (prevents duplicate orders per table until paid)
  const placeOrder = async () => {
    if (cart.length === 0) return;
    
    // Check if table is assigned (locked to client mesa if in client mode)
    let effectiveMesaId = currentTableId;
    if (isClientMode) {
      const lockedMesa = localStorage.getItem('churo_mesa') || mesaQR;
      if (lockedMesa && !isNaN(Number(lockedMesa))) {
        effectiveMesaId = Number(lockedMesa);
      }
    }

    if (effectiveMesaId === null) {
      showToast("Por favor selecciona tu número de mesa para enviar el pedido.", "error");
      setModalMode('cart');
      setCustomerModalOpen(true);
      return;
    }

    const tableObj = tables.find(t => t.id === Number(effectiveMesaId));
    if (!tableObj) {
      showToast("Mesa no válida. Por favor selecciona tu mesa.", "error");
      return;
    }

    
    // Check if table already has an active order in progress
    const existingOrder = orders.find(
      o => o.tableId === tableObj.id && 
      o.status !== 'pagado' && 
      o.status !== 'cancelado'
    );

    if (existingOrder) {
      // ADICIÓN: Merge seamlessly into existing order so kitchen comanda is unified without duplicate cards!
      try {
        const additionTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const additionTimestamp = Date.now();
        const additionItems: OrderItem[] = cart.map((item, idx) => ({
          id: item.id,
          nombre: item.nombre,
          precioBs: item.precioBs,
          qty: item.qty,
          categoria: item.categoria,
          isAddition: true,
          orderItemId: `orditem-${item.id}-add-${additionTimestamp}-${idx}`
        }));

        const updatedItems = [...existingOrder.items, ...additionItems];
        const updatedTotal = Number((existingOrder.total + cartTotal).toFixed(2));

        await updateDoc(doc(db, 'pedidos', existingOrder.id), {
          items: updatedItems,
          total: updatedTotal,
          hasAddition: true,
          additionTime: additionTimeStr
        });

        setCart([]);
        setCustomerModalOpen(false);
        showToast(`¡Adición enviada a cocina para ${tableObj.name}! 🍲`);
      } catch (error) {
        console.error("Error al enviar adición:", error);
        showToast("Hubo un error al enviar la adición. Intenta de nuevo.", "error");
      }
    } else {
      // NUEVA COMANDA PARA MESA LIBRE
      const orderTimestamp = Date.now();
      const newOrder = {
        tableId: tableObj.id,
        tableName: tableObj.name,
        items: cart.map((item, idx) => ({
          id: item.id,
          nombre: item.nombre,
          precioBs: item.precioBs,
          qty: item.qty,
          categoria: item.categoria,
          orderItemId: `orditem-${item.id}-init-${orderTimestamp}-${idx}`
        })),
        total: Number(cartTotal.toFixed(2)),
        status: 'pendiente',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: orderTimestamp
      };

      try {
        await addDoc(collection(db, 'pedidos'), newOrder);
        setCart([]);
        setCustomerModalOpen(false);
        showToast(`¡Pedido de ${tableObj.name} enviado a cocina con éxito! 🍲`);
      } catch (error) {
        console.error("Error al enviar pedido:", error);
        showToast("Hubo un error al enviar el pedido. Intenta de nuevo.", "error");
      }
    }
  };

  // Cancel order (allowed before kitchen starts cooking)
  const cancelOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'pedidos', orderId), {
        status: 'cancelado'
      });
      showToast('Comanda cancelada con éxito. La mesa ha quedado libre.');
    } catch (e) {
      console.error("Error al cancelar comanda:", e);
      showToast("Error al cancelar la comanda", "error");
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'pedidos', orderId), { status: newStatus });
      showToast(`Pedido actualizado a: ${newStatus}`);
    } catch (e) {
      console.error("Error updating status:", e);
      showToast("Error al actualizar estado", "error");
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'menu', id), { disponible: !currentStatus });
      showToast(`Estado de disponibilidad actualizado.`);
    } catch (e) {
      console.error("Error toggling availability:", e);
      try {
        const dish = menu.find(m => m.id === id);
        if (dish) {
          await setDoc(doc(db, 'menu', id), { ...dish, disponible: !currentStatus });
        }
      } catch (e2) {
        console.warn("Fallback setDoc error:", e2);
      }
      setMenu(prev => prev.map(m => m.id === id ? { ...m, disponible: !currentStatus } : m));
      showToast(`Estado de disponibilidad actualizado.`);
    }
  };

  /* =========================================================================
   * 🍽️ GESTIÓN DEL MENÚ: GUARDAR, EDITAR, CAMBIAR PRECIO Y BORRAR PLATOS
   * 
   * 🌟 EXPLICACIÓN SENCILLA COMO PARA UN NIÑO DE 12 AÑOS:
   * 
   * 1. handleSaveDish:
   *    Toma toda la información del plato (nombre, precio, foto bonita, ingredientes)
   *    y la guarda en la base de datos (Firestore). Funciona tanto para platos NUEVOS
   *    como para platos que estamos EDITANDO.
   * 
   * 2. handleDeleteDish:
   *    Elimina el plato de la base de datos para que ya no aparezca más en el menú.
   * 
   * 3. handleQuickUpdatePrice:
   *    Permite cambiar el precio en Bolivianos (Bs.) en un parpadeo.
   * ========================================================================= */

  // 1. Guardar o actualizar plato/bebida
  const handleSaveDish = async (dishData: MenuItem, isEditing: boolean) => {
    try {
      await setDoc(doc(db, 'menu', dishData.id), dishData);
      setMenu(prev => {
        const exists = prev.some(item => item.id === dishData.id);
        if (exists) {
          return prev.map(item => item.id === dishData.id ? dishData : item);
        }
        return [dishData, ...prev];
      });
      showToast(isEditing ? `¡Plato "${dishData.nombre}" actualizado!` : `¡Plato "${dishData.nombre}" agregado al menú! 🎉`);
    } catch (error) {
      console.error("Error al guardar plato en Firestore:", error);
      // Fallback local en caso de desconexión:
      setMenu(prev => {
        const exists = prev.some(item => item.id === dishData.id);
        if (exists) {
          return prev.map(item => item.id === dishData.id ? dishData : item);
        }
        return [dishData, ...prev];
      });
      showToast(isEditing ? `Plato "${dishData.nombre}" actualizado.` : `Plato "${dishData.nombre}" agregado.`);
    }
  };

  // 2. Eliminar plato/bebida del menú
  const handleDeleteDish = async (dishId: string) => {
    try {
      await deleteDoc(doc(db, 'menu', dishId));
      setMenu(prev => prev.filter(item => item.id !== dishId));
      showToast('Plato o bebida eliminado del menú.');
    } catch (error) {
      console.error("Error al eliminar plato en Firestore:", error);
      setMenu(prev => prev.filter(item => item.id !== dishId));
      showToast('Plato eliminado del menú.');
    }
  };

  // 3. Cambio rápido de precio en Bolivianos (Bs.)
  const handleQuickUpdatePrice = async (dishId: string, newPrice: number) => {
    try {
      await updateDoc(doc(db, 'menu', dishId), { precioBs: newPrice });
      setMenu(prev => prev.map(item => item.id === dishId ? { ...item, precioBs: newPrice } : item));
      showToast(`Precio actualizado a Bs. ${newPrice.toFixed(2)}.`);
    } catch (error) {
      console.error("Error al actualizar precio en Firestore:", error);
      try {
        const targetDish = menu.find(m => m.id === dishId);
        if (targetDish) {
          await setDoc(doc(db, 'menu', dishId), { ...targetDish, precioBs: newPrice });
        }
      } catch (e2) {
        console.warn("Fallback setDoc fallo:", e2);
      }
      setMenu(prev => prev.map(item => item.id === dishId ? { ...item, precioBs: newPrice } : item));
      showToast(`Precio actualizado a Bs. ${newPrice.toFixed(2)}.`);
    }
  };

  // Menú saneado con identificadores únicos y estables garantizados (sin duplicados)
  const uniqueMenu = useMemo(() => {
    const seen = new Set<string>();
    return menu.filter(item => {
      if (!item || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [menu]);

  // Filtro inteligente para buscar platos y bebidas en el panel de administración
  const filteredAdminMenu = useMemo(() => {
    return uniqueMenu.filter(item => {
      const matchSearch = adminMenuSearch.trim() === '' || 
        item.nombre.toLowerCase().includes(adminMenuSearch.toLowerCase()) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(adminMenuSearch.toLowerCase())) ||
        item.categoria.toLowerCase().includes(adminMenuSearch.toLowerCase());
      const matchCat = adminMenuCategory === 'TODOS' || item.categoria === adminMenuCategory;
      return matchSearch && matchCat;
    });
  }, [uniqueMenu, adminMenuSearch, adminMenuCategory]);

  const callWaiter = async (table: Table) => {
    if (isClientMode) {
      const lockedMesa = localStorage.getItem('churo_mesa') || mesaQR;
      if (lockedMesa && table.id !== Number(lockedMesa)) {
        showToast(`Solo puedes llamar al mozo para tu Mesa ${lockedMesa}`, 'error');
        return;
      }
    }

    const callData: WaiterCall = {
      id: `CALL-${Date.now()}`,
      tableId: table.id,
      tableName: table.name,
      type: 'mozo',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      status: 'pendiente'
    };

    setWaiterCalls(prev => {
      const exists = prev.some(c => c.tableId === table.id && c.type === 'mozo' && c.status === 'pendiente');
      if (exists) return prev;
      return [callData, ...prev];
    });

    try {
      const docRef = await addDoc(collection(db, 'llamadas'), {
        tableId: callData.tableId,
        tableName: callData.tableName,
        type: callData.type,
        time: callData.time,
        createdAt: callData.createdAt,
        status: 'pendiente'
      });
      setWaiterCalls(prev => prev.map(c => c.id === callData.id ? { ...c, id: docRef.id } : c));
      showToast(`Llamada de mozo enviada para ${table.name}. ¡Un mozo viene en camino! 🔔`);
    } catch (e) {
      console.error("Error al registrar llamada de mozo en Firestore:", e);
      showToast(`Llamada de mozo enviada para ${table.name}. ¡Un mozo viene en camino! 🔔`);
    }
  };

  const requestBill = async (table: Table) => {
    if (isClientMode) {
      const lockedMesa = localStorage.getItem('churo_mesa') || mesaQR;
      if (lockedMesa && table.id !== Number(lockedMesa)) {
        showToast(`Solo puedes pedir la cuenta de tu Mesa ${lockedMesa}`, 'error');
        return;
      }
    }

    const callData: WaiterCall = {
      id: `CALL-${Date.now()}`,
      tableId: table.id,
      tableName: table.name,
      type: 'cuenta',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: Date.now(),
      status: 'pendiente'
    };


    setWaiterCalls(prev => {
      const exists = prev.some(c => c.tableId === table.id && c.type === 'cuenta' && c.status === 'pendiente');
      if (exists) return prev;
      return [callData, ...prev];
    });

    try {
      const docRef = await addDoc(collection(db, 'llamadas'), {
        tableId: callData.tableId,
        tableName: callData.tableName,
        type: callData.type,
        time: callData.time,
        createdAt: callData.createdAt,
        status: 'pendiente'
      });
      setWaiterCalls(prev => prev.map(c => c.id === callData.id ? { ...c, id: docRef.id } : c));
    } catch (e) {
      console.error("Error al registrar solicitud de cuenta en Firestore:", e);
    }

    // Update order status to 'por-pagar' in Firestore if active order exists
    const activeOrder = orders.find(
      o => o.tableId === table.id && 
      o.status !== 'pagado' && 
      o.status !== 'cancelado'
    );
    if (activeOrder && activeOrder.status !== 'por-pagar') {
      try {
        await updateDoc(doc(db, 'pedidos', activeOrder.id), { status: 'por-pagar' });
      } catch (e) {
        console.warn("Error setting status por-pagar:", e);
      }
    }

    setModalMode('bill');
    setCustomerModalOpen(true);
    showToast(`Solicitud de cuenta registrada para ${table.name}. 🧾`);
  };

  const attendWaiterCall = async (callId: string) => {
    try {
      await updateDoc(doc(db, 'llamadas', callId), { status: 'atendido' });
      showToast('Llamada atendida con éxito.');
    } catch (e) {
      console.warn("Error al actualizar llamada, eliminando:", e);
      try {
        await deleteDoc(doc(db, 'llamadas', callId));
        showToast('Llamada atendida.');
      } catch (err) {
        console.error("Error al eliminar llamada:", err);
        setWaiterCalls(prev => prev.filter(c => c.id !== callId));
      }
    }
  };

  // Notificar al mozo para cobro de mesa desde la cuenta
  const handleCallWaiterForBill = async () => {
    if (currentTableId === null) {
      showToast("Por favor selecciona tu mesa.", "error");
      return;
    }
    const tableIdNum = Number(currentTableId);
    const tableObj = tables.find(t => t.id === tableIdNum);
    const tableName = tableObj ? tableObj.name : `Mesa #${tableIdNum}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timestamp = Date.now();

    const callData: WaiterCall = {
      id: `CALL-${timestamp}`,
      tableId: tableIdNum,
      tableName: tableName,
      type: 'cuenta',
      time: nowTime,
      createdAt: timestamp,
      status: 'pendiente'
    };

    // Actualización inmediata en el estado local (optimista) para reflejo instantáneo en Admin
    setWaiterCalls(prev => {
      const alreadyListed = prev.some(c => c.tableId === tableIdNum && c.type === 'cuenta' && c.status === 'pendiente');
      if (alreadyListed) return prev;
      return [callData, ...prev];
    });

    // Actualizar mesa a 'por-pagar' localmente
    setTables(prev => prev.map(t => t.id === tableIdNum ? { ...t, status: 'por-pagar' } : t));

    try {
      await updateDoc(doc(db, 'mesas', String(tableIdNum)), { status: 'por-pagar' });
      const activeOrder = orders.find(o => o.tableId === tableIdNum && o.status !== 'pagado' && o.status !== 'cancelado');
      if (activeOrder) {
        await updateDoc(doc(db, 'pedidos', activeOrder.id), { status: 'por-pagar' });
      }
      const docRef = await addDoc(collection(db, 'llamadas'), {
        tableId: tableIdNum,
        tableName: tableName,
        type: 'cuenta',
        time: nowTime,
        createdAt: timestamp,
        status: 'pendiente'
      });
      // Sincronizar ID generado por Firestore con el registro local
      setWaiterCalls(prev => prev.map(c => c.id === callData.id ? { ...c, id: docRef.id } : c));
      showToast(`🔔 Solicitud de cobro enviada al personal para ${tableName}.`);
    } catch (e) {
      console.error("Error al llamar al mozo para cuenta en Firestore:", e);
      showToast(`🔔 Solicitud de cobro registrada para ${tableName}.`);
    }
  };

  // Payment Confirmation & Table Liberation in Firestore (Staff Only)
  const handlePayment = async (method: 'QR' | 'EFECTIVO') => {
    if (!isStaffAuthenticated) {
      showToast("Operación denegada. Solo el personal con PIN puede confirmar cobros y liberar la mesa.", "error");
      return;
    }
    if (currentTableId === null) {
      setCustomerModalOpen(false);
      showToast("Mesa no seleccionada.", "error");
      return;
    }
    const tableObj = tables.find(t => t.id === Number(currentTableId));
    if (!tableObj) {
      setCustomerModalOpen(false);
      showToast("Mesa no válida.", "error");
      return;
    }
    const activeOrder = orders.find(
      o => o.tableId === tableObj.id && 
      o.status !== 'pagado' && 
      o.status !== 'cancelado'
    );

    try {
      if (activeOrder) {
        await updateDoc(doc(db, 'pedidos', activeOrder.id), {
          status: 'pagado',
          paidAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          paymentMethod: method
        });
      }
      // Actualizar mesa en Firestore a libre
      await updateDoc(doc(db, 'mesas', String(tableObj.id)), {
        status: 'free',
        currentOrder: null
      });

      // Evento de pago y liberación de sesión: BEST PRACTICE
      try {
        const mesaActual = String(tableObj.id);
        localStorage.setItem('churo_sesion_activa', 'false');
        localStorage.removeItem('churo_carrito');
        localStorage.setItem('churo_ultima_mesa', mesaActual);
        localStorage.setItem('churo_fecha_pago', new Date().toISOString());
        localStorage.removeItem('churo_fecha_inicio');
        // Mantén churo_celular para pre-llenar la próxima vez
      } catch (stErr) {
        console.warn("Storage update error on payment:", stErr);
      }
      setCart([]);

      // Limpiar llamadas de mozo de esta mesa
      waiterCalls.filter(c => c.tableId === tableObj.id).forEach(c => attendWaiterCall(c.id));
      setTables(prev => prev.map(t => t.id === tableObj.id ? { ...t, status: 'free', currentOrder: null } : t));
      setCustomerModalOpen(false);
      setCashAmount('');
      showToast(`¡Pago con ${method} confirmado! Mesa #${tableObj.id} cobrada y liberada. ✨`);
    } catch (e) {
      console.error("Error al registrar pago y liberar mesa:", e);
      try {
        const mesaActual = String(tableObj.id);
        localStorage.setItem('churo_sesion_activa', 'false');
        localStorage.removeItem('churo_carrito');
        localStorage.setItem('churo_ultima_mesa', mesaActual);
        localStorage.setItem('churo_fecha_pago', new Date().toISOString());
        localStorage.removeItem('churo_fecha_inicio');
      } catch {
        // ignore
      }
      setCart([]);
      setTables(prev => prev.map(t => t.id === tableObj.id ? { ...t, status: 'free', currentOrder: null } : t));
      setCustomerModalOpen(false);
      setCashAmount('');
      showToast(`¡Pago con ${method} registrado! Mesa #${tableObj.id} liberada. ✨`);
    }
  };

  // Staff function to collect & liberate table immediately
  const liberateTable = async (tableId: number) => {
    if (!isStaffAuthenticated) {
      showToast("Acceso denegado. Se requiere autenticación de personal con PIN.", "error");
      return;
    }
    // Clear pending calls for this table
    waiterCalls.filter(c => c.tableId === tableId).forEach(c => attendWaiterCall(c.id));

    const orderToPay = orders.find(
      o => o.tableId === tableId && 
      o.status !== 'pagado' && 
      o.status !== 'cancelado'
    );

    try {
      if (orderToPay) {
        await updateDoc(doc(db, 'pedidos', orderToPay.id), {
          status: 'pagado',
          paidAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          paymentMethod: 'EFECTIVO'
        });
      }
      await updateDoc(doc(db, 'mesas', String(tableId)), {
        status: 'free',
        currentOrder: null
      });

      // Evento de pago y liberación de sesión: BEST PRACTICE
      try {
        const mesaActual = String(tableId);
        localStorage.setItem('churo_sesion_activa', 'false');
        localStorage.removeItem('churo_carrito');
        localStorage.setItem('churo_ultima_mesa', mesaActual);
        localStorage.setItem('churo_fecha_pago', new Date().toISOString());
        localStorage.removeItem('churo_fecha_inicio');
      } catch (stErr) {
        console.warn("Storage update error on table liberation:", stErr);
      }
      setCart([]);

      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: 'free', currentOrder: null } : t));
      showToast(`Mesa #${tableId} cobrada y liberada con éxito.`);
    } catch (e) {
      console.error("Error al liberar mesa:", e);
      try {
        const mesaActual = String(tableId);
        localStorage.setItem('churo_sesion_activa', 'false');
        localStorage.removeItem('churo_carrito');
        localStorage.setItem('churo_ultima_mesa', mesaActual);
        localStorage.setItem('churo_fecha_pago', new Date().toISOString());
      } catch {
        // ignore
      }
      setCart([]);
      setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: 'free', currentOrder: null } : t));
      showToast(`Mesa #${tableId} liberada.`);
    }
  };

  // Crear Solicitud de Cambio de Mesa (Modo Cliente)
  const handleCreateChangeRequest = async (motivo: string, celular?: string) => {
    const mesaNum = currentTableId || (mesaQR ? Number(mesaQR) : null);
    if (!mesaNum) {
      showToast("Por favor selecciona tu mesa antes de solicitar un cambio.", "error");
      return;
    }
    try {
      const cleanPhone = (celular || localStorage.getItem('churo_celular') || '').replace(/\D/g, '');
      const docRef = await addDoc(collection(db, 'solicitudes_cambio'), {
        mesa_origen: Number(mesaNum),
        mesa_destino: null,
        celular: cleanPhone || null,
        motivo: motivo || 'Mesa más grande',
        estado: 'pendiente',
        createdAt: serverTimestamp(),
        cliente_nombre: `Cliente Mesa ${mesaNum}`
      });
      console.log('Solicitud creada:', docRef.id);
      showToast("Solicitud enviada");
    } catch (e) {
      console.error("Error al enviar solicitud de cambio de mesa:", e);
      showToast("Error al enviar la solicitud. Intenta de nuevo.", "error");
    }
  };

  // Simular solicitud de cambio de mesa en admin
  const handleSimulateRequest = async () => {
    try {
      const docRef = await addDoc(collection(db, 'solicitudes_cambio'), {
        mesa_origen: 5,
        mesa_destino: null,
        celular: '71234567',
        motivo: 'Mesa más grande',
        estado: 'pendiente',
        createdAt: serverTimestamp(),
        cliente_nombre: 'Cliente Mesa 5'
      });
      console.log('Solicitud creada:', docRef.id);
      showToast("Solicitud simulada creada correctamente");
    } catch (e) {
      console.error("Error al simular solicitud:", e);
      showToast("Error al simular solicitud", "error");
    }
  };


  // Mover Comanda de Mesa Origen a Mesa Destino Libre (Modo Mozo / Admin y Traslado Aprobado)
  const handleMoveTable = async (sourceTableId: number, targetTableId: number, requestId?: string) => {
    try {
      const sourceTable = tables.find(t => t.id === sourceTableId);
      const targetTable = tables.find(t => t.id === targetTableId);
      const targetTableName = targetTable ? targetTable.name : `Mesa #${targetTableId}`;

      // a) Lee comanda de mesa_origen de mesas_activas/mesa_X
      const sourceMesaActivaRef = doc(db, 'mesas_activas', `mesa_${sourceTableId}`);
      let sourceData: any = null;
      try {
        const snap = await getDoc(sourceMesaActivaRef);
        if (snap.exists()) {
          sourceData = snap.data();
        }
      } catch (e) {
        console.warn("Lectura mesas_activas origen:", e);
      }

      const clienteCelular = sourceData?.cliente_celular || localStorage.getItem('churo_celular') || null;

      // Buscar comanda activa en 'pedidos'
      const activeOrder = orders.find(
        o => o.tableId === sourceTableId && 
        o.status !== 'pagado' && 
        o.status !== 'cancelado'
      );

      // b) Escribe esa comanda en mesas_activas/mesa_destino
      const targetMesaActivaRef = doc(db, 'mesas_activas', `mesa_${targetTableId}`);
      await setDoc(targetMesaActivaRef, {
        mesa: targetTableId,
        cliente_celular: clienteCelular,
        cliente_llego: sourceData?.cliente_llego || serverTimestamp(),
        trasladado_desde: sourceTableId,
        trasladado_el: serverTimestamp(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Actualizar la comanda activa en pedidos para que cocina y cuenta apunten a la nueva mesa
      if (activeOrder) {
        await updateDoc(doc(db, 'pedidos', activeOrder.id), {
          tableId: targetTableId,
          tableName: targetTableName,
          trasladadoDesde: sourceTableId,
          trasladadoAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }

      // d) Borra o marca mesa_origen como LIBRE
      try {
        await deleteDoc(sourceMesaActivaRef);
      } catch (delErr) {
        console.warn("Delete mesas_activas origen fallback:", delErr);
      }
      await updateDoc(doc(db, 'mesas', String(sourceTableId)), {
        status: 'free',
        currentOrder: null
      });

      // e) Marca mesa_destino como OCUPADA (o por-pagar según corresponda)
      const targetStatus = activeOrder?.status === 'por-pagar' ? 'por-pagar' : 'occupied';
      await updateDoc(doc(db, 'mesas', String(targetTableId)), {
        status: targetStatus,
        currentOrder: activeOrder ? { ...activeOrder, tableId: targetTableId, tableName: targetTableName } : null
      });

      // f) Actualiza solicitud a estado:'completado', mesa_destino: Y
      if (requestId) {
        try {
          await updateDoc(doc(db, 'solicitudes_cambio', requestId), {
            estado: 'completado',
            mesa_destino: targetTableId,
            atendidoAt: serverTimestamp()
          });
        } catch (rErr) {
          console.warn("Update solicitud_cambio:", rErr);
        }
      } else {
        const matchingReq = changeRequests.find(r => r.mesa_origen === sourceTableId && r.estado === 'pendiente');
        if (matchingReq) {
          try {
            await updateDoc(doc(db, 'solicitudes_cambio', matchingReq.id), {
              estado: 'completado',
              mesa_destino: targetTableId,
              atendidoAt: serverTimestamp()
            });
          } catch (rErr2) {
            console.warn("Update solicitud_cambio matching:", rErr2);
          }
        }
      }

      // g) Opcional: actualiza clientes/{celular} ultima_mesa
      if (clienteCelular) {
        try {
          await setDoc(doc(db, 'clientes', String(clienteCelular)), {
            ultima_mesa: targetTableId,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (cErr) {
          console.warn("Actualizar clientes doc:", cErr);
        }
      }

      // Si el usuario en este navegador es el cliente de esa mesa, actualizar su sesión a la nueva mesa
      const storedMesa = localStorage.getItem('churo_mesa');
      if (storedMesa && Number(storedMesa) === sourceTableId) {
        localStorage.setItem('churo_mesa', String(targetTableId));
        setCurrentTableId(targetTableId);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('mesa', String(targetTableId));
        window.history.replaceState({}, '', newUrl.toString());
      }

      showToast(`¡Comanda trasladada de Mesa ${sourceTableId} a Mesa ${targetTableId} con éxito! 🔄`);
    } catch (e) {
      console.error("Error al trasladar mesa:", e);
      showToast("Hubo un error al trasladar la mesa. Intenta nuevamente.", "error");
    }
  };

  // Add Table to Firestore and Local State
  const handleAddTable = async (newTable: { id: number; name: string; seats: number }) => {
    try {
      await setDoc(doc(db, 'mesas', String(newTable.id)), {
        id: newTable.id,
        name: newTable.name,
        seats: newTable.seats,
        status: 'free'
      });
      setTables(prev => {
        if (prev.some(t => t.id === newTable.id)) return prev;
        const createdTable: Table = { ...newTable, status: 'free' as const, currentOrder: null };
        return [...prev, createdTable].sort((a, b) => a.id - b.id);
      });
      showToast(`¡${newTable.name} agregada con éxito! 🎉`);
    } catch (e) {
      console.error("Error al agregar mesa en Firestore:", e);
      const createdTable: Table = { ...newTable, status: 'free' as const, currentOrder: null };
      setTables(prev => [...prev, createdTable].sort((a, b) => a.id - b.id));
      showToast(`¡${newTable.name} agregada! 🎉`);
    }
  };

  // Delete Table from Firestore and Local State
  const handleDeleteTable = async (tableId: number) => {
    const table = tables.find(t => t.id === tableId);
    if (table && table.status !== 'free') {
      showToast(`No se puede eliminar la Mesa #${tableId} porque tiene comensales o comanda activa.`, 'error');
      return;
    }

    try {
      await deleteDoc(doc(db, 'mesas', String(tableId)));
      setTables(prev => prev.filter(t => t.id !== tableId));
      if (currentTableId === tableId) {
        setCurrentTableId(null);
      }
      showToast(`Mesa #${tableId} eliminada correctamente.`);
    } catch (e) {
      console.error("Error al eliminar mesa en Firestore:", e);
      setTables(prev => prev.filter(t => t.id !== tableId));
      if (currentTableId === tableId) {
        setCurrentTableId(null);
      }
      showToast(`Mesa #${tableId} eliminada.`);
    }
  };

  // Robust QR Printing with Iframe Fallback
  const printQRCode = (table: Table) => {
    const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://el-churo-mosito.app';
    const targetUrl = `${originUrl}/?mesa=${table.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      // Fallback for mobile browsers or popup blocker
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Imprimir QR - ${table.name}</title>
              <style>
                body { font-family: system-ui, sans-serif; text-align: center; padding: 30px; }
                .card { border: 2px dashed #333; padding: 25px; border-radius: 16px; max-width: 320px; margin: 0 auto; }
                img { width: 220px; height: 220px; margin: 15px auto; }
                h1 { font-size: 20px; margin: 0; }
                p { font-size: 14px; color: #555; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>El Churo Mosito</h1>
                <p><strong>${table.name}</strong></p>
                <img src="${qrUrl}" alt="QR Mesa ${table.id}" />
                <p>Escanee para ordenar desde su smartphone</p>
              </div>
              <script>
                window.onload = function() {
                  window.focus();
                  window.print();
                };
              </script>
            </body>
          </html>
        `);
        doc.close();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 3000);
      }
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir QR - ${table.name}</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 30px; }
            .card { border: 2px dashed #333; padding: 25px; border-radius: 16px; max-width: 320px; margin: 0 auto; }
            img { width: 220px; height: 220px; margin: 15px auto; }
            h1 { font-size: 20px; margin: 0; }
            p { font-size: 14px; color: #555; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>El Churo Mosito</h1>
            <p><strong>${table.name}</strong></p>
            <img src="${qrUrl}" alt="QR Mesa ${table.id}" />
            <p>Escanee para ordenar desde su smartphone</p>
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtered Menu
  const categoriesWithAll = useMemo(() => ['TODOS', ...MENU_CATEGORIAS], []);
  const filteredMenu = useMemo(() => {
    if (selectedCategory === 'TODOS') return uniqueMenu;
    return uniqueMenu.filter(item => item.categoria === selectedCategory);
  }, [uniqueMenu, selectedCategory]);

  const backgroundModeClass = useMemo(() => {
    switch (restaurantProfile.modoFondo) {
      case 'dark-pure':
        return 'bg-[#000000]';
      case 'dark-warm':
        return 'bg-[#17100b]';
      case 'dark-zinc':
      default:
        return 'bg-[#1c1917]';
    }
  }, [restaurantProfile.modoFondo]);

  return (
    <div className={`min-h-screen ${backgroundModeClass} text-[#f5efe6] font-sans antialiased selection:bg-[#ff7a00] selection:text-white overflow-x-hidden relative w-full transition-colors duration-300`}>
      
      {/* Welcome & WhatsApp Capture Screen when scanning QR (?mesa=X) */}
      {showWelcomeScreen && currentTableId !== null && (
        <WelcomeScreen
          mesaNumber={currentTableId}
          restaurantProfile={restaurantProfile}
          onComplete={(celular) => {
            try {
              sessionStorage.setItem(`welcome_done_${currentTableId}`, 'true');
              sessionStorage.setItem(`churo_welcome_dismissed_${currentTableId}`, 'true');
            } catch {
              // ignore
            }
            setShowWelcomeScreen(false);
            if (celular) {
              showToast(`¡Bienvenido! WhatsApp +591 ${celular} registrado para Mesa #${currentTableId}`);
            }
          }}
        />
      )}

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-[1300] flex items-center gap-3 px-5 py-3.5 rounded-[16px] shadow-2xl backdrop-blur-md border animate-bounce ${
          notification.type === 'error' 
            ? 'bg-red-950/90 border-red-500/50 text-red-200' 
            : 'bg-[#292524]/95 border-[#ff7a00]/40 text-[#f5efe6]'
        }`}>
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-400 shrink-0" /> : <Sparkles className="w-5 h-5 text-[#ff7a00] shrink-0" />}
          <span className="text-[14px] font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1c1917]/95 backdrop-blur-md border-b border-[#3a3632]">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 h-[68px] sm:h-[72px] flex items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div 
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] flex items-center justify-center shrink-0 overflow-hidden shadow-lg transition-all"
              style={{
                backgroundColor: restaurantProfile.colorPrimario || '#ff7a00',
                boxShadow: `0 8px 30px ${(restaurantProfile.colorPrimario || '#ff7a00')}40`
              }}
            >
              {restaurantProfile.logoUrl ? (
                <img 
                  src={restaurantProfile.logoUrl} 
                  alt={restaurantProfile.nombre} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Utensils className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] sm:text-[20px] font-bold tracking-tight text-[#f5efe6] font-serif leading-tight truncate">
                {restaurantProfile.nombre || 'El Churo Mosito'}
              </h1>
              <p className="text-[10px] sm:text-[11px] text-[#a8a29e] tracking-[0.06em] uppercase font-medium truncate">
                {restaurantProfile.slogan || 'Gastronomía de Altura • Tarija'}
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center p-1.5 rounded-[16px] border border-[#3a3632] bg-[#292524]">
            {[
              { id: 'menu', label: 'Menú', icon: Utensils, isStaff: false },
              { id: 'tables', label: 'Mesas', icon: QrCode, isStaff: true },
              { id: 'kitchen', label: 'Cocina', icon: ChefHat, isStaff: true },
              { id: 'admin', label: 'Admin', icon: Layers, isStaff: true },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const activeCount = orders.filter(o => o.status !== 'pagado' && o.status !== 'cancelado' && o.status !== 'servido').length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-2 rounded-[12px] gap-2 text-[13px] font-semibold transition-all cursor-pointer ${
                    isActive ? 'bg-[#ff7a00] text-white shadow-lg' : 'text-[#a8a29e] hover:text-[#f5efe6]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {((tab.isStaff && !isStaffAuthenticated) || (tab.id === 'admin' && !isAdminAuthenticated)) && (
                    <Lock className="w-3 h-3 text-[#78716c]" />
                  )}
                  {tab.id === 'tables' && pendingChangeRequests.length > 0 && (
                    <span className="ml-1 px-1.5 min-w-[20px] h-5 bg-[#ff7a00] text-black rounded-full text-[10px] font-black flex items-center justify-center animate-pulse" title="Solicitudes de cambio de mesa">
                      🔔 {pendingChangeRequests.length}
                    </span>
                  )}
                  {tab.id === 'kitchen' && activeCount > 0 && (
                    <span className="ml-1 w-5 h-5 bg-amber-500 text-black rounded-full text-[10px] font-bold flex items-center justify-center">
                      {activeCount}
                    </span>
                  )}
                  {tab.id === 'admin' && (waiterCalls.length > 0 || pendingChangeRequests.length > 0) && (
                    <span className="ml-1 px-1.5 min-w-[20px] h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                      {waiterCalls.length + pendingChangeRequests.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Header Cart & Personal Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Botón de Casita (Inicio / Pantalla de Bienvenida) */}
            <button
              onClick={() => {
                if (currentTableId === null) {
                  setCurrentTableId(3);
                }
                setShowWelcomeScreen(true);
              }}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[#292524] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00]/60 text-[#a8a29e] hover:text-[#ff7a00] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0"
              title="Volver a la Pantalla de Bienvenida"
              aria-label="Volver a la Pantalla de Bienvenida"
            >
              <Home className="w-4 h-4 text-[#ff7a00]" />
              <span className="hidden md:inline font-semibold text-xs text-[#f5efe6]">Inicio</span>
            </button>
            {isStaffAuthenticated ? (
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-[#292524] border border-[#3a3632] hover:border-red-500/40 text-xs text-[#a8a29e] hover:text-white transition-colors cursor-pointer"
                title="Cerrar sesión de personal"
              >
                <LogOut className="w-3.5 h-3.5 text-[#ff7a00]" />
                <span className="hidden sm:inline font-medium">
                  {user?.displayName || staffSession?.name || 'Personal'}
                </span>
                <span className="sm:hidden text-[11px] font-semibold">Salir</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('tables')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-[#292524] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00]/50 text-xs text-[#a8a29e] hover:text-[#f5efe6] transition-all cursor-pointer active:scale-95"
                title="Acceso para Mozos, Cocina y Administración (PIN)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-[11px] sm:text-xs">Personal</span>
              </button>
            )}
            <button
              onClick={() => { setModalMode('cart'); setCustomerModalOpen(true); }}
              className="relative px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[14px] bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-bold transition-all shadow-[0_4px_20px_rgba(255,122,0,0.35)] flex items-center gap-2 active:scale-95 shrink-0 cursor-pointer"
              aria-label="Abrir Carrito"
            >
              <ShoppingBag className="w-5 h-5 shrink-0" />
              <span className="font-extrabold text-[14px]">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
              <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider">
                Carrito
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 pb-36 sm:pb-12">
        {activeTab === 'menu' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Hero Banner */}
            <div className="relative rounded-[24px] overflow-hidden bg-gradient-to-r from-[#292524] to-[#1c1917] border border-[#3a3632] p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              <div className="space-y-3 z-10 max-w-xl">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff7a00]/20 text-[#ff7a00] text-[12px] font-semibold tracking-wide uppercase">
                  <Award className="w-3.5 h-3.5" /> Sabor Auténtico Tarijeño
                </span>
                <h2 className="text-[26px] sm:text-[34px] font-serif font-extrabold tracking-tight text-[#f5efe6] leading-[1.15]">
                  Pide directamente a cocina desde tu smartphone
                </h2>
                <p className="text-[13px] sm:text-[14px] text-[#a8a29e] leading-relaxed">
                  Escanea el código QR de tu mesa, agrega tus platos al carrito y envíalos a cocina sin demoras.
                </p>
                <div className="pt-2 flex flex-wrap gap-2.5 items-center">
                  {isClientMode ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 border border-[#ff7a00]/40 bg-[#1c1917] rounded-xl px-3.5 py-2 text-xs font-bold text-[#ff7a00] shadow-sm">
                        <Lock className="w-3.5 h-3.5 text-[#ff7a00]" />
                        <span>{tables.find(t => t.id === currentTableId)?.name || `Mesa ${currentTableId}`} - Salón Central</span>
                        <span className="text-[10px] text-[#a8a29e] font-normal" title="Mesa asignada por QR bloqueada">🔒</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRequestChangeModalOpen(true)}
                        className="text-[11px] text-[#a8a29e] hover:text-[#ff7a00] underline transition-colors cursor-pointer flex items-center gap-1 self-start font-medium pt-0.5"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-[#ff7a00]" />
                        <span>¿Cambiar de mesa?</span>
                      </button>
                    </div>
                  ) : (
                    <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 transition-colors ${
                      currentTableId === null ? 'bg-amber-950/40 border-amber-500/60' : 'bg-[#1c1917] border-[#3a3632]'
                    }`}>
                      <span className="text-xs text-[#a8a29e]">Mesa:</span>
                      <select 
                        value={currentTableId ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          handleTableChange(val as number);
                        }}
                        className="bg-transparent text-sm font-bold text-[#ff7a00] focus:outline-none cursor-pointer"
                      >
                        <option value="" disabled className="bg-[#1c1917] text-stone-400">
                          -- Seleccionar Mesa --
                        </option>
                        {tables.map(t => (
                          <option key={`table-option-${t.id}`} value={t.id} className="bg-[#1c1917] text-white">
                            {formatTableOptionLabel(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      const effectiveId = isClientMode 
                        ? (Number(localStorage.getItem('churo_mesa')) || mesaQR || currentTableId)
                        : currentTableId;
                      if (effectiveId === null) {
                        showToast("Por favor selecciona tu mesa antes de llamar al mozo.", "error");
                        return;
                      }
                      const table = tables.find(t => t.id === Number(effectiveId));
                      if (table) callWaiter(table);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#3a3632] hover:bg-[#ff7a00] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#ff7a00]" /> Llamar Mozo
                  </button>
                  <button 
                    onClick={() => {
                      const effectiveId = isClientMode 
                        ? (Number(localStorage.getItem('churo_mesa')) || mesaQR || currentTableId)
                        : currentTableId;
                      if (effectiveId === null) {
                        showToast("Por favor selecciona tu mesa para pedir la cuenta.", "error");
                        return;
                      }
                      const table = tables.find(t => t.id === Number(effectiveId));
                      if (table) requestBill(table);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#3a3632] hover:bg-emerald-600 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" /> Pedir Cuenta
                  </button>
                </div>
              </div>
            </div>

            {/* Active Table Order Banner: Real-time Comanda Tracker */}
            {activeOrderForCurrentTable && (
              <ActiveOrderBanner
                order={activeOrderForCurrentTable}
                tableName={tables.find(t => t.id === Number(currentTableId))?.name || `Mesa #${currentTableId}`}
                onOpenAdditions={() => {
                  showToast('Selecciona platos o bebidas abajo para adicionarlos a tu mesa');
                  const menuSec = document.getElementById('menu-list-section');
                  if (menuSec) menuSec.scrollIntoView({ behavior: 'smooth' });
                }}
                onOpenBill={() => {
                  const table = currentTableId !== null ? tables.find(t => t.id === Number(currentTableId)) : null;
                  if (table) {
                    requestBill(table);
                  } else {
                    setModalMode('bill');
                    setCustomerModalOpen(true);
                  }
                }}
                onCancelOrder={cancelOrder}
              />
            )}

            {/* Categories Carousel */}
            <div id="menu-list-section" className="flex items-center gap-2 overflow-x-auto w-full pb-2 no-scrollbar scroll-mt-24">
              {categoriesWithAll.map(category => (
                <button
                  key={`cat-pill-${category}`}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-[14px] text-[13px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === category 
                      ? 'bg-[#ff7a00] text-white shadow-lg' 
                      : 'bg-[#292524] text-[#a8a29e] hover:bg-[#3a3632] hover:text-[#f5efe6] border border-[#3a3632]'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Menu Grid: If TODOS, grouped neatly by Category; If specific, direct list */}
            {selectedCategory === 'TODOS' ? (
              <div className="space-y-12">
                {MENU_CATEGORIAS.map(cat => {
                  const itemsInCat = uniqueMenu.filter(item => item.categoria === cat);
                  if (itemsInCat.length === 0) return null;
                  return (
                    <div key={`category-group-${cat}`} className="space-y-4">
                      <div className="flex items-center gap-3 border-b border-[#3a3632] pb-3">
                        <div className="w-3.5 h-3.5 rounded-full bg-[#ff7a00]" />
                        <h3 className="text-xl font-serif font-bold text-[#f5efe6] tracking-tight">{cat}</h3>
                        <span className="text-xs text-[#a8a29e] bg-[#292524] px-3 py-1 rounded-full border border-[#3a3632]">
                          {itemsInCat.length} platos
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {itemsInCat.map(product => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            onAddToCart={addToCart}
                            cartQty={cart.find(c => c.id === product.id)?.qty || 0}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMenu.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    cartQty={cart.find(c => c.id === product.id)?.qty || 0}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Staff Protected Views: Mesas, Cocina KDS y Administración */}
        {(activeTab === 'admin' && (!isStaffAuthenticated || !isAdminAuthenticated)) ? (
          <StaffLoginView
            onSuccess={(session) => setStaffSession(session)}
            showToast={showToast}
            requiredRole="Panel de Administración (PIN Administrador: 7777)"
          />
        ) : ((activeTab === 'tables' || activeTab === 'kitchen') && !isStaffAuthenticated) ? (
          <StaffLoginView
            onSuccess={(session) => setStaffSession(session)}
            showToast={showToast}
            requiredRole={activeTab === 'tables' ? "Gestión de Mesas (PIN Mozo: 1234 o Admin: 7777)" : "Cocina KDS (PIN Cocina: 1234 o Admin: 7777)"}
          />
        ) : (
          <div className="animate-fadeIn">
            {/* Tables & QR Code Generator Tab */}
            {activeTab === 'tables' && (
              <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-[24px] sm:text-[28px] font-serif font-extrabold tracking-tight text-[#f5efe6]">
                    Gestión de Mesas y Códigos QR
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ff7a00]/20 text-[#ff7a00] border border-[#ff7a00]/30 font-sans">
                    {tables.length} mesas
                  </span>
                  {pendingChangeRequests.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-black border border-amber-400 font-sans animate-pulse flex items-center gap-1">
                      <Bell className="w-3 h-3" /> {pendingChangeRequests.length} {pendingChangeRequests.length === 1 ? 'cambio pendiente' : 'cambios pendientes'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#a8a29e] mt-1">
                  Visualiza el consumo en tiempo real, traslada comandas a mesas libres, cobra o imprime los códigos QR.
                </p>
              </div>
              <button
                onClick={() => setIsAddTableModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[14px] bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-bold text-sm shadow-[0_4px_20px_rgba(255,122,0,0.35)] transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Nueva Mesa</span>
              </button>
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
                  {pendingChangeRequests.map(req => {
                    const originTable = tables.find(t => t.id === req.mesa_origen);
                    return (
                      <div key={`req-card-${req.id}`} className="bg-[#292524] border border-[#3a3632] rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-sm">
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#ff7a00] text-sm">Mesa #{req.mesa_origen} ({originTable?.name || 'Mesa'})</span>
                            <span className="text-[#a8a29e] text-[10px] flex items-center gap-1 bg-[#1c1917] px-2 py-0.5 rounded border border-[#3a3632]">
                              <Clock className="w-3 h-3 text-amber-400" /> Pendiente
                            </span>
                          </div>
                          <p className="text-[#f5efe6] italic bg-[#1c1917] p-2 rounded-lg border border-[#3a3632]/80 mt-1">
                            "{req.motivo}"
                          </p>
                          {req.celular && (
                            <p className="text-[#a8a29e] text-[11px]">
                              WhatsApp: +591 {req.celular}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (originTable) {
                                setMoveStaffModal({
                                  isOpen: true,
                                  sourceTable: originTable,
                                  requestId: req.id,
                                  requestDetails: req
                                });
                              } else {
                                showToast("Mesa de origen no encontrada", "error");
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
              {tables.map(table => (
                <div key={`table-card-${table.id}`} className="bg-[#292524] border border-[#3a3632] rounded-[20px] p-6 flex flex-col justify-between gap-6 shadow-md">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#ff7a00]">
                        Mesa #{table.id}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        table.status === 'free' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 
                        table.status === 'por-pagar' ? 'bg-red-950 text-red-300 border border-red-800' : 
                        'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {table.status === 'free' ? 'Libre' : table.status === 'por-pagar' ? 'Por Pagar' : 'Ocupada'}
                      </span>
                    </div>
                    <h3 className="text-[18px] font-serif font-bold text-[#f5efe6] mt-2">{table.name}</h3>
                    <p className="text-xs text-[#a8a29e] mt-1">{table.seats} comensales</p>

                    {table.currentOrder && (
                      <div className="mt-3 p-3 rounded-xl bg-[#1c1917] border border-[#3a3632] space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#a8a29e]">Consumo en curso:</span>
                          <span className="text-[#ff7a00] font-black text-sm">Bs. {table.currentOrder.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-[#a8a29e]">
                          <span>{table.currentOrder.items.length} ítems</span>
                          <span>Hora: {table.currentOrder.time}</span>
                        </div>
                      </div>
                    )}

                    {/* Aviso de solicitud de cambio para esta mesa específica */}
                    {pendingChangeRequests.some(r => r.mesa_origen === table.id) && (
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-2 animate-pulse">
                        <span className="flex items-center gap-1.5 font-bold">
                          <ArrowRightLeft className="w-4 h-4 text-[#ff7a00]" />
                          <span>Solicitud de cambio</span>
                        </span>
                        <button
                          onClick={() => {
                            const req = pendingChangeRequests.find(r => r.mesa_origen === table.id);
                            setMoveStaffModal({
                              isOpen: true,
                              sourceTable: table,
                              requestId: req?.id,
                              requestDetails: req || null
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#ff7a00] hover:bg-[#ff8c1a] text-black text-[11px] font-black cursor-pointer transition-colors"
                        >
                          Mover
                        </button>
                      </div>
                    )}

                    {waiterCalls.some(c => c.tableId === table.id) && (
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-2 animate-pulse">
                        <span className="flex items-center gap-1.5 font-bold">
                          <Bell className="w-4 h-4 text-[#ff7a00]" />
                          {waiterCalls.find(c => c.tableId === table.id)?.type === 'mozo' ? 'Mozo solicitado' : 'Cuenta solicitada'}
                        </span>
                        <button
                          onClick={() => {
                            const call = waiterCalls.find(c => c.tableId === table.id);
                            if (call) attendWaiterCall(call.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-emerald-600 text-white text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Atender
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => setQrModalTable(table)}
                      className="w-full py-2.5 px-3 rounded-[12px] bg-[#3a3632] hover:bg-[#ff7a00] text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" /> Ver / Imprimir QR
                    </button>
                    {table.status !== 'free' ? (
                      isStaffAuthenticated ? (
                        <>
                          <button
                            onClick={() => {
                              setCurrentTableId(table.id);
                              setModalMode('bill');
                              setCashAmount('');
                              setCustomerModalOpen(true);
                            }}
                            className="w-full py-2.5 px-3 rounded-[12px] bg-emerald-600 hover:bg-emerald-700 text-[13px] font-semibold text-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow"
                          >
                            <CheckCheck className="w-4 h-4" /> Cobrar y Liberar Mesa
                          </button>
                          <button
                            onClick={() => {
                              const req = pendingChangeRequests.find(r => r.mesa_origen === table.id);
                              setMoveStaffModal({
                                isOpen: true,
                                sourceTable: table,
                                requestId: req?.id,
                                requestDetails: req || null
                              });
                            }}
                            className="w-full py-2 px-3 rounded-[12px] bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00]/50 text-[12px] font-semibold text-[#f5efe6] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 text-[#ff7a00]" />
                            <span>Mover a otra mesa</span>
                          </button>
                        </>
                      ) : null
                    ) : (
                      isStaffAuthenticated ? (
                        <button
                          onClick={() => setTableToDelete(table)}
                          className="w-full py-2 px-3 rounded-[12px] bg-[#1c1917] hover:bg-red-950/60 border border-[#3a3632] hover:border-red-500/40 text-[12px] font-semibold text-[#a8a29e] hover:text-red-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Eliminar mesa del restaurante"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>Eliminar Mesa</span>
                        </button>
                      ) : null
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

            {/* Kitchen KDS */}
            {activeTab === 'kitchen' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[24px] sm:text-[28px] font-serif font-extrabold tracking-tight text-[#f5efe6]">
                      Comanda de Cocina (KDS)
                    </h2>
                    <p className="text-sm text-[#a8a29e]">
                      Pedidos en tiempo real sincronizados desde las mesas. Sin mesas duplicadas.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                    {orders.filter(o => o.status !== 'pagado' && o.status !== 'cancelado' && o.status !== 'servido').length} en cocina
                  </span>
                </div>

                {orders.filter(o => o.status !== 'pagado' && o.status !== 'cancelado').length === 0 ? (
                  <div className="text-center py-16 bg-[#292524] border border-[#3a3632] rounded-[24px] text-[#a8a29e]">
                    <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-40 text-[#ff7a00]" />
                    <p className="text-base font-bold text-[#f5efe6]">No hay comandas activas</p>
                    <p className="text-xs mt-1">Los pedidos enviados por los clientes aparecerán aquí automáticamente.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders
                      .filter(o => o.status !== 'pagado' && o.status !== 'cancelado')
                      .map(order => (
                      <div key={`kitchen-order-${order.id}`} className="bg-[#292524] border border-[#3a3632] rounded-[20px] p-6 space-y-4 flex flex-col justify-between shadow-lg">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-[#ff7a00]">{order.id}</span>
                            <div className="flex items-center gap-2">
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
                          <div className="flex items-center justify-between">
                            <h4 className="text-base font-serif font-bold text-[#f5efe6]">{order.tableName}</h4>
                            <span className="text-xs font-extrabold text-[#ff7a00]">Bs. {order.total.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-[#3a3632] pt-3 space-y-2">
                            {order.items.map((item) => (
                              <div key={item.orderItemId || `kds-item-${order.id}-${item.id}`} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-[#f5efe6] font-medium">{item.qty}x {item.nombre}</span>
                                  {item.isAddition && (
                                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                                      Adición
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-[#a8a29e]">Bs. {(item.precioBs * item.qty).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="pt-4 border-t border-[#3a3632] flex flex-wrap gap-2">
                          <button 
                            onClick={() => updateOrderStatus(order.id, 'en-preparacion')}
                            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              order.status === 'en-preparacion' ? 'bg-amber-600 text-white font-bold' : 'bg-[#1c1917] text-[#a8a29e]'
                            }`}
                          >
                            En Fogones
                          </button>
                          <button 
                            onClick={() => updateOrderStatus(order.id, 'servido')}
                            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              order.status === 'servido' ? 'bg-emerald-600 text-white font-bold' : 'bg-[#1c1917] text-[#a8a29e]'
                            }`}
                          >
                            Servido
                          </button>
                          <button 
                            onClick={() => liberateTable(order.tableId)}
                            className="py-2 px-2.5 rounded-xl text-xs font-semibold bg-[#3a3632] hover:bg-emerald-700 text-emerald-300 hover:text-white transition-colors cursor-pointer"
                            title="Cobrar comanda y liberar mesa"
                          >
                            Cobrar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Admin View */}
            {activeTab === 'admin' && (
              <div className="space-y-8 animate-fadeIn">
                {/* Cabecera Principal del Panel Admin con Pestañas de Navegación */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3a3632] pb-6">
                  <div>
                    <h2 className="text-[24px] sm:text-[28px] font-serif font-extrabold tracking-tight text-[#f5efe6] flex items-center gap-3">
                      <span>Panel de Administración</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-[#a8a29e] mt-1">
                      Gestiona el inventario de platos, atiende llamadas de clientes y configura la identidad de marca del restaurante.
                    </p>
                  </div>

                  {/* Selector de Módulos del Panel Admin */}
                  <div className="flex items-center p-1.5 rounded-2xl bg-[#292524] border border-[#3a3632] self-start md:self-auto shrink-0 shadow-md">
                    <button
                      type="button"
                      onClick={() => setAdminSubTab('inventario')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        adminSubTab === 'inventario'
                          ? 'bg-[#ff7a00] text-white shadow-lg'
                          : 'text-[#a8a29e] hover:text-[#f5efe6]'
                      }`}
                    >
                      <Utensils className="w-4 h-4" />
                      <span>Inventario ({uniqueMenu.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminSubTab('perfil')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        adminSubTab === 'perfil'
                          ? 'bg-[#ff7a00] text-[#0A0A0A] shadow-lg font-black'
                          : 'text-[#a8a29e] hover:text-[#f5efe6]'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Perfil de Marca</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAdminSubTab('historial')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                        adminSubTab === 'historial'
                          ? 'bg-[#ff7a00] text-[#0A0A0A] shadow-lg font-black'
                          : 'text-[#a8a29e] hover:text-[#f5efe6]'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Historial de Recibos</span>
                    </button>
                  </div>

                </div>
                
                <div className="space-y-6">
                  {/* Waiter Calls */}
                  <div className="bg-[#292524] border border-[#3a3632] rounded-[20px] p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-serif font-bold text-[#f5efe6] flex items-center gap-2">
                        <Bell className="w-5 h-5 text-[#ff7a00]" />
                        <span>Llamadas Activas de Clientes</span>
                      </h3>
                      {waiterCalls.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                          {waiterCalls.length} pendientes
                        </span>
                      )}
                    </div>
                    {waiterCalls.length === 0 ? (
                      <p className="text-sm text-[#a8a29e]">No hay llamadas pendientes.</p>
                    ) : (
                      <div className="space-y-3">
                        {waiterCalls.map((call) => (
                          <div key={`call-${call.id}`} className="flex items-center justify-between bg-[#1c1917] p-4 rounded-xl border border-[#3a3632] shadow-sm">
                            <div className="flex items-center gap-3">
                              {call.type === 'mozo' ? <Bell className="w-5 h-5 text-[#ff7a00] animate-bounce" /> : <FileText className="w-5 h-5 text-emerald-400 animate-pulse" />}
                              <div>
                                <p className="text-sm font-bold text-[#f5efe6]">{call.tableName}</p>
                                <span className="text-xs text-[#a8a29e]">{call.type === 'mozo' ? 'Llamada de Mozo' : 'Solicitud de Cuenta'} • {call.time}</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => attendWaiterCall(call.id)} 
                              className="px-3.5 py-1.5 rounded-lg bg-[#3a3632] hover:bg-emerald-600 text-xs font-bold text-white cursor-pointer transition-colors"
                            >
                              Atendido
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Solicitudes de Cambio de Mesa en Admin */}
                  <div className="bg-[#292524] border border-[#3a3632] rounded-[20px] p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3 className="text-lg font-serif font-bold text-[#f5efe6] flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-[#ff7a00]" />
                        <span>Solicitudes de Cambio de Mesa</span>
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSimulateRequest}
                          className="px-3 py-1.5 rounded-xl bg-[#3a3632] hover:bg-[#ff7a00] text-xs font-bold text-[#f5efe6] hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow"
                          title="Simular solicitud de cambio de mesa"
                        >
                          <span>Simular solicitud</span>
                        </button>
                        {pendingChangeRequests.length > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#ff7a00] text-black border border-amber-400 animate-pulse">
                            {pendingChangeRequests.length} pendientes
                          </span>
                        )}
                      </div>
                    </div>
                    {pendingChangeRequests.length === 0 ? (
                      <p className="text-sm text-[#a8a29e]">No hay solicitudes pendientes</p>
                    ) : (
                      <div className="space-y-3">
                        {pendingChangeRequests.map((req) => {
                          const originTable = tables.find(t => t.id === req.mesa_origen);
                          return (
                            <div key={`admin-req-${req.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1c1917] p-4 rounded-xl border border-[#3a3632] shadow-sm">
                              <div className="space-y-1 text-xs">
                                <p className="font-bold text-[#f5efe6]">
                                  Mesa {req.mesa_origen} solicita cambio - Motivo: {req.motivo || 'Mesa más grande'} - Cel: {req.celular || '71234567'}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  const originTable = tables.find(t => t.id === req.mesa_origen) || { id: req.mesa_origen, name: `Mesa ${req.mesa_origen}`, seats: 4, status: 'occupied', currentOrder: null };
                                  setMoveStaffModal({
                                    isOpen: true,
                                    sourceTable: originTable as any,
                                    requestId: req.id,
                                    requestDetails: req
                                  });
                                }}
                                className="px-3.5 py-2 rounded-lg bg-[#ff7a00] hover:bg-[#ff8c1a] text-xs font-black text-black cursor-pointer transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0 shadow-md"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>[Botón Mover]</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* =========================================================================
                   * 📋 INVENTARIO Y GESTIÓN DE PLATOS Y BEBIDAS DEL RESTAURANTE
                   * 
                   * 🌟 EXPLICACIÓN FÁCIL COMO PARA UN NIÑO DE 12 AÑOS:
                   * Aquí el dueño o administrador del restaurante tiene el control total:
                   * 1. ➕ Botón "+ Agregar Plato o Bebida": Abre una ventana para inventar un plato nuevo.
                   * 2. 💰 Botón "Bs. / Precio": Permite cambiar cuánto cuesta un plato si la carne sube o baja.
                   * 3. ✏️ Botón "Editar": Para cambiar la foto, los ingredientes o el nombre.
                   * 4. 🗑️ Botón "Eliminar": Para quitar un plato que ya no se va a vender.
                   * 5. 🔍 Buscador y Filtros: Para encontrar cualquier comida o bebida rápidamente.
                   * ========================================================================= */}
                  {adminSubTab === 'inventario' && (
                    <div className="bg-[#292524] border border-[#3a3632] rounded-[24px] p-5 sm:p-7 space-y-6 shadow-xl animate-fadeIn">
                    {/* Cabecera del Inventario con Título y Botón Principal */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#3a3632] pb-5">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-xl sm:text-2xl font-serif font-black text-[#f5efe6]">
                            Inventario de Platos y Bebidas
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ff7a00]/15 text-[#ff7a00] border border-[#ff7a00]/30">
                            {uniqueMenu.length} artículos
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#a8a29e] mt-1">
                          Edita precios en Bolivianos (Bs.), fotos, ingredientes o agrega nuevos platos al instante.
                        </p>
                      </div>

                      {/* Botón para Agregar Plato o Bebida */}
                      <button
                        onClick={() => {
                          setDishToEdit(null);
                          setDishModalOpen(true);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] active:scale-95 text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,122,0,0.3)] cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Agregar Plato o Bebida</span>
                      </button>
                    </div>

                    {/* Tarjetas de Estadísticas Rápidas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
                        <span className="text-[11px] text-[#a8a29e] uppercase font-bold tracking-wider">Total Ítems</span>
                        <p className="text-xl font-black text-[#f5efe6] mt-0.5">{uniqueMenu.length}</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
                        <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider">Disponibles</span>
                        <p className="text-xl font-black text-emerald-400 mt-0.5">{uniqueMenu.filter(m => m.disponible).length}</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
                        <span className="text-[11px] text-red-400 uppercase font-bold tracking-wider">Agotados</span>
                        <p className="text-xl font-black text-red-400 mt-0.5">{uniqueMenu.filter(m => !m.disponible).length}</p>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
                        <span className="text-[11px] text-amber-400 uppercase font-bold tracking-wider">Categorías</span>
                        <p className="text-xl font-black text-amber-400 mt-0.5">{new Set(uniqueMenu.map(m => m.categoria)).size}</p>
                      </div>
                    </div>

                    {/* Buscador y Filtro de Categorías */}
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={adminMenuSearch}
                          onChange={(e) => setAdminMenuSearch(e.target.value)}
                          placeholder="Buscar plato, bebida, ingrediente o categoría..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-xs sm:text-sm text-[#f5efe6] focus:outline-none placeholder-[#78716c]"
                        />
                        {adminMenuSearch && (
                          <button
                            onClick={() => setAdminMenuSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#a8a29e] hover:text-white"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>

                      {/* Pestañas de categoría para filtrar rápido */}
                      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                        <button
                          onClick={() => setAdminMenuCategory('TODOS')}
                          className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer font-bold ${
                            adminMenuCategory === 'TODOS'
                              ? 'bg-[#ff7a00] text-white'
                              : 'bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#3a3632]'
                          }`}
                        >
                          Todos ({uniqueMenu.length})
                        </button>
                        {MENU_CATEGORIAS.map((cat) => {
                          const count = uniqueMenu.filter(m => m.categoria === cat).length;
                          if (count === 0) return null;
                          return (
                            <button
                              key={`admin-cat-tab-${cat}`}
                              onClick={() => setAdminMenuCategory(cat)}
                              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer font-semibold ${
                                adminMenuCategory === cat
                                    ? 'bg-[#ff7a00] text-white font-bold'
                                  : 'bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#3a3632]'
                              }`}
                            >
                              {cat} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tabla de Artículos con Imágenes, Precios y Acciones */}
                    {filteredAdminMenu.length === 0 ? (
                      <div className="text-center py-12 bg-[#1c1917] rounded-2xl border border-[#3a3632] text-[#a8a29e] space-y-2">
                        <p className="text-sm font-bold text-[#f5efe6]">No se encontraron platos ni bebidas</p>
                        <p className="text-xs">Prueba buscando con otra palabra o selecciona otra categoría.</p>
                        <button
                          onClick={() => {
                            setAdminMenuSearch('');
                            setAdminMenuCategory('TODOS');
                          }}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-[#3a3632] text-xs font-bold text-white hover:bg-[#ff7a00] transition-colors"
                        >
                          Restablecer Filtros
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-[#3a3632]">
                        <table className="w-full text-left text-xs sm:text-sm text-[#a8a29e]">
                          <thead className="text-[11px] text-[#f5efe6] uppercase bg-[#1c1917] border-b border-[#3a3632]">
                            <tr>
                              <th className="px-4 py-3.5">Plato / Bebida</th>
                              <th className="px-4 py-3.5">Categoría</th>
                              <th className="px-4 py-3.5">Precio (Bs.)</th>
                              <th className="px-4 py-3.5">Estado</th>
                              <th className="px-4 py-3.5 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#3a3632] bg-[#292524]">
                            {filteredAdminMenu.map((item) => (
                              <tr key={item.id} className="hover:bg-[#1c1917]/50 transition-colors">
                                {/* Foto y Nombre del Plato */}
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      onClick={() => {
                                        setDishToEdit(item);
                                        setDishModalOpen(true);
                                      }}
                                      className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#1c1917] border border-[#3a3632] shrink-0 cursor-pointer group"
                                      title="Clic para editar foto o detalles"
                                    >
                                      <img
                                        src={item.image}
                                        alt={item.nombre}
                                        onError={(e) => {
                                          (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80';
                                        }}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Pencil className="w-3.5 h-3.5 text-white" />
                                      </div>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-[#f5efe6] truncate">{item.nombre}</p>
                                      {item.descripcion && (
                                        <p className="text-[11px] text-[#a8a29e] line-clamp-1 max-w-xs">{item.descripcion}</p>
                                      )}
                                      {item.notas && (
                                        <span className="text-[10px] text-amber-300 font-semibold">{item.notas}</span>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Categoría */}
                                <td className="px-4 py-3">
                                  <span className="text-[11px] font-bold text-[#ff7a00] bg-[#ff7a00]/10 px-2 py-0.5 rounded-full border border-[#ff7a00]/20 whitespace-nowrap">
                                    {item.categoria}
                                  </span>
                                </td>

                                {/* Precio con Botón de Edición Rápida */}
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => setDishToQuickPrice(item)}
                                    className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00] text-[#f5efe6] cursor-pointer transition-colors"
                                    title="Clic para cambiar el precio en 2 segundos"
                                  >
                                    <span className="font-mono font-black text-sm text-[#ff7a00]">
                                      Bs. {item.precioBs.toFixed(2)}
                                    </span>
                                    <Pencil className="w-3 h-3 text-[#a8a29e] group-hover:text-white" />
                                  </button>
                                </td>

                                {/* Disponibilidad en Cocina */}
                                <td className="px-4 py-3">
                                  <button
                                    onClick={() => toggleAvailability(item.id, item.disponible)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors border ${
                                      item.disponible
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                                        : 'bg-red-950 text-red-300 border-red-700 hover:bg-red-900'
                                    }`}
                                    title="Clic para alternar entre Disponible y Agotado"
                                  >
                                    {item.disponible ? '✓ Disponible' : '✕ Agotado'}
                                  </button>
                                </td>

                                {/* Botones de Acción: Editar, Precio y Borrar */}
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* Botón Editar Todo */}
                                    <button
                                      onClick={() => {
                                        setDishToEdit(item);
                                        setDishModalOpen(true);
                                      }}
                                      className="p-1.5 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] text-[#f5efe6] hover:text-[#ff7a00] border border-[#3a3632] transition-colors cursor-pointer"
                                      title="Editar plato completo (ingredientes, foto, etc.)"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>

                                    {/* Botón Cambiar Precio Rápido */}
                                    <button
                                      onClick={() => setDishToQuickPrice(item)}
                                      className="p-1.5 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] text-[#ff7a00] hover:text-white border border-[#3a3632] transition-colors cursor-pointer"
                                      title="Cambiar precio rápidamente"
                                    >
                                      <DollarSign className="w-4 h-4" />
                                    </button>

                                    {/* Botón Eliminar Plato */}
                                    <button
                                      onClick={() => setDishToDelete(item)}
                                      className="p-1.5 rounded-lg bg-[#1c1917] hover:bg-red-950/60 text-red-400 hover:text-red-300 border border-[#3a3632] hover:border-red-500/40 transition-colors cursor-pointer"
                                      title="Eliminar este plato del menú"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB 2: Perfil del Restaurante e Identidad de Marca */}
                {adminSubTab === 'perfil' && (
                  <RestaurantProfileAdmin
                    currentProfile={restaurantProfile}
                    onProfileUpdated={(updated) => setRestaurantProfile(updated)}
                    showNotification={(msg, type) => showToast(msg, type)}
                  />
                )}

                {/* SUBTAB 3: Historial de Recibos y Ventas */}
                {adminSubTab === 'historial' && (
                  <TicketHistoryAdmin />
                )}

              </div>
            </div>
            )}
          </div>
        )}
      </main>

      {/* Cart & Checkout Modal (Z-[1200], 100dvh, Sticky Footer with Enviar Pedido) */}
      <CartModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        modalMode={modalMode}
        cart={cart}
        cartTotal={cartTotal}
        tables={tables}
        currentTableId={currentTableId}
        activeOrder={activeOrderForCurrentTable}
        onTableChange={handleTableChange}
        onUpdateQty={updateCartQty}
        onRemoveItem={removeFromCart}
        onPlaceOrder={placeOrder}
        onPayment={handlePayment}
        cashAmount={cashAmount}
        setCashAmount={setCashAmount}
        onViewMenu={() => setActiveTab('menu')}
        onSwitchToBill={() => {
          const effectiveId = isClientMode 
            ? (Number(localStorage.getItem('churo_mesa')) || mesaQR || currentTableId)
            : currentTableId;
          const table = effectiveId !== null ? tables.find(t => t.id === Number(effectiveId)) : null;
          if (table) {
            requestBill(table);
          } else {
            setModalMode('bill');
          }
        }}
        isClientMode={isClientMode}
        isStaffAuthenticated={isStaffAuthenticated}
        staffName={user?.displayName || staffSession?.name || 'Personal'}
        onStaffLoginSuccess={(session) => setStaffSession(session)}
        onCallWaiterForBill={handleCallWaiterForBill}
        onRequestTableChange={() => setIsRequestChangeModalOpen(true)}
      />

      {/* Floating Mobile Cart Bar (Hides when Cart Modal is Open) */}
      <FloatingCartBar
        cart={cart}
        cartTotal={cartTotal}
        isOpen={customerModalOpen}
        onOpenCart={() => {
          setModalMode('cart');
          setCustomerModalOpen(true);
        }}
      />

      {/* Mobile Bottom Dock */}
      <MobileDock
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        cart={cart}
        orders={orders}
        waiterCallsCount={waiterCalls.length}
        changeRequestsCount={pendingChangeRequests.length}
        isCartOpen={customerModalOpen}
        isStaffAuthenticated={isStaffAuthenticated}
        isAdminAuthenticated={isAdminAuthenticated}
        onOpenCart={() => {
          setModalMode('cart');
          setCustomerModalOpen(true);
        }}
        onOpenWelcome={() => {
          if (currentTableId === null) {
            setCurrentTableId(3);
          }
          setShowWelcomeScreen(true);
        }}
      />

      {/* QR Modal for Mesa */}
      <QrModal
        table={qrModalTable}
        onClose={() => setQrModalTable(null)}
        onPrint={printQRCode}
      />

      {/* Add Table Modal */}
      <AddTableModal
        isOpen={isAddTableModalOpen}
        onClose={() => setIsAddTableModalOpen(false)}
        existingTables={tables}
        onAddTable={handleAddTable}
      />

      {/* Delete Table Modal */}
      <DeleteTableModal
        table={tableToDelete}
        onClose={() => setTableToDelete(null)}
        onConfirmDelete={handleDeleteTable}
      />

      {/* Modales para Funcionalidad de Cambio de Mesa */}
      {/* 1. Modal para que el cliente solicite cambio de mesa con motivo */}
      <RequestTableChangeModal
        isOpen={isRequestChangeModalOpen}
        onClose={() => setIsRequestChangeModalOpen(false)}
        mesaOrigen={currentTableId || (mesaQR ? Number(mesaQR) : 1)}
        initialCelular={localStorage.getItem('churo_celular') || ''}
        onSubmit={handleCreateChangeRequest}
      />

      {/* 2. Modal para que el mozo o admin mueva la comanda a otra mesa libre */}
      <MoveTableStaffModal
        isOpen={moveStaffModal.isOpen}
        onClose={() => setMoveStaffModal({ isOpen: false, sourceTable: null })}
        sourceTable={moveStaffModal.sourceTable}
        allTables={tables}
        requestId={moveStaffModal.requestId}
        requestDetails={moveStaffModal.requestDetails}
        onConfirmMove={handleMoveTable}
      />

      {/* 3. Modal para el cliente cuando escanea un nuevo QR teniendo comanda activa */}
      {clientMovePrompt && (
        <ClientConfirmMoveModal
          isOpen={clientMovePrompt.isOpen}
          fromMesa={clientMovePrompt.fromMesa}
          toMesa={clientMovePrompt.toMesa}
          onConfirmMove={async () => {
            await handleMoveTable(clientMovePrompt.fromMesa, clientMovePrompt.toMesa);
            setClientMovePrompt(null);
          }}
          onStay={() => {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('mesa', String(clientMovePrompt.fromMesa));
            window.history.replaceState({}, '', newUrl.toString());
            setCurrentTableId(clientMovePrompt.fromMesa);
            setClientMovePrompt(null);
            showToast(`Permaneces en tu Mesa ${clientMovePrompt.fromMesa}`);
          }}
        />
      )}

      {/* =========================================================================
       * 🍽️ VENTANAS MÁGICAS (MODALES) PARA PLATOS, PRECIOS Y FOTOS:
       * 
       * 🌟 EXPLICACIÓN COMO PARA UN NIÑO DE 12 AÑOS:
       * 1. AddEditDishModal: La hoja de papel para inventar un plato o cambiarle la foto.
       * 2. QuickPriceModal: El marcador rápido para cambiar el precio en 2 clics.
       * 3. DeleteDishModal: El cartel de "¿Seguro?" antes de borrar un plato por accidente.
       * ========================================================================= */}
      <AddEditDishModal
        isOpen={dishModalOpen}
        onClose={() => {
          setDishModalOpen(false);
          setDishToEdit(null);
        }}
        dishToEdit={dishToEdit}
        onSave={handleSaveDish}
      />

      <QuickPriceModal
        isOpen={Boolean(dishToQuickPrice)}
        onClose={() => setDishToQuickPrice(null)}
        dish={dishToQuickPrice}
        onUpdatePrice={handleQuickUpdatePrice}
      />

      <DeleteDishModal
        isOpen={Boolean(dishToDelete)}
        onClose={() => setDishToDelete(null)}
        dish={dishToDelete}
        onConfirmDelete={handleDeleteDish}
      />

    </div>
  );
}
