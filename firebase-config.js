// ============================================================
// FIREBASE CONFIG - PAB PELUQUERÍA
// ============================================================
// INSTRUCCIONES PARA CONFIGURAR FIREBASE:
//
// 1. Ve a https://console.firebase.google.com
// 2. Crea un nuevo proyecto llamado "pab-peluqueria"
// 3. Activa Authentication > Sign-in method > Email/Password
// 4. Activa Firestore Database > Crear base de datos
// 5. En Configuración del proyecto > Tus apps > Web (</>)
//    Registra la app y copia los datos de configuración aquí abajo
// 6. En Firestore, ve a Reglas y pega esto:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /users/{userId} {
//          allow read, write: if request.auth != null && 
//            (request.auth.uid == userId || 
//             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
//        }
//        match /appointments/{apptId} {
//          allow read, write: if request.auth != null;
//        }
//      }
//    }
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️ REEMPLAZA ESTOS VALORES CON LOS DE TU PROYECTO FIREBASE:
const firebaseConfig = {
 apiKey: "AIzaSyAiyx9mKA9o3bwltveYdzL2kivKXQiaWBQ",
    authDomain: "pab-peluqueria.firebaseapp.com",
    projectId: "pab-peluqueria",
    storageBucket: "pab-peluqueria.firebasestorage.app",
    messagingSenderId: "535670952335",
    appId: "1:535670952335:web:cefe99b1ebb4b3ef5b7bfa",
    measurementId: "G-RNM56THP05"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ADMIN EMAIL - El usuario con este correo tendrá acceso al panel admin
export const ADMIN_EMAIL = "izplopz@gmail.com";

export const GOOGLE_HOLIDAYS_CALENDAR_ID =
  "es.co#holiday@group.v.calendar.google.com";

export const GOOGLE_CLOSURES_CALENDAR_ID =
  "8e8c95478d9f43bc06fc02274b27a85fef35b76459faefee5a9c293415fb0451@group.calendar.google.com";

export const GOOGLE_CALENDAR_API_KEY =
  "AIzaSyBXzkzeOzg-49IhUWdYitQTWXouo2ysDbg";
