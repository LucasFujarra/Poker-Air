// ================================================================
// POKER AIR — Configuração do Firebase
// ================================================================

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? ''
};

// Verificar se as credenciais foram configuradas
export const isFirebaseConfigured = (): boolean => {
  return (
    Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId) &&
    firebaseConfig.apiKey !== "COLE_SUA_API_KEY_AQUI" &&
    !firebaseConfig.databaseURL.includes('SEU_PROJETO')
  );
};

// Inicializar Firebase
let app: ReturnType<typeof initializeApp> | null = null;
let database: ReturnType<typeof getDatabase> | null = null;

export const initFirebase = () => {
  if (!app && isFirebaseConfigured()) {
    try {
      app = initializeApp(firebaseConfig);
      database = getDatabase(app);
      console.log('✅ Firebase conectado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar Firebase:', error);
    }
  }
  return { app, database };
};

export const getFirebaseDatabase = () => {
  if (!database) {
    initFirebase();
  }
  return database;
};

export { firebaseConfig };

let authentication: Promise<string> | null = null;

export function ensureFirebaseUser(): Promise<string> {
  if (authentication) return authentication;
  const { app: firebaseApp } = initFirebase();
  if (!firebaseApp) return Promise.reject(new Error('Firebase não configurado.'));
  const auth = getAuth(firebaseApp);
  authentication = auth.authStateReady().then(async () => {
    return (auth.currentUser ?? (await signInAnonymously(auth)).user).uid;
  }).catch((error) => {
    authentication = null;
    throw error;
  });
  return authentication;
}

export function getFirebaseUserId(): string {
  const { app: firebaseApp } = initFirebase();
  return firebaseApp ? getAuth(firebaseApp).currentUser?.uid ?? '' : '';
}
