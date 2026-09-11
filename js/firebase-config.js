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
    console.error('Firebase SDK not loaded before js/firebase-config.js');
    return;
  }
  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  try {
    window.db = firebase.firestore();
  } catch (err) {
    console.error('Failed to init Firestore', err);
  }
  window.firebaseConfig = firebaseConfig;
})();
