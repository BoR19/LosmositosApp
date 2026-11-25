import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase.ts';
import {
  Collaborator,
  PermissionKey,
  SecurityConfig,
  StaffCargo,
  StaffSession,
} from '../types/index.ts';

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'mesas',
  'cocina',
  'caja',
  'menu_admin',
  'reportes',
];

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  shortLabel: string;
  description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: 'mesas',
    label: 'Mesas y Comandas',
    shortLabel: 'Mesas y Comandas',
    description: 'Acceso al mapa de mesas, tomar pedidos y mover comandas.',
  },
  {
    key: 'cocina',
    label: 'Cocina (KDS)',
    shortLabel: 'Cocina (KDS)',
    description: 'Ver pedidos en tiempo real en el tablero de cocina y cambiar estados de preparación.',
  },
  {
    key: 'caja',
    label: 'Caja y Cobros',
    shortLabel: 'Caja y Cobros',
    description: 'Cobrar pedidos, cerrar cuentas y liberar mesas.',
  },
  {
    key: 'menu_admin',
    label: 'Menú e Inventario (Admin)',
    shortLabel: 'Menú e Inventario',
    description: 'Editar platos, precios, stock/inventario y marcar agotados.',
  },
  {
    key: 'reportes',
    label: 'Reportes e Historial',
    shortLabel: 'Reportes e Historial',
    description: 'Consultar ventas cobradas y descargar reportes.',
  },
];

export const DEFAULT_PERMISSIONS_BY_CARGO: Record<StaffCargo, PermissionKey[]> = {
  Mozo: ['mesas'],
  Cocina: ['cocina'],
  Cajero: ['mesas', 'caja', 'reportes'],
};

export function normalizePermisos(raw: unknown): PermissionKey[] {
  if (Array.isArray(raw)) {
    return raw.filter((k): k is PermissionKey =>
      ALL_PERMISSION_KEYS.includes(k as PermissionKey)
    );
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return ALL_PERMISSION_KEYS.filter((k) => Boolean(obj[k]));
  }
  return [];
}

export function getPermissionLabel(key: PermissionKey): string {
  return PERMISSION_DEFINITIONS.find((p) => p.key === key)?.shortLabel || key;
}

export function isValidFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(pin.trim());
}

export function hasPermission(
  session: StaffSession | null,
  permission: PermissionKey,
  isGoogleAdmin: boolean = false
): boolean {
  if (isGoogleAdmin) return true;
  if (!session) return false;
  if (session.isMasterAdmin || session.role === 'admin') return true;
  return Array.isArray(session.permisos) && session.permisos.includes(permission);
}

export function isGoogleUserAdmin(
  email: string | null | undefined,
  securityConfig: SecurityConfig
): boolean {
  if (!email) return false;
  const admins = securityConfig.adminsGoogle || [];
  if (admins.length === 0) {
    // Si aún no se configuró una lista blanca explícita en configuracion/seguridad,
    // cualquier cuenta Google autenticada en el proyecto se considera autorizada.
    return true;
  }
  const cleanEmail = email.trim().toLowerCase();
  return admins.some((e) => e.trim().toLowerCase() === cleanEmail);
}

const SECURITY_DOC_REF = () => doc(db, 'configuracion', 'seguridad');
const COLLABORATORS_COL_REF = () => collection(db, 'colaboradores');

export async function ensureSecurityConfigInitialized(): Promise<SecurityConfig> {
  const ref = SECURITY_DOC_REF();
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        pinMaestro: typeof data.pinMaestro === 'string' && /^\d{4}$/.test(data.pinMaestro)
          ? data.pinMaestro
          : '7777',
        adminsGoogle: Array.isArray(data.adminsGoogle) ? data.adminsGoogle : [],
        updatedAt: data.updatedAt,
      };
    }
    const initialConfig: SecurityConfig = {
      pinMaestro: '7777',
      adminsGoogle: [],
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initialConfig, { merge: true });
    return { pinMaestro: '7777', adminsGoogle: [] };
  } catch (error) {
    console.warn('Error leyendo/inicializando configuracion/seguridad:', error);
    return { pinMaestro: '7777', adminsGoogle: [] };
  }
}

export function subscribeSecurityConfig(
  onUpdate: (config: SecurityConfig) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    SECURITY_DOC_REF(),
    async (snap) => {
      if (!snap.exists()) {
        const defaultConfig: SecurityConfig = {
          pinMaestro: '7777',
          adminsGoogle: [],
          updatedAt: serverTimestamp(),
        };
        try {
          await setDoc(SECURITY_DOC_REF(), defaultConfig, { merge: true });
        } catch (err) {
          console.warn('No se pudo crear configuracion/seguridad inicial:', err);
        }
        onUpdate({ pinMaestro: '7777', adminsGoogle: [] });
        return;
      }
      const data = snap.data();
      onUpdate({
        pinMaestro:
          typeof data.pinMaestro === 'string' && /^\d{4}$/.test(data.pinMaestro)
            ? data.pinMaestro
            : '7777',
        adminsGoogle: Array.isArray(data.adminsGoogle)
          ? data.adminsGoogle.filter((e): e is string => typeof e === 'string')
          : [],
        updatedAt: data.updatedAt,
      });
    },
    (error) => {
      console.log('Usando localStorage fallback (configuracion/seguridad):', error);
      if (onError) onError(error);
    }
  );
}

export function subscribeCollaborators(
  onUpdate: (collaborators: Collaborator[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    COLLABORATORS_COL_REF(),
    (snapshot) => {
      const list: Collaborator[] = snapshot.docs.map((d) => {
        const data = d.data();
        const rawCargo = data.cargo;
        const cargo: StaffCargo =
          rawCargo === 'Cocina' || rawCargo === 'Cajero' ? rawCargo : 'Mozo';
        return {
          id: d.id,
          nombre: String(data.nombre || 'Colaborador'),
          cargo,
          pin: String(data.pin || ''),
          activo: data.activo !== false,
          permisos: normalizePermisos(data.permisos),
          creadoEn: data.creadoEn,
          actualizadoEn: data.actualizadoEn,
        };
      });

      list.sort((a, b) => {
        const tA = a.creadoEn?.toMillis ? a.creadoEn.toMillis() : 0;
        const tB = b.creadoEn?.toMillis ? b.creadoEn.toMillis() : 0;
        return tB - tA || a.nombre.localeCompare(b.nombre);
      });

      onUpdate(list);
    },
    (error) => {
      console.log('Usando localStorage fallback (colaboradores):', error);
      if (onError) onError(error);
    }
  );
}

export async function updateMasterPin(
  newPin: string,
  existingCollaborators: Collaborator[]
): Promise<void> {
  const cleanPin = newPin.trim();
  if (!isValidFourDigitPin(cleanPin)) {
    throw new Error('El PIN Maestro debe tener exactamente 4 dígitos numéricos.');
  }
  const conflict = existingCollaborators.find((c) => c.pin === cleanPin);
  if (conflict) {
    throw new Error(
      `El PIN ${cleanPin} ya está asignado a "${conflict.nombre}". Elige otro PIN distinto.`
    );
  }
  await setDoc(
    SECURITY_DOC_REF(),
    {
      pinMaestro: cleanPin,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function updateAuthorizedGoogleAdmins(emails: string[]): Promise<void> {
  const cleanEmails = Array.from(
    new Set(
      emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes('@'))
    )
  );
  await setDoc(
    SECURITY_DOC_REF(),
    {
      adminsGoogle: cleanEmails,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export interface CollaboratorPayload {
  nombre: string;
  cargo: StaffCargo;
  pin: string;
  activo: boolean;
  permisos: PermissionKey[];
}

export async function createCollaborator(
  payload: CollaboratorPayload,
  masterPin: string,
  existingCollaborators: Collaborator[]
): Promise<string> {
  const cleanName = payload.nombre.trim();
  const cleanPin = payload.pin.trim();

  if (!cleanName) {
    throw new Error('Ingresa el nombre completo del colaborador.');
  }
  if (!isValidFourDigitPin(cleanPin)) {
    throw new Error('El PIN debe tener exactamente 4 dígitos numéricos.');
  }
  if (cleanPin === masterPin) {
    throw new Error('El PIN del colaborador no puede ser igual al PIN Maestro de Administrador.');
  }
  const duplicate = existingCollaborators.find((c) => c.pin === cleanPin);
  if (duplicate) {
    throw new Error(`El PIN ${cleanPin} ya está en uso por "${duplicate.nombre}".`);
  }
  if (payload.permisos.length === 0) {
    throw new Error('Selecciona al menos un permiso habilitado para el colaborador.');
  }

  const docRef = await addDoc(COLLABORATORS_COL_REF(), {
    nombre: cleanName,
    cargo: payload.cargo,
    pin: cleanPin,
    activo: payload.activo,
    permisos: payload.permisos,
    creadoEn: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCollaborator(
  id: string,
  payload: CollaboratorPayload,
  masterPin: string,
  existingCollaborators: Collaborator[]
): Promise<void> {
  const cleanName = payload.nombre.trim();
  const cleanPin = payload.pin.trim();

  if (!cleanName) {
    throw new Error('Ingresa el nombre completo del colaborador.');
  }
  if (!isValidFourDigitPin(cleanPin)) {
    throw new Error('El PIN debe tener exactamente 4 dígitos numéricos.');
  }
  if (cleanPin === masterPin) {
    throw new Error('El PIN del colaborador no puede ser igual al PIN Maestro de Administrador.');
  }
  const duplicate = existingCollaborators.find((c) => c.id !== id && c.pin === cleanPin);
  if (duplicate) {
    throw new Error(`El PIN ${cleanPin} ya está en uso por "${duplicate.nombre}".`);
  }
  if (payload.permisos.length === 0) {
    throw new Error('Selecciona al menos un permiso habilitado para el colaborador.');
  }

  await updateDoc(doc(db, 'colaboradores', id), {
    nombre: cleanName,
    cargo: payload.cargo,
    pin: cleanPin,
    activo: payload.activo,
    permisos: payload.permisos,
    actualizadoEn: serverTimestamp(),
  });
}

export async function toggleCollaboratorStatus(id: string, activo: boolean): Promise<void> {
  await updateDoc(doc(db, 'colaboradores', id), {
    activo,
    actualizadoEn: serverTimestamp(),
  });
}

export async function deleteCollaborator(id: string): Promise<void> {
  await deleteDoc(doc(db, 'colaboradores', id));
}

export type PinAuthResult =
  | { ok: true; session: StaffSession }
  | { ok: false; error: string };

export async function authenticateStaffWithPin(rawPin: string): Promise<PinAuthResult> {
  const cleanPin = rawPin.trim();
  if (!isValidFourDigitPin(cleanPin)) {
    return { ok: false, error: 'Ingresa un PIN numérico de 4 dígitos.' };
  }

  const securityConfig = await ensureSecurityConfigInitialized();

  // 1. Verificar si coincide con el PIN Maestro de Administrador en configuracion/seguridad
  if (cleanPin === securityConfig.pinMaestro) {
    return {
      ok: true,
      session: {
        name: 'Administrador',
        role: 'admin',
        cargo: 'Administrador',
        isMasterAdmin: true,
        authType: 'pin',
        permisos: [...ALL_PERMISSION_KEYS],
        sessionPin: cleanPin,
      },
    };
  }

  // 2. Buscar en la colección colaboradores de Firestore
  try {
    const snap = await getDocs(COLLABORATORS_COL_REF());
    const matchedDoc = snap.docs.find((d) => String(d.data().pin || '').trim() === cleanPin);

    if (!matchedDoc) {
      return { ok: false, error: 'PIN incorrecto o no registrado.' };
    }

    const data = matchedDoc.data();
    if (data.activo === false) {
      return {
        ok: false,
        error: 'Tu cuenta de colaborador está desactivada. Contacta al Administrador.',
      };
    }

    const rawCargo = data.cargo;
    const cargo: StaffCargo =
      rawCargo === 'Cocina' || rawCargo === 'Cajero' ? rawCargo : 'Mozo';
    const permisos = normalizePermisos(data.permisos);

    return {
      ok: true,
      session: {
        name: String(data.nombre || cargo),
        role: 'staff',
        cargo,
        isMasterAdmin: false,
        collaboratorId: matchedDoc.id,
        authType: 'pin',
        permisos,
        sessionPin: cleanPin,
      },
    };
  } catch (error) {
    console.error('Error al validar PIN contra Firestore:', error);
    return {
      ok: false,
      error: 'No se pudo verificar el PIN en la nube. Revisa tu conexión.',
    };
  }
}
