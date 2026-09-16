/* Shared Firebase configuration for Original Concert 3.0.
 * Other pages query Firestore through this file:
 *   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
 *   <script src="js/firebase-config.js"></script>
 * Then use `window.db` (Firestore) e.g. window.db.collection('tickets')...
 */
const firebaseConfig = {
  apiKey: "AIzaSyAhN5gEdNvN-9cY5XwJodyfZ_zF11VQr2w",
  authDomain: "original-concert.firebaseapp.com",
  projectId: "original-concert",
  storageBucket: "original-concert.firebasestorage.app",
  messagingSenderId: "1013926515363",
  appId: "1:1013926515363:web:06978260900aa60fd3e516"
};

(function initSharedFirebase() {
  if (typeof firebase === 'undefined' || !firebase.initializeApp) {
    console.error('[firebase-config] Firebase core SDK was NOT loaded before js/firebase-config.js. Check the script tags in your HTML.');
    return;
  }
  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
  } catch (err) {
    console.error('[firebase-config] firebase.initializeApp failed:', err);
  }
  try {
    if (typeof firebase.firestore === 'function') {
      window.db = firebase.firestore();
      console.log('[firebase-config] Firestore initialised for project:', firebaseConfig.projectId);
    } else {
      console.error('[firebase-config] firebase.firestore is not available. Ensure firebase-firestore-compat.js is loaded BEFORE js/firebase-config.js.');
    }
  } catch (err) {
    console.error('[firebase-config] Failed to init Firestore:', err);
  }
  window.firebaseConfig = firebaseConfig;
})();
