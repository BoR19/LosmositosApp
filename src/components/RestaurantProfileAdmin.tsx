import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Upload, 
  Image as ImageIcon, 
  Palette, 
  Phone, 
  Check, 
  Loader2, 
  RefreshCw, 
  Sparkles, 
  Eye, 
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { RestaurantProfile } from '../types';

interface RestaurantProfileAdminProps {
  currentProfile: RestaurantProfile;
  onProfileUpdated: (updated: RestaurantProfile) => void;
  showNotification?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const PRIMARY_PRESETS = [
  { name: 'Naranja Mosito', hex: '#ff7a00', desc: 'Identidad Clásica' },
  { name: 'Ámbar Fuego', hex: '#f59e0b', desc: 'Cálido y Dinámico' },
  { name: 'Rojo Brasa', hex: '#ef4444', desc: 'Parrillero Tradicional' },
  { name: 'Oro Tarijeño', hex: '#eab308', desc: 'Nobleza y Valle' },
  { name: 'Carmín Criollo', hex: '#e11d48', desc: 'Alta Cocina' },
  { name: 'Azul Gourmet', hex: '#3b82f6', desc: 'Moderno y Sobrio' },
];

const SECONDARY_PRESETS = [
  { name: 'Esmeralda', hex: '#10b981', desc: 'Verde Fresco' },
  { name: 'Menta Valle', hex: '#059669', desc: 'Confirmación Clásica' },
  { name: 'Lima Criollo', hex: '#84cc16', desc: 'Cítrico y Vigoroso' },
  { name: 'Verde Bosque', hex: '#16a34a', desc: 'Natural y Orgánico' },
  { name: 'Jade Tarija', hex: '#14b8a6', desc: 'Turquesa Elegante' },
];

const BACKGROUND_MODES = [
  { 
    id: 'dark-zinc', 
    label: 'Zinc Oscuro (Original)', 
    desc: 'Tono piedra oscura característico del restaurante',
    cardBg: 'bg-[#292524]',
    pageBg: 'bg-[#1c1917]',
    border: 'border-[#3a3632]'
  },
  { 
    id: 'dark-pure', 
    label: 'Negro Azabache', 
    desc: 'Máximo contraste profundo para pantallas OLED',
    cardBg: 'bg-[#121212]',
    pageBg: 'bg-[#000000]',
    border: 'border-[#262626]'
  },
  { 
    id: 'dark-warm', 
    label: 'Brasa Cálida', 
    desc: 'Matiz tostado maderero con atmósfera de leña',
    cardBg: 'bg-[#231a15]',
    pageBg: 'bg-[#17100b]',
    border: 'border-[#3d2c22]'
  },
];

export const RestaurantProfileAdmin: React.FC<RestaurantProfileAdminProps> = ({
  currentProfile,
  onProfileUpdated,
  showNotification
}) => {
  const [nombre, setNombre] = useState(currentProfile.nombre || 'El Churo Mosito');
  const [slogan, setSlogan] = useState(currentProfile.slogan || 'GASTRONOMÍA DE ALTURA • TARIJA');
  const [telefono, setTelefono] = useState(currentProfile.telefono || '+591 71234567');
  const [logoUrl, setLogoUrl] = useState(currentProfile.logoUrl || '');
  const [colorPrimario, setColorPrimario] = useState(currentProfile.colorPrimario || '#ff7a00');
  const [colorSecundario, setColorSecundario] = useState(currentProfile.colorSecundario || '#10b981');
  const [modoFondo, setModoFondo] = useState(currentProfile.modoFondo || 'dark-zinc');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync if external profile changes
  useEffect(() => {
    if (currentProfile) {
      setNombre(currentProfile.nombre || 'El Churo Mosito');
      setSlogan(currentProfile.slogan || 'GASTRONOMÍA DE ALTURA • TARIJA');
      setTelefono(currentProfile.telefono || '+591 71234567');
      setLogoUrl(currentProfile.logoUrl || '');
      setColorPrimario(currentProfile.colorPrimario || '#ff7a00');
      setColorSecundario(currentProfile.colorSecundario || '#10b981');
      setModoFondo(currentProfile.modoFondo || 'dark-zinc');
    }
  }, [currentProfile]);

  // Handle Logo File Upload directly to Firebase Storage ('logos/')
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      const err = 'Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP, SVG).';
      setUploadError(err);
      if (showNotification) showNotification(err, 'error');
      return;
    }

    // Limit size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      const err = 'La imagen no debe superar los 10MB.';
      setUploadError(err);
      if (showNotification) showNotification(err, 'error');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(10);

    // Instant local preview
    const localPreviewUrl = URL.createObjectURL(file);
    setLogoUrl(localPreviewUrl);

    try {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `logos/logo_${timestamp}_${sanitizedName}`;
      const storageReference = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageReference, file, {
        contentType: file.type,
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Error al subir a Firebase Storage:', error);
          // Fallback to base64 if storage has strict bucket policy or network issues
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setLogoUrl(dataUrl);
            setIsUploading(false);
            setUploadProgress(null);
            if (showNotification) {
              showNotification('Imagen cargada localmente y lista para guardar.', 'info');
            }
          };
          reader.readAsDataURL(file);
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            setLogoUrl(downloadUrl);
            setIsUploading(false);
            setUploadProgress(100);
            setTimeout(() => setUploadProgress(null), 1500);
            if (showNotification) {
              showNotification('Logo subido a Firebase Storage con éxito.', 'success');
            }
          } catch (urlErr) {
            console.error('Error al obtener URL del logo:', urlErr);
            setIsUploading(false);
          }
        }
      );
    } catch (err: any) {
      console.error('Error al iniciar carga de logo:', err);
      // Fallback: Read as Data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setLogoUrl(dataUrl);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Save changes to Firestore document "configuracion/perfil"
  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updatedData: RestaurantProfile = {
        nombre: nombre.trim() || 'El Churo Mosito',
        slogan: slogan.trim() || 'GASTRONOMÍA DE ALTURA • TARIJA',
        telefono: telefono.trim() || '+591 71234567',
        logoUrl: logoUrl.trim(),
        colorPrimario: colorPrimario || '#ff7a00',
        colorSecundario: colorSecundario || '#10b981',
        modoFondo: modoFondo || 'dark-zinc',
        updatedAt: new Date().toISOString(),
      };

      const docRef = doc(db, 'configuracion', 'perfil');
      await setDoc(docRef, updatedData, { merge: true });

      onProfileUpdated(updatedData);

      if (showNotification) {
        showNotification('¡Identidad y perfil de marca guardados exitosamente en Firestore!', 'success');
      }
    } catch (error: any) {
      console.error('Error al guardar perfil de marca:', error);
      if (showNotification) {
        showNotification(`Error al guardar: ${error?.message || 'Revisa tu conexión'}`, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setNombre('El Churo Mosito');
    setSlogan('GASTRONOMÍA DE ALTURA • TARIJA');
    setTelefono('+591 71234567');
    setColorPrimario('#ff7a00');
    setColorSecundario('#10b981');
    setModoFondo('dark-zinc');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Encabezado del Módulo con badge de estado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#292524] border border-[#3a3632] rounded-[24px] p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
            style={{ 
              backgroundColor: colorPrimario,
              boxShadow: `0 8px 24px ${colorPrimario}40`
            }}
          >
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xl sm:text-2xl font-serif font-black text-[#f5efe6]">
                Perfil del Restaurante e Identidad de Marca
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Firestore + Storage
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#a8a29e] mt-1">
              Personaliza el nombre, logo oficial, teléfono de contacto y la paleta visual para todo el restaurante.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-center">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-[#1c1917] hover:bg-[#3a3632] text-xs font-semibold text-[#a8a29e] hover:text-[#f5efe6] border border-[#3a3632] transition-colors cursor-pointer flex items-center gap-1.5"
            title="Restablecer valores originales"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Valores Predeterminados</span>
          </button>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSaving || isUploading}
            className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-all flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            style={{ 
              backgroundColor: colorPrimario,
              boxShadow: `0 6px 20px ${colorPrimario}50`
            }}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Guardar Cambios de Marca</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda: Formulario y Configuraciones (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* SECCIÓN 1: Formulario de Identidad de Marca */}
          <div className="bg-[#292524] border border-[#3a3632] rounded-[22px] p-6 space-y-5 shadow-md">
            <div className="border-b border-[#3a3632] pb-3.5 flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-[#1c1917] border border-[#3a3632] text-[#f5efe6] text-xs font-bold flex items-center justify-center">
                1
              </span>
              <div>
                <h4 className="text-base font-serif font-bold text-[#f5efe6]">
                  Datos Principales de la Marca
                </h4>
                <p className="text-[11px] text-[#a8a29e]">
                  Se mostrarán en el menú, tickets de comanda y enlaces de WhatsApp
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Nombre del Restaurante */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#a8a29e] mb-1.5">
                  Nombre del Restaurante <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: El Churo Mosito"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-sm text-[#f5efe6] focus:outline-none placeholder-[#78716c] transition-colors"
                />
              </div>

              {/* Slogan / Subtítulo */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#a8a29e] mb-1.5">
                  Slogan / Subtítulo Oficial
                </label>
                <input
                  type="text"
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  placeholder="Ej: GASTRONOMÍA DE ALTURA • TARIJA"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-sm text-[#f5efe6] focus:outline-none placeholder-[#78716c] transition-colors"
                />
              </div>

              {/* Teléfono / WhatsApp de Contacto */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#a8a29e] mb-1.5">
                  Teléfono / WhatsApp de Contacto
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej: +591 71234567"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-sm text-[#f5efe6] focus:outline-none placeholder-[#78716c] transition-colors"
                  />
                </div>
                <p className="text-[10px] text-[#78716c] mt-1">
                  Permite a los comensales contactar directamente al restaurante o recibir confirmaciones de reservas.
                </p>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Carga y Gestión de Logo (Firebase Storage) */}
          <div className="bg-[#292524] border border-[#3a3632] rounded-[22px] p-6 space-y-5 shadow-md">
            <div className="border-b border-[#3a3632] pb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-[#1c1917] border border-[#3a3632] text-[#f5efe6] text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <div>
                  <h4 className="text-base font-serif font-bold text-[#f5efe6]">
                    Logo Oficial del Restaurante
                  </h4>
                  <p className="text-[11px] text-[#a8a29e]">
                    Subida directa a Firebase Storage (carpeta <code className="text-amber-300">logos/</code>)
                  </p>
                </div>
              </div>

              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                  title="Quitar logo actual"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar Logo</span>
                </button>
              )}
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 p-3 bg-red-950/70 border border-red-500/40 rounded-xl text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Drag & Drop / File Input Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 transition-all text-center cursor-pointer relative overflow-hidden group ${
                isDragging
                  ? 'border-[#ff7a00] bg-[#ff7a00]/10 scale-[0.99]'
                  : 'border-[#3a3632] hover:border-[#ff7a00]/60 bg-[#1c1917]/70 hover:bg-[#1c1917]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-[#292524] border border-[#3a3632] flex items-center justify-center group-hover:scale-105 transition-transform">
                  {isUploading ? (
                    <Loader2 className="w-7 h-7 text-[#ff7a00] animate-spin" />
                  ) : logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="Logo Preview" 
                      className="w-full h-full object-contain p-1 rounded-2xl" 
                    />
                  ) : (
                    <Upload className="w-6 h-6 text-[#a8a29e] group-hover:text-[#ff7a00] transition-colors" />
                  )}
                </div>

                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#f5efe6]">
                    {isUploading ? 'Subiendo archivo a Firebase Storage...' : 'Haz clic o arrastra el archivo de imagen aquí'}
                  </p>
                  <p className="text-[11px] text-[#a8a29e] mt-0.5">
                    Formatos recomendados: PNG transparente, SVG o JPG (Máx. 10MB)
                  </p>
                </div>

                {uploadProgress !== null && (
                  <div className="w-full max-w-xs mt-2">
                    <div className="flex justify-between text-[10px] text-[#a8a29e] mb-1 font-mono">
                      <span>Subiendo...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#3a3632] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#ff7a00] transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Opcional: Pegar URL Directa de Imagen */}
            <div className="pt-2">
              <label className="block text-[11px] font-semibold text-[#a8a29e] mb-1">
                O ingresa un enlace web directo de imagen:
              </label>
              <div className="relative">
                <ImageIcon className="w-4 h-4 text-[#a8a29e] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] text-xs text-[#f5efe6] focus:outline-none placeholder-[#78716c]"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: Paleta de Colores y Estilo Visual */}
          <div className="bg-[#292524] border border-[#3a3632] rounded-[22px] p-6 space-y-6 shadow-md">
            <div className="border-b border-[#3a3632] pb-3.5 flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-[#1c1917] border border-[#3a3632] text-[#f5efe6] text-xs font-bold flex items-center justify-center">
                3
              </span>
              <div>
                <h4 className="text-base font-serif font-bold text-[#f5efe6]">
                  Paleta de Colores y Estilo Visual
                </h4>
                <p className="text-[11px] text-[#a8a29e]">
                  Configura los colores de marca y el tema de fondo Dark Mode
                </p>
              </div>
            </div>

            {/* Color Primario (Acento / Botones / Destacados) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#f5efe6] flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorPrimario }} />
                    Color Primario (Acento / Botones)
                  </label>
                  <p className="text-[11px] text-[#a8a29e]">Color de la marca para botones principales y selecciones</p>
                </div>

                <div className="flex items-center gap-2 bg-[#1c1917] px-2.5 py-1 rounded-xl border border-[#3a3632]">
                  <input
                    type="color"
                    value={colorPrimario}
                    onChange={(e) => setColorPrimario(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                    title="Selector de color personalizado"
                  />
                  <span className="text-xs font-mono font-bold text-[#f5efe6]">{colorPrimario}</span>
                </div>
              </div>

              {/* Presets Primarios */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRIMARY_PRESETS.map((p) => {
                  const isSelected = colorPrimario.toLowerCase() === p.hex.toLowerCase();
                  return (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setColorPrimario(p.hex)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-white bg-[#1c1917] shadow-md' 
                          : 'border-[#3a3632] bg-[#1c1917]/60 hover:bg-[#1c1917]'
                      }`}
                    >
                      <span 
                        className="w-5 h-5 rounded-lg shrink-0 flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: p.hex }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#f5efe6] truncate">{p.name}</p>
                        <p className="text-[9px] text-[#a8a29e] truncate">{p.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Secundario (Verdes / Confirmación / Alertas) */}
            <div className="space-y-2.5 pt-2 border-t border-[#3a3632]">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#f5efe6] flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorSecundario }} />
                    Color Secundario (Verdes / Confirmación)
                  </label>
                  <p className="text-[11px] text-[#a8a29e]">Color para estados disponibles, pagos listos y confirmaciones</p>
                </div>

                <div className="flex items-center gap-2 bg-[#1c1917] px-2.5 py-1 rounded-xl border border-[#3a3632]">
                  <input
                    type="color"
                    value={colorSecundario}
                    onChange={(e) => setColorSecundario(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                    title="Selector de color personalizado"
                  />
                  <span className="text-xs font-mono font-bold text-[#f5efe6]">{colorSecundario}</span>
                </div>
              </div>

              {/* Presets Secundarios */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SECONDARY_PRESETS.map((p) => {
                  const isSelected = colorSecundario.toLowerCase() === p.hex.toLowerCase();
                  return (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setColorSecundario(p.hex)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-white bg-[#1c1917] shadow-md' 
                          : 'border-[#3a3632] bg-[#1c1917]/60 hover:bg-[#1c1917]'
                      }`}
                    >
                      <span 
                        className="w-5 h-5 rounded-lg shrink-0 flex items-center justify-center shadow-sm"
                        style={{ backgroundColor: p.hex }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#f5efe6] truncate">{p.name}</p>
                        <p className="text-[9px] text-[#a8a29e] truncate">{p.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modo de Fondo (Dark Mode Presets) */}
            <div className="space-y-2.5 pt-2 border-t border-[#3a3632]">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#f5efe6]">
                  Modo de Fondo (Dark Mode)
                </label>
                <p className="text-[11px] text-[#a8a29e]">
                  Selecciona la atmósfera de oscuridad adecuada para el restaurante
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {BACKGROUND_MODES.map((mode) => {
                  const isSelected = modoFondo === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setModoFondo(mode.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        isSelected 
                          ? 'border-[#ff7a00] bg-[#1c1917] ring-1 ring-[#ff7a00]' 
                          : 'border-[#3a3632] bg-[#1c1917]/60 hover:bg-[#1c1917]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-[#f5efe6]">{mode.label}</p>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#ff7a00]" />}
                      </div>
                      <p className="text-[10px] text-[#a8a29e] leading-snug">{mode.desc}</p>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <div className={`w-4 h-4 rounded ${mode.pageBg} border ${mode.border}`} />
                        <div className={`w-4 h-4 rounded ${mode.cardBg} border ${mode.border}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Vista Previa en Tiempo Real e Integraciones (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-24 space-y-6">
            {/* Live Preview Card */}
            <div className="bg-[#292524] border border-[#3a3632] rounded-[24px] p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#3a3632] pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-serif font-bold text-[#f5efe6]">
                    Vista Previa en Vivo de Marca
                  </h4>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  En Tiempo Real
                </span>
              </div>

              {/* Mockup de Cabecera y Tarjeta de Comanda */}
              <div className="rounded-2xl border border-[#3a3632] bg-[#1c1917] p-4 space-y-4 shadow-inner">
                {/* Header Mockup */}
                <div className="flex items-center justify-between border-b border-[#3a3632] pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md overflow-hidden"
                      style={{ 
                        backgroundColor: colorPrimario,
                        boxShadow: `0 4px 15px ${colorPrimario}40`
                      }}
                    >
                      {logoUrl ? (
                        <img 
                          src={logoUrl} 
                          alt="Logo Preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#f5efe6] truncate font-serif">
                        {nombre || 'El Churo Mosito'}
                      </p>
                      <p className="text-[10px] text-[#a8a29e] tracking-wider uppercase font-medium truncate">
                        {slogan || 'GASTRONOMÍA DE ALTURA • TARIJA'}
                      </p>
                    </div>
                  </div>

                  <span 
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: colorPrimario }}
                  >
                    Abierto
                  </span>
                </div>

                {/* Sample Product Card in Live Preview */}
                <div className="bg-[#292524] p-3 rounded-xl border border-[#3a3632] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#f5efe6] truncate">
                        Pollo a la Leña (Muestra)
                      </span>
                      <span 
                        className="text-[9px] px-1.5 py-0.2 rounded font-bold text-white shrink-0"
                        style={{ backgroundColor: colorSecundario }}
                      >
                        ✓ Disponible
                      </span>
                    </div>
                    <p className="text-[11px] font-mono font-bold mt-0.5" style={{ color: colorPrimario }}>
                      Bs. 45.00
                    </p>
                  </div>

                  <button 
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-bold shrink-0 shadow cursor-pointer transition-transform active:scale-95"
                    style={{ backgroundColor: colorPrimario }}
                  >
                    + Agregar
                  </button>
                </div>

                {/* WhatsApp & Contact Preview */}
                <div className="bg-[#292524] p-3 rounded-xl border border-[#3a3632] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#a8a29e]">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Oficial:</span>
                  </div>
                  <a
                    href={`https://wa.me/${telefono.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <span>{telefono || '+591 71234567'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Botón Grande de Guardar */}
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving || isUploading}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                style={{ 
                  backgroundColor: colorPrimario,
                  boxShadow: `0 8px 25px ${colorPrimario}50`
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Guardando en Firestore...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Guardar Cambios de Marca</span>
                  </>
                )}
              </button>

              <div className="p-3 bg-[#1c1917] rounded-xl border border-[#3a3632] text-[11px] text-[#a8a29e] space-y-1">
                <p className="font-semibold text-[#f5efe6] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Sincronización en la Nube
                </p>
                <p>
                  Los cambios se guardan permanentemente en la colección <code className="text-amber-300">configuracion/perfil</code> de Firestore y se reflejan al instante en las comandas y pantallas del restaurante.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
