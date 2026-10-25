import React, { useState } from 'react';
import { 
  Utensils, 
  CheckCircle2, 
  Flame,
  MessageCircle
} from 'lucide-react';
import { doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { RestaurantProfile } from '../types';

interface WelcomeScreenProps {
  mesaNumber: number;
  restaurantProfile: RestaurantProfile;
  onComplete: (celular?: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  mesaNumber,
  restaurantProfile,
  onComplete,
}) => {
  // Pre-fill phone if user already saved it previously
  const [celular, setCelular] = useState(() => {
    try {
      return localStorage.getItem('churo_celular') || '';
    } catch {
      return '';
    }
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Clean and validate Bolivian 8-digit mobile number starting with 6 or 7
  const cleanCelular = celular.replace(/\D/g, '').slice(0, 8);
  const isValidNumber = cleanCelular.length === 8 && (cleanCelular.startsWith('6') || cleanCelular.startsWith('7'));
  const hasStartedTyping = cleanCelular.length > 0;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
    setCelular(val);
    setErrorMsg('');
  };

  const handleContinueWithPhone = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!isValidNumber) {
      if (cleanCelular.length === 0) {
        setErrorMsg('Ingresa un número de celular de 8 dígitos.');
      } else if (cleanCelular.length < 8) {
        setErrorMsg('El número debe tener exactamente 8 dígitos.');
      } else {
        setErrorMsg('El celular debe comenzar con 6 o 7.');
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // a) Save in localStorage and sessionStorage
      localStorage.setItem('churo_celular', cleanCelular);
      localStorage.setItem('churo_mesa', String(mesaNumber));
      localStorage.setItem('churo_fecha', new Date().toISOString());
      sessionStorage.setItem(`welcome_done_${mesaNumber}`, 'true');
      sessionStorage.setItem(`churo_welcome_dismissed_${mesaNumber}`, 'true');

      // b) Save in Firestore (clientes doc=cleanCelular & mesas_activas doc=mesa_X)
      const nowIso = new Date().toISOString();

      try {
        const clienteRef = doc(db, 'clientes', cleanCelular);
        await setDoc(clienteRef, {
          celular: cleanCelular,
          ultima_mesa: Number(mesaNumber),
          ultima_visita: serverTimestamp(),
          visitas: increment(1),
          updatedAt: nowIso
        }, { merge: true });
      } catch (fErr) {
        console.warn('Firestore clientes write fallback:', fErr);
      }

      try {
        const mesaActivaRef = doc(db, 'mesas_activas', `mesa_${mesaNumber}`);
        await setDoc(mesaActivaRef, {
          mesa: Number(mesaNumber),
          cliente_celular: cleanCelular,
          cliente_llego: serverTimestamp(),
          updatedAt: nowIso
        }, { merge: true });
      } catch (mErr) {
        console.warn('Firestore mesas_activas write fallback:', mErr);
      }
    } catch (err) {
      console.warn('Network or storage write exception handled:', err);
    } finally {
      setIsSubmitting(false);
      onComplete(cleanCelular);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('churo_mesa', String(mesaNumber));
      sessionStorage.setItem(`welcome_done_${mesaNumber}`, 'true');
      sessionStorage.setItem(`churo_welcome_dismissed_${mesaNumber}`, 'true');
    } catch (e) {
      // ignore
    }
    onComplete();
  };

  const primaryColor = restaurantProfile.colorPrimario || '#FF7A00';

  return (
    <div className="fixed inset-0 z-[2500] bg-[#0d0a08] text-[#f5efe6] font-sans flex flex-col justify-between overflow-y-auto selection:bg-[#FF7A00] selection:text-white p-4 sm:p-6 animate-fadeIn">
      {/* Background glow effects */}
      <div 
        className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none opacity-25"
        style={{ backgroundColor: primaryColor }}
      />
      <div className="fixed bottom-0 right-0 w-[350px] h-[350px] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-sm mx-auto w-full my-auto flex flex-col items-center space-y-6 text-center py-4">
        
        {/* 1. EMBLEM / LOGO HEADER */}
        <div className="relative flex flex-col items-center group">
          {/* Flame Ambient Glow */}
          <div 
            className="absolute -top-6 w-32 h-32 rounded-full blur-2xl opacity-40 animate-pulse pointer-events-none"
            style={{ backgroundColor: primaryColor }}
          />

          {/* Restaurant Logo / Emblem Box */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-b from-[#2a1c14] to-[#120a06] p-1.5 border-2 border-[#ff7a00]/40 shadow-[0_12px_35px_rgba(255,122,0,0.35)] flex items-center justify-center overflow-hidden">
            {restaurantProfile.logoUrl ? (
              <img 
                src={restaurantProfile.logoUrl} 
                alt={restaurantProfile.nombre} 
                className="w-full h-full object-cover rounded-2xl"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center space-y-1">
                <Flame className="w-10 h-10 text-[#FF7A00] animate-bounce" />
                <Utensils className="w-6 h-6 text-amber-200" />
              </div>
            )}
          </div>

          {/* Restaurant Name */}
          <h1 className="mt-3 text-xl sm:text-2xl font-serif font-black tracking-tight text-[#f5efe6] uppercase">
            {restaurantProfile.nombre || 'EL CHURO MOSITO'}
          </h1>
          <p className="text-[10px] tracking-[0.2em] text-[#a8a29e] uppercase font-bold">
            {restaurantProfile.slogan || 'GASTRONOMÍA DE ALTURA • TARIJA'}
          </p>
        </div>

        {/* 2. MESA BADGE */}
        <div className="px-5 py-1.5 rounded-full bg-[#1c1510] border border-[#ff7a00]/50 text-[#f5efe6] text-xs font-mono font-extrabold shadow-md inline-flex items-center gap-1.5">
          <span>Mesa {mesaNumber}</span>
        </div>

        {/* 3. HEADINGS & DESCRIPTION */}
        <div className="space-y-2 max-w-xs">
          <h2 className="text-3xl sm:text-4xl font-serif font-black tracking-tight text-[#f5efe6]">
            Bienvenido
          </h2>
          <h3 className="text-xl sm:text-2xl font-bold text-[#f5efe6] leading-tight">
            ¿A dónde te enviamos <br /> tu cuenta?
          </h3>
          <p className="text-xs text-[#a8a29e] pt-1 leading-relaxed flex items-center justify-center gap-1 flex-wrap">
            <span>Recibirás tu recibo al instante por</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </span>
            <span>al finalizar tu pedido.</span>
          </p>
        </div>

        {/* 4. FORM / INPUT & ACTIONS */}
        <form onSubmit={handleContinueWithPhone} className="w-full space-y-4 pt-1">
          {/* Phone Input Box */}
          <div className="relative flex items-center rounded-2xl bg-[#1c1612] border-2 border-[#ff7a00]/60 focus-within:border-[#FF7A00] focus-within:ring-2 focus-within:ring-[#FF7A00]/30 transition-all p-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            {/* Flag Bolivia 🇧🇴 + Code +591 */}
            <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold font-mono text-[#f5efe6] border-r border-[#3a2c22] shrink-0">
              <span className="text-lg">🇧🇴</span>
              <span>+591</span>
            </div>

            {/* Phone Field */}
            <input
              type="tel"
              inputMode="numeric"
              value={cleanCelular}
              onChange={handlePhoneChange}
              placeholder="7245XXXX"
              maxLength={8}
              className="w-full bg-transparent px-3 py-2 text-base font-mono font-extrabold text-[#f5efe6] placeholder-[#52453d] focus:outline-none tracking-widest text-left"
              autoFocus
            />

            {isValidNumber && (
              <div className="pr-3 text-emerald-400 shrink-0 animate-fadeIn">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            )}
          </div>

          {/* Validation error hint */}
          {hasStartedTyping && !isValidNumber && (
            <p className="text-[11px] text-amber-400 font-medium px-1 text-center">
              {cleanCelular.length < 8 
                ? `Faltan ${8 - cleanCelular.length} dígitos (ej: 72451234)`
                : 'Debe iniciar con 6 o 7 (números móviles en Bolivia)'}
            </p>
          )}

          {errorMsg && (
            <p className="text-xs text-red-400 font-medium px-1 text-center">
              {errorMsg}
            </p>
          )}

          {/* 5. MAIN VER MENÚ BUTTON */}
          <button
            type="submit"
            disabled={isSubmitting || (hasStartedTyping && !isValidNumber)}
            className={`w-full py-4 px-6 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl active:scale-98 ${
              isValidNumber || !hasStartedTyping
                ? 'bg-gradient-to-r from-[#ff7a00] via-[#ff8c1a] to-[#ff6a00] text-white shadow-[0_8px_30px_rgba(255,122,0,0.55)] border border-[#ffa34d]/50 hover:brightness-110'
                : 'bg-[#291f19] text-[#786356] cursor-not-allowed border border-[#3d2e24]'
            }`}
          >
            {isSubmitting ? (
              <span>Cargando Menú...</span>
            ) : (
              <span>Ver Menú</span>
            )}
          </button>
        </form>

        {/* 6. SECONDARY LINK: CONTINUAR SIN NÚMERO */}
        <button
          type="button"
          onClick={handleSkip}
          className="text-xs sm:text-sm font-semibold text-[#a8a29e] hover:text-[#f5efe6] underline underline-offset-4 transition-colors cursor-pointer py-1"
        >
          Continuar sin número
        </button>

        {/* 7. FOOTER DISCLAIMER */}
        <p className="text-[10px] text-[#786e68] leading-tight max-w-xs pt-2">
          Usamos tu número solo para enviar el recibo por WhatsApp. Puedes cambiarlo luego.
        </p>

      </div>
    </div>
  );
};
