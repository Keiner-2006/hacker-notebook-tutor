/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  query, 
  orderBy, 
  setDoc 
} from 'firebase/firestore';
import { db } from './firebase';
import { Notebook, NotebookItem, Evaluation, Lab } from '../types';

// Enums y tipos de error requeridos por la guía de integración Firebase
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function buildFirestoreUserKey(authUid: string, email?: string | null): string {
  const normalizedEmail = email?.trim().toLowerCase();
  return normalizedEmail && normalizedEmail.length > 0 ? normalizedEmail : authUid;
}

export async function migrateUserWorkspaceToEmailKey(authUid: string, email?: string | null): Promise<string> {
  const preferredUserId = buildFirestoreUserKey(authUid, email);
  if (preferredUserId === authUid) {
    return authUid;
  }

  const sourceNotebooksRef = collection(db, 'users', authUid, 'notebooks');
  const sourceNotebooksSnap = await getDocs(sourceNotebooksRef);
  if (sourceNotebooksSnap.empty) {
    return preferredUserId;
  }

  const targetNotebooksRef = collection(db, 'users', preferredUserId, 'notebooks');
  const targetNotebooksSnap = await getDocs(targetNotebooksRef);
  const targetNotebookIds = new Set(targetNotebooksSnap.docs.map((doc) => doc.id));

  for (const notebookDoc of sourceNotebooksSnap.docs) {
    const targetNotebookId = notebookDoc.id;
    const targetNotebookRef = doc(db, 'users', preferredUserId, 'notebooks', targetNotebookId);
    const targetNotebookDoc = targetNotebookIds.has(targetNotebookId)
      ? await getDoc(targetNotebookRef)
      : null;

    if (!targetNotebookDoc?.exists()) {
      await setDoc(targetNotebookRef, notebookDoc.data());
    }

    const sourceItemsSnap = await getDocs(collection(db, 'users', authUid, 'notebooks', notebookDoc.id, 'items'));
    for (const itemDoc of sourceItemsSnap.docs) {
      const targetItemRef = doc(db, 'users', preferredUserId, 'notebooks', notebookDoc.id, 'items', itemDoc.id);
      if (!(await getDoc(targetItemRef)).exists()) {
        await setDoc(targetItemRef, itemDoc.data());
      }
    }

    const sourceEvalsSnap = await getDocs(collection(db, 'users', authUid, 'notebooks', notebookDoc.id, 'evaluations'));
    for (const evalDoc of sourceEvalsSnap.docs) {
      const targetEvalRef = doc(db, 'users', preferredUserId, 'notebooks', notebookDoc.id, 'evaluations', evalDoc.id);
      if (!(await getDoc(targetEvalRef)).exists()) {
        await setDoc(targetEvalRef, evalDoc.data());
      }
    }

    const sourceLabsSnap = await getDocs(collection(db, 'users', authUid, 'notebooks', notebookDoc.id, 'labs'));
    for (const labDoc of sourceLabsSnap.docs) {
      const targetLabRef = doc(db, 'users', preferredUserId, 'notebooks', notebookDoc.id, 'labs', labDoc.id);
      if (!(await getDoc(targetLabRef)).exists()) {
        await setDoc(targetLabRef, labDoc.data());
      }
    }
  }

  return preferredUserId;
}

// Obtener o generar ID de usuario persistente para organizar la base de datos
export function getOrCreateUserId(): { userId: string; handle: string } {
  if (typeof window === 'undefined') {
    return { userId: 'default-user', handle: 'GUEST@local' };
  }
  
  let userId = localStorage.getItem('hacker_user_id');
  let handle = localStorage.getItem('hacker_handle');
  
  if (!userId) {
    userId = 'usr_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('hacker_user_id', userId);
  }
  
  if (!handle) {
    const handles = ['NEO', 'ZERO_COOL', 'TRINITY', 'ALEX_MERCER', 'CYBER_PUNK', 'ROOT_USER', 'DARE_DEVIL', 'PENTESTER_99'];
    const randomHandle = handles[Math.floor(Math.random() * handles.length)] + '@fsociety';
    handle = randomHandle;
    localStorage.setItem('hacker_handle', handle);
  }
  
  return { userId, handle };
}

export function saveUserHandle(handle: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('hacker_handle', handle);
  }
}

// --- OPERACIONES DE CUADERNOS (NOTEBOOKS) ---

export async function getNotebooks(userId: string): Promise<Notebook[]> {
  const path = `users/${userId}/notebooks`;
  try {
    const ref = collection(db, 'users', userId, 'notebooks');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Notebook));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addNotebook(userId: string, name: string, description: string): Promise<Notebook> {
  const path = `users/${userId}/notebooks`;
  const now = Date.now();
  try {
    const ref = collection(db, 'users', userId, 'notebooks');
    const docRef = await addDoc(ref, {
      name,
      description,
      createdAt: now
    });
    
    return {
      id: docRef.id,
      name,
      description,
      createdAt: now
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteNotebook(userId: string, notebookId: string): Promise<void> {
  const path = `users/${userId}/notebooks/${notebookId}`;
  try {
    const notebookRef = doc(db, 'users', userId, 'notebooks', notebookId);
    await deleteDoc(notebookRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- OPERACIONES DE ITEMS DEL CUADERNO (NOTAS, COMANDOS, TÉCNICAS) ---

export async function getNotebookItems(userId: string, notebookId: string): Promise<NotebookItem[]> {
  const path = `users/${userId}/notebooks/${notebookId}/items`;
  try {
    const ref = collection(db, 'users', userId, 'notebooks', notebookId, 'items');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as NotebookItem));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addNotebookItem(
  userId: string, 
  notebookId: string, 
  item: Omit<NotebookItem, 'id' | 'createdAt'>
): Promise<NotebookItem> {
  const path = `users/${userId}/notebooks/${notebookId}/items`;
  const now = Date.now();
  const itemData = {
    ...item,
    createdAt: now
  };
  
  try {
    const ref = collection(db, 'users', userId, 'notebooks', notebookId, 'items');
    const docRef = await addDoc(ref, itemData);
    return {
      id: docRef.id,
      ...itemData
    } as NotebookItem;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateNotebookItem(
  userId: string,
  notebookId: string,
  itemId: string,
  updatedFields: Partial<Omit<NotebookItem, 'id' | 'createdAt'>>
): Promise<void> {
  const path = `users/${userId}/notebooks/${notebookId}/items/${itemId}`;
  try {
    const itemRef = doc(db, 'users', userId, 'notebooks', notebookId, 'items', itemId);
    await updateDoc(itemRef, updatedFields);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotebookItem(userId: string, notebookId: string, itemId: string): Promise<void> {
  const path = `users/${userId}/notebooks/${notebookId}/items/${itemId}`;
  try {
    const itemRef = doc(db, 'users', userId, 'notebooks', notebookId, 'items', itemId);
    await deleteDoc(itemRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- OPERACIONES DE EVALUACIONES (EXÁMENES DE APRENDIZAJE ACTIVO) ---

export async function getEvaluations(userId: string, notebookId: string): Promise<Evaluation[]> {
  const path = `users/${userId}/notebooks/${notebookId}/evaluations`;
  try {
    const ref = collection(db, 'users', userId, 'notebooks', notebookId, 'evaluations');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Evaluation));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addEvaluation(userId: string, notebookId: string, evaluation: Omit<Evaluation, 'id'>): Promise<Evaluation> {
  const path = `users/${userId}/notebooks/${notebookId}/evaluations`;
  try {
    const ref = collection(db, 'users', userId, 'notebooks', notebookId, 'evaluations');
    const docRef = await addDoc(ref, evaluation);
    
    return {
      id: docRef.id,
      ...evaluation
    } as Evaluation;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- UTILIDADES DE SESIÓN DE OPERADOR ---

export function getSavedHandleForId(userId: string): string {
  if (typeof window === 'undefined') return 'GUEST@fsociety';
  let handle = localStorage.getItem(`hacker_handle_${userId}`);
  if (!handle) {
    const handles = ['NEO', 'ZERO_COOL', 'TRINITY', 'ALEX_MERCER', 'CYBER_PUNK', 'ROOT_USER', 'DARE_DEVIL', 'PENTESTER_99'];
    const randomHandle = handles[Math.floor(Math.random() * handles.length)] + '@fsociety';
    handle = randomHandle;
    localStorage.setItem(`hacker_handle_${userId}`, handle);
  }
  return handle;
}

export function saveUserHandleForId(userId: string, handle: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`hacker_handle_${userId}`, handle);
    localStorage.setItem('hacker_handle', handle);
  }
}

// --- OPERACIONES DE LABS (REGISTROS DE LABORATORIOS PRÁCTICOS) ---

export async function getLabs(userId: string, notebookId: string): Promise<Lab[]> {
  const path = `users/${userId}/notebooks/${notebookId}/labs`;
  try {
    const ref = collection(db, 'users', userId, 'notebooks', notebookId, 'labs');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Lab));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addLab(
  userId: string, 
  notebookId: string, 
  lab: Omit<Lab, 'id' | 'createdAt'>
): Promise<Lab> {
  const path = `users/${userId}/notebooks/${notebookId}/labs`;
  const now = Date.now();
  const labData = {
    ...lab,
    createdAt: now
  };
  
  try {
    const ref = collection(db, 'users', userId, 'notebooks', notebookId, 'labs');
    const docRef = await addDoc(ref, labData);
    return {
      id: docRef.id,
      ...labData
    } as Lab;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateLab(
  userId: string,
  notebookId: string,
  labId: string,
  updatedFields: Partial<Omit<Lab, 'id' | 'createdAt'>>
): Promise<void> {
  const path = `users/${userId}/notebooks/${notebookId}/labs/${labId}`;
  try {
    const labRef = doc(db, 'users', userId, 'notebooks', notebookId, 'labs', labId);
    await updateDoc(labRef, updatedFields);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLab(userId: string, notebookId: string, labId: string): Promise<void> {
  const path = `users/${userId}/notebooks/${notebookId}/labs/${labId}`;
  try {
    const labRef = doc(db, 'users', userId, 'notebooks', notebookId, 'labs', labId);
    await deleteDoc(labRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}


