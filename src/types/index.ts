export interface MenuItem {
  id: string;
  categoria: string;
  nombre: string;
  descripcion: string;
  notas?: string;
  precioBs: number;
  disponible: boolean;
  image: string;
  prepTime?: string;
  spicy?: number;
}

export interface CartItem extends MenuItem {
  qty: number;
}

export interface Table {
  id: number;
  name: string;
  seats: number;
  status: 'free' | 'occupied' | 'reserved' | 'por-pagar';
  currentOrder?: {
    id: string;
    items: (CartItem | OrderItem)[];
    total: number;
    time: string;
    status?: string;
  } | null;
}

export interface OrderItem {
  id: string;
  nombre: string;
  precioBs: number;
  qty: number;
  categoria?: string;
  isAddition?: boolean;
  orderItemId?: string;
}

export interface Order {
  id: string;
  tableId: number;
  tableName: string;
  items: OrderItem[];
  total: number;
  status: 'pendiente' | 'en-preparacion' | 'servido' | 'por-pagar' | 'pagado' | 'cancelado';
  time: string;
  createdAt?: number;
  hasAddition?: boolean;
  additionTime?: string;
  paidAt?: string;
  paymentMethod?: 'QR' | 'EFECTIVO';
}

export interface WaiterCall {
  id: string;
  tableId: number;
  tableName: string;
  type: 'mozo' | 'cuenta';
  time: string;
  status?: 'pendiente' | 'atendido';
  createdAt?: number;
}

export interface NotificationState {
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface RestaurantProfile {
  nombre: string;
  slogan: string;
  telefono: string;
  logoUrl: string;
  colorPrimario: string;
  colorSecundario: string;
  modoFondo: string;
  updatedAt?: string;
}

export interface TicketHistoryItem {
  id: string;
  mesa: number;
  tableName: string;
  total: number;
  celular?: string | null;
  tipoEntrega: 'whatsapp' | 'ticket' | 'ambas';
  metodoPago: 'EFECTIVO' | 'QR';
  fecha?: any;
  reimpresiones?: number;
}

export interface SolicitudCambio {
  id: string;
  mesa_origen: number;
  mesa_destino?: number | null;
  celular?: string | null;
  motivo: string;
  estado: 'pendiente' | 'completado' | 'cancelado';
  createdAt?: any;
  atendidoAt?: any;
}


