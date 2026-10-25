import React, { useState } from 'react';
import { 
  ChefHat, 
  LogIn, 
  KeyRound, 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Check, 
  HelpCircle, 
  X, 
  ShieldCheck, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.ts';

export interface StaffSession {
  name: string;
  role: 'cocina' | 'admin';
  authType: 'google' | 'pin';
  email?: string;
}

interface StaffLoginViewProps {
  onSuccess: (session: StaffSession) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  requiredRole?: string;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({ 
  onSuccess, 
  showToast,
  requiredRole = 'cocina o administración' 
}) => {
  const [pin, setPin] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);
  const [showDomainHelp, setShowDomainHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'pin' | 'google'>('pin');

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'mositope.vercel.app';
  const projectId = 'starry-serenity-d6tvw';
  const firebaseSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(currentDomain);
    setCopied(true);
    showToast(`Dominio "${currentDomain}" copiado al portapapeles`, 'info');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const googleUser = result.user;
      const session: StaffSession = {
        name: googleUser.displayName || 'Personal Google',
        role: 'admin',
        authType: 'google',
        email: googleUser.email || undefined
      };
      localStorage.setItem('elchuro_staff_session', JSON.stringify(session));
      showToast(`¡Bienvenido, ${googleUser.displayName || 'Personal'}! ✨`);
      onSuccess(session);
    } catch (error: any) {
      console.error("Error al iniciar sesión con Google:", error);
      if (error?.code === 'auth/unauthorized-domain') {
        setAuthError({
          code: 'auth/unauthorized-domain',
          message: `El dominio "${currentDomain}" no está en la lista de dominios autorizados de Firebase.`
        });
        setShowDomainHelp(true);
      } else if (error?.code === 'auth/popup-closed-by-user') {
        showToast('Ventana de inicio de sesión cerrada.', 'info');
      } else if (error?.code === 'auth/popup-blocked') {
        showToast('El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes para este sitio.', 'error');
      } else {
        showToast(`Error al autenticar: ${error?.message || error?.code}`, 'error');
        setAuthError({
          code: error?.code || 'unknown',
          message: error?.message || 'Error al conectar con Google'
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPin = pin.trim();

    if (cleanPin === '1234') {
      const session: StaffSession = {
        name: 'Mozo / Cocina',
        role: 'cocina',
        authType: 'pin'
      };
      localStorage.setItem('elchuro_staff_session', JSON.stringify(session));
      showToast('¡Acceso concedido a Mesas y Cocina! 🍽️');
      onSuccess(session);
    } else if (cleanPin === '7777') {
      const session: StaffSession = {
        name: 'Administrador Restaurante',
        role: 'admin',
        authType: 'pin'
      };
      localStorage.setItem('elchuro_staff_session', JSON.stringify(session));
      showToast('¡Acceso concedido como Administrador! ⚡');
      onSuccess(session);
    } else {
      showToast('PIN incorrecto. Usa 1234 para Mozo/Cocina o 7777 para Admin.', 'error');
    }
  };

  const handleQuickPin = (quickPin: string) => {
    setPin(quickPin);
    if (quickPin === '1234') {
      const session: StaffSession = {
        name: 'Mozo / Cocina',
        role: 'cocina',
        authType: 'pin'
      };
      localStorage.setItem('elchuro_staff_session', JSON.stringify(session));
      showToast('¡Acceso concedido a Mesas y Cocina! 🍽️');
      onSuccess(session);
    } else if (quickPin === '7777') {
      const session: StaffSession = {
        name: 'Administrador Restaurante',
        role: 'admin',
        authType: 'pin'
      };
      localStorage.setItem('elchuro_staff_session', JSON.stringify(session));
      showToast('¡Acceso concedido como Administrador! ⚡');
      onSuccess(session);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 max-w-lg mx-auto">
      <div className="w-full bg-[#292524] border border-[#3a3632] rounded-[28px] p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow decorative accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#ff7a00]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-[20px] bg-gradient-to-tr from-[#ff7a00]/20 to-amber-500/20 border border-[#ff7a00]/30 mx-auto flex items-center justify-center text-[#ff7a00] shadow-inner">
            <ChefHat className="w-8 h-8" />
          </div>
          <h2 className="text-[22px] sm:text-[24px] font-serif font-bold text-[#f5efe6] tracking-tight">
            Acceso de Personal
          </h2>
          <p className="text-[13px] text-[#a8a29e]">
            Comandas de Cocina, Gestión de Mesas e Inventario para {requiredRole}.
          </p>
        </div>

        {/* Method Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-[#1c1917] rounded-xl border border-[#3a3632]">
          <button
            type="button"
            onClick={() => setActiveMethod('pin')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'pin'
                ? 'bg-[#ff7a00] text-white shadow-md'
                : 'text-[#a8a29e] hover:text-[#f5efe6]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" /> PIN de Restaurante
          </button>
          <button
            type="button"
            onClick={() => setActiveMethod('google')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'google'
                ? 'bg-[#ff7a00] text-white shadow-md'
                : 'text-[#a8a29e] hover:text-[#f5efe6]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" /> Cuenta Google
          </button>
        </div>

        {/* Method 1: Staff PIN Form */}
        {activeMethod === 'pin' && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#a8a29e] uppercase tracking-wider">
                Ingresa tu PIN de Acceso
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Ej. 1234"
                  className="w-full bg-[#1c1917] border border-[#3a3632] focus:border-[#ff7a00] focus:ring-1 focus:ring-[#ff7a00] rounded-xl px-4 py-3 text-center text-xl font-mono tracking-[0.3em] text-[#f5efe6] placeholder-[#57534e] outline-none transition-all"
                  autoFocus
                />
                <KeyRound className="w-4 h-4 text-[#78716c] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] active:scale-[0.98] text-white font-bold text-sm shadow-[0_4px_20px_rgba(255,122,0,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Ingresar con PIN</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Quick Preset Buttons for Tablets & Testing */}
            <div className="pt-2 border-t border-[#3a3632]/60 space-y-2">
              <span className="text-[11px] text-[#78716c] block text-center font-medium">
                Acceso Rápido por Rol:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickPin('1234')}
                  className="p-2.5 rounded-xl bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] text-left transition-colors cursor-pointer group"
                >
                  <div className="text-[11px] font-bold text-[#f5efe6] group-hover:text-[#ff7a00] flex items-center justify-between">
                    <span>Mozo y Cocina</span>
                    <span className="font-mono text-[10px] bg-[#292524] px-1.5 py-0.5 rounded text-[#a8a29e]">1234</span>
                  </div>
                  <span className="text-[10px] text-[#78716c]">Mesas, KDS y comandas</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickPin('7777')}
                  className="p-2.5 rounded-xl bg-[#1c1917] hover:bg-[#3a3632] border border-[#3a3632] text-left transition-colors cursor-pointer group"
                >
                  <div className="text-[11px] font-bold text-[#f5efe6] group-hover:text-[#ff7a00] flex items-center justify-between">
                    <span>Administrador</span>
                    <span className="font-mono text-[10px] bg-[#292524] px-1.5 py-0.5 rounded text-[#a8a29e]">7777</span>
                  </div>
                  <span className="text-[10px] text-[#78716c]">Mesas, KDS y menú</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Method 2: Google Sign-In */}
        {activeMethod === 'google' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-xl bg-white hover:bg-neutral-100 active:scale-[0.98] text-[#1c1917] font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoggingIn ? 'Conectando con Google...' : 'Continuar con Google'}</span>
            </button>

            {/* Error banner if domain not authorized */}
            {authError && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2 text-left">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200">
                    <p className="font-bold">Dominio no autorizado en Firebase</p>
                    <p className="text-[11px] text-amber-300/90 mt-0.5">
                      Firebase requiere autorizar el dominio <strong>{currentDomain}</strong> en la consola para usar Google OAuth.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDomainHelp(true)}
                    className="text-[11px] font-bold text-amber-300 hover:text-white underline cursor-pointer"
                  >
                    Ver cómo autorizar en 3 pasos
                  </button>
                  <span className="text-amber-500">•</span>
                  <button
                    type="button"
                    onClick={() => setActiveMethod('pin')}
                    className="text-[11px] font-bold text-[#ff7a00] hover:underline cursor-pointer"
                  >
                    Usar PIN inmediato
                  </button>
                </div>
              </div>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowDomainHelp(true)}
                className="text-xs text-[#a8a29e] hover:text-[#f5efe6] flex items-center justify-center gap-1 mx-auto cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>¿Error auth/unauthorized-domain en Vercel? Ver solución</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Domain Authorization Guide Modal */}
      {showDomainHelp && (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#292524] border border-[#ff7a00]/40 rounded-[24px] max-w-lg w-full p-6 shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#f5efe6]">Autorizar Dominio en Firebase</h3>
                  <p className="text-xs text-[#a8a29e]">Solución para error auth/unauthorized-domain</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDomainHelp(false)}
                className="p-1 rounded-lg text-[#a8a29e] hover:text-white hover:bg-[#3a3632] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#1c1917] p-3.5 rounded-xl border border-[#3a3632] space-y-2">
              <span className="text-[11px] text-[#a8a29e] uppercase font-semibold">Tu dominio actual:</span>
              <div className="flex items-center justify-between bg-[#292524] px-3 py-2 rounded-lg border border-[#3a3632]">
                <code className="text-sm font-mono text-[#ff7a00] font-bold break-all">
                  {currentDomain}
                </code>
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className="ml-2 px-2.5 py-1 rounded-md bg-[#3a3632] hover:bg-[#ff7a00] text-white text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#d6d3d1] leading-relaxed">
              <p className="font-semibold text-[#f5efe6]">Pasos para habilitar Google Login en Vercel:</p>
              
              <ol className="space-y-2 list-decimal list-inside bg-[#1c1917] p-4 rounded-xl border border-[#3a3632]">
                <li className="space-y-1">
                  <span>Entra a Firebase Console en la sección de Ajustes:</span>
                  <a
                    href={firebaseSettingsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#ff7a00] hover:underline font-bold ml-1 break-all"
                  >
                    Abrir Firebase Console Settings <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </li>
                <li>
                  Ve a la pestaña <strong>Dominios autorizados (Authorized domains)</strong>.
                </li>
                <li>
                  Haz clic en el botón <strong>Agregar dominio (Add domain)</strong>.
                </li>
                <li>
                  Pega exactamente tu dominio: <code className="bg-[#292524] px-1.5 py-0.5 rounded text-[#ff7a00] font-mono">{currentDomain}</code> (sin https://) y guarda.
                </li>
              </ol>

              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-200">
                <span className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> ¿Necesitas entrar ya mismo?
                </span>
                <p className="text-[11px] text-emerald-300/90 mt-1">
                  No necesitas esperar a configurar Firebase: puedes entrar de inmediato usando el <strong>PIN de Personal</strong> (<code className="font-bold text-white">1234</code> para Mozo y Cocina o <code className="font-bold text-white">7777</code> para Admin).
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDomainHelp(false);
                  setActiveMethod('pin');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#ff7a00] hover:bg-[#ff8c1a] text-white text-xs font-bold transition-all cursor-pointer text-center"
              >
                Ingresar con PIN Ahora
              </button>
              <button
                type="button"
                onClick={() => setShowDomainHelp(false)}
                className="px-4 py-2.5 rounded-xl bg-[#3a3632] hover:bg-[#44403c] text-[#f5efe6] text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
