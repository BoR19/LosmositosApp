import React, { useState, useEffect } from 'react';
import { 
  X, AlertTriangle, Utensils, DollarSign, Image as ImageIcon, 
  Sparkles, Check, Flame, Clock, Layers, FileText, Trash2
} from 'lucide-react';
import { MenuItem } from '../types/index.ts';
import { MENU_CATEGORIAS } from '../data/menuData.ts';

/* =========================================================================================
 * 🌟 COMENTARIOS DIDÁCTICOS (EXPLICACIÓN FÁCIL COMO PARA UN NIÑO DE 12 AÑOS):
 * 
 * ¿QUÉ ES ESTE ARCHIVO?
 * Imagina que este archivo es una "caja de herramientas mágicas" para el dueño del restaurante.
 * Tiene 3 ventanas emergentes (llamadas Modales):
 * 
 * 1. AddEditDishModal: Es como una hoja de papel en blanco (o la receta de un chef) donde
 *    puedes escribir el nombre del plato, cuánto cuesta en Bolivianos, qué ingredientes tiene,
 *    y pegarle una foto bonita. ¡Sirve para crear platos NUEVOS o para EDITAR platos que ya existen!
 * 
 * 2. QuickPriceModal: Es como un marcador mágico para cambiarle el precio a un plato en 2 segundos
 *    sin tener que abrir todo el formulario largo.
 * 
 * 3. DeleteDishModal: Es como una papelera segura. Antes de tirar un plato a la basura, te pregunta:
 *    "¿Seguro que quieres borrar este plato?". Así evitamos borrar comida por error.
 * 
 * 🖼️ ¿CÓMO CAMBIAR LAS IMÁGENES DE LOS PLATOS Y BEBIDAS?
 * En el formulario de abajo verás un campo llamado "URL de la Imagen".
 * Allí solo tienes que copiar y pegar el link de internet de cualquier foto (por ejemplo de Unsplash,
 * Google Fotos, Imgur o tu propia página). Además, pusimos botones de fotos sugeridas (carne, pollo,
 * pescado, jugos, vinos) para que con un solo clic le pongas una foto deliciosa.
 * ========================================================================================= */

// Lista de fotos sugeridas de alta calidad listas para usar con 1 solo clic:
const SUGGESTED_IMAGES = [
  { label: '🥩 Parrilla / Carne', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80' },
  { label: '🍗 Pollo a la Leña', url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80' },
  { label: '🐟 Pescado Asado', url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80' },
  { label: '🍖 Lechón / Costilla', url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80' },
  { label: '🍲 Sopa Criolla', url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80' },
  { label: '🍟 Guarnición / Papas', url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80' },
  { label: '🍹 Jugo Natural', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80' },
  { label: '🍸 Cóctel / Trago', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80' },
  { label: '🥤 Gaseosa / Refresco', url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80' },
  { label: '🍷 Vino Tinto', url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80' },
  { label: '🍰 Postre Dulce', url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80' },
];

// Imagen de reserva por si el usuario escribe un link que no existe o está roto:
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80';

// -----------------------------------------------------------------------------
// 1. MODAL: AGREGAR O EDITAR PLATO / BEBIDA
// -----------------------------------------------------------------------------
interface AddEditDishModalProps {
  isOpen: boolean;
  onClose: () => void;
  dishToEdit: MenuItem | null; // Si tiene un plato, estamos EDITANDO. Si es null, estamos CREANDO uno nuevo.
  onSave: (dish: MenuItem, isEditing: boolean) => Promise<void> | void;
}

export const AddEditDishModal: React.FC<AddEditDishModalProps> = ({
  isOpen,
  onClose,
  dishToEdit,
  onSave,
}) => {
  // Estados para guardar lo que el usuario escribe en cada cajita del formulario:
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState(MENU_CATEGORIAS[0] || 'PARRILLA Y CRUZ');
  const [customCategoria, setCustomCategoria] = useState('');
  const [isCustomCategoria, setIsCustomCategoria] = useState(false);
  const [precioBs, setPrecioBs] = useState<number>(35);
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');
  const [prepTime, setPrepTime] = useState('15 min');
  const [spicy, setSpicy] = useState<number>(0);
  const [disponible, setDisponible] = useState<boolean>(true);
  const [imageUrl, setImageUrl] = useState<string>(SUGGESTED_IMAGES[0].url);
  const [imageError, setImageError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cuando la ventanita se abre, rellenamos las cajitas con los datos del plato (o valores nuevos si es nuevo):
  useEffect(() => {
    if (isOpen) {
      if (dishToEdit) {
        // Estamos editando un plato existente:
        setNombre(dishToEdit.nombre);
        if (MENU_CATEGORIAS.includes(dishToEdit.categoria)) {
          setCategoria(dishToEdit.categoria);
          setIsCustomCategoria(false);
          setCustomCategoria('');
        } else {
          setCategoria('OTRA');
          setIsCustomCategoria(true);
          setCustomCategoria(dishToEdit.categoria);
        }
        setPrecioBs(dishToEdit.precioBs);
        setDescripcion(dishToEdit.descripcion || '');
        setNotas(dishToEdit.notas || '');
        setPrepTime(dishToEdit.prepTime || '15 min');
        setSpicy(dishToEdit.spicy ?? 0);
        setDisponible(dishToEdit.disponible);
        setImageUrl(dishToEdit.image || SUGGESTED_IMAGES[0].url);
      } else {
        // Estamos creando un plato desde cero:
        setNombre('');
        setCategoria(MENU_CATEGORIAS[0] || 'PARRILLA Y CRUZ');
        setIsCustomCategoria(false);
        setCustomCategoria('');
        setPrecioBs(35);
        setDescripcion('');
        setNotas('');
        setPrepTime('15 min');
        setSpicy(0);
        setDisponible(true);
        setImageUrl(SUGGESTED_IMAGES[0].url);
      }
      setImageError(false);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, dishToEdit]);

  if (!isOpen) return null;

  // Función que se ejecuta cuando el usuario presiona el botón "Guardar Plato":
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validaciones simples para que no hayan errores tontos:
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) {
      setErrorMessage('Por favor, escribe el nombre del plato o bebida.');
      return;
    }

    if (isNaN(precioBs) || precioBs <= 0) {
      setErrorMessage('El precio debe ser un número mayor a 0 Bolivianos (Bs).');
      return;
    }

    const finalCategoria = isCustomCategoria ? customCategoria.trim() : categoria;
    if (!finalCategoria) {
      setErrorMessage('Por favor, indica una categoría válida.');
      return;
    }

    // 2. Si es nuevo, generamos un identificador único seguro (ID):
    const id = dishToEdit ? dishToEdit.id : `dish-${Date.now()}`;

    // 3. Empaquetamos toda la información en nuestro objeto de plato:
    const finalDish: MenuItem = {
      id,
      nombre: trimmedNombre.toUpperCase(),
      categoria: finalCategoria.toUpperCase(),
      precioBs: Number(Number(precioBs).toFixed(2)),
      descripcion: descripcion.trim(),
      notas: notas.trim() ? notas.trim() : undefined,
      prepTime: prepTime.trim() ? prepTime.trim() : undefined,
      spicy: Number(spicy),
      disponible: Boolean(disponible),
      image: imageUrl.trim() || FALLBACK_IMAGE,
    };

    try {
      setIsSubmitting(true);
      await onSave(finalDish, !!dishToEdit);
      onClose();
    } catch (err) {
      console.error('Error al guardar el plato en Firestore:', err);
      setErrorMessage('No pudimos guardar los cambios. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div 
        className="bg-[#292524] border border-[#ff7a00]/40 rounded-[24px] max-w-2xl w-full p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)] my-auto max-h-[92vh] overflow-y-auto space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-[#3a3632] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#ff7a00]/15 border border-[#ff7a00]/30 flex items-center justify-center text-[#ff7a00]">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-serif font-black text-[#f5efe6]">
                {dishToEdit ? 'Editar Plato o Bebida' : 'Agregar Nuevo Plato o Bebida'}
              </h3>
              <p className="text-xs text-[#a8a29e] mt-0.5">
                {dishToEdit 
                  ? 'Modifica los precios, ingredientes o fotos y se actualizará para todos los clientes al instante.'
                  : 'Crea un nuevo ítem en el menú digital visible de inmediato en todas las mesas.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#a8a29e] hover:text-white hover:bg-[#3a3632] transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de error si algo falta */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formulario principal */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Fila 1: Nombre y Precio en Bolivianos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-[#f5efe6] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#ff7a00]" />
                Nombre del Plato o Bebida *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Bife de Chorizo a las Brasas"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-[#f5efe6] text-sm focus:outline-none placeholder-[#78716c]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#f5efe6] uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#ff7a00]" />
                Precio (Bs.) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#a8a29e]">
                  Bs.
                </span>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={precioBs}
                  onChange={(e) => setPrecioBs(parseFloat(e.target.value) || 0)}
                  placeholder="35"
                  required
                  className="w-full pl-11 pr-3 py-2.5 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-[#ff7a00] font-black text-base focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Fila 2: Categoría */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#f5efe6] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#ff7a00]" />
              Categoría en el Menú *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={isCustomCategoria ? 'OTRA' : categoria}
                onChange={(e) => {
                  if (e.target.value === 'OTRA') {
                    setIsCustomCategoria(true);
                  } else {
                    setIsCustomCategoria(false);
                    setCategoria(e.target.value);
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-[#f5efe6] text-sm focus:outline-none"
              >
                {MENU_CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="OTRA">+ Escribir otra categoría nueva...</option>
              </select>

              {isCustomCategoria && (
                <input
                  type="text"
                  value={customCategoria}
                  onChange={(e) => setCustomCategoria(e.target.value)}
                  placeholder="Escribe el nombre de la nueva categoría..."
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1c1917] border border-[#ff7a00] text-[#f5efe6] text-sm focus:outline-none placeholder-[#78716c]"
                />
              )}
            </div>
          </div>

          {/* Fila 3: Descripción de ingredientes y Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#f5efe6] uppercase tracking-wider">
              Descripción e Ingredientes
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Ej. Servido con papa frita, ensalada fresca criolla, arroz graneado y llajwa tradicional."
              className="w-full px-4 py-2.5 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-[#f5efe6] text-sm focus:outline-none placeholder-[#78716c] resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#f5efe6] uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#ff7a00]" />
                Tiempo Prep.
              </label>
              <input
                type="text"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="Ej. 15 min"
                className="w-full px-3 py-2 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-[#f5efe6] text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#f5efe6] uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                Nivel Picante
              </label>
              <select
                value={spicy}
                onChange={(e) => setSpicy(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-[#f5efe6] text-xs focus:outline-none"
              >
                <option value={0}>0 - Sin picante (Apto niños)</option>
                <option value={1}>1 - Suave (Toque llajwa)</option>
                <option value={2}>2 - Medio picante</option>
                <option value={3}>3 - Muy picante (Picante criollo)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#f5efe6] uppercase tracking-wider">
                Notas extras
              </label>
              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. Para 2 personas"
                className="w-full px-3 py-2 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-[#f5efe6] text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Fila 4: 🖼️ IMAGEN DEL PLATO - EXPLICACIÓN CLARA PARA CAMBIAR FOTOS */}
          <div className="p-4 rounded-2xl bg-[#1c1917] border border-[#3a3632] space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#f5efe6] uppercase tracking-wider flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#ff7a00]" />
                <span>Foto del Plato o Bebida (Imagen)</span>
              </label>
              <span className="text-[11px] text-[#ff7a00] font-medium bg-[#ff7a00]/10 px-2 py-0.5 rounded-full border border-[#ff7a00]/20">
                Vista previa en vivo 👇
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Recuadro de vista previa con la foto cargada */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-[#292524] border-2 border-[#3a3632] shrink-0 shadow-inner group">
                <img
                  src={imageError ? FALLBACK_IMAGE : imageUrl}
                  alt="Vista previa"
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold p-1 text-center">
                  Foto actual
                </div>
              </div>

              {/* Input para pegar la URL de la foto */}
              <div className="flex-1 w-full space-y-2">
                <p className="text-[12px] text-[#a8a29e] leading-snug">
                  📌 <strong className="text-[#f5efe6]">¿Dónde cambiar la imagen?</strong> Pega aquí abajo el enlace directo de internet (URL) de cualquier foto:
                </p>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImageError(false);
                  }}
                  placeholder="https://images.unsplash.com/... o enlace de tu foto"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#292524] border border-[#3a3632] focus:border-[#ff7a00] text-xs text-[#f5efe6] focus:outline-none font-mono"
                />
                {imageError && (
                  <p className="text-[11px] text-amber-400">
                    ⚠️ La imagen no se pudo cargar desde ese link. Se usará una foto deliciosa de respaldo.
                  </p>
                )}
              </div>
            </div>

            {/* Galería rápida de fotos con un solo clic */}
            <div className="space-y-1.5 pt-2 border-t border-[#3a3632]/80">
              <span className="text-[11px] font-bold text-[#a8a29e] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#ff7a00]" />
                O elige una foto sugerida con 1 solo clic:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                {SUGGESTED_IMAGES.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setImageUrl(sug.url);
                      setImageError(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer border ${
                      imageUrl === sug.url 
                        ? 'bg-[#ff7a00] text-white border-[#ff7a00] font-bold'
                        : 'bg-[#292524] text-[#d6d3d1] border-[#3a3632] hover:border-[#ff7a00]/50 hover:text-white'
                    }`}
                  >
                    {sug.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fila 5: Interruptor de disponibilidad */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1c1917] border border-[#3a3632]">
            <div>
              <p className="text-xs font-bold text-[#f5efe6]">Disponibilidad en cocina</p>
              <p className="text-[11px] text-[#a8a29e]">
                {disponible 
                  ? 'El plato se puede pedir libremente desde las mesas.' 
                  : 'Aparecerá como "Agotado" para que los clientes no lo ordenen.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDisponible(!disponible)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-colors border ${
                disponible 
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700' 
                  : 'bg-red-950 text-red-300 border-red-700'
              }`}
            >
              {disponible ? '✓ Disponible' : '✕ Agotado'}
            </button>
          </div>

          {/* Botones de acción al final */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#3a3632]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#3a3632] hover:bg-[#44403c] text-xs font-bold text-[#f5efe6] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] active:scale-95 text-xs font-bold text-white transition-all flex items-center gap-2 shadow-[0_4px_15px_rgba(255,122,0,0.3)] cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando en la nube...' : dishToEdit ? 'Actualizar Plato' : 'Guardar y Publicar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 2. MODAL: CAMBIO RÁPIDO DE PRECIO (EN 2 CLICS)
// -----------------------------------------------------------------------------
interface QuickPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  dish: MenuItem | null;
  onUpdatePrice: (dishId: string, newPrice: number) => Promise<void> | void;
}

export const QuickPriceModal: React.FC<QuickPriceModalProps> = ({
  isOpen,
  onClose,
  dish,
  onUpdatePrice,
}) => {
  const [newPrice, setNewPrice] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (dish) {
      setNewPrice(dish.precioBs);
      setIsSubmitting(false);
    }
  }, [dish, isOpen]);

  if (!isOpen || !dish) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPrice <= 0) return;
    try {
      setIsSubmitting(true);
      await onUpdatePrice(dish.id, Number(Number(newPrice).toFixed(2)));
      onClose();
    } catch (e) {
      console.error('Error al actualizar el precio:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1550] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#292524] border border-[#ff7a00]/40 rounded-[22px] max-w-sm w-full p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#3a3632] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ff7a00]/20 flex items-center justify-center text-[#ff7a00]">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-serif font-bold text-[#f5efe6]">Cambiar Precio</h4>
              <p className="text-[11px] text-[#a8a29e] truncate max-w-[190px]">{dish.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#a8a29e] hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-center">
            <span className="text-xs text-[#a8a29e]">Precio actual: Bs. {dish.precioBs.toFixed(2)}</span>
            <div className="relative mt-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#a8a29e]">
                Bs.
              </span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                autoFocus
                required
                className="w-full pl-12 pr-4 py-3 rounded-xl bg-[#1c1917] border-2 border-[#ff7a00] text-center text-2xl font-black text-[#ff7a00] focus:outline-none"
              />
            </div>
          </div>

          {/* Botones de ajuste rápido +/- */}
          <div className="flex justify-center gap-2">
            {[-5, -1, 1, 5, 10].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => setNewPrice((prev) => Math.max(1, prev + delta))}
                className="px-2.5 py-1 rounded-lg bg-[#1c1917] border border-[#3a3632] hover:border-[#ff7a00] text-xs font-bold text-[#f5efe6] transition-colors cursor-pointer"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#3a3632] hover:bg-[#44403c] text-xs font-bold text-[#f5efe6] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || newPrice <= 0}
              className="flex-1 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50 shadow"
            >
              {isSubmitting ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 3. MODAL: CONFIRMAR ELIMINACIÓN DE PLATO / BEBIDA
// -----------------------------------------------------------------------------
interface DeleteDishModalProps {
  isOpen: boolean;
  onClose: () => void;
  dish: MenuItem | null;
  onConfirmDelete: (dishId: string) => Promise<void> | void;
}

export const DeleteDishModal: React.FC<DeleteDishModalProps> = ({
  isOpen,
  onClose,
  dish,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !dish) return null;

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirmDelete(dish.id);
      onClose();
    } catch (err) {
      console.error('Error al eliminar plato:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-[#292524] border border-red-500/40 rounded-[22px] max-w-md w-full p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-red-400">
          <div className="w-10 h-10 rounded-2xl bg-red-950/80 border border-red-500/40 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h4 className="text-lg font-serif font-bold text-[#f5efe6]">¿Eliminar este ítem del menú?</h4>
            <p className="text-xs text-[#a8a29e]">Esta acción removerá el ítem de las cartas y comandas.</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#1c1917] border border-[#3a3632] flex items-center gap-3">
          <img
            src={dish.image || FALLBACK_IMAGE}
            alt={dish.nombre}
            className="w-14 h-14 rounded-xl object-cover border border-[#3a3632] shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#f5efe6] truncate">{dish.nombre}</p>
            <p className="text-xs text-[#a8a29e]">{dish.categoria}</p>
            <p className="text-xs font-black text-[#ff7a00] mt-0.5">Bs. {dish.precioBs.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-[#3a3632] hover:bg-[#44403c] text-xs font-bold text-[#f5efe6] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-colors cursor-pointer shadow disabled:opacity-50"
          >
            {isDeleting ? 'Borrando...' : 'Sí, Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
};
