import { useState, useEffect, useMemo } from 'react';
import {
  Utensils, QrCode, ChefHat, Layers, LogOut, Lock,
  Sparkles, AlertCircle, CheckCheck, Home
} from 'lucide-react';
import { db, auth } from './firebase.ts';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';

import { INITIAL_MENU, INITIAL_TABLES } from './data/menuData.ts';
import {
  MenuItem,
  CartItem,
  Table,
  Order,
  OrderItem,
  WaiterCall,
  NotificationState,
  RestaurantProfile,
  SolicitudCambio,
  Collaborator,
  SecurityConfig,
  StaffSession,
} from './types/index.ts';
import { CartModal } from './components/CartModal.tsx';
import { FloatingCartBar } from './components/FloatingCartBar.tsx';
import { MobileDock } from './components/MobileDock.tsx';
import { QrModal } from './components/QrModal.tsx';
import { StaffLoginView } from './components/StaffLoginView.tsx';
import { AddTableModal, DeleteTableModal } from './components/TableModals.tsx';
import { AddEditDishModal, QuickPriceModal, DeleteDishModal } from './components/DishModals.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import {
  RequestTableChangeModal,
  MoveTableStaffModal,
  ClientConfirmMoveModal,
} from './components/TableChangeModals.tsx';
import { PosSidebar } from './components/PosSidebar.tsx';
import { ClientTopBar } from './components/ClientTopBar.tsx';
import { QuickOpenTableModal } from './components/QuickOpenTableModal.tsx';
import { TakeAwayDeliveryModal } from './components/TakeAwayDeliveryModal.tsx';
import { TakeAwayTrackerModal } from './components/TakeAwayTrackerModal.tsx';
import { MenuCatalogView } from './components/MenuCatalogView.tsx';
import { TableMapView } from './components/TableMapView.tsx';
import { OrdersKdsView, KitchenFilterTab } from './components/OrdersKdsView.tsx';
import { AdminPanelView, AdminSubTab } from './components/AdminPanelView.tsx';
import {
  clearClientSessionStorage,
  isTableDataFree,
  liberarMesaYReiniciarSesion,
  generateTableSessionId,
  abrirMesaDesdeCaja,
} from './services/tableSessionService.ts';
import {
  subscribeSecurityConfig,
  subscribeCollaborators,
  isGoogleUserAdmin,
  hasPermission,
} from './services/staffSecurityService.ts';
import {
  generateDeliveryCode4Digits,
  getNextTakeAwayCorrelative,
  enqueueTakeAwayThermalPrint,
  buildTakeAwayReceiptWhatsAppUrl,
} from './services/takeAwayService.ts';
import {
  calculateItemsTotal,
  isOrderOpen,
  isTakeAwayOrder,
  isValidBoliviaPhone,
  sanitizeBoliviaPhone,
} from './utils/formatters.ts';

const TAKE_AWAY_STORAGE_KEY = 'churo_llevar_order_id';

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
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>({
    pinMaestro: '7777',
    adminsGoogle: [],
  });
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [securityLoaded, setSecurityLoaded] = useState<boolean>(false);
  const [collaboratorsLoaded, setCollaboratorsLoaded] = useState<boolean>(false);

  const isGoogleAdmin = Boolean(user && isGoogleUserAdmin(user.email, securityConfig));
  const isAdminAuthenticated = Boolean(
    isGoogleAdmin ||
      staffSession?.isMasterAdmin ||
      (staffSession?.role === 'admin' && !staffSession?.collaboratorId)
  );
  const isStaffAuthenticated = Boolean(isGoogleAdmin || staffSession);

  const canAccessTables = hasPermission(staffSession, 'mesas', isGoogleAdmin);
  const canAccessKitchen = hasPermission(staffSession, 'cocina', isGoogleAdmin);
  const canAccessCashier = hasPermission(staffSession, 'caja', isGoogleAdmin);
  const canAccessMenuAdmin = hasPermission(staffSession, 'menu_admin', isGoogleAdmin);
  const canAccessReports = hasPermission(staffSession, 'reportes', isGoogleAdmin);
  const canAccessAdminTab = Boolean(
    isAdminAuthenticated || canAccessMenuAdmin || canAccessReports
  );

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/admin')) return 'admin';
      if (path.includes('/mesas')) return 'tables';
      if (path.includes('/cocina')) return 'kitchen';
    }
    return 'menu';
  });

  // Carrito persistente con ciclo de vida de sesión y verificación de expiración (> 4 horas sin pagar)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      if (typeof localStorage === 'undefined') return [];

      const sesionActiva = localStorage.getItem('churo_sesion_activa');
      if (sesionActiva === 'false') {
        localStorage.removeItem('churo_carrito');
        return [];
      }

      const fechaRef =
        localStorage.getItem('churo_fecha_inicio') || localStorage.getItem('churo_fecha');
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

  // Detección de Modo Cliente QR vs Modo Staff
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
    isStaffAuthenticated ||
      (typeof window !== 'undefined' &&
        (window.location.pathname.includes('/admin') ||
          window.location.pathname.includes('/mesas') ||
          window.location.pathname.includes('/cocina')))
  );

  const isClientMode = Boolean(
    (mesaQR !== null ||
      (typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('churo_mesa')))) &&
      !isStaff
  );

  const [currentTableId, setCurrentTableId] = useState<number | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mesaParam = params.get('mesa');
      const savedMesa =
        typeof localStorage !== 'undefined' ? localStorage.getItem('churo_mesa') : null;
      const sesionActiva =
        typeof localStorage !== 'undefined' ? localStorage.getItem('churo_sesion_activa') : null;

      if (mesaParam && !isNaN(Number(mesaParam))) {
        return Number(mesaParam);
      }

      if (sesionActiva !== 'false' && savedMesa && !isNaN(Number(savedMesa))) {
        return Number(savedMesa);
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Para Llevar (Take Away) States
  const [takeAwaySelection, setTakeAwaySelection] = useState<'new' | string | null>(null);
  const [clientTakeAwayOrderId, setClientTakeAwayOrderId] = useState<string | null>(() => {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem(TAKE_AWAY_STORAGE_KEY) || null
        : null;
    } catch {
      return null;
    }
  });
  const [isTakeAwayTrackerOpen, setIsTakeAwayTrackerOpen] = useState<boolean>(false);
  const [deliveryVerifyOrder, setDeliveryVerifyOrder] = useState<Order | null>(null);
  const [kitchenFilter, setKitchenFilter] = useState<KitchenFilterTab>('all');

  const [customerModalOpen, setCustomerModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'cart' | 'bill'>('cart');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [posMenuSearch, setPosMenuSearch] = useState<string>('');
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const isDesktopPos = Boolean(isStaffAuthenticated && isDesktopViewport);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [qrModalTable, setQrModalTable] = useState<Table | null>(null);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState<boolean>(false);
  const [tableToDelete, setTableToDelete] = useState<Table | null>(null);
  const [quickOpenTable, setQuickOpenTable] = useState<Table | null>(null);

  const [changeRequests, setChangeRequests] = useState<SolicitudCambio[]>([]);
  const pendingChangeRequests = useMemo(() => {
    return changeRequests.filter((r) => r.estado === 'pendiente');
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

  const [dishModalOpen, setDishModalOpen] = useState<boolean>(false);
  const [dishToEdit, setDishToEdit] = useState<MenuItem | null>(null);
  const [dishToDelete, setDishToDelete] = useState<MenuItem | null>(null);
  const [dishToQuickPrice, setDishToQuickPrice] = useState<MenuItem | null>(null);
  const [adminMenuSearch, setAdminMenuSearch] = useState<string>('');
  const [adminMenuCategory, setAdminMenuCategory] = useState<string>('TODOS');

  const [restaurantProfile, setRestaurantProfile] = useState<RestaurantProfile>({
    nombre: 'El Churo Mosito',
    slogan: 'GASTRONOMÍA DE ALTURA • TARIJA',
    telefono: '+591 71234567',
    logoUrl: '',
    colorPrimario: '#ff7a00',
    colorSecundario: '#10b981',
    modoFondo: 'dark-zinc',
  });
  const [usarPildoraFlotante, setUsarPildoraFlotante] = useState<boolean>(true);
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>(() => {
    if (
      typeof window !== 'undefined' &&
      window.location.pathname.toLowerCase().includes('/admin/equipo')
    ) {
      return 'equipo';
    }
    return 'inventario';
  });

  const [clientPhone, setClientPhone] = useState<string>(() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem('churo_celular') || '' : '';
    } catch {
      return '';
    }
  });
  const [, setActiveClientSessionId] = useState<string | null>(() => {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem('churo_sesion_id') || null
        : null;
    } catch {
      return null;
    }
  });
  const [sessionClosedMesa, setSessionClosedMesa] = useState<number | null>(null);

  // Pantalla de bienvenida: aparece al escanear ?mesa=X O al entrar sin mesa ni sesión previa (Para Llevar)
  const [showWelcomeScreen, setShowWelcomeScreen] = useState<boolean>(() => {
    try {
      const path = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
      const hasStaffSession = Boolean(localStorage.getItem('elchuro_staff_session'));
      if (hasStaffSession || path.includes('/admin') || path.includes('/mesas') || path.includes('/cocina')) {
        return false;
      }

      const params = new URLSearchParams(window.location.search);
      const mesaParam = params.get('mesa');
      if (mesaParam && !isNaN(Number(mesaParam))) {
        const mesaNumStr = String(mesaParam);
        const welcomeDoneSession =
          sessionStorage.getItem(`welcome_done_${mesaNumStr}`) === 'true' ||
          sessionStorage.getItem(`churo_welcome_dismissed_${mesaNumStr}`) === 'true';
        const storedMesa = localStorage.getItem('churo_mesa');
        const storedSessionId = localStorage.getItem('churo_sesion_id');
        const sesionActiva = localStorage.getItem('churo_sesion_activa');

        if (welcomeDoneSession && storedSessionId && storedMesa === mesaNumStr && sesionActiva !== 'false') {
          return false;
        }
        return true;
      }

      const storedMesa = localStorage.getItem('churo_mesa');
      const storedTakeAway = localStorage.getItem(TAKE_AWAY_STORAGE_KEY);
      const dismissedTakeAwayWelcome =
        sessionStorage.getItem('churo_welcome_dismissed_takeaway') === 'true';

      if (!storedMesa && !storedTakeAway && !dismissedTakeAwayWelcome) {
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  });

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
      console.warn('Error al cerrar sesión de Firebase:', e);
    }
    localStorage.removeItem('elchuro_staff_session');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('churo_role');
    setStaffSession(null);
    setTakeAwaySelection(null);
    setActiveTab('menu');
    showToast('Sesión de personal cerrada.');
  };

  // Firebase Real-time Subscriptions
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const unsubscribeOrders = onSnapshot(
      collection(db, 'pedidos'),
      (snapshot) => {
        const liveOrders = snapshot.docs.map((d) => {
          const data = d.data();
          const rawItems = (data.items || []) as OrderItem[];
          const items = rawItems.map((item, idx) => ({
            ...item,
            orderItemId:
              item.orderItemId ||
              `ord-${d.id}-${item.id}-${item.isAddition ? 'add' : 'init'}-${idx}`,
          }));
          return {
            id: d.id,
            ...data,
            items,
          } as Order;
        });
        setOrders(liveOrders);

        // Solo órdenes de salón (no Para Llevar) ocupan mesas físicas
        setTables((prev) =>
          prev.map((t) => {
            const tableActiveOrder = liveOrders.find(
              (o) => !isTakeAwayOrder(o) && o.tableId === t.id && isOrderOpen(o)
            );
            if (tableActiveOrder) {
              const status = tableActiveOrder.status === 'por-pagar' ? 'por-pagar' : 'occupied';
              return { ...t, status, currentOrder: tableActiveOrder };
            }
            if (t.estado === 'ocupada' && t.sesionActivaId) {
              return {
                ...t,
                status: t.status === 'por-pagar' ? 'por-pagar' : 'occupied',
                currentOrder: null,
              };
            }
            return { ...t, status: 'free', currentOrder: null };
          })
        );
      },
      (error) => {
        console.warn('Pedidos snapshot listener error:', error);
      }
    );

    const unsubscribeMenu = onSnapshot(
      collection(db, 'menu'),
      async (snapshot) => {
        if (snapshot.docs.length === 0) {
          for (const item of INITIAL_MENU) {
            try {
              await setDoc(doc(db, 'menu', item.id), item);
            } catch (e) {
              console.error('Error al sembrar ítem de menú:', e);
            }
          }
        } else {
          const seenIds = new Set<string>();
          const uniqueItems: MenuItem[] = [];
          snapshot.docs.forEach((d) => {
            const data = d.data();
            const stableId = d.id || data.id;
            if (stableId && !seenIds.has(stableId)) {
              seenIds.add(stableId);
              uniqueItems.push({ ...data, id: stableId } as MenuItem);
            }
          });
          setMenu(uniqueItems);
        }
      },
      (error) => {
        console.log('Usando menú local fallback', error);
      }
    );

    const unsubscribeCalls = onSnapshot(
      collection(db, 'llamadas'),
      (snapshot) => {
        const liveCalls = snapshot.docs
          .map((d) => {
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
              status: isPending ? ('pendiente' as const) : ('atendido' as const),
            } as WaiterCall;
          })
          .filter((c) => c.status === 'pendiente')
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setWaiterCalls(liveCalls);
      },
      (error) => {
        console.warn('Llamadas snapshot listener error:', error);
      }
    );

    const unsubscribeTables = onSnapshot(
      collection(db, 'mesas'),
      async (snapshot) => {
        if (snapshot.docs.length === 0) {
          for (const item of INITIAL_TABLES) {
            try {
              await setDoc(doc(db, 'mesas', String(item.id)), {
                id: item.id,
                name: item.name,
                seats: item.seats,
                status: 'free',
                estado: 'libre',
                sesionActivaId: null,
              });
            } catch (e) {
              console.error('Error al sembrar mesa inicial:', e);
            }
          }
        } else {
          const liveTables: Table[] = snapshot.docs
            .map((d) => {
              const data = d.data();
              const hasActiveSession = data.estado === 'ocupada' && Boolean(data.sesionActivaId);
              const derivedStatus: Table['status'] =
                data.status === 'por-pagar' ? 'por-pagar' : hasActiveSession ? 'occupied' : 'free';
              return {
                id: Number(data.id || d.id),
                name: data.name || `Mesa ${d.id}`,
                seats: Number(data.seats || 4),
                status: derivedStatus,
                estado: (data.estado === 'ocupada' ? 'ocupada' : 'libre') as 'libre' | 'ocupada',
                origen: data.origen === 'caja' || data.origen === 'qr' ? data.origen : null,
                sesionActivaId: data.sesionActivaId ?? null,
                currentOrder: null,
              };
            })
            .sort((a, b) => a.id - b.id);

          setTables((prev) =>
            liveTables.map((lt) => {
              const existing = prev.find((p) => p.id === lt.id);
              if (existing && existing.currentOrder) {
                return { ...lt, status: existing.status, currentOrder: existing.currentOrder };
              }
              return lt;
            })
          );
        }
      },
      (error) => {
        console.warn('Mesas snapshot listener error:', error);
      }
    );

    const unsubscribeProfile = onSnapshot(
      doc(db, 'configuracion', 'perfil'),
      (snapshot) => {
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
      },
      (error) => {
        console.warn('Perfil snapshot listener error:', error);
      }
    );

    const unsubscribeAppearance = onSnapshot(
      doc(db, 'configuracion', 'apariencia'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setUsarPildoraFlotante(data.usarPildoraFlotante !== false);
        } else {
          setUsarPildoraFlotante(true);
        }
      },
      (error) => {
        console.warn('Apariencia snapshot listener error:', error);
      }
    );

    const unsubscribeRequests = isStaff
      ? onSnapshot(
          collection(db, 'solicitudes_cambio'),
          (snapshot) => {
            const liveReqs = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })) as SolicitudCambio[];
            setChangeRequests(liveReqs);
          },
          (error) => {
            console.log('Usando localStorage fallback solicitudes:', error);
          }
        )
      : () => {};

    return () => {
      unsubscribeAuth();
      unsubscribeMenu();
      unsubscribeOrders();
      unsubscribeCalls();
      unsubscribeTables();
      unsubscribeProfile();
      unsubscribeAppearance();
      unsubscribeRequests();
    };
  }, [isStaff]);

  // Suscripción en tiempo real a Seguridad (PIN Maestro) y Colaboradores
  useEffect(() => {
    const needsSecuritySync =
      isStaffAuthenticated ||
      activeTab === 'tables' ||
      activeTab === 'kitchen' ||
      activeTab === 'admin';

    if (!needsSecuritySync) return;

    const unsubSec = subscribeSecurityConfig(
      (cfg) => {
        setSecurityConfig(cfg);
        setSecurityLoaded(true);
      },
      () => setSecurityLoaded(true)
    );

    const unsubCollabs = subscribeCollaborators(
      (list) => {
        setCollaborators(list);
        setCollaboratorsLoaded(true);
      },
      () => setCollaboratorsLoaded(true)
    );

    return () => {
      unsubSec();
      unsubCollabs();
    };
  }, [isStaffAuthenticated, activeTab]);

  // Sincronización y revocación inmediata en tiempo real
  useEffect(() => {
    if (securityLoaded && user && !isGoogleUserAdmin(user.email, securityConfig)) {
      signOut(auth).catch(() => {});
      localStorage.removeItem('elchuro_staff_session');
      setStaffSession(null);
      setActiveTab('menu');
      showToast('Tu cuenta Google ya no tiene permisos de Administrador.', 'error');
      return;
    }

    if (collaboratorsLoaded && staffSession?.collaboratorId) {
      const liveCollab = collaborators.find((c) => c.id === staffSession.collaboratorId);
      if (
        !liveCollab ||
        !liveCollab.activo ||
        (staffSession.sessionPin && liveCollab.pin !== staffSession.sessionPin)
      ) {
        localStorage.removeItem('elchuro_staff_session');
        setStaffSession(null);
        setActiveTab('menu');
        showToast('Tu acceso ha sido actualizado o desactivado por el Administrador.', 'error');
        return;
      }

      const permsChanged =
        JSON.stringify(liveCollab.permisos) !== JSON.stringify(staffSession.permisos);
      const infoChanged =
        liveCollab.nombre !== staffSession.name || liveCollab.cargo !== staffSession.cargo;

      if (permsChanged || infoChanged) {
        const updatedSession: StaffSession = {
          ...staffSession,
          name: liveCollab.nombre,
          cargo: liveCollab.cargo,
          permisos: liveCollab.permisos,
        };
        setStaffSession(updatedSession);
        localStorage.setItem('elchuro_staff_session', JSON.stringify(updatedSession));
      }
    }

    if (
      securityLoaded &&
      staffSession?.isMasterAdmin &&
      staffSession.authType === 'pin' &&
      staffSession.sessionPin &&
      securityConfig.pinMaestro !== staffSession.sessionPin
    ) {
      localStorage.removeItem('elchuro_staff_session');
      setStaffSession(null);
      setActiveTab('menu');
      showToast('El PIN Maestro fue modificado. Inicia sesión nuevamente.', 'info');
    }
  }, [collaborators, collaboratorsLoaded, securityConfig, securityLoaded, staffSession, user]);

  // Bloqueo de ruta y redirección automática según permisos reales
  useEffect(() => {
    if (!isStaffAuthenticated) return;

    if (activeTab === 'tables' && !canAccessTables) {
      setActiveTab('menu');
      showToast('No tienes permiso para acceder al módulo de Mesas.', 'error');
    } else if (activeTab === 'kitchen' && !canAccessKitchen) {
      setActiveTab('menu');
      showToast('No tienes permiso para acceder al módulo de Cocina.', 'error');
    } else if (activeTab === 'admin') {
      if (!canAccessAdminTab) {
        setActiveTab('menu');
        showToast('No tienes permiso para acceder al módulo Admin.', 'error');
      } else {
        if ((adminSubTab === 'equipo' || adminSubTab === 'perfil') && !isAdminAuthenticated) {
          setAdminSubTab(canAccessMenuAdmin ? 'inventario' : 'historial');
        } else if (adminSubTab === 'inventario' && !isAdminAuthenticated && !canAccessMenuAdmin) {
          if (canAccessReports) setAdminSubTab('historial');
        } else if (adminSubTab === 'historial' && !isAdminAuthenticated && !canAccessReports) {
          if (canAccessMenuAdmin) setAdminSubTab('inventario');
        }
      }
    }
  }, [
    activeTab,
    adminSubTab,
    isStaffAuthenticated,
    isAdminAuthenticated,
    canAccessTables,
    canAccessKitchen,
    canAccessAdminTab,
    canAccessMenuAdmin,
    canAccessReports,
  ]);

  // Detectar viewport desktop (>= 1024px)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleViewportChange = (e: MediaQueryListEvent) => {
      setIsDesktopViewport(e.matches);
    };
    setIsDesktopViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleViewportChange);
    return () => mediaQuery.removeEventListener('change', handleViewportChange);
  }, []);

  // Cerrar modales y drawers abiertos automáticamente al cambiar de rol, vista o modo POS
  useEffect(() => {
    setCustomerModalOpen(false);
    setQrModalTable(null);
    setIsAddTableModalOpen(false);
    setTableToDelete(null);
    setQuickOpenTable(null);
    setIsRequestChangeModalOpen(false);
    setMoveStaffModal({ isOpen: false, sourceTable: null });
    setDishModalOpen(false);
    setDishToDelete(null);
    setDishToQuickPrice(null);
    setDeliveryVerifyOrder(null);
    setIsTakeAwayTrackerOpen(false);
  }, [activeTab, isStaffAuthenticated, isAdminAuthenticated, isDesktopPos]);

  // Polling para cliente: verifica clientes/{celular} cada 10s
  useEffect(() => {
    if (!isClientMode) return;
    const celular = localStorage.getItem('churo_celular');
    if (!celular) return;

    const intervalId = setInterval(async () => {
      try {
        const clientDocRef = doc(db, 'clientes', String(celular));
        const clientSnap = await getDoc(clientDocRef);
        if (clientSnap.exists()) {
          const clientData = clientSnap.data();
          const ultimaMesa = clientData?.ultima_mesa;
          const currentMesaStored = Number(localStorage.getItem('churo_mesa') || currentTableId);
          if (ultimaMesa && !isNaN(Number(ultimaMesa)) && Number(ultimaMesa) !== currentMesaStored) {
            try {
              const destSnap = await getDoc(doc(db, 'mesas', String(ultimaMesa)));
              if (destSnap.exists() && destSnap.data().sesionActivaId) {
                localStorage.setItem('churo_sesion_id', String(destSnap.data().sesionActivaId));
              }
            } catch {
              // ignore
            }
            localStorage.setItem('churo_mesa', String(ultimaMesa));
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('mesa', String(ultimaMesa));
            window.history.replaceState({}, '', newUrl.toString());
            showToast(`¡Te movimos a Mesa ${ultimaMesa}!`);
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      } catch (err) {
        console.log('Usando localStorage fallback (cliente getDoc):', err);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isClientMode, currentTableId]);

  // Validación y limpieza en tiempo real de la sesión de mesa del cliente
  useEffect(() => {
    if (isStaff) return;
    const targetMesaId = mesaQR ?? currentTableId;
    if (targetMesaId === null) return;

    let latestMesaData: Record<string, any> | null = null;
    let latestActivaData: Record<string, any> | null = null;
    let mesaSnapshotReady = false;

    const evaluateClientSession = () => {
      if (clientMovePrompt?.isOpen || !mesaSnapshotReady) return;

      const data = latestMesaData;
      const activa = latestActivaData;
      const liveSessionId =
        typeof activa?.sesionActivaId === 'string' && activa.sesionActivaId
          ? activa.sesionActivaId
          : typeof data?.sesionActivaId === 'string' && data.sesionActivaId
            ? data.sesionActivaId
            : null;

      const isOpenedFromCaja = Boolean(
        liveSessionId &&
          ((activa?.estado === 'ocupada' && activa?.origen === 'caja') ||
            (data?.estado === 'ocupada' && data?.origen === 'caja'))
      );
      const tableIsFree = !isOpenedFromCaja && isTableDataFree(data);

      const localSessionId = localStorage.getItem('churo_sesion_id');
      const localMesa = localStorage.getItem('churo_mesa');
      const hadActiveLocalSession = Boolean(localSessionId && localMesa === String(targetMesaId));

      if (isOpenedFromCaja && liveSessionId && sessionClosedMesa === null) {
        const needsSync =
          showWelcomeScreen ||
          localSessionId !== liveSessionId ||
          localMesa !== String(targetMesaId);

        if (needsSync) {
          if (localMesa && localMesa !== String(targetMesaId)) {
            setCart([]);
          }
          const cajaPhone = sanitizeBoliviaPhone(String(activa?.cliente_celular || ''));
          const nowIso = new Date().toISOString();
          try {
            localStorage.setItem('churo_mesa', String(targetMesaId));
            localStorage.setItem('churo_sesion_id', liveSessionId);
            localStorage.setItem('churo_sesion_activa', 'true');
            localStorage.setItem('churo_fecha', nowIso);
            localStorage.setItem('churo_fecha_inicio', nowIso);
            if (cajaPhone) {
              localStorage.setItem('churo_celular', cajaPhone);
            } else {
              localStorage.removeItem('churo_celular');
            }
            sessionStorage.setItem(`welcome_done_${targetMesaId}`, 'true');
            sessionStorage.setItem(`churo_welcome_dismissed_${targetMesaId}`, 'true');
          } catch {
            // ignore
          }
          setCurrentTableId(targetMesaId);
          setActiveClientSessionId(liveSessionId);
          setClientPhone(cajaPhone);
          setShowWelcomeScreen(false);
          setActiveTab('menu');
        }
        return;
      }

      if (
        hadActiveLocalSession &&
        !showWelcomeScreen &&
        sessionClosedMesa === null &&
        (tableIsFree || (liveSessionId && liveSessionId !== localSessionId))
      ) {
        clearClientSessionStorage(targetMesaId);
        setCart([]);
        setClientPhone('');
        setActiveClientSessionId(null);
        setCustomerModalOpen(false);
        setIsRequestChangeModalOpen(false);
        setSessionClosedMesa(targetMesaId);
        return;
      }

      if (
        !showWelcomeScreen &&
        sessionClosedMesa === null &&
        (tableIsFree ||
          !localSessionId ||
          liveSessionId !== localSessionId ||
          localMesa !== String(targetMesaId))
      ) {
        clearClientSessionStorage(targetMesaId);
        setCart([]);
        setClientPhone('');
        setActiveClientSessionId(null);
        setShowWelcomeScreen(true);
        return;
      }

      if (liveSessionId && localSessionId === liveSessionId && localMesa === String(targetMesaId)) {
        setActiveClientSessionId(liveSessionId);
        const storedPhone = localStorage.getItem('churo_celular') || '';
        if (storedPhone !== clientPhone) {
          setClientPhone(storedPhone);
        }
      }
    };

    const unsubscribeMesaSession = onSnapshot(
      doc(db, 'mesas', String(targetMesaId)),
      (snap) => {
        latestMesaData = snap.exists() ? snap.data() : null;
        mesaSnapshotReady = true;
        evaluateClientSession();
      },
      (err) => {
        console.log('Usando localStorage fallback (mesa session listener):', err);
      }
    );

    const unsubscribeMesaActiva = onSnapshot(
      doc(db, 'mesas_activas', `mesa_${targetMesaId}`),
      (snap) => {
        latestActivaData = snap.exists() ? snap.data() : null;
        if (latestActivaData?.estado === 'ocupada' && latestActivaData?.origen === 'caja') {
          mesaSnapshotReady = true;
        }
        evaluateClientSession();
      },
      (err) => {
        console.log('Usando localStorage fallback (mesas_activas listener):', err);
      }
    );

    return () => {
      unsubscribeMesaSession();
      unsubscribeMesaActiva();
    };
  }, [isStaff, mesaQR, currentTableId, showWelcomeScreen, sessionClosedMesa, clientMovePrompt?.isOpen]);

  // Detect Mesa from URL query params
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlMesa = params.get('mesa');
      const storedMesa = localStorage.getItem('churo_mesa');
      const sesionActiva = localStorage.getItem('churo_sesion_activa');
      const storedSessionId = localStorage.getItem('churo_sesion_id');

      const fechaRef =
        localStorage.getItem('churo_fecha_inicio') || localStorage.getItem('churo_fecha');
      if (fechaRef) {
        const elapsed = (Date.now() - new Date(fechaRef).getTime()) / (1000 * 60 * 60);
        if (elapsed > 4) {
          clearClientSessionStorage(currentTableId);
          setCart([]);
          setClientPhone('');
          setActiveClientSessionId(null);
        }
      }

      if (isStaff) {
        localStorage.setItem('churo_role', 'staff');
      } else if (isClientMode) {
        localStorage.setItem('churo_role', 'cliente');
      }

      if (urlMesa && !isNaN(Number(urlMesa))) {
        const urlMesaNum = Number(urlMesa);

        if (storedMesa && storedMesa !== urlMesa) {
          const storedMesaNum = Number(storedMesa);
          const activeOrderOldMesa = orders.find(
            (o) => !isTakeAwayOrder(o) && o.tableId === storedMesaNum && isOrderOpen(o)
          );

          if (activeOrderOldMesa) {
            setShowWelcomeScreen(false);
            setClientMovePrompt({
              isOpen: true,
              fromMesa: storedMesaNum,
              toMesa: urlMesaNum,
            });
            return;
          }

          clearClientSessionStorage(storedMesaNum);
          localStorage.setItem('churo_mesa', urlMesa);
          setCart([]);
          setClientPhone('');
          setActiveClientSessionId(null);
        }

        setCurrentTableId(urlMesaNum);

        if (!storedSessionId || sesionActiva === 'false' || storedMesa !== urlMesa) {
          if (sessionClosedMesa === null) {
            setShowWelcomeScreen(true);
          }
        }
      } else if (storedMesa && !isNaN(Number(storedMesa))) {
        if (sesionActiva !== 'false' && storedSessionId) {
          setCurrentTableId(Number(storedMesa));
        }
      }
    } catch (e) {
      console.warn('Error en detección y gestión de sesión de mesa:', e);
    }
  }, [isClientMode, isStaff, orders]);

  // Para Llevar: Pedidos activos en tiempo real
  const activeTakeAwayOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (!isTakeAwayOrder(o) || !isOrderOpen(o)) return false;
        if (o.estadoCocina === 'entregado' && o.pagado) return false;
        return true;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [orders]);

  // Pedido Para Llevar activo del cliente en este dispositivo
  const activeClientTakeAwayOrder = useMemo(() => {
    if (!clientTakeAwayOrderId) return null;
    const found = orders.find((o) => o.id === clientTakeAwayOrderId && isTakeAwayOrder(o));
    if (!found || found.status === 'cancelado') return null;
    if (found.estadoCocina === 'entregado' && found.pagado) return null;
    return found;
  }, [orders, clientTakeAwayOrderId]);

  useEffect(() => {
    if (!clientTakeAwayOrderId || orders.length === 0) return;
    const found = orders.find((o) => o.id === clientTakeAwayOrderId);
    if (found && (found.status === 'cancelado' || (found.estadoCocina === 'entregado' && found.pagado))) {
      try {
        localStorage.removeItem(TAKE_AWAY_STORAGE_KEY);
      } catch {
        // ignore
      }
      setClientTakeAwayOrderId(null);
    }
  }, [orders, clientTakeAwayOrderId]);

  const handleTableChange = (tableId: number) => {
    if (isClientMode) {
      const lockedMesa = mesaQR ? String(mesaQR) : localStorage.getItem('churo_mesa') || null;
      if (lockedMesa && Number(lockedMesa) !== tableId) {
        showToast(
          `Tu mesa es la Mesa ${lockedMesa}. Solo el personal puede cambiar de mesa.`,
          'error'
        );
        return;
      }
    }
    setTakeAwaySelection(null);
    setCurrentTableId(tableId);
  };

  const openTableInCart = (tableId: number) => {
    setTakeAwaySelection(null);
    setCurrentTableId(tableId);
    const targetOrder = orders.find(
      (o) => !isTakeAwayOrder(o) && o.tableId === tableId && isOrderOpen(o)
    );
    const openDirectlyInBill = Boolean(
      targetOrder && canAccessCashier && !canAccessTables && !isAdminAuthenticated
    );
    setCashAmount('');
    setModalMode(openDirectlyInBill ? 'bill' : 'cart');
    if (!isDesktopPos) {
      setCustomerModalOpen(true);
    }
  };

  const openTakeAwayInCart = (orderId: string | 'new', mode: 'cart' | 'bill' = 'cart') => {
    setCurrentTableId(null);
    setTakeAwaySelection(orderId);
    setCashAmount('');
    setModalMode(mode);
    if (!isDesktopPos) {
      setCustomerModalOpen(true);
    }
  };

  const handleClientSwitchToTakeAway = () => {
    try {
      if (mesaQR || localStorage.getItem('churo_mesa')) {
        clearClientSessionStorage(currentTableId);
        const url = new URL(window.location.href);
        url.searchParams.delete('mesa');
        window.history.replaceState({}, '', url.toString());
      }
      sessionStorage.setItem('churo_welcome_dismissed_takeaway', 'true');
    } catch {
      // ignore
    }
    setCurrentTableId(null);
    setTakeAwaySelection('new');
    setShowWelcomeScreen(false);
    setActiveTab('menu');
    showToast('Modo Para Llevar activado. Agrega tus platos al carrito.');
  };

  const selectedTableObject = useMemo(() => {
    if (currentTableId === null || takeAwaySelection !== null) return null;
    return tables.find((t) => t.id === Number(currentTableId)) || null;
  }, [tables, currentTableId, takeAwaySelection]);

  const activeOrderForCurrentTable = useMemo(() => {
    if (currentTableId === null || takeAwaySelection !== null) return null;
    return (
      orders.find(
        (o) => !isTakeAwayOrder(o) && o.tableId === Number(currentTableId) && isOrderOpen(o)
      ) || null
    );
  }, [orders, currentTableId, takeAwaySelection]);

  // Cart Calculations & Handlers
  const cartTotal = useMemo(() => calculateItemsTotal(cart), [cart]);

  const addToCart = (product: MenuItem) => {
    if (!product.disponible) {
      showToast('Este producto no está disponible en este momento.', 'error');
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const mesaParam =
        params.get('mesa') || (currentTableId !== null ? String(currentTableId) : null);
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

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
    showToast(`Agregado: ${product.nombre}`);
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.reduce<CartItem[]>((acc, item) => {
        if (item.id !== id) {
          acc.push(item);
          return acc;
        }
        const nextQty = item.qty + delta;
        if (nextQty > 0) {
          acc.push({ ...item, qty: nextQty });
        }
        return acc;
      }, [])
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    showToast('Producto eliminado del carrito');
  };

  // =========================================================================
  // PARA LLEVAR (TAKE AWAY) HANDLERS
  // =========================================================================
  const handleCreateTakeAwayOrder = async ({
    clienteNombre,
    clienteTelefono,
    notaRetiro,
    cobrarAhora = false,
    metodoPago = 'EFECTIVO',
    cashGivenBs,
    imprimirOEnviar = false,
  }: {
    clienteNombre: string;
    clienteTelefono?: string;
    notaRetiro: string;
    cobrarAhora?: boolean;
    metodoPago?: 'EFECTIVO' | 'QR';
    cashGivenBs?: number;
    imprimirOEnviar?: boolean;
  }) => {
    if (cart.length === 0) return;

    const orderTimestamp = Date.now();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const codigoCorrelativo = getNextTakeAwayCorrelative(orders);
    const codigoEntrega = generateDeliveryCode4Digits();
    const cleanPhone = clienteTelefono ? sanitizeBoliviaPhone(clienteTelefono) : '';
    const validPhone = isValidBoliviaPhone(cleanPhone) ? cleanPhone : null;
    const totalAmount = calculateItemsTotal(cart);

    const itemsPayload: OrderItem[] = cart.map((item, idx) => ({
      id: item.id,
      nombre: item.nombre,
      precioBs: item.precioBs,
      qty: item.qty,
      categoria: item.categoria,
      orderItemId: `orditem-${item.id}-ll-${orderTimestamp}-${idx}`,
    }));

    const newOrderData: Record<string, any> = {
      tableId: 0,
      tableName: `Para Llevar ${codigoCorrelativo}`,
      tipoPedido: 'llevar',
      codigoCorrelativo,
      clienteNombre: clienteNombre.trim(),
      clienteTelefono: validPhone,
      notaRetiro: notaRetiro.trim() || 'En 15 min',
      codigoEntrega,
      estadoCocina: 'preparando',
      pagado: Boolean(cobrarAhora),
      items: itemsPayload,
      total: totalAmount,
      status: 'en-preparacion',
      time: timeStr,
      createdAt: orderTimestamp,
    };

    if (cobrarAhora) {
      newOrderData.paymentMethod = metodoPago;
      newOrderData.paidAt = timeStr;
    }

    try {
      const docRef = await addDoc(collection(db, 'pedidos'), newOrderData);
      const createdOrder: Order = {
        id: docRef.id,
        ...newOrderData,
      } as Order;

      if (cobrarAhora) {
        try {
          await addDoc(collection(db, 'tickets_history'), {
            mesa: 0,
            tableName: `PARA LLEVAR ${codigoCorrelativo}`,
            total: totalAmount,
            descuento: 0,
            celular: validPhone,
            tipoEntrega: imprimirOEnviar ? (validPhone ? 'ambas' : 'ticket') : 'ticket',
            metodoPago,
            fecha: serverTimestamp(),
            reimpresiones: 0,
          });
        } catch (tErr) {
          console.warn('Error guardando ticket Take Away en historial:', tErr);
        }
      }

      if (imprimirOEnviar) {
        try {
          await enqueueTakeAwayThermalPrint({
            order: createdOrder,
            cashGivenBs,
          });
        } catch (pErr) {
          console.warn('Error encolando ticket 80mm Para Llevar:', pErr);
        }

        if (validPhone) {
          const waUrl = buildTakeAwayReceiptWhatsAppUrl({
            order: createdOrder,
            phone: validPhone,
          });
          if (waUrl) window.open(waUrl, '_blank');
        }
      }

      setCart([]);
      setCashAmount('');

      if (!isStaffAuthenticated) {
        try {
          localStorage.setItem(TAKE_AWAY_STORAGE_KEY, docRef.id);
          if (validPhone) {
            localStorage.setItem('churo_celular', validPhone);
            setClientPhone(validPhone);
          }
        } catch {
          // ignore
        }
        setClientTakeAwayOrderId(docRef.id);
        setTakeAwaySelection(docRef.id);
        setCustomerModalOpen(false);
        setIsTakeAwayTrackerOpen(true);
      } else {
        setTakeAwaySelection(docRef.id);
        setCustomerModalOpen(false);
      }

      showToast(
        `🛍️ Pedido Para Llevar ${codigoCorrelativo} creado (Código: ${codigoEntrega})`
      );
    } catch (err) {
      console.error('Error al crear pedido Para Llevar:', err);
      showToast('No se pudo crear el pedido Para Llevar. Intenta nuevamente.', 'error');
    }
  };

  const handleAddItemsToTakeAway = async (orderId: string) => {
    if (cart.length === 0) return;
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    try {
      const additionTimeStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const additionTs = Date.now();
      const additionItems: OrderItem[] = cart.map((item, idx) => ({
        id: item.id,
        nombre: item.nombre,
        precioBs: item.precioBs,
        qty: item.qty,
        categoria: item.categoria,
        isAddition: true,
        orderItemId: `orditem-${item.id}-lladd-${additionTs}-${idx}`,
      }));

      const updatedItems = [...target.items, ...additionItems];
      const updatedTotal = calculateItemsTotal(updatedItems);

      await updateDoc(doc(db, 'pedidos', orderId), {
        items: updatedItems,
        total: updatedTotal,
        hasAddition: true,
        additionTime: additionTimeStr,
      });

      setCart([]);
      setCustomerModalOpen(false);
      showToast(`¡Platos sumados a ${target.codigoCorrelativo || '#LL'}!`);
    } catch (err) {
      console.error('Error sumando platos a pedido Para Llevar:', err);
      showToast('Error al agregar los platos al pedido.', 'error');
    }
  };

  const handleUpdateTakeAwayItemQty = async (
    orderId: string,
    itemIndex: number,
    delta: number
  ) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    if (target.pagado || target.estadoCocina === 'entregado') {
      showToast('No se pueden editar cantidades de un pedido ya cobrado o entregado.', 'error');
      return;
    }

    const updatedItems = target.items.reduce<OrderItem[]>((acc, item, idx) => {
      if (idx !== itemIndex) {
        acc.push(item);
        return acc;
      }
      const nextQty = item.qty + delta;
      if (nextQty > 0) {
        acc.push({ ...item, qty: nextQty });
      }
      return acc;
    }, []);

    try {
      if (updatedItems.length === 0) {
        await updateDoc(doc(db, 'pedidos', orderId), {
          items: [],
          total: 0,
          status: 'cancelado',
        });
        setTakeAwaySelection(null);
        showToast(`Pedido ${target.codigoCorrelativo || '#LL'} cancelado al quedar sin platos.`);
      } else {
        await updateDoc(doc(db, 'pedidos', orderId), {
          items: updatedItems,
          total: calculateItemsTotal(updatedItems),
        });
      }
    } catch (err) {
      console.error('Error actualizando cantidad en pedido Para Llevar:', err);
      showToast('No se pudo actualizar la cantidad.', 'error');
    }
  };

  const handleUpdateTakeAwayStatus = async (
    orderId: string,
    estadoCocina: 'preparando' | 'listo' | 'entregado'
  ) => {
    const target = orders.find((o) => o.id === orderId);
    const mappedStatus: Order['status'] =
      estadoCocina === 'listo'
        ? 'servido'
        : estadoCocina === 'entregado'
          ? target?.pagado
            ? 'pagado'
            : 'por-pagar'
          : 'en-preparacion';

    try {
      await updateDoc(doc(db, 'pedidos', orderId), {
        estadoCocina,
        status: mappedStatus,
      });
      showToast(
        estadoCocina === 'listo'
          ? `Pedido ${target?.codigoCorrelativo || ''} marcado como LISTO PARA RETIRAR.`
          : `Pedido ${target?.codigoCorrelativo || ''} actualizado a ${estadoCocina}.`
      );
    } catch (err) {
      console.error('Error actualizando estado Para Llevar:', err);
      showToast('No se pudo actualizar el estado.', 'error');
    }
  };

  const handleConfirmTakeAwayDelivery = async (order: Order) => {
    const deliveredTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const nextStatus: Order['status'] = order.pagado ? 'pagado' : 'por-pagar';

    try {
      await updateDoc(doc(db, 'pedidos', order.id), {
        estadoCocina: 'entregado',
        deliveredAt: deliveredTime,
        status: nextStatus,
      });
      if (!order.pagado) {
        showToast(
          `Pedido ${order.codigoCorrelativo || ''} entregado. Recuerda registrar el cobro en Caja.`,
          'info'
        );
      } else {
        showToast(`¡Pedido ${order.codigoCorrelativo || ''} verificado y entregado! ✅`);
      }
    } catch (err) {
      console.error('Error al confirmar entrega Para Llevar:', err);
      showToast('No se pudo completar la entrega.', 'error');
    }
  };

  const handleCollectTakeAwayPayment = async ({
    order,
    method,
    discountBs,
    cashGivenBs,
    tipoEntrega,
    phone,
  }: {
    order: Order;
    method: 'EFECTIVO' | 'QR';
    discountBs: number;
    cashGivenBs?: number;
    tipoEntrega: 'whatsapp' | 'ticket' | 'ambas';
    phone?: string;
  }) => {
    if (!isStaffAuthenticated || !canAccessCashier) {
      showToast('Se requiere permiso de Caja y Cobros para registrar el pago.', 'error');
      return;
    }

    const paidTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const cleanDiscount = Math.max(0, Math.min(discountBs, order.total));
    const finalTotal = Number((order.total - cleanDiscount).toFixed(2));
    const nextStatus: Order['status'] =
      order.estadoCocina === 'entregado'
        ? 'pagado'
        : order.estadoCocina === 'listo'
          ? 'servido'
          : 'en-preparacion';

    try {
      await updateDoc(doc(db, 'pedidos', order.id), {
        pagado: true,
        paymentMethod: method,
        paidAt: paidTime,
        status: nextStatus,
        ...(cleanDiscount > 0 ? { discountBs: cleanDiscount, total: finalTotal } : {}),
      });

      const updatedOrderForReceipt: Order = {
        ...order,
        pagado: true,
        paymentMethod: method,
        total: finalTotal,
      };

      const validPhone = phone && isValidBoliviaPhone(phone) ? sanitizeBoliviaPhone(phone) : null;
      if ((tipoEntrega === 'whatsapp' || tipoEntrega === 'ambas') && validPhone) {
        const waUrl = buildTakeAwayReceiptWhatsAppUrl({
          order: updatedOrderForReceipt,
          phone: validPhone,
          discountBs: cleanDiscount,
        });
        if (waUrl) window.open(waUrl, '_blank');
      }

      if (tipoEntrega === 'ticket' || tipoEntrega === 'ambas') {
        try {
          await enqueueTakeAwayThermalPrint({
            order: { ...order, pagado: true, paymentMethod: method },
            discountBs: cleanDiscount,
            cashGivenBs,
          });
        } catch (pErr) {
          console.warn('Error encolando ticket 80mm:', pErr);
        }
      }

      try {
        await addDoc(collection(db, 'tickets_history'), {
          mesa: 0,
          tableName: `PARA LLEVAR ${order.codigoCorrelativo || '#LL-01'}`,
          total: finalTotal,
          descuento: cleanDiscount,
          celular: validPhone,
          tipoEntrega,
          metodoPago: method,
          fecha: serverTimestamp(),
          reimpresiones: 0,
        });
      } catch (tErr) {
        console.warn('Error guardando ticket en historial:', tErr);
      }

      setCashAmount('');
      setModalMode('cart');
      setCustomerModalOpen(false);
      showToast(
        `Cobro ${method} registrado para ${order.codigoCorrelativo || 'Para Llevar'}. ✨`
      );
    } catch (err) {
      console.error('Error al cobrar pedido Para Llevar:', err);
      showToast('No se pudo registrar el cobro.', 'error');
    }
  };

  const handleAdminCancelOrder = async (orderId: string) => {
    if (!isAdminAuthenticated) {
      showToast('Solo el Administrador puede anular pedidos.', 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'pedidos', orderId), {
        status: 'cancelado',
      });
      if (takeAwaySelection === orderId) {
        setTakeAwaySelection(null);
      }
      showToast('Pedido anulado por Administración.');
    } catch (err) {
      console.error('Error al anular pedido:', err);
      showToast('No se pudo anular el pedido.', 'error');
    }
  };

  // =========================================================================
  // PEDIDOS EN SALÓN / MESAS
  // =========================================================================
  const placeOrder = async () => {
    if (cart.length === 0) return;

    // Si es cliente sin mesa QR y tiene un pedido Para Llevar abierto, sumar automáticamente
    if (!isStaffAuthenticated && !isClientMode && currentTableId === null && activeClientTakeAwayOrder) {
      await handleAddItemsToTakeAway(activeClientTakeAwayOrder.id);
      return;
    }

    let effectiveMesaId = currentTableId;
    if (isClientMode) {
      const lockedMesa = localStorage.getItem('churo_mesa') || mesaQR;
      if (lockedMesa && !isNaN(Number(lockedMesa))) {
        effectiveMesaId = Number(lockedMesa);
      }
    }

    if (effectiveMesaId === null) {
      showToast('Por favor selecciona tu mesa o completa tus datos Para Llevar.', 'error');
      setModalMode('cart');
      if (!isDesktopPos) {
        setCustomerModalOpen(true);
      }
      return;
    }

    const tableObj = tables.find((t) => t.id === Number(effectiveMesaId));
    if (!tableObj) {
      showToast('Mesa no válida. Por favor selecciona tu mesa.', 'error');
      return;
    }

    const existingOrder = orders.find(
      (o) => !isTakeAwayOrder(o) && o.tableId === tableObj.id && isOrderOpen(o)
    );

    if (existingOrder) {
      try {
        const additionTimeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const additionTimestamp = Date.now();
        const additionItems: OrderItem[] = cart.map((item, idx) => ({
          id: item.id,
          nombre: item.nombre,
          precioBs: item.precioBs,
          qty: item.qty,
          categoria: item.categoria,
          isAddition: true,
          orderItemId: `orditem-${item.id}-add-${additionTimestamp}-${idx}`,
        }));

        const updatedItems = [...existingOrder.items, ...additionItems];
        const updatedTotal = Number((existingOrder.total + cartTotal).toFixed(2));

        await updateDoc(doc(db, 'pedidos', existingOrder.id), {
          items: updatedItems,
          total: updatedTotal,
          hasAddition: true,
          additionTime: additionTimeStr,
        });

        setCart([]);
        setCustomerModalOpen(false);
        showToast(`¡Adición enviada a cocina para ${tableObj.name}! 🍲`);
      } catch (error) {
        console.error('Error al enviar adición:', error);
        showToast('Hubo un error al enviar la adición. Intenta de nuevo.', 'error');
      }
    } else {
      const orderTimestamp = Date.now();
      const newOrder = {
        tableId: tableObj.id,
        tableName: tableObj.name,
        tipoPedido: 'mesa',
        items: cart.map((item, idx) => ({
          id: item.id,
          nombre: item.nombre,
          precioBs: item.precioBs,
          qty: item.qty,
          categoria: item.categoria,
          orderItemId: `orditem-${item.id}-init-${orderTimestamp}-${idx}`,
        })),
        total: Number(cartTotal.toFixed(2)),
        status: 'pendiente',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: orderTimestamp,
      };

      try {
        await addDoc(collection(db, 'pedidos'), newOrder);
        const ensuredSessionId = tableObj.sesionActivaId || generateTableSessionId(tableObj.id);
        await setDoc(
          doc(db, 'mesas', String(tableObj.id)),
          {
            id: tableObj.id,
            name: tableObj.name,
            seats: tableObj.seats,
            status: 'occupied',
            estado: 'ocupada',
            sesionActivaId: ensuredSessionId,
          },
          { merge: true }
        );
        setCart([]);
        setCustomerModalOpen(false);
        showToast(`¡Pedido de ${tableObj.name} enviado a cocina con éxito! 🍲`);
      } catch (error) {
        console.error('Error al enviar pedido:', error);
        showToast('Hubo un error al enviar el pedido. Intenta de nuevo.', 'error');
      }
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'pedidos', orderId), { status: 'cancelado' });
      showToast('Comanda cancelada con éxito. La mesa ha quedado libre.');
    } catch (e) {
      console.error('Error al cancelar comanda:', e);
      showToast('Error al cancelar la comanda', 'error');
    }
  };

  const handleRemoveOrderItem = async (orderId: string, itemIndex: number) => {
    if (!isAdminAuthenticated) {
      showToast('Solo el Administrador puede anular ítems ya enviados a cocina.', 'error');
      return;
    }
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const removedItem = targetOrder.items[itemIndex];
    const remainingItems = targetOrder.items.filter((_, idx) => idx !== itemIndex);
    const updatedTotal = calculateItemsTotal(remainingItems);

    try {
      if (remainingItems.length === 0) {
        await updateDoc(doc(db, 'pedidos', orderId), {
          items: [],
          total: 0,
          status: 'cancelado',
        });
        showToast('Último ítem anulado. Comanda cancelada y mesa liberada.');
      } else {
        await updateDoc(doc(db, 'pedidos', orderId), {
          items: remainingItems,
          total: updatedTotal,
        });
        showToast(`Ítem "${removedItem?.nombre || 'Plato'}" anulado de la comanda.`);
      }
    } catch (e) {
      console.error('Error al anular ítem de la comanda:', e);
      showToast('No se pudo anular el ítem en la base de datos.', 'error');
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'pedidos', orderId), { status: newStatus });
      showToast(`Pedido actualizado a: ${newStatus}`);
    } catch (e) {
      console.error('Error updating status:', e);
      showToast('Error al actualizar estado', 'error');
    }
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'menu', id), { disponible: !currentStatus });
      showToast('Estado de disponibilidad actualizado.');
    } catch (e) {
      console.error('Error toggling availability:', e);
      try {
        const dish = menu.find((m) => m.id === id);
        if (dish) {
          await setDoc(doc(db, 'menu', id), { ...dish, disponible: !currentStatus });
        }
      } catch (e2) {
        console.warn('Fallback setDoc error:', e2);
      }
      setMenu((prev) =>
        prev.map((m) => (m.id === id ? { ...m, disponible: !currentStatus } : m))
      );
      showToast('Estado de disponibilidad actualizado.');
    }
  };

  const handleSaveDish = async (dishData: MenuItem, isEditing: boolean) => {
    try {
      await setDoc(doc(db, 'menu', dishData.id), dishData);
      setMenu((prev) => {
        const exists = prev.some((item) => item.id === dishData.id);
        return exists
          ? prev.map((item) => (item.id === dishData.id ? dishData : item))
          : [dishData, ...prev];
      });
      showToast(
        isEditing
          ? `¡Plato "${dishData.nombre}" actualizado!`
          : `¡Plato "${dishData.nombre}" agregado al menú! 🎉`
      );
    } catch (error) {
      console.error('Error al guardar plato en Firestore:', error);
      setMenu((prev) => {
        const exists = prev.some((item) => item.id === dishData.id);
        return exists
          ? prev.map((item) => (item.id === dishData.id ? dishData : item))
          : [dishData, ...prev];
      });
      showToast(
        isEditing ? `Plato "${dishData.nombre}" actualizado.` : `Plato "${dishData.nombre}" agregado.`
      );
    }
  };

  const handleDeleteDish = async (dishId: string) => {
    try {
      await deleteDoc(doc(db, 'menu', dishId));
      setMenu((prev) => prev.filter((item) => item.id !== dishId));
      showToast('Plato o bebida eliminado del menú.');
    } catch (error) {
      console.error('Error al eliminar plato en Firestore:', error);
      setMenu((prev) => prev.filter((item) => item.id !== dishId));
      showToast('Plato eliminado del menú.');
    }
  };

  const handleQuickUpdatePrice = async (dishId: string, newPrice: number) => {
    try {
      await updateDoc(doc(db, 'menu', dishId), { precioBs: newPrice });
      setMenu((prev) =>
        prev.map((item) => (item.id === dishId ? { ...item, precioBs: newPrice } : item))
      );
      showToast(`Precio actualizado a Bs. ${newPrice.toFixed(2)}.`);
    } catch (error) {
      console.error('Error al actualizar precio en Firestore:', error);
      setMenu((prev) =>
        prev.map((item) => (item.id === dishId ? { ...item, precioBs: newPrice } : item))
      );
      showToast(`Precio actualizado a Bs. ${newPrice.toFixed(2)}.`);
    }
  };

  const uniqueMenu = useMemo(() => {
    const seen = new Set<string>();
    return menu.filter((item) => {
      if (!item || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [menu]);

  const filteredAdminMenu = useMemo(() => {
    const searchLower = adminMenuSearch.trim().toLowerCase();
    return uniqueMenu.filter((item) => {
      const matchSearch =
        searchLower === '' ||
        item.nombre.toLowerCase().includes(searchLower) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(searchLower)) ||
        item.categoria.toLowerCase().includes(searchLower);
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
      status: 'pendiente',
    };

    setWaiterCalls((prev) => {
      const exists = prev.some(
        (c) => c.tableId === table.id && c.type === 'mozo' && c.status === 'pendiente'
      );
      return exists ? prev : [callData, ...prev];
    });

    try {
      const docRef = await addDoc(collection(db, 'llamadas'), {
        tableId: callData.tableId,
        tableName: callData.tableName,
        type: callData.type,
        time: callData.time,
        createdAt: callData.createdAt,
        status: 'pendiente',
      });
      setWaiterCalls((prev) => prev.map((c) => (c.id === callData.id ? { ...c, id: docRef.id } : c)));
      showToast(`Llamada de mozo enviada para ${table.name}. ¡Un mozo viene en camino! 🔔`);
    } catch (e) {
      console.error('Error al registrar llamada de mozo:', e);
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
      status: 'pendiente',
    };

    setWaiterCalls((prev) => {
      const exists = prev.some(
        (c) => c.tableId === table.id && c.type === 'cuenta' && c.status === 'pendiente'
      );
      return exists ? prev : [callData, ...prev];
    });

    try {
      const docRef = await addDoc(collection(db, 'llamadas'), {
        tableId: callData.tableId,
        tableName: callData.tableName,
        type: callData.type,
        time: callData.time,
        createdAt: callData.createdAt,
        status: 'pendiente',
      });
      setWaiterCalls((prev) => prev.map((c) => (c.id === callData.id ? { ...c, id: docRef.id } : c)));
    } catch (e) {
      console.error('Error al registrar solicitud de cuenta:', e);
    }

    const activeOrder = orders.find(
      (o) => !isTakeAwayOrder(o) && o.tableId === table.id && isOrderOpen(o)
    );
    if (activeOrder && activeOrder.status !== 'por-pagar') {
      try {
        await updateDoc(doc(db, 'pedidos', activeOrder.id), { status: 'por-pagar' });
      } catch (e) {
        console.warn('Error setting status por-pagar:', e);
      }
    }

    setModalMode('bill');
    if (!isDesktopPos) {
      setCustomerModalOpen(true);
    }
    showToast(`Solicitud de cuenta registrada para ${table.name}. 🧾`);
  };

  const attendWaiterCall = async (callId: string) => {
    try {
      await updateDoc(doc(db, 'llamadas', callId), { status: 'atendido' });
      showToast('Llamada atendida con éxito.');
    } catch (e) {
      console.warn('Error al actualizar llamada:', e);
      try {
        await deleteDoc(doc(db, 'llamadas', callId));
        showToast('Llamada atendida.');
      } catch (err) {
        console.error('Error al eliminar llamada:', err);
        setWaiterCalls((prev) => prev.filter((c) => c.id !== callId));
      }
    }
  };

  const handleCallWaiterForBill = async () => {
    if (currentTableId === null) {
      showToast('Por favor selecciona tu mesa.', 'error');
      return;
    }
    const tableIdNum = Number(currentTableId);
    const tableObj = tables.find((t) => t.id === tableIdNum);
    const tableName = tableObj ? tableObj.name : `Mesa #${tableIdNum}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timestamp = Date.now();

    const callData: WaiterCall = {
      id: `CALL-${timestamp}`,
      tableId: tableIdNum,
      tableName,
      type: 'cuenta',
      time: nowTime,
      createdAt: timestamp,
      status: 'pendiente',
    };

    setWaiterCalls((prev) => {
      const alreadyListed = prev.some(
        (c) => c.tableId === tableIdNum && c.type === 'cuenta' && c.status === 'pendiente'
      );
      return alreadyListed ? prev : [callData, ...prev];
    });

    setTables((prev) =>
      prev.map((t) => (t.id === tableIdNum ? { ...t, status: 'por-pagar' } : t))
    );

    try {
      await updateDoc(doc(db, 'mesas', String(tableIdNum)), { status: 'por-pagar' });
      const activeOrder = orders.find(
        (o) => !isTakeAwayOrder(o) && o.tableId === tableIdNum && isOrderOpen(o)
      );
      if (activeOrder) {
        await updateDoc(doc(db, 'pedidos', activeOrder.id), { status: 'por-pagar' });
      }
      const docRef = await addDoc(collection(db, 'llamadas'), {
        tableId: tableIdNum,
        tableName,
        type: 'cuenta',
        time: nowTime,
        createdAt: timestamp,
        status: 'pendiente',
      });
      setWaiterCalls((prev) => prev.map((c) => (c.id === callData.id ? { ...c, id: docRef.id } : c)));
      showToast(`🔔 Solicitud de cobro enviada al personal para ${tableName}.`);
    } catch (e) {
      console.error('Error al llamar al mozo para cuenta:', e);
      showToast(`🔔 Solicitud de cobro registrada para ${tableName}.`);
    }
  };

  const handlePayment = async (method: 'QR' | 'EFECTIVO', discountBs: number = 0) => {
    if (!isStaffAuthenticated || !canAccessCashier) {
      showToast(
        'Operación denegada. Requiere permiso de Caja y Cobros para cobrar y liberar mesas.',
        'error'
      );
      return;
    }
    if (currentTableId === null) {
      setCustomerModalOpen(false);
      showToast('Mesa no seleccionada.', 'error');
      return;
    }
    const tableObj = tables.find((t) => t.id === Number(currentTableId));
    if (!tableObj) {
      setCustomerModalOpen(false);
      showToast('Mesa no válida.', 'error');
      return;
    }

    const activeOrdersForTable = orders.filter(
      (o) => !isTakeAwayOrder(o) && o.tableId === tableObj.id && isOrderOpen(o)
    );

    try {
      await liberarMesaYReiniciarSesion({
        tableId: tableObj.id,
        tableName: tableObj.name,
        tableSeats: tableObj.seats,
        ordersToClose: activeOrdersForTable,
        method,
        discountBs,
      });

      waiterCalls.filter((c) => c.tableId === tableObj.id).forEach((c) => attendWaiterCall(c.id));
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableObj.id
            ? { ...t, status: 'free', estado: 'libre', sesionActivaId: null, currentOrder: null }
            : t
        )
      );
      setCustomerModalOpen(false);
      setCashAmount('');
      showToast(
        `¡Pago con ${method} confirmado! Mesa #${tableObj.id} cobrada, liberada y reiniciada. ✨`
      );
    } catch (e) {
      console.error('Error al registrar pago y liberar mesa:', e);
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableObj.id
            ? { ...t, status: 'free', estado: 'libre', sesionActivaId: null, currentOrder: null }
            : t
        )
      );
      setCustomerModalOpen(false);
      setCashAmount('');
      showToast(`¡Pago con ${method} registrado! Mesa #${tableObj.id} liberada. ✨`);
    }
  };

  const liberateTable = async (tableId: number) => {
    if (!isStaffAuthenticated || !canAccessCashier) {
      showToast(
        'Acceso denegado. Se requiere permiso de Caja y Cobros para cobrar la mesa.',
        'error'
      );
      return;
    }
    waiterCalls.filter((c) => c.tableId === tableId).forEach((c) => attendWaiterCall(c.id));

    const tableObj = tables.find((t) => t.id === tableId);
    const activeOrdersForTable = orders.filter(
      (o) => !isTakeAwayOrder(o) && o.tableId === tableId && isOrderOpen(o)
    );

    try {
      await liberarMesaYReiniciarSesion({
        tableId,
        tableName: tableObj?.name,
        tableSeats: tableObj?.seats,
        ordersToClose: activeOrdersForTable,
        method: 'EFECTIVO',
      });

      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? { ...t, status: 'free', estado: 'libre', sesionActivaId: null, currentOrder: null }
            : t
        )
      );
      showToast(`Mesa #${tableId} cobrada, liberada y reiniciada con éxito.`);
    } catch (e) {
      console.error('Error al liberar mesa:', e);
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? { ...t, status: 'free', estado: 'libre', sesionActivaId: null, currentOrder: null }
            : t
        )
      );
      showToast(`Mesa #${tableId} liberada.`);
    }
  };

  const handleCreateChangeRequest = async (motivo: string, celular?: string) => {
    const mesaNum = currentTableId || (mesaQR ? Number(mesaQR) : null);
    if (!mesaNum) {
      showToast('Por favor selecciona tu mesa antes de solicitar un cambio.', 'error');
      return;
    }
    const cleanPhone = (celular || localStorage.getItem('churo_celular') || '').replace(/\D/g, '');
    const reqData = {
      mesa_origen: Number(mesaNum),
      mesa_destino: null,
      celular: cleanPhone || null,
      motivo: motivo || 'Mesa más grande',
      estado: 'pendiente',
      createdAt: Date.now(),
      cliente_nombre: `Cliente Mesa ${mesaNum}`,
    };
    try {
      await addDoc(collection(db, 'solicitudes_cambio'), {
        ...reqData,
        createdAt: serverTimestamp(),
      });
      showToast('Solicitud enviada');
    } catch (e) {
      console.error('Error al enviar solicitud de cambio de mesa:', e);
      showToast('No se pudo enviar la solicitud. Intenta de nuevo.', 'error');
    }
  };

  const handleSimulateRequest = async () => {
    const reqData = {
      mesa_origen: 5,
      mesa_destino: null,
      celular: '71234567',
      motivo: 'Mesa más grande',
      estado: 'pendiente',
      createdAt: Date.now(),
      cliente_nombre: 'Cliente Mesa 5',
    };
    try {
      await addDoc(collection(db, 'solicitudes_cambio'), {
        ...reqData,
        createdAt: serverTimestamp(),
      });
      showToast('Solicitud simulada creada correctamente');
    } catch (e) {
      console.error('Error al simular solicitud:', e);
      showToast('No se pudo simular la solicitud.', 'error');
    }
  };

  const handleMoveTable = async (
    sourceTableId: number,
    targetTableId: number,
    requestId?: string
  ) => {
    try {
      const sourceTable = tables.find((t) => t.id === sourceTableId);
      const targetTable = tables.find((t) => t.id === targetTableId);
      const targetTableName = targetTable ? targetTable.name : `Mesa #${targetTableId}`;

      const sourceMesaActivaRef = doc(db, 'mesas_activas', `mesa_${sourceTableId}`);
      let sourceData: any = null;
      try {
        const snap = await getDoc(sourceMesaActivaRef);
        if (snap.exists()) {
          sourceData = snap.data();
        }
      } catch (e) {
        console.warn('Lectura mesas_activas origen:', e);
      }

      const clienteCelular =
        sourceData?.cliente_celular || localStorage.getItem('churo_celular') || null;
      const activeOrder = orders.find(
        (o) => !isTakeAwayOrder(o) && o.tableId === sourceTableId && isOrderOpen(o)
      );
      const carriedSessionId =
        sourceData?.sesionActivaId ||
        sourceTable?.sesionActivaId ||
        generateTableSessionId(targetTableId);

      const targetMesaActivaRef = doc(db, 'mesas_activas', `mesa_${targetTableId}`);
      await setDoc(
        targetMesaActivaRef,
        {
          mesa: targetTableId,
          sesionActivaId: carriedSessionId,
          cliente_celular: clienteCelular,
          cliente_llego: sourceData?.cliente_llego || serverTimestamp(),
          trasladado_desde: sourceTableId,
          trasladado_el: serverTimestamp(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (activeOrder) {
        await updateDoc(doc(db, 'pedidos', activeOrder.id), {
          tableId: targetTableId,
          tableName: targetTableName,
          trasladadoDesde: sourceTableId,
          trasladadoAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }

      try {
        await deleteDoc(sourceMesaActivaRef);
      } catch (delErr) {
        console.warn('Delete mesas_activas origen fallback:', delErr);
      }
      await updateDoc(doc(db, 'mesas', String(sourceTableId)), {
        status: 'free',
        estado: 'libre',
        sesionActivaId: null,
        currentOrder: null,
      });

      const targetStatus = activeOrder?.status === 'por-pagar' ? 'por-pagar' : 'occupied';
      await updateDoc(doc(db, 'mesas', String(targetTableId)), {
        status: targetStatus,
        estado: 'ocupada',
        sesionActivaId: carriedSessionId,
        currentOrder: activeOrder
          ? { ...activeOrder, tableId: targetTableId, tableName: targetTableName }
          : null,
      });

      const matchingReqId =
        requestId ||
        changeRequests.find((r) => r.mesa_origen === sourceTableId && r.estado === 'pendiente')
          ?.id;
      if (matchingReqId) {
        try {
          await updateDoc(doc(db, 'solicitudes_cambio', matchingReqId), {
            estado: 'completado',
            mesa_destino: targetTableId,
            atendidoAt: serverTimestamp(),
          });
        } catch (rErr) {
          console.warn('Update solicitud_cambio:', rErr);
        }
      }

      if (clienteCelular) {
        try {
          await setDoc(
            doc(db, 'clientes', String(clienteCelular)),
            {
              ultima_mesa: targetTableId,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (cErr) {
          console.warn('Actualizar clientes doc:', cErr);
        }
      }

      const storedMesa = localStorage.getItem('churo_mesa');
      if (storedMesa && Number(storedMesa) === sourceTableId) {
        localStorage.setItem('churo_mesa', String(targetTableId));
        setCurrentTableId(targetTableId);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('mesa', String(targetTableId));
        window.history.replaceState({}, '', newUrl.toString());
      }

      showToast(
        `¡Comanda trasladada de Mesa ${sourceTableId} a Mesa ${targetTableId} con éxito! 🔄`
      );
    } catch (e) {
      console.error('Error al trasladar mesa:', e);
      showToast('Hubo un error al trasladar la mesa. Intenta nuevamente.', 'error');
    }
  };

  const handleAddTable = async (newTable: { id: number; name: string; seats: number }) => {
    try {
      await setDoc(doc(db, 'mesas', String(newTable.id)), {
        id: newTable.id,
        name: newTable.name,
        seats: newTable.seats,
        status: 'free',
        estado: 'libre',
        sesionActivaId: null,
      });
      setTables((prev) => {
        if (prev.some((t) => t.id === newTable.id)) return prev;
        const createdTable: Table = { ...newTable, status: 'free', currentOrder: null };
        return [...prev, createdTable].sort((a, b) => a.id - b.id);
      });
      showToast(`¡${newTable.name} agregada con éxito! 🎉`);
    } catch (e) {
      console.error('Error al agregar mesa en Firestore:', e);
      const createdTable: Table = { ...newTable, status: 'free', currentOrder: null };
      setTables((prev) => [...prev, createdTable].sort((a, b) => a.id - b.id));
      showToast(`¡${newTable.name} agregada! 🎉`);
    }
  };

  const handleQuickOpenTable = async ({
    table,
    nota,
    celular,
  }: {
    table: Table;
    nota?: string;
    celular?: string;
  }) => {
    try {
      const sesionActivaId = await abrirMesaDesdeCaja({
        mesaNumber: table.id,
        tableName: table.name,
        tableSeats: table.seats,
        nota,
        celular,
      });
      setTables((prev) =>
        prev.map((t) =>
          t.id === table.id
            ? {
                ...t,
                status: 'occupied',
                estado: 'ocupada',
                origen: 'caja',
                sesionActivaId,
              }
            : t
        )
      );
      setQuickOpenTable(null);
      setTakeAwaySelection(null);
      setCurrentTableId(table.id);
      setModalMode('cart');
      setActiveTab('menu');
      showToast(`${table.name} abierta en Caja. Selecciona los platos para enviar a cocina.`);
    } catch (err) {
      console.error('Error al abrir mesa desde Caja:', err);
      showToast('No se pudo abrir la mesa. Intenta nuevamente.', 'error');
    }
  };

  const handleDeleteTable = async (tableId: number) => {
    const table = tables.find((t) => t.id === tableId);
    if (table && table.status !== 'free') {
      showToast(
        `No se puede eliminar la Mesa #${tableId} porque tiene comensales o comanda activa.`,
        'error'
      );
      return;
    }

    try {
      await deleteDoc(doc(db, 'mesas', String(tableId)));
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      if (currentTableId === tableId) {
        setCurrentTableId(null);
      }
      showToast(`Mesa #${tableId} eliminada correctamente.`);
    } catch (e) {
      console.error('Error al eliminar mesa en Firestore:', e);
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      if (currentTableId === tableId) {
        setCurrentTableId(null);
      }
      showToast(`Mesa #${tableId} eliminada.`);
    }
  };

  const printQRCode = (table: Table) => {
    const originUrl =
      typeof window !== 'undefined' ? window.location.origin : 'https://el-churo-mosito.app';
    const targetUrl = `${originUrl}/?mesa=${table.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      targetUrl
    )}`;
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const docWindow = iframe.contentWindow?.document;
      if (docWindow) {
        docWindow.open();
        docWindow.write(`
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
        docWindow.close();
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

  const pendingKitchenCount = useMemo(() => {
    return orders.filter((o) => {
      if (!isOrderOpen(o)) return false;
      if (isTakeAwayOrder(o)) {
        return o.estadoCocina !== 'listo' && o.estadoCocina !== 'entregado';
      }
      return o.status !== 'servido';
    }).length;
  }, [orders]);

  const staffDisplayName = user?.displayName || staffSession?.name || 'Administrador';
  const staffRoleLabel = isAdminAuthenticated
    ? 'Administrador'
    : staffSession?.cargo || 'Personal';

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

  const isTakeAwayContext = Boolean(
    takeAwaySelection !== null || (!isStaffAuthenticated && !isClientMode && currentTableId === null)
  );

  return (
    <div
      className={`min-h-screen ${backgroundModeClass} text-[#f5efe6] font-sans antialiased selection:bg-[#ff7a00] selection:text-white relative w-full transition-colors duration-300 ${
        isDesktopPos ? 'lg:grid lg:grid-cols-[240px_1fr_380px] lg:h-screen lg:overflow-hidden' : 'overflow-x-hidden'
      }`}
    >
      {/* Welcome & WhatsApp / Para Llevar Screen */}
      {showWelcomeScreen && (
        <WelcomeScreen
          mesaNumber={currentTableId}
          tableName={currentTableId !== null ? tables.find((t) => t.id === currentTableId)?.name : undefined}
          tableSeats={currentTableId !== null ? tables.find((t) => t.id === currentTableId)?.seats : 4}
          restaurantProfile={restaurantProfile}
          onSessionInvalidated={() => {
            setCart([]);
            setClientPhone('');
            setActiveClientSessionId(null);
          }}
          onSelectTakeAway={handleClientSwitchToTakeAway}
          onExploreMenu={() => {
            try {
              sessionStorage.setItem('churo_welcome_dismissed_takeaway', 'true');
            } catch {
              // ignore
            }
            setTakeAwaySelection('new');
            setShowWelcomeScreen(false);
            setActiveTab('menu');
          }}
          onComplete={(celular, sesionId) => {
            if (sesionId) setActiveClientSessionId(sesionId);
            setClientPhone(celular || '');
            setSessionClosedMesa(null);
            setShowWelcomeScreen(false);
            if (celular && currentTableId !== null) {
              showToast(`¡Bienvenido! WhatsApp +591 ${celular} registrado para Mesa #${currentTableId}`);
            }
          }}
        />
      )}

      {/* Pantalla limpia de agradecimiento si la mesa fue cobrada/liberada en tiempo real */}
      {sessionClosedMesa !== null && !isStaff && (
        <div className="fixed inset-0 z-[2400] bg-[#0d0a08]/98 backdrop-blur-md flex items-center justify-center p-5 animate-fadeIn">
          <div className="bg-[#292524] border border-[#ff7a00]/40 rounded-[28px] max-w-sm w-full p-7 text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCheck className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#ff7a00]">
                Mesa #{sessionClosedMesa} Liberada
              </span>
              <h2 className="text-2xl font-serif font-black text-[#f5efe6]">
                ¡Gracias por tu visita!
              </h2>
              <p className="text-xs text-[#a8a29e] leading-relaxed">
                Tu cuenta fue cobrada y la mesa ha sido cerrada. Tu carrito y sesión se limpiaron automáticamente para el siguiente comensal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const mesaToRestart = sessionClosedMesa;
                clearClientSessionStorage(mesaToRestart);
                setCart([]);
                setClientPhone('');
                setActiveClientSessionId(null);
                setSessionClosedMesa(null);
                setCurrentTableId(mesaToRestart);
                setShowWelcomeScreen(true);
              }}
              className="w-full py-3.5 px-5 rounded-2xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-white font-extrabold text-sm shadow-lg transition-all cursor-pointer active:scale-95"
            >
              Iniciar nueva orden en Mesa #{sessionClosedMesa}
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-[1300] flex items-center gap-3 px-5 py-3.5 rounded-[16px] shadow-2xl backdrop-blur-md border animate-bounce ${
            notification.type === 'error'
              ? 'bg-red-950/90 border-red-500/50 text-red-200'
              : 'bg-[#292524]/95 border-[#ff7a00]/40 text-[#f5efe6]'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          ) : (
            <Sparkles className="w-5 h-5 text-[#ff7a00] shrink-0" />
          )}
          <span className="text-[14px] font-medium">{notification.message}</span>
        </div>
      )}

      {/* Columna 1 (Desktop POS): Sidebar Izquierdo */}
      {isDesktopPos && (
        <PosSidebar
          restaurantProfile={restaurantProfile}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isAdminAuthenticated={isAdminAuthenticated}
          canAccessTables={canAccessTables}
          canAccessKitchen={canAccessKitchen}
          canAccessAdminTab={canAccessAdminTab}
          pendingKitchenCount={pendingKitchenCount}
          pendingChangeRequestsCount={pendingChangeRequests.length}
          waiterCalls={waiterCalls}
          onAttendWaiterCall={attendWaiterCall}
          staffDisplayName={staffDisplayName}
          staffRoleLabel={staffRoleLabel}
          onLogout={handleLogout}
        />
      )}

      {/* Columna Central */}
      <div className={isDesktopPos ? 'h-full overflow-y-auto min-w-0 pos-scrollbar' : ''}>
        {/* Header (clientes y móvil/tablet) */}
        <header
          className={`sticky top-0 z-50 bg-[#1c1917]/95 backdrop-blur-md border-b border-[#3a3632] ${
            isDesktopPos ? 'lg:hidden' : ''
          }`}
        >
          <div className="max-w-[1280px] mx-auto px-3 sm:px-6 h-[68px] sm:h-[72px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] flex items-center justify-center shrink-0 overflow-hidden shadow-lg transition-all"
                style={{
                  backgroundColor: restaurantProfile.colorPrimario || '#ff7a00',
                  boxShadow: `0 8px 30px ${restaurantProfile.colorPrimario || '#ff7a00'}40`,
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

            <nav className="hidden lg:flex items-center p-1.5 rounded-[16px] border border-[#3a3632] bg-[#292524]">
              {[
                { id: 'menu', label: 'Menú', icon: Utensils, isStaff: false, allowed: true },
                { id: 'tables', label: 'Mesas', icon: QrCode, isStaff: true, allowed: canAccessTables },
                { id: 'kitchen', label: 'Cocina', icon: ChefHat, isStaff: true, allowed: canAccessKitchen },
                { id: 'admin', label: 'Admin', icon: Layers, isStaff: true, allowed: canAccessAdminTab },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isLocked = tab.isStaff && (!isStaffAuthenticated || !tab.allowed);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (tab.isStaff && isStaffAuthenticated && !tab.allowed) {
                        showToast(`No tienes permiso habilitado para ${tab.label}.`, 'error');
                        return;
                      }
                      setActiveTab(tab.id);
                    }}
                    className={`flex items-center px-4 py-2 rounded-[12px] gap-2 text-[13px] font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#ff7a00] text-white shadow-lg'
                        : isLocked && isStaffAuthenticated
                          ? 'text-[#78716c] opacity-65 hover:text-[#a8a29e]'
                          : 'text-[#a8a29e] hover:text-[#f5efe6]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {isLocked && <Lock className="w-3 h-3 text-[#78716c]" />}
                    {tab.id === 'tables' && !isLocked && pendingChangeRequests.length > 0 && (
                      <span
                        className="ml-1 px-1.5 min-w-[20px] h-5 bg-[#ff7a00] text-black rounded-full text-[10px] font-black flex items-center justify-center animate-pulse"
                        title="Solicitudes de cambio de mesa"
                      >
                        🔔 {pendingChangeRequests.length}
                      </span>
                    )}
                    {tab.id === 'kitchen' && !isLocked && pendingKitchenCount > 0 && (
                      <span className="ml-1 w-5 h-5 bg-amber-500 text-black rounded-full text-[10px] font-bold flex items-center justify-center">
                        {pendingKitchenCount}
                      </span>
                    )}
                    {tab.id === 'admin' &&
                      !isLocked &&
                      (waiterCalls.length > 0 || pendingChangeRequests.length > 0) && (
                        <span className="ml-1 px-1.5 min-w-[20px] h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                          {waiterCalls.length + pendingChangeRequests.length}
                        </span>
                      )}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowWelcomeScreen(true)}
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[#292524] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00]/60 text-[#a8a29e] hover:text-[#ff7a00] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0"
                title="Volver a la Pantalla de Bienvenida"
                aria-label="Volver a la Pantalla de Bienvenida"
              >
                <Home className="w-4 h-4 text-[#ff7a00]" />
                <span className="hidden md:inline font-semibold text-xs text-[#f5efe6]">Inicio</span>
              </button>
              {isStaffAuthenticated ? (
                <button
                  type="button"
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
                  type="button"
                  onClick={() => setActiveTab('tables')}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-[#292524] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00]/50 text-xs text-[#a8a29e] hover:text-[#f5efe6] transition-all cursor-pointer active:scale-95"
                  title="Acceso para Mozos, Cocina y Administración (PIN)"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold text-[11px] sm:text-xs">Personal</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Barra superior discreta del cliente (Mesa QR o Píldora activa Para Llevar) */}
        {(isClientMode || activeClientTakeAwayOrder || isTakeAwayContext) && !isStaff && (
          <ClientTopBar
            mesaNumber={currentTableId}
            tableName={
              currentTableId !== null
                ? tables.find((t) => t.id === currentTableId)?.name
                : undefined
            }
            clientPhone={clientPhone}
            onPhoneUpdated={(newPhone) => setClientPhone(newPhone)}
            onRequestTableChange={() => setIsRequestChangeModalOpen(true)}
            onOpenWelcome={() => setShowWelcomeScreen(true)}
            activeTakeAwayOrder={activeClientTakeAwayOrder}
            onOpenTakeAwayTracker={() => setIsTakeAwayTrackerOpen(true)}
            showToast={showToast}
          />
        )}

        {/* Main Content */}
        <main
          className={`max-w-[1280px] mx-auto px-4 sm:px-6 py-6 ${
            isDesktopPos
              ? 'pb-10'
              : usarPildoraFlotante
                ? 'pb-28 lg:pb-12'
                : 'pb-24 lg:pb-12'
          }`}
        >
          {activeTab === 'menu' && (
            <MenuCatalogView
              menu={uniqueMenu}
              cart={cart}
              tables={tables}
              currentTableId={currentTableId}
              selectedTableObject={selectedTableObject}
              activeOrderForCurrentTable={activeOrderForCurrentTable}
              activeClientTakeAwayOrder={activeClientTakeAwayOrder}
              isClientMode={isClientMode}
              isStaffAuthenticated={isStaffAuthenticated}
              isDesktopPos={isDesktopPos}
              isTakeAwayMode={isTakeAwayContext}
              selectedCategory={selectedCategory}
              posMenuSearch={posMenuSearch}
              onSelectCategory={setSelectedCategory}
              onSearchChange={setPosMenuSearch}
              onAddToCart={addToCart}
              onUpdateCartQty={updateCartQty}
              onTableChange={handleTableChange}
              onCallWaiter={callWaiter}
              onRequestBill={requestBill}
              onOpenBillFallback={() => {
                setModalMode('bill');
                if (!isDesktopPos) {
                  setCustomerModalOpen(true);
                }
              }}
              onCancelOrder={cancelOrder}
              onOpenTakeAwayTracker={() => setIsTakeAwayTrackerOpen(true)}
              onActivateTakeAway={() => {
                if (activeClientTakeAwayOrder) {
                  setIsTakeAwayTrackerOpen(true);
                } else {
                  setTakeAwaySelection('new');
                  setModalMode('cart');
                  setCustomerModalOpen(true);
                }
              }}
              showToast={showToast}
            />
          )}

          {/* Staff Protected Views */}
          {(activeTab === 'tables' || activeTab === 'kitchen' || activeTab === 'admin') &&
          !isStaffAuthenticated ? (
            <StaffLoginView
              onSuccess={(session) => {
                setStaffSession(session);
                if (activeTab === 'admin' && !session.isMasterAdmin) {
                  if (session.permisos.includes('menu_admin')) {
                    setAdminSubTab('inventario');
                  } else if (session.permisos.includes('reportes')) {
                    setAdminSubTab('historial');
                  }
                }
              }}
              showToast={showToast}
              requiredRole={
                activeTab === 'admin'
                  ? 'Panel de Administración'
                  : activeTab === 'tables'
                    ? 'Gestión de Mesas'
                    : 'Cocina KDS'
              }
            />
          ) : (
            <div className="animate-fadeIn">
              {activeTab === 'tables' && (
                <TableMapView
                  tables={tables}
                  pendingChangeRequests={pendingChangeRequests}
                  waiterCalls={waiterCalls}
                  isStaffAuthenticated={isStaffAuthenticated}
                  isAdminAuthenticated={isAdminAuthenticated}
                  canAccessTables={canAccessTables}
                  canAccessCashier={canAccessCashier}
                  onOpenNewTakeAway={() => {
                    setCurrentTableId(null);
                    setTakeAwaySelection('new');
                    setModalMode('cart');
                    setActiveTab('menu');
                    if (!isDesktopPos) {
                      setCustomerModalOpen(true);
                    }
                    showToast('Modo 🛍️ Nuevo Pedido Para Llevar listo. Elige los platos.');
                  }}
                  onOpenAddTableModal={() => setIsAddTableModalOpen(true)}
                  onOpenTableInCart={openTableInCart}
                  onQuickOpenTable={(t) => setQuickOpenTable(t)}
                  onSelectTableForMenu={(t) => {
                    setTakeAwaySelection(null);
                    setCurrentTableId(t.id);
                    setModalMode('cart');
                    setActiveTab('menu');
                    showToast(`${t.name} seleccionada para agregar pedido.`);
                  }}
                  onOpenQrModal={(t) => setQrModalTable(t)}
                  onOpenTableBill={(tableId) => {
                    setTakeAwaySelection(null);
                    setCurrentTableId(tableId);
                    setModalMode('bill');
                    setCashAmount('');
                    if (!isDesktopPos) {
                      setCustomerModalOpen(true);
                    }
                  }}
                  onOpenMoveModal={(t, req) => {
                    setMoveStaffModal({
                      isOpen: true,
                      sourceTable: t,
                      requestId: req?.id,
                      requestDetails: req || null,
                    });
                  }}
                  onOpenDeleteTable={(t) => setTableToDelete(t)}
                  onAttendWaiterCall={attendWaiterCall}
                  showToast={showToast}
                />
              )}

              {activeTab === 'kitchen' && (
                <OrdersKdsView
                  orders={orders}
                  filterTab={kitchenFilter}
                  onChangeFilterTab={setKitchenFilter}
                  canAccessCashier={canAccessCashier}
                  isAdminAuthenticated={isAdminAuthenticated}
                  onOpenTableInCart={openTableInCart}
                  onOpenTakeAwayInCart={(orderId, mode = 'cart') =>
                    openTakeAwayInCart(orderId, mode)
                  }
                  onUpdateOrderStatus={updateOrderStatus}
                  onUpdateTakeAwayStatus={handleUpdateTakeAwayStatus}
                  onRequestDeliveryVerify={(order) => setDeliveryVerifyOrder(order)}
                  onLiberateTable={liberateTable}
                  onAdminCancelOrder={handleAdminCancelOrder}
                  showToast={showToast}
                />
              )}

              {activeTab === 'admin' && canAccessAdminTab && (
                <AdminPanelView
                  adminSubTab={adminSubTab}
                  onChangeAdminSubTab={setAdminSubTab}
                  isAdminAuthenticated={isAdminAuthenticated}
                  canAccessMenuAdmin={canAccessMenuAdmin}
                  canAccessReports={canAccessReports}
                  canAccessTables={canAccessTables}
                  canAccessCashier={canAccessCashier}
                  uniqueMenu={uniqueMenu}
                  filteredAdminMenu={filteredAdminMenu}
                  adminMenuSearch={adminMenuSearch}
                  adminMenuCategory={adminMenuCategory}
                  onAdminSearchChange={setAdminMenuSearch}
                  onAdminCategoryChange={setAdminMenuCategory}
                  waiterCalls={waiterCalls}
                  pendingChangeRequests={pendingChangeRequests}
                  tables={tables}
                  restaurantProfile={restaurantProfile}
                  usarPildoraFlotante={usarPildoraFlotante}
                  securityConfig={securityConfig}
                  collaborators={collaborators}
                  onAttendWaiterCall={attendWaiterCall}
                  onSimulateRequest={handleSimulateRequest}
                  onOpenMoveModal={(t, req) => {
                    setMoveStaffModal({
                      isOpen: true,
                      sourceTable: t,
                      requestId: req.id,
                      requestDetails: req,
                    });
                  }}
                  onOpenNewDish={() => {
                    setDishToEdit(null);
                    setDishModalOpen(true);
                  }}
                  onOpenEditDish={(dish) => {
                    setDishToEdit(dish);
                    setDishModalOpen(true);
                  }}
                  onOpenQuickPrice={(dish) => setDishToQuickPrice(dish)}
                  onOpenDeleteDish={(dish) => setDishToDelete(dish)}
                  onToggleAvailability={toggleAvailability}
                  onProfileUpdated={(updated) => setRestaurantProfile(updated)}
                  onMasterPinUpdated={(newPin) => {
                    if (staffSession?.isMasterAdmin && staffSession.authType === 'pin') {
                      const updatedSession: StaffSession = {
                        ...staffSession,
                        sessionPin: newPin,
                      };
                      setStaffSession(updatedSession);
                      localStorage.setItem('elchuro_staff_session', JSON.stringify(updatedSession));
                    }
                  }}
                  showToast={showToast}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Columna 3 (Desktop POS): Panel Derecho Fijo / Drawer Overlay Móvil */}
      {(() => {
        const sharedCartProps = {
          onClose: () => setCustomerModalOpen(false),
          modalMode,
          cart,
          cartTotal,
          tables,
          currentTableId,
          activeOrder: activeOrderForCurrentTable,
          onTableChange: handleTableChange,
          onUpdateQty: updateCartQty,
          onRemoveItem: removeFromCart,
          onPlaceOrder: placeOrder,
          onPayment: handlePayment,
          cashAmount,
          setCashAmount,
          onViewMenu: () => setActiveTab('menu'),
          onSwitchToBill: () => {
            const effectiveId = isClientMode
              ? Number(localStorage.getItem('churo_mesa')) || mesaQR || currentTableId
              : currentTableId;
            const table =
              effectiveId !== null ? tables.find((t) => t.id === Number(effectiveId)) : null;
            if (table) {
              requestBill(table);
            } else {
              setModalMode('bill');
            }
          },
          onSwitchMode: (mode: 'cart' | 'bill') => {
            setCashAmount('');
            setModalMode(mode);
          },
          isClientMode,
          isStaffAuthenticated,
          isAdminAuthenticated,
          canTakeOrders: isAdminAuthenticated || canAccessTables,
          canManageKitchen: isAdminAuthenticated || canAccessKitchen,
          canCharge: canAccessCashier,
          staffName: user?.displayName || staffSession?.name || 'Personal',
          onCallWaiterForBill: handleCallWaiterForBill,
          onRequestTableChange: () => setIsRequestChangeModalOpen(true),
          onUpdateOrderStatus: updateOrderStatus,
          onRemoveOrderItem: handleRemoveOrderItem,
          onOpenTableMove: (table: Table) => {
            const req = pendingChangeRequests.find((r) => r.mesa_origen === table.id);
            setMoveStaffModal({
              isOpen: true,
              sourceTable: table,
              requestId: req?.id,
              requestDetails: req || null,
            });
          },
          // Para Llevar
          takeAwayMode: takeAwaySelection,
          activeTakeAwayOrders,
          clientTakeAwayOrder: activeClientTakeAwayOrder,
          onSelectTakeAway: (mode: 'new' | string | null) => {
            setTakeAwaySelection(mode);
            if (mode !== null) {
              setCurrentTableId(null);
            }
            setCashAmount('');
            setModalMode('cart');
          },
          onCreateTakeAwayOrder: handleCreateTakeAwayOrder,
          onAddItemsToTakeAway: handleAddItemsToTakeAway,
          onUpdateTakeAwayItemQty: handleUpdateTakeAwayItemQty,
          onUpdateTakeAwayStatus: handleUpdateTakeAwayStatus,
          onRequestDeliveryVerify: (order: Order) => setDeliveryVerifyOrder(order),
          onCollectTakeAwayPayment: handleCollectTakeAwayPayment,
          onCancelTakeAwayOrder: handleAdminCancelOrder,
          onOpenTakeAwayTracker: () => setIsTakeAwayTrackerOpen(true),
        };

        if (isDesktopPos) {
          return (
            <aside className="hidden lg:flex lg:flex-col lg:h-full lg:overflow-hidden">
              <CartModal {...sharedCartProps} isDocked={true} isOpen={true} />
            </aside>
          );
        }

        return (
          <>
            <CartModal {...sharedCartProps} isDocked={false} isOpen={customerModalOpen} />
            <FloatingCartBar
              cart={cart}
              cartTotal={cartTotal}
              isOpen={customerModalOpen}
              selectedTable={selectedTableObject}
              takeAwayOrder={activeClientTakeAwayOrder}
              isTakeAwaySelected={isTakeAwayContext}
              visible={usarPildoraFlotante}
              onOpenCart={() => {
                setModalMode('cart');
                setCustomerModalOpen(true);
              }}
            />
          </>
        );
      })()}

      {/* Mobile Bottom Dock */}
      <MobileDock
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        cart={cart}
        orders={orders}
        waiterCallsCount={waiterCalls.length}
        changeRequestsCount={pendingChangeRequests.length}
        isCartOpen={customerModalOpen}
        usarPildoraFlotante={usarPildoraFlotante}
        isStaffAuthenticated={isStaffAuthenticated}
        isAdminAuthenticated={isAdminAuthenticated}
        canAccessTables={canAccessTables}
        canAccessKitchen={canAccessKitchen}
        canAccessAdmin={canAccessAdminTab}
        onOpenCart={() => {
          setModalMode('cart');
          setCustomerModalOpen(true);
        }}
        onOpenWelcome={() => setShowWelcomeScreen(true)}
      />

      {/* Modales Operativos */}
      <QrModal
        table={qrModalTable}
        onClose={() => setQrModalTable(null)}
        onPrint={printQRCode}
      />

      <AddTableModal
        isOpen={isAddTableModalOpen}
        onClose={() => setIsAddTableModalOpen(false)}
        existingTables={tables}
        onAddTable={handleAddTable}
      />

      <DeleteTableModal
        table={tableToDelete}
        onClose={() => setTableToDelete(null)}
        onConfirmDelete={handleDeleteTable}
      />

      <QuickOpenTableModal
        table={quickOpenTable}
        onClose={() => setQuickOpenTable(null)}
        onConfirm={handleQuickOpenTable}
      />

      {/* Modales Para Llevar (Entrega Segura 4 Dígitos & Seguimiento Cliente) */}
      <TakeAwayDeliveryModal
        order={deliveryVerifyOrder}
        onClose={() => setDeliveryVerifyOrder(null)}
        canRevealCode={Boolean(isStaffAuthenticated && (isAdminAuthenticated || canAccessCashier))}
        onConfirmDelivery={handleConfirmTakeAwayDelivery}
      />

      <TakeAwayTrackerModal
        isOpen={isTakeAwayTrackerOpen}
        order={activeClientTakeAwayOrder}
        onClose={() => setIsTakeAwayTrackerOpen(false)}
        onAddMoreDishes={() => {
          setActiveTab('menu');
          showToast('Selecciona más platos para sumarlos automáticamente a tu pedido.');
        }}
      />

      {/* Modales Cambio de Mesa */}
      <RequestTableChangeModal
        isOpen={isRequestChangeModalOpen}
        onClose={() => setIsRequestChangeModalOpen(false)}
        mesaOrigen={currentTableId || (mesaQR ? Number(mesaQR) : 1)}
        initialCelular={localStorage.getItem('churo_celular') || ''}
        onSubmit={handleCreateChangeRequest}
        onSwitchToTakeAway={handleClientSwitchToTakeAway}
      />

      <MoveTableStaffModal
        isOpen={moveStaffModal.isOpen}
        onClose={() => setMoveStaffModal({ isOpen: false, sourceTable: null })}
        sourceTable={moveStaffModal.sourceTable}
        allTables={tables}
        requestId={moveStaffModal.requestId}
        requestDetails={moveStaffModal.requestDetails}
        onConfirmMove={handleMoveTable}
      />

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

      {/* Modales Gestión de Platos */}
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
