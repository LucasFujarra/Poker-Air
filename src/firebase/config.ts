// ================================================================
// POKER AIR — Configuração do Firebase
// ================================================================

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBB4Z9t8OlP42VEPxMKcHOAtvl9jP52E5M",
  authDomain: "poker-air.firebaseapp.com",
  databaseURL: "https://poker-air-default-rtdb.firebaseio.com",
  projectId: "poker-air",
  storageBucket: "poker-air.firebasestorage.app",
  messagingSenderId: "127863266192",
  appId: "1:127863266192:web:d1acddea4ba863b278b115"
};

// Verificar se as credenciais foram configuradas
export const isFirebaseConfigured = (): boolean => {
  return (
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
