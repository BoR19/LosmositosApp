import React from 'react';
import {
  Utensils, QrCode, ChefHat, Layers, Bell, LogOut, CheckCheck, ShieldCheck
} from 'lucide-react';
import { RestaurantProfile, WaiterCall } from '../types/index.ts';

interface PosSidebarProps {
  restaurantProfile: RestaurantProfile;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isAdminAuthenticated: boolean;
  canAccessTables: boolean;
  canAccessKitchen: boolean;
  canAccessAdminTab: boolean;
  pendingKitchenCount: number;
  pendingChangeRequestsCount: number;
  waiterCalls: WaiterCall[];
  onAttendWaiterCall: (callId: string) => void;
  staffDisplayName: string;
  staffRoleLabel: string;
  onLogout: () => void;
}

export const PosSidebar: React.FC<PosSidebarProps> = ({
  restaurantProfile,
  activeTab,
  onSelectTab,
  isAdminAuthenticated,
  canAccessTables,
  canAccessKitchen,
  canAccessAdminTab,
  pendingKitchenCount,
  pendingChangeRequestsCount,
  waiterCalls,
  onAttendWaiterCall,
  staffDisplayName,
  staffRoleLabel,
  onLogout,
}) => {
  const navItems = [
    { id: 'menu', label: 'Menú', icon: Utensils, allowed: true },
    { id: 'tables', label: 'Mesas', icon: QrCode, allowed: isAdminAuthenticated || canAccessTables },
    { id: 'kitchen', label: 'Cocina', icon: ChefHat, allowed: isAdminAuthenticated || canAccessKitchen },
    {
      id: 'admin',
      label: isAdminAuthenticated ? 'Admin / Equipo' : 'Admin',
      icon: Layers,
      allowed: isAdminAuthenticated || canAccessAdminTab,
    },
  ].filter((item) => item.allowed);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:h-full lg:overflow-hidden bg-[#171412] border-r border-[#3a3632] select-none">
      {/* Logo y Nombre Real del Restaurante */}
      <div className="p-5 border-b border-[#3a3632] flex items-center gap-3 shrink-0">
        <div
          className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0 overflow-hidden shadow-lg"
          style={{
            backgroundColor: restaurantProfile.colorPrimario || '#ff7a00',
            boxShadow: `0 6px 20px ${(restaurantProfile.colorPrimario || '#ff7a00')}40`,
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
            <Utensils className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold tracking-tight text-[#f5efe6] font-serif leading-tight truncate">
            {restaurantProfile.nombre || 'El Churo Mosito'}
          </h1>
          <p className="text-[10px] text-[#a8a29e] tracking-[0.06em] uppercase font-medium truncate">
            Modo POS • Salón
          </p>
        </div>
      </div>

      {/* Navegación Real Filtrada por Permisos */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-6 min-h-0 pos-scrollbar">
        <nav className="space-y-1.5" aria-label="Navegación POS">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-[14px] text-[13px] font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#ff7a00] text-white shadow-[0_6px_20px_rgba(255,122,0,0.35)]'
                    : 'text-[#a8a29e] hover:text-[#f5efe6] hover:bg-[#292524]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>

                {item.id === 'tables' && pendingChangeRequestsCount > 0 && (
                  <span className="px-1.5 min-w-[20px] h-5 rounded-full bg-amber-400 text-black text-[10px] font-black flex items-center justify-center">
                    {pendingChangeRequestsCount}
                  </span>
                )}
                {item.id === 'kitchen' && pendingKitchenCount > 0 && (
                  <span
                    className={`px-1.5 min-w-[20px] h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                      isActive ? 'bg-black/30 text-white' : 'bg-amber-500 text-black'
                    }`}
                  >
                    {pendingKitchenCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Indicador en Tiempo Real de Llamadas de Mesa (Colección llamadas) */}
        <div className="rounded-[16px] bg-[#292524] border border-[#3a3632] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#f5efe6] flex items-center gap-1.5">
              <Bell className={`w-3.5 h-3.5 ${waiterCalls.length > 0 ? 'text-[#ff7a00] animate-bounce' : 'text-[#a8a29e]'}`} />
              <span>Llamadas de Mesa</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black tabular-nums ${
                waiterCalls.length > 0
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-[#1c1917] text-[#a8a29e] border border-[#3a3632]'
              }`}
            >
              {waiterCalls.length}
            </span>
          </div>

          {waiterCalls.length === 0 ? (
            <p className="text-[11px] text-[#78716c] leading-snug">
              Sin llamadas activas en salón.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5 pos-scrollbar">
              {waiterCalls.slice(0, 5).map((call) => (
                <div
                  key={`sidebar-call-${call.id}`}
                  className="bg-[#1c1917] border border-[#3a3632] rounded-xl p-2 flex items-center justify-between gap-2 text-[11px]"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[#f5efe6] truncate">{call.tableName}</p>
                    <p className="text-[10px] text-amber-300 truncate">
                      {call.type === 'mozo' ? 'Llama al mozo' : 'Pide la cuenta'} • {call.time}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAttendWaiterCall(call.id)}
                    className="p-1.5 rounded-lg bg-[#292524] hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Marcar llamada como atendida"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bloque Inferior: Colaborador Conectado y Cerrar Sesión */}
      <div className="p-3.5 border-t border-[#3a3632] bg-[#1c1917]/80 space-y-2.5 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="w-8 h-8 rounded-xl bg-[#ff7a00]/15 border border-[#ff7a00]/30 text-[#ff7a00] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#f5efe6] truncate">{staffDisplayName}</p>
            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide truncate">
              {staffRoleLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="w-full py-2 px-3 rounded-xl bg-[#292524] hover:bg-red-950/60 border border-[#3a3632] hover:border-red-500/40 text-xs font-semibold text-[#a8a29e] hover:text-red-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-[#ff7a00]" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};
