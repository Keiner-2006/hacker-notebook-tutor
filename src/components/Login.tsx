/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  AuthCredential
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { saveUserHandleForId, buildFirestoreUserKey } from '../lib/db';
import { Terminal, Shield, KeyRound, Mail, User, AlertTriangle, Cpu, Eye, EyeOff, Globe } from 'lucide-react';

interface LoginProps {
  onAuthSuccess: (uid: string, handle: string) => void;
}

export default function Login({ onAuthSuccess }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCredential, setPendingCredential] = useState<AuthCredential | null>(null);
  const [pendingLinkEmail, setPendingLinkEmail] = useState<string | null>(null);

  const getCleanErrorMessage = (code: string, message: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'CONEXIÓN RECHAZADA: El correo ya está registrado en el nodo central.';
      case 'auth/invalid-credential':
        return 'CONEXIÓN RECHAZADA: Credenciales inválidas. Acceso denegado.';
      case 'auth/weak-password':
        return 'CONEXIÓN RECHAZADA: Clave vulnerable. Mínimo 6 caracteres.';
      case 'auth/invalid-email':
        return 'CONEXIÓN RECHAZADA: Formato de correo electrónico inválido.';
      case 'auth/network-request-failed':
        return 'ERROR DE RED: Nodo de autenticación inalcanzable.';
      case 'auth/operation-not-allowed':
        return 'CONEXIÓN RECHAZADA: El inicio de sesión con Correo/Contraseña está inactivo en Firebase Console. Por favor activa "Correo electrónico/contraseña" en la pestaña "Authentication -> Sign-in method" o utiliza el botón "CONECTAR VÍA GOOGLE" abajo para ingresar al instante.';
      default:
        return `ERROR DEL SISTEMA [${code}]: ${message}`;
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      const normalizedUserId = buildFirestoreUserKey(user.uid, user.email);
      
      let savedHandle = localStorage.getItem(`hacker_handle_${normalizedUserId}`);
      if (!savedHandle) {
        let namePart = user.displayName ? user.displayName.toUpperCase().replace(/\s+/g, '_') : '';
        if (!namePart && user.email) {
          namePart = user.email.split('@')[0].toUpperCase();
        }
        savedHandle = (namePart || 'OPERATOR') + '@fsociety';
        saveUserHandleForId(normalizedUserId, savedHandle);
      }
      
      onAuthSuccess(normalizedUserId, savedHandle);
    } catch (err: any) {
      console.error('Google Auth failure:', err);
      const errorEmail = err.customData?.email || email || auth.currentUser?.email || '';
      const errorCode = err.code || 'unknown';

      if (errorCode === 'auth/account-exists-with-different-credential' && errorEmail) {
        const methods = await fetchSignInMethodsForEmail(auth, errorEmail);
        if (methods.includes('password')) {
          setError('Este correo ya existe con contraseña. Inicia sesión con Correo/Contraseña y el sistema vinculará Google automáticamente.');
          return;
        }
      }

      setError(getCleanErrorMessage(errorCode, err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('ERROR: Todos los campos obligatorios deben ser completados.');
      return;
    }
    if (mode === 'register' && !handle.trim()) {
      setError('ERROR: Debes ingresar un Alias/Hacker Handle.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const normalizedUserId = buildFirestoreUserKey(user.uid, user.email);

        if (pendingCredential && pendingLinkEmail && user.email && user.email.toLowerCase() === pendingLinkEmail.toLowerCase()) {
          try {
            await linkWithCredential(user, pendingCredential);
            console.info('Credencial de Google vinculada correctamente al usuario de correo y contraseña.');
          } catch (linkErr) {
            console.error('Error al vincular credencial con Google:', linkErr);
          } finally {
            setPendingCredential(null);
            setPendingLinkEmail(null);
          }
        }
        
        // Obtener handle guardado o generar uno
        const savedHandle = localStorage.getItem(`hacker_handle_${normalizedUserId}`);
        const userHandle = savedHandle || (user.email ? user.email.split('@')[0].toUpperCase() + '@fsociety' : 'OPERATOR@fsociety');
        if (!savedHandle) {
          saveUserHandleForId(normalizedUserId, userHandle);
        }
        
        onAuthSuccess(normalizedUserId, userHandle);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        let formattedHandle = handle.trim();
        if (!formattedHandle.includes('@')) {
          formattedHandle += '@fsociety';
        }
        
        saveUserHandleForId(user.uid, formattedHandle);
        onAuthSuccess(user.uid, formattedHandle);
      }
    } catch (err: any) {
      console.error('Auth failure:', err);
      setError(getCleanErrorMessage(err.code || 'unknown', err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-terminal-black text-terminal-green flex flex-col justify-center items-center p-4 select-none font-mono">
      {/* Retro CRT Scanline overlay effect */}
      <div className="crt-overlay crt-flicker pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full glow-border bg-terminal-dark/95 p-6 md:p-8 rounded-lg shadow-[0_0_20px_rgba(0,255,65,0.1)]">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-[#333333] pb-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00FF41] animate-pulse glow-text" />
            <h1 className="text-sm font-bold tracking-widest text-[#00FF41]">
              SYS_AUTH // DECRYPT_NODE
            </h1>
          </div>
          <span className="text-[10px] text-terminal-green-dim font-mono">v3.5.0</span>
        </div>

        {/* Visual Badge */}
        <div className="flex flex-col items-center justify-center text-center space-y-2 mb-6">
          <div className="border border-terminal-green p-3 rounded-full bg-terminal-green/5 shadow-[0_0_15px_rgba(0,255,102,0.15)]">
            <Terminal className="w-8 h-8 text-terminal-green animate-pulse" />
          </div>
          <h2 className="text-sm font-bold tracking-widest uppercase">
            {mode === 'login' ? 'INICIAR_SESIÓN_OPERADOR' : 'REGISTRAR_NUEVO_NODO'}
          </h2>
          <p className="text-[10px] text-terminal-green-dim max-w-xs">
            {mode === 'login' 
              ? 'Introduce tus credenciales para descifrar tu base de conocimientos.' 
              : 'Establece un enlace seguro con la base de datos de auto-aprendizaje.'}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {mode === 'register' && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-terminal-green-dim mb-1 tracking-wider">
                ALIAS_OPERADOR (Hacker Handle)
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-[#050505] border border-[#333333] rounded focus-within:border-terminal-green glow-border-focus transition-all">
                <User className="w-4 h-4 text-terminal-green shrink-0" />
                <input
                  type="text"
                  placeholder="E.g., NEO, ZERO_COOL"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="bg-transparent text-terminal-green w-full outline-none"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase font-bold text-terminal-green-dim mb-1 tracking-wider">
              CORREO_DE_ACCESO
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#050505] border border-[#333333] rounded focus-within:border-terminal-green glow-border-focus transition-all">
              <Mail className="w-4 h-4 text-terminal-green shrink-0" />
              <input
                type="email"
                placeholder="operator@fsociety.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent text-terminal-green w-full outline-none"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-terminal-green-dim mb-1 tracking-wider">
              CLAVE_DE_ACCESO
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#050505] border border-[#333333] rounded focus-within:border-terminal-green glow-border-focus transition-all">
              <KeyRound className="w-4 h-4 text-terminal-green shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent text-terminal-green w-full outline-none"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-terminal-green-dim hover:text-terminal-green transition-all"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Consola de Errores */}
          {error && (
            <div className="bg-terminal-red/10 border border-terminal-red/40 p-3 rounded flex items-start gap-2 text-terminal-red animate-pulse text-[11px] leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">SYSTEM_ALERT:</span> {error}
              </div>
            </div>
          )}

          {/* Botón de Envío */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-terminal-green text-terminal-black font-bold uppercase rounded tracking-widest hover:bg-terminal-green-bright hover:shadow-[0_0_15px_rgba(0,255,102,0.4)] transition-all cursor-pointer flex justify-center items-center gap-2 mt-4"
          >
            {loading ? (
              <>
                <Cpu className="w-4 h-4 animate-spin text-terminal-black" />
                <span>[PROCESANDO_CRIPTOGRAFÍA...]</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 text-terminal-black" />
                <span>{mode === 'login' ? 'DESCIFRAR_CONSOLA' : 'MONTAR_NODO_SEGURO'}</span>
              </>
            )}
          </button>
        </form>

        {/* Separador de Acceso Alternativo */}
        <div className="flex items-center my-5 gap-2">
          <div className="h-[1px] bg-[#333333] flex-1" />
          <span className="text-[9px] text-terminal-green-dim tracking-widest uppercase shrink-0 font-mono">
            O INICIAR VÍA ACCESO RÁPIDO
          </span>
          <div className="h-[1px] bg-[#333333] flex-1" />
        </div>

        {/* Botón de Google */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-2 bg-transparent text-terminal-green hover:bg-terminal-green/10 border border-terminal-green/30 font-bold uppercase rounded tracking-widest transition-all cursor-pointer flex justify-center items-center gap-2"
        >
          <Globe className="w-4 h-4 text-terminal-green animate-pulse" />
          <span>CONECTAR VÍA GOOGLE</span>
        </button>

        {/* Selector de modo */}
        <div className="mt-6 pt-4 border-t border-[#222222] text-center">
          <p className="text-[11px] text-terminal-green-dim">
            {mode === 'login' ? '¿No posees una llave de acceso?' : '¿Ya tienes un enlace registrado?'}
          </p>
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="text-terminal-green underline text-xs font-bold hover:text-terminal-green-bright tracking-wider uppercase mt-1 cursor-pointer"
          >
            {mode === 'login' ? 'REGISTRAR_OPERADOR' : 'IR_AL_LOGIN'}
          </button>
        </div>
      </div>
    </div>
  );
}
