import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = "gen-lang-client-0897715027";
const databaseId = "ai-studio-hackernotebooktu-241cb9f4-efdd-4dbc-af3f-187fcc9dd03d";

async function main() {
  console.log("Initializing firebase-admin...");
  try {
    initializeApp({
      projectId: projectId,
    });
    
    // Pass databaseId to getFirestore to query the specific database instance
    const db = getFirestore(databaseId);
    
    console.log("Fetching users collection...");
    const usersSnap = await db.collection('users').get();
    console.log(`Found ${usersSnap.size} users in collection 'users'.`);
    
    for (const doc of usersSnap.docs) {
      console.log(`User ID: ${doc.id}`);
      const notebooksSnap = await db.collection('users').doc(doc.id).collection('notebooks').get();
      console.log(`  Notebooks count: ${notebooksSnap.size}`);
      for (const nbDoc of notebooksSnap.docs) {
        console.log(`    Notebook ID: ${nbDoc.id}`);
        console.log(`      Name: ${nbDoc.data().name}`);
        console.log(`      Created At: ${new Date(nbDoc.data().createdAt).toISOString()}`);
        
        // Fetch items count too
        const itemsSnap = await db.collection('users').doc(doc.id).collection('notebooks').doc(nbDoc.id).collection('items').get();
        console.log(`      Items count: ${itemsSnap.size}`);
        for (const itemDoc of itemsSnap.docs) {
          console.log(`        Item: [${itemDoc.data().type}] ${itemDoc.data().title}`);
        }
      }
    }
    
    console.log("Scan completed.");
  } catch (error) {
    console.error("Error in admin execution:", error);
  }
}

main();
