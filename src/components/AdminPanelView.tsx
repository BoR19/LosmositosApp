import React from 'react';
import {
  Utensils,
  Building2,
  FileText,
  Users,
  Bell,
  ArrowRightLeft,
  Plus,
  Search,
  Pencil,
  DollarSign,
  Trash2,
} from 'lucide-react';
import { MENU_CATEGORIAS } from '../data/menuData.ts';
import {
  Collaborator,
  MenuItem,
  RestaurantProfile,
  SecurityConfig,
  SolicitudCambio,
  Table,
  WaiterCall,
} from '../types/index.ts';
import { RestaurantProfileAdmin } from './RestaurantProfileAdmin.tsx';
import { TicketHistoryAdmin } from './TicketHistoryAdmin.tsx';
import { EquipoYPermisos } from './EquipoYPermisos.tsx';
import { formatCurrencyBs } from '../utils/formatters.ts';

export type AdminSubTab = 'inventario' | 'perfil' | 'historial' | 'equipo';

interface AdminPanelViewProps {
  adminSubTab: AdminSubTab;
  onChangeAdminSubTab: (sub: AdminSubTab) => void;
  isAdminAuthenticated: boolean;
  canAccessMenuAdmin: boolean;
  canAccessReports: boolean;
  canAccessTables: boolean;
  canAccessCashier: boolean;
  uniqueMenu: MenuItem[];
  filteredAdminMenu: MenuItem[];
  adminMenuSearch: string;
  adminMenuCategory: string;
  onAdminSearchChange: (val: string) => void;
  onAdminCategoryChange: (cat: string) => void;
  waiterCalls: WaiterCall[];
  pendingChangeRequests: SolicitudCambio[];
  tables: Table[];
  restaurantProfile: RestaurantProfile;
  usarPildoraFlotante: boolean;
  securityConfig: SecurityConfig;
  collaborators: Collaborator[];
  onAttendWaiterCall: (callId: string) => void;
  onSimulateRequest: () => void;
  onOpenMoveModal: (table: Table, req: SolicitudCambio) => void;
  onOpenNewDish: () => void;
  onOpenEditDish: (dish: MenuItem) => void;
  onOpenQuickPrice: (dish: MenuItem) => void;
  onOpenDeleteDish: (dish: MenuItem) => void;
  onToggleAvailability: (id: string, currentStatus: boolean) => void;
  onProfileUpdated: (updated: RestaurantProfile) => void;
  onMasterPinUpdated: (newPin: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  adminSubTab,
  onChangeAdminSubTab,
  isAdminAuthenticated,
  canAccessMenuAdmin,
  canAccessReports,
  canAccessTables,
  canAccessCashier,
  uniqueMenu,
  filteredAdminMenu,
  adminMenuSearch,
  adminMenuCategory,
  onAdminSearchChange,
  onAdminCategoryChange,
  waiterCalls,
  pendingChangeRequests,
  tables,
  restaurantProfile,
  usarPildoraFlotante,
  securityConfig,
  collaborators,
  onAttendWaiterCall,
  onSimulateRequest,
  onOpenMoveModal,
  onOpenNewDish,
  onOpenEditDish,
  onOpenQuickPrice,
  onOpenDeleteDish,
  onToggleAvailability,
  onProfileUpdated,
  onMasterPinUpdated,
  showToast,
}) => {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Cabecera Principal del Panel Admin con Pestañas de Navegación */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#3a3632] pb-6">
        <div>
          <h2 className="text-[24px] sm:text-[28px] font-serif font-extrabold tracking-tight text-[#f5efe6] flex items-center gap-3">
            <span>Panel de Administración</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#a8a29e] mt-1">
            Gestiona el inventario, historial de ventas, identidad de marca y control de accesos.
          </p>
        </div>

        {/* Selector de Módulos del Panel Admin */}
        <div className="flex flex-wrap items-center p-1.5 rounded-2xl bg-[#292524] border border-[#3a3632] self-start lg:self-auto shrink-0 shadow-md gap-1">
          {(isAdminAuthenticated || canAccessMenuAdmin) && (
            <button
              type="button"
              onClick={() => onChangeAdminSubTab('inventario')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'inventario'
                  ? 'bg-[#ff7a00] text-white shadow-lg'
                  : 'text-[#a8a29e] hover:text-[#f5efe6]'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Inventario ({uniqueMenu.length})</span>
            </button>
          )}

          {isAdminAuthenticated && (
            <button
              type="button"
              onClick={() => onChangeAdminSubTab('perfil')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'perfil'
                  ? 'bg-[#ff7a00] text-[#0A0A0A] shadow-lg font-black'
                  : 'text-[#a8a29e] hover:text-[#f5efe6]'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Perfil de Marca</span>
            </button>
          )}

          {(isAdminAuthenticated || canAccessReports) && (
            <button
              type="button"
              onClick={() => onChangeAdminSubTab('historial')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'historial'
                  ? 'bg-[#ff7a00] text-[#0A0A0A] shadow-lg font-black'
                  : 'text-[#a8a29e] hover:text-[#f5efe6]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Historial de Recibos</span>
            </button>
          )}

          {isAdminAuthenticated && (
            <button
              type="button"
              onClick={() => onChangeAdminSubTab('equipo')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                adminSubTab === 'equipo'
                  ? 'bg-[#ff7a00] text-white shadow-lg'
                  : 'text-[#a8a29e] hover:text-[#f5efe6]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Equipo y Permisos</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {(isAdminAuthenticated || canAccessTables || canAccessCashier) && (
          <>
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
                    <div
                      key={`call-${call.id}`}
                      className="flex items-center justify-between bg-[#1c1917] p-4 rounded-xl border border-[#3a3632] shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        {call.type === 'mozo' ? (
                          <Bell className="w-5 h-5 text-[#ff7a00] animate-bounce" />
                        ) : (
                          <FileText className="w-5 h-5 text-emerald-400 animate-pulse" />
                        )}
                        <div>
                          <p className="text-sm font-bold text-[#f5efe6]">{call.tableName}</p>
                          <span className="text-xs text-[#a8a29e]">
                            {call.type === 'mozo' ? 'Llamada de Mozo' : 'Solicitud de Cuenta'} •{' '}
                            {call.time}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAttendWaiterCall(call.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#3a3632] hover:bg-emerald-600 text-xs font-bold text-white cursor-pointer transition-colors"
                      >
                        Atendido
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Solicitudes de Cambio de Mesa */}
            <div className="bg-[#292524] border border-[#3a3632] rounded-[20px] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-lg font-serif font-bold text-[#f5efe6] flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-[#ff7a00]" />
                  <span>Solicitudes de Cambio de Mesa</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onSimulateRequest}
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
                  {pendingChangeRequests.map((req) => (
                    <div
                      key={`admin-req-${req.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1c1917] p-4 rounded-xl border border-[#3a3632] shadow-sm"
                    >
                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-[#f5efe6]">
                          Mesa {req.mesa_origen} solicita cambio - Motivo:{' '}
                          {req.motivo || 'Mesa más grande'} - Cel: {req.celular || 'Sin registro'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const originTable =
                            tables.find((t) => t.id === req.mesa_origen) ||
                            ({
                              id: req.mesa_origen,
                              name: `Mesa ${req.mesa_origen}`,
                              seats: 4,
                              status: 'occupied',
                              currentOrder: null,
                            } as Table);
                          onOpenMoveModal(originTable, req);
                        }}
                        className="px-3.5 py-2 rounded-lg bg-[#ff7a00] hover:bg-[#ff8c1a] text-xs font-black text-black cursor-pointer transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0 shadow-md"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Mover</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* SUBTAB 1: INVENTARIO */}
        {adminSubTab === 'inventario' && (
          <div className="bg-[#292524] border border-[#3a3632] rounded-[24px] p-5 sm:p-7 space-y-6 shadow-xl animate-fadeIn">
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

              <button
                type="button"
                onClick={onOpenNewDish}
                className="px-4 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] active:scale-95 text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,122,0,0.3)] cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Plato o Bebida</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
                <span className="text-[11px] text-[#a8a29e] uppercase font-bold tracking-wider">
                  Total Ítems
                </span>
                <p className="text-xl font-black text-[#f5efe6] mt-0.5">{uniqueMenu.length}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
                <span className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider">
                  Disponibles
                </span>
                <p className="text-xl font-black text-emerald-400 mt-0.5">
                  {uniqueMenu.filter((m) => m.disponible).length}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
                <span className="text-[11px] text-red-400 uppercase font-bold tracking-wider">
                  Agotados
                </span>
                <p className="text-xl font-black text-red-400 mt-0.5">
                  {uniqueMenu.filter((m) => !m.disponible).length}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#1c1917] border border-[#3a3632]">
                <span className="text-[11px] text-amber-400 uppercase font-bold tracking-wider">
                  Categorías
                </span>
                <p className="text-xl font-black text-amber-400 mt-0.5">
                  {new Set(uniqueMenu.map((m) => m.categoria)).size}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={adminMenuSearch}
                  onChange={(e) => onAdminSearchChange(e.target.value)}
                  placeholder="Buscar plato, bebida, ingrediente o categoría..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-xs sm:text-sm text-[#f5efe6] focus:outline-none placeholder-[#78716c]"
                />
                {adminMenuSearch && (
                  <button
                    type="button"
                    onClick={() => onAdminSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#a8a29e] hover:text-white cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <button
                  type="button"
                  onClick={() => onAdminCategoryChange('TODOS')}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer font-bold ${
                    adminMenuCategory === 'TODOS'
                      ? 'bg-[#ff7a00] text-white'
                      : 'bg-[#1c1917] text-[#a8a29e] hover:text-white border border-[#3a3632]'
                  }`}
                >
                  Todos ({uniqueMenu.length})
                </button>
                {MENU_CATEGORIAS.map((cat) => {
                  const count = uniqueMenu.filter((m) => m.categoria === cat).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={`admin-cat-tab-${cat}`}
                      type="button"
                      onClick={() => onAdminCategoryChange(cat)}
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

            {filteredAdminMenu.length === 0 ? (
              <div className="text-center py-12 bg-[#1c1917] rounded-2xl border border-[#3a3632] text-[#a8a29e] space-y-2">
                <p className="text-sm font-bold text-[#f5efe6]">No se encontraron platos ni bebidas</p>
                <p className="text-xs">Prueba buscando con otra palabra o selecciona otra categoría.</p>
                <button
                  type="button"
                  onClick={() => {
                    onAdminSearchChange('');
                    onAdminCategoryChange('TODOS');
                  }}
                  className="mt-2 px-3 py-1.5 rounded-lg bg-[#3a3632] text-xs font-bold text-white hover:bg-[#ff7a00] transition-colors cursor-pointer"
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
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => onOpenEditDish(item)}
                              className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#1c1917] border border-[#3a3632] shrink-0 cursor-pointer group"
                              title="Clic para editar foto o detalles"
                            >
                              <img
                                src={item.image}
                                alt={item.nombre}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src =
                                    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80';
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
                                <p className="text-[11px] text-[#a8a29e] line-clamp-1 max-w-xs">
                                  {item.descripcion}
                                </p>
                              )}
                              {item.notas && (
                                <span className="text-[10px] text-amber-300 font-semibold">
                                  {item.notas}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-bold text-[#ff7a00] bg-[#ff7a00]/10 px-2 py-0.5 rounded-full border border-[#ff7a00]/20 whitespace-nowrap">
                            {item.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onOpenQuickPrice(item)}
                            className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] hover:border-[#ff7a00] text-[#f5efe6] cursor-pointer transition-colors"
                            title="Clic para cambiar el precio en 2 segundos"
                          >
                            <span className="font-mono font-black text-sm text-[#ff7a00]">
                              {formatCurrencyBs(item.precioBs)}
                            </span>
                            <Pencil className="w-3 h-3 text-[#a8a29e] group-hover:text-white" />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => onToggleAvailability(item.id, item.disponible)}
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
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenEditDish(item)}
                              className="p-1.5 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] text-[#f5efe6] hover:text-[#ff7a00] border border-[#3a3632] transition-colors cursor-pointer"
                              title="Editar plato completo"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenQuickPrice(item)}
                              className="p-1.5 rounded-lg bg-[#1c1917] hover:bg-[#3a3632] text-[#ff7a00] hover:text-white border border-[#3a3632] transition-colors cursor-pointer"
                              title="Cambiar precio rápidamente"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenDeleteDish(item)}
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

        {/* SUBTAB 2: PERFIL DE MARCA */}
        {adminSubTab === 'perfil' && isAdminAuthenticated && (
          <RestaurantProfileAdmin
            currentProfile={restaurantProfile}
            onProfileUpdated={onProfileUpdated}
            showNotification={(msg, type) => showToast(msg, type)}
          />
        )}

        {/* SUBTAB 3: HISTORIAL DE RECIBOS */}
        {adminSubTab === 'historial' && (isAdminAuthenticated || canAccessReports) && (
          <TicketHistoryAdmin />
        )}

        {/* SUBTAB 4: EQUIPO Y PERMISOS */}
        {adminSubTab === 'equipo' && isAdminAuthenticated && (
          <EquipoYPermisos
            isAdminAuthenticated={isAdminAuthenticated}
            securityConfig={securityConfig}
            collaborators={collaborators}
            usarPildoraFlotante={usarPildoraFlotante}
            showToast={showToast}
            onMasterPinUpdated={onMasterPinUpdated}
          />
        )}
      </div>
    </div>
  );
};
