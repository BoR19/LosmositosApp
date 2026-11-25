import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  UserPlus,
  Pencil,
  Trash2,
  Check,
  X,
  Save,
  AlertCircle,
  Mail,
  Plus,
} from 'lucide-react';
import {
  Collaborator,
  PermissionKey,
  SecurityConfig,
  StaffCargo,
} from '../types/index.ts';
import {
  PERMISSION_DEFINITIONS,
  DEFAULT_PERMISSIONS_BY_CARGO,
  getPermissionLabel,
  isValidFourDigitPin,
  updateMasterPin,
  updateAuthorizedGoogleAdmins,
  createCollaborator,
  updateCollaborator,
  toggleCollaboratorStatus,
  deleteCollaborator,
} from '../services/staffSecurityService.ts';

interface EquipoYPermisosProps {
  isAdminAuthenticated: boolean;
  securityConfig: SecurityConfig;
  collaborators: Collaborator[];
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onMasterPinUpdated?: (newPin: string) => void;
}

const CARGOS: StaffCargo[] = ['Mozo', 'Cajero', 'Cocina'];

export const EquipoYPermisos: React.FC<EquipoYPermisosProps> = ({
  isAdminAuthenticated,
  securityConfig,
  collaborators,
  showToast,
  onMasterPinUpdated,
}) => {
  // Defense-in-depth: never render for non-administrators
  if (!isAdminAuthenticated) return null;

  // Master PIN state
  const [masterPinInput, setMasterPinInput] = useState(securityConfig.pinMaestro || '7777');
  const [showMasterPin, setShowMasterPin] = useState(false);
  const [isUpdatingMasterPin, setIsUpdatingMasterPin] = useState(false);

  // Optional Google Admins panel state
  const [showGoogleAdmins, setShowGoogleAdmins] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isSavingEmails, setIsSavingEmails] = useState(false);

  // Form state (Create / Edit Collaborator)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [cargo, setCargo] = useState<StaffCargo>('Mozo');
  const [pin, setPin] = useState('');
  const [activo, setActivo] = useState(true);
  const [permisos, setPermisos] = useState<PermissionKey[]>(DEFAULT_PERMISSIONS_BY_CARGO.Mozo);
  const [hasCustomizedPerms, setHasCustomizedPerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Right list states (PIN visibility per row + delete confirmation)
  const [visiblePins, setVisiblePins] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMasterPinInput(securityConfig.pinMaestro || '7777');
  }, [securityConfig.pinMaestro]);

  const activeCount = useMemo(
    () => collaborators.filter((c) => c.activo).length,
    [collaborators]
  );

  // Live PIN validation feedback for collaborator form
  const pinValidationError = useMemo(() => {
    const clean = pin.trim();
    if (!clean) return null;
    if (!/^\d{4}$/.test(clean)) {
      return 'El PIN debe ser numérico de exactamente 4 dígitos.';
    }
    if (clean === securityConfig.pinMaestro) {
      return 'No puede ser igual al PIN Maestro de Administrador.';
    }
    const conflict = collaborators.find(
      (c) => c.pin === clean && c.id !== editingId
    );
    if (conflict) {
      return `PIN ya asignado a "${conflict.nombre}".`;
    }
    return null;
  }, [pin, securityConfig.pinMaestro, collaborators, editingId]);

  const resetForm = () => {
    setEditingId(null);
    setNombre('');
    setCargo('Mozo');
    setPin('');
    setActivo(true);
    setPermisos(DEFAULT_PERMISSIONS_BY_CARGO.Mozo);
    setHasCustomizedPerms(false);
    setFormError(null);
  };

  const handleSelectCargo = (selectedCargo: StaffCargo) => {
    setCargo(selectedCargo);
    if (!editingId && !hasCustomizedPerms) {
      setPermisos(DEFAULT_PERMISSIONS_BY_CARGO[selectedCargo]);
    }
  };

  const handleTogglePermission = (key: PermissionKey) => {
    setHasCustomizedPerms(true);
    setPermisos((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleMasterPinUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = masterPinInput.trim();
    if (!isValidFourDigitPin(clean)) {
      showToast('El PIN Maestro debe tener 4 dígitos numéricos.', 'error');
      return;
    }
    setIsUpdatingMasterPin(true);
    try {
      await updateMasterPin(clean, collaborators);
      if (onMasterPinUpdated) onMasterPinUpdated(clean);
      showToast('PIN Maestro de Administrador actualizado en tiempo real.');
    } catch (err: any) {
      showToast(err?.message || 'Error al actualizar el PIN Maestro.', 'error');
    } finally {
      setIsUpdatingMasterPin(false);
    }
  };

  const handleAddGoogleAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showToast('Ingresa un correo Google válido.', 'error');
      return;
    }
    setIsSavingEmails(true);
    try {
      const current = securityConfig.adminsGoogle || [];
      await updateAuthorizedGoogleAdmins([...current, email]);
      setNewAdminEmail('');
      showToast(`Correo "${email}" autorizado como Administrador.`);
    } catch (err: any) {
      showToast(err?.message || 'Error al guardar correo autorizado.', 'error');
    } finally {
      setIsSavingEmails(false);
    }
  };

  const handleRemoveGoogleAdmin = async (emailToRemove: string) => {
    setIsSavingEmails(true);
    try {
      const updated = (securityConfig.adminsGoogle || []).filter(
        (e) => e.toLowerCase() !== emailToRemove.toLowerCase()
      );
      await updateAuthorizedGoogleAdmins(updated);
      showToast(`Correo "${emailToRemove}" removido de administradores.`);
    } catch (err: any) {
      showToast(err?.message || 'Error al remover correo.', 'error');
    } finally {
      setIsSavingEmails(false);
    }
  };

  const handleSubmitCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (pinValidationError) {
      setFormError(pinValidationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        cargo,
        pin: pin.trim(),
        activo,
        permisos,
      };

      if (editingId) {
        await updateCollaborator(
          editingId,
          payload,
          securityConfig.pinMaestro,
          collaborators
        );
        showToast(`Colaborador "${payload.nombre}" actualizado.`);
      } else {
        await createCollaborator(
          payload,
          securityConfig.pinMaestro,
          collaborators
        );
        showToast(`Colaborador "${payload.nombre}" registrado.`);
      }
      resetForm();
    } catch (err: any) {
      const msg = err?.message || 'No se pudo guardar el colaborador.';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (collab: Collaborator) => {
    setEditingId(collab.id);
    setNombre(collab.nombre);
    setCargo(collab.cargo);
    setPin(collab.pin);
    setActivo(collab.activo);
    setPermisos(collab.permisos);
    setHasCustomizedPerms(true);
    setFormError(null);
  };

  const handleQuickToggleStatus = async (collab: Collaborator) => {
    try {
      await toggleCollaboratorStatus(collab.id, !collab.activo);
      showToast(
        `${collab.nombre} ${!collab.activo ? 'activado' : 'desactivado'}.`
      );
    } catch (err: any) {
      showToast(err?.message || 'Error al cambiar estado.', 'error');
    }
  };

  const handleConfirmDelete = async (collab: Collaborator) => {
    setIsDeletingId(collab.id);
    try {
      await deleteCollaborator(collab.id);
      if (editingId === collab.id) resetForm();
      setConfirmDeleteId(null);
      showToast(`Colaborador "${collab.nombre}" eliminado.`);
    } catch (err: any) {
      showToast(err?.message || 'Error al eliminar colaborador.', 'error');
    } finally {
      setIsDeletingId(null);
    }
  };

  const googleAdmins = securityConfig.adminsGoogle || [];
  const masterPinChanged =
    masterPinInput.trim() !== (securityConfig.pinMaestro || '7777');

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabecera Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-xl sm:text-2xl font-serif font-extrabold tracking-tight text-[#f5efe6] flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#ff7a00]" />
            <span>Equipo y Permisos</span>
          </h3>
          <p className="text-xs sm:text-sm text-[#a8a29e]">
            Administra los accesos por PIN de 4 dígitos y define qué módulos puede usar cada colaborador.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <span className="px-3.5 py-1.5 rounded-full bg-[#292524] border border-[#3a3632] text-xs font-bold text-[#ff7a00] tabular-nums">
            {activeCount} {activeCount === 1 ? 'activo' : 'activos'} de {collaborators.length}
          </span>
        </div>
      </div>

      {/* Sección Superior: PIN Maestro de Administrador */}
      <div className="bg-[#292524] border border-[#3a3632] rounded-[20px] p-4 sm:p-5 space-y-4 shadow-md">
        <form
          onSubmit={handleMasterPinUpdate}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff7a00]/15 border border-[#ff7a00]/30 text-[#ff7a00] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-[#f5efe6]">
                PIN maestro de Administrador
              </h4>
              <p className="text-xs text-[#a8a29e]">
                Otorga acceso total a ventas, menú, reportes y gestión de equipo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <div className="relative">
              <input
                type={showMasterPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                value={masterPinInput}
                onChange={(e) =>
                  setMasterPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                aria-label="PIN maestro de Administrador"
                className="w-32 bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl pl-3.5 pr-9 py-2.5 text-sm font-mono font-bold tracking-[0.3em] text-[#ff7a00] text-center focus:outline-none transition-colors tabular-nums"
              />
              <button
                type="button"
                onClick={() => setShowMasterPin((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a8a29e] hover:text-[#f5efe6] transition-colors cursor-pointer"
                title={showMasterPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                aria-label={showMasterPin ? 'Ocultar PIN' : 'Mostrar PIN'}
              >
                {showMasterPin ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={isUpdatingMasterPin || !isValidFourDigitPin(masterPinInput)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                masterPinChanged
                  ? 'bg-[#ff7a00] hover:bg-[#ff8c1a] text-white shadow-[0_4px_14px_rgba(255,122,0,0.35)]'
                  : 'bg-[#3a3632] hover:bg-[#ff7a00] text-[#f5efe6] hover:text-white'
              }`}
            >
              {isUpdatingMasterPin ? 'Guardando...' : 'Actualizar PIN'}
            </button>

            <button
              type="button"
              onClick={() => setShowGoogleAdmins((v) => !v)}
              className="p-2.5 rounded-xl bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] text-[#a8a29e] hover:text-[#f5efe6] transition-colors cursor-pointer"
              title="Gestionar cuentas Google autorizadas"
              aria-label="Gestionar cuentas Google autorizadas"
            >
              <Mail className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Gestión opcional de Admins Google */}
        {showGoogleAdmins && (
          <div className="pt-4 border-t border-[#3a3632] space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-[#f5efe6]">
                  Correos Google autorizados como Administrador (Opcional)
                </p>
                <p className="text-[11px] text-[#a8a29e]">
                  {googleAdmins.length === 0
                    ? 'Sin lista definida: cualquier cuenta Google autenticada en el proyecto puede ingresar como Admin.'
                    : 'Solo las cuentas listadas aquí podrán ingresar con Cuenta Google como Administrador.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleAddGoogleAdmin} className="flex gap-2">
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="correo-admin@gmail.com"
                className="flex-1 bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl px-3.5 py-2 text-xs text-[#f5efe6] placeholder-[#57534e] focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSavingEmails || !newAdminEmail.trim()}
                className="px-3.5 py-2 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Autorizar</span>
              </button>
            </form>

            {googleAdmins.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {googleAdmins.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#1c1917] border border-[#3a3632] text-xs text-[#f5efe6]"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveGoogleAdmin(email)}
                      disabled={isSavingEmails}
                      className="text-[#a8a29e] hover:text-red-400 cursor-pointer"
                      aria-label={`Remover ${email}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid Principal de 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: + Nuevo colaborador / Modo Edición */}
        <form
          onSubmit={handleSubmitCollaborator}
          className="lg:col-span-5 bg-[#292524] border border-[#3a3632] rounded-[20px] p-5 sm:p-6 space-y-5 shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-lg font-serif font-bold text-[#f5efe6] flex items-center gap-2">
              {editingId ? (
                <>
                  <Pencil className="w-4 h-4 text-[#ff7a00]" />
                  <span>Editar colaborador</span>
                </>
              ) : (
                <>
                  <span className="text-[#ff7a00] font-sans text-xl leading-none">+</span>
                  <span>Nuevo colaborador</span>
                </>
              )}
            </h4>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-[#a8a29e] hover:text-[#f5efe6] px-2.5 py-1 rounded-lg bg-[#1c1917] border border-[#3a3632] cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>

          {/* Nombre completo */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#a8a29e]">
              Nombre completo
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. María (Caja)"
              maxLength={80}
              required
              className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] rounded-xl px-3.5 py-2.5 text-sm text-[#f5efe6] placeholder-[#57534e] focus:outline-none transition-colors"
            />
          </div>

          {/* Cargo (píldora) + PIN de 4 dígitos */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-7 space-y-1.5">
              <label className="block text-xs font-semibold text-[#a8a29e]">
                Cargo
              </label>
              <div className="grid grid-cols-3 p-1 rounded-xl bg-[#1c1917] border border-[#3a3632] gap-1">
                {CARGOS.map((c) => {
                  const selected = cargo === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleSelectCargo(c)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        selected
                          ? 'bg-[#ff7a00] text-white shadow-sm'
                          : 'text-[#a8a29e] hover:text-[#f5efe6]'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <label className="block text-xs font-semibold text-[#a8a29e]">
                PIN de 4 dígitos
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#ff7a00] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="4 dígitos"
                  required
                  className={`w-full bg-[#1c1917] border rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono font-bold text-[#f5efe6] placeholder-[#57534e] focus:outline-none transition-colors tabular-nums ${
                    pinValidationError
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-[#3a3632] focus:border-[#ff7a00]'
                  }`}
                />
              </div>
            </div>
          </div>

          {pinValidationError && (
            <p className="text-[11px] text-red-400 flex items-center gap-1.5 -mt-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{pinValidationError}</span>
            </p>
          )}

          {/* Estado de acceso */}
          <div className="flex items-center justify-between bg-[#1c1917] border border-[#3a3632] rounded-xl px-4 py-2.5">
            <span className="text-xs font-semibold text-[#f5efe6]">
              Estado de acceso
            </span>
            <button
              type="button"
              onClick={() => setActivo((prev) => !prev)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                activo
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
              }`}
            >
              {activo ? 'Activo' : 'Inactivo'}
            </button>
          </div>

          {/* Permisos habilitados */}
          <div className="space-y-2.5">
            <span className="block text-xs font-bold text-[#ff7a00]">
              Permisos habilitados
            </span>

            <div className="bg-[#1c1917] border border-[#3a3632] rounded-xl divide-y divide-[#3a3632] overflow-hidden">
              {PERMISSION_DEFINITIONS.map((perm) => {
                const isChecked = permisos.includes(perm.key);
                return (
                  <button
                    key={perm.key}
                    type="button"
                    onClick={() => handleTogglePermission(perm.key)}
                    className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#292524]/60 transition-colors cursor-pointer"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold text-[#f5efe6]">
                        {perm.label}
                      </p>
                      <p className="text-[11px] text-[#a8a29e] leading-snug">
                        {perm.description}
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        isChecked
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-[#292524] border-[#3a3632] text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Botón Principal de Envío */}
          <button
            type="submit"
            disabled={isSubmitting || Boolean(pinValidationError)}
            className="w-full py-3 px-4 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] active:scale-[0.99] text-white font-bold text-sm shadow-[0_4px_20px_rgba(255,122,0,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {editingId ? (
              <>
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Guardando cambios...' : 'Guardar cambios'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Registrando...' : 'Registrar colaborador'}</span>
              </>
            )}
          </button>
        </form>

        {/* Columna Derecha: Personal registrado */}
        <div className="lg:col-span-7 bg-[#292524] border border-[#3a3632] rounded-[20px] p-5 sm:p-6 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-[#3a3632] pb-3.5">
            <h4 className="text-lg font-serif font-bold text-[#f5efe6]">
              Personal registrado
            </h4>
            <span className="text-xs text-[#a8a29e] tabular-nums">
              {collaborators.length} {collaborators.length === 1 ? 'miembro' : 'miembros'}
            </span>
          </div>

          {collaborators.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2 bg-[#1c1917] rounded-2xl border border-[#3a3632]">
              <Users className="w-10 h-10 text-[#ff7a00]/50 mx-auto" />
              <p className="text-sm font-bold text-[#f5efe6]">
                Aún no hay colaboradores registrados
              </p>
              <p className="text-xs text-[#a8a29e] max-w-sm mx-auto">
                Registra a tu equipo de mozos, cocina y caja en el formulario de la izquierda para asignarles un PIN único y sus permisos.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#3a3632]">
              {collaborators.map((collab) => {
                const isPinVisible = Boolean(visiblePins[collab.id]);
                const isConfirmingDelete = confirmDeleteId === collab.id;

                return (
                  <div
                    key={collab.id}
                    className={`py-4 first:pt-1 last:pb-1 space-y-3 transition-opacity ${
                      !collab.activo ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-bold text-[#f5efe6]">
                            {collab.nombre}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#ff7a00]/15 border border-[#ff7a00]/30 text-[11px] font-semibold text-[#ff7a00]">
                            {collab.cargo}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickToggleStatus(collab)}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                              collab.activo
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
                            }`}
                            title="Clic para activar o desactivar acceso inmediatamente"
                          >
                            {collab.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </div>

                        {/* PIN oculto con ícono de ojo */}
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[#a8a29e]">PIN:</span>
                          <span className="font-mono font-bold text-[#ff7a00] tracking-widest tabular-nums">
                            {isPinVisible ? collab.pin : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setVisiblePins((prev) => ({
                                ...prev,
                                [collab.id]: !prev[collab.id],
                              }))
                            }
                            className="p-1 rounded-md text-[#a8a29e] hover:text-[#f5efe6] hover:bg-[#1c1917] transition-colors cursor-pointer"
                            title={isPinVisible ? 'Ocultar PIN' : 'Mostrar PIN'}
                            aria-label={isPinVisible ? 'Ocultar PIN' : 'Mostrar PIN'}
                          >
                            {isPinVisible ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Botones Editar y Eliminar (con confirmación) */}
                      <div className="flex items-center gap-2 shrink-0 self-start">
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1.5 bg-red-950/60 border border-red-500/40 rounded-lg px-2.5 py-1">
                            <span className="text-[11px] font-semibold text-red-200 mr-1">
                              ¿Eliminar?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(collab)}
                              disabled={isDeletingId === collab.id}
                              className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                            >
                              {isDeletingId === collab.id ? '...' : 'Sí'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 rounded bg-[#1c1917] hover:bg-[#3a3632] text-[#a8a29e] hover:text-white text-[11px] font-bold cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(collab)}
                              className="px-3 py-1.5 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00]/50 text-xs font-semibold text-[#f5efe6] flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#ff7a00]" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(collab.id)}
                              className="p-1.5 rounded-lg bg-[#1c1917] hover:bg-red-950/60 border border-[#3a3632] hover:border-red-500/40 text-[#a8a29e] hover:text-red-400 transition-colors cursor-pointer"
                              title="Eliminar colaborador"
                              aria-label={`Eliminar a ${collab.nombre}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Etiquetas de permisos asignados */}
                    <div className="flex flex-wrap gap-1.5">
                      {collab.permisos.map((permKey) => (
                        <span
                          key={`${collab.id}-${permKey}`}
                          className="px-2.5 py-1 rounded-lg bg-[#1c1917] border border-[#3a3632] text-[11px] font-medium text-[#d6d3d1]"
                        >
                          {getPermissionLabel(permKey)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
