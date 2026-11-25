import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase.ts';
import { Order } from '../types/index.ts';

export const CLIENT_STORAGE_KEYS = [
  'churo_celular',
  'churo_carrito',
  'churo_sesion_id',
  'churo_mesa',
  'churo_fecha',
  'churo_fecha_inicio',
  'churo_fecha_pago',
  'churo_ultima_mesa',
  'churo_sesion_activa',
] as const;

export function clearClientSessionStorage(mesaNumber?: number | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      CLIENT_STORAGE_KEYS.forEach((key) => {
        localStorage.removeItem(key);
      });
    }
    if (typeof sessionStorage !== 'undefined') {
      if (mesaNumber !== undefined && mesaNumber !== null) {
        sessionStorage.removeItem(`welcome_done_${mesaNumber}`);
        sessionStorage.removeItem(`churo_welcome_dismissed_${mesaNumber}`);
      } else {
        Object.keys(sessionStorage).forEach((k) => {
          if (k.startsWith('welcome_done_') || k.startsWith('churo_welcome_dismissed_')) {
            sessionStorage.removeItem(k);
          }
        });
      }
    }
  } catch (err) {
    console.warn('Error limpiando localStorage/sessionStorage del cliente:', err);
  }
}

export function generateTableSessionId(mesaNumber: number): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SES-${mesaNumber}-${Date.now()}-${rand}`;
}

export function isTableDataFree(data: Record<string, any> | null | undefined): boolean {
  if (!data) return true;
  if (data.estado === 'libre' || data.status === 'free') return true;
  if (!data.sesionActivaId) return true;
  return false;
}

export async function activarSesionMesa(params: {
  mesaNumber: number;
  tableName?: string;
  tableSeats?: number;
  celular?: string;
}): Promise<string> {
  const { mesaNumber, tableName, tableSeats = 4, celular } = params;
  const cleanPhone = (celular || '').replace(/\D/g, '').slice(0, 8);
  const nowIso = new Date().toISOString();
  const mesaRef = doc(db, 'mesas', String(mesaNumber));

  let resolvedSessionId = generateTableSessionId(mesaNumber);
  let resolvedName = tableName || `Mesa ${mesaNumber}`;
  let resolvedSeats = tableSeats;
  let wasFree = true;

  try {
    const snap = await getDoc(mesaRef);
    if (snap.exists()) {
      const data = snap.data();
      resolvedName = data.name || resolvedName;
      resolvedSeats = Number(data.seats || resolvedSeats);
      if (!isTableDataFree(data) && typeof data.sesionActivaId === 'string') {
        // Si la mesa ya tiene una sesión en curso (ej. otro comensal en la misma mesa), se une a esa sesión
        resolvedSessionId = data.sesionActivaId;
        wasFree = false;
      }
    }
  } catch (err) {
    console.warn('No se pudo leer estado previo de mesa al activar sesión:', err);
  }

  try {
    await setDoc(
      mesaRef,
      {
        id: Number(mesaNumber),
        name: resolvedName,
        seats: resolvedSeats,
        status: 'occupied',
        estado: 'ocupada',
        sesionActivaId: resolvedSessionId,
        sesionIniciadaAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Fallback al marcar mesa ocupada con sesionActivaId:', err);
  }

  try {
    const mesaActivaRef = doc(db, 'mesas_activas', `mesa_${mesaNumber}`);
    const payload: Record<string, any> = {
      mesa: Number(mesaNumber),
      sesionActivaId: resolvedSessionId,
      estado: 'ocupada',
      updatedAt: nowIso,
    };
    if (wasFree) {
      payload.cliente_llego = serverTimestamp();
      payload.cliente_celular = cleanPhone || null;
    } else if (cleanPhone) {
      payload.cliente_celular = cleanPhone;
    }
    await setDoc(mesaActivaRef, payload, { merge: !wasFree });
  } catch (err) {
    console.warn('Error actualizando mesas_activas al iniciar sesión:', err);
  }

  if (cleanPhone) {
    try {
      await setDoc(
        doc(db, 'clientes', cleanPhone),
        {
          celular: cleanPhone,
          ultima_mesa: Number(mesaNumber),
          ultima_visita: serverTimestamp(),
          visitas: increment(1),
          updatedAt: nowIso,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Error registrando cliente en Firestore:', err);
    }
  }

  try {
    localStorage.setItem('churo_mesa', String(mesaNumber));
    localStorage.setItem('churo_sesion_id', resolvedSessionId);
    localStorage.setItem('churo_sesion_activa', 'true');
    localStorage.setItem('churo_fecha', nowIso);
    localStorage.setItem('churo_fecha_inicio', nowIso);
    if (cleanPhone) {
      localStorage.setItem('churo_celular', cleanPhone);
    } else if (wasFree) {
      localStorage.removeItem('churo_celular');
    }
    sessionStorage.setItem(`welcome_done_${mesaNumber}`, 'true');
    sessionStorage.setItem(`churo_welcome_dismissed_${mesaNumber}`, 'true');
  } catch (err) {
    console.warn('Error guardando sesión de mesa en localStorage:', err);
  }

  return resolvedSessionId;
}

export async function actualizarTelefonoMesaActiva(params: {
  mesaNumber: number;
  celular: string;
}): Promise<void> {
  const { mesaNumber, celular } = params;
  const cleanPhone = celular.replace(/\D/g, '').slice(0, 8);
  const nowIso = new Date().toISOString();

  try {
    if (cleanPhone) {
      localStorage.setItem('churo_celular', cleanPhone);
    } else {
      localStorage.removeItem('churo_celular');
    }
  } catch {
    // ignore
  }

  try {
    await setDoc(
      doc(db, 'mesas_activas', `mesa_${mesaNumber}`),
      {
        mesa: Number(mesaNumber),
        cliente_celular: cleanPhone || null,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Error actualizando teléfono en mesas_activas:', err);
  }

  if (cleanPhone) {
    try {
      await setDoc(
        doc(db, 'clientes', cleanPhone),
        {
          celular: cleanPhone,
          ultima_mesa: Number(mesaNumber),
          updatedAt: nowIso,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Error actualizando documento clientes:', err);
    }
  }
}

export async function liberarMesaYReiniciarSesion(params: {
  tableId: number;
  tableName?: string;
  tableSeats?: number;
  ordersToClose: Order[];
  method?: 'QR' | 'EFECTIVO';
  discountBs?: number;
}): Promise<void> {
  const {
    tableId,
    tableName,
    tableSeats = 4,
    ordersToClose,
    method = 'EFECTIVO',
    discountBs = 0,
  } = params;

  const paidAtStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // 1. Marcar todos los pedidos activos de la mesa como pagados/archivados
  for (let i = 0; i < ordersToClose.length; i++) {
    const order = ordersToClose[i];
    const cleanDiscount = i === 0 ? Math.max(0, Math.min(discountBs, order.total)) : 0;
    const finalTotal = Number((order.total - cleanDiscount).toFixed(2));
    await updateDoc(doc(db, 'pedidos', order.id), {
      status: 'pagado',
      paidAt: paidAtStr,
      paymentMethod: method,
      ...(cleanDiscount > 0 ? { discountBs: cleanDiscount, total: finalTotal } : {}),
    });
  }

  // 2. Cambiar estado de la mesa a 'libre' / 'free' y resetear sesionActivaId en Firestore
  await setDoc(
    doc(db, 'mesas', String(tableId)),
    {
      id: Number(tableId),
      name: tableName || `Mesa ${tableId}`,
      seats: tableSeats,
      status: 'free',
      estado: 'libre',
      currentOrder: null,
      sesionActivaId: null,
      liberadaAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 3. Limpiar / eliminar documento de sesión en mesas_activas/{mesaId}
  try {
    await deleteDoc(doc(db, 'mesas_activas', `mesa_${tableId}`));
  } catch (delErr) {
    console.warn('Error al eliminar mesas_activas al liberar mesa:', delErr);
  }
}
