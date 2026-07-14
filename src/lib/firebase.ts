/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Inicializar la aplicación de Firebase con el archivo de configuración provisto
const app = initializeApp(firebaseConfig);

// Inicializar Firestore con la base de datos específica asignada a este applet
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Inicializar Authentication
export const auth = getAuth(app);

export default db;
