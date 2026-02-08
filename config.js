// Firebase Configuration
// Uses global 'firebase' object from compat libraries in index.html

// Default Configuration (Provided by User)
const defaultExposedConfig = {
    apiKey: "AIzaSyCGxgby7nheVf8TbtFjICoXxbrsTvzIcsw",
    authDomain: "clp-msc.firebaseapp.com",
    projectId: "clp-msc",
    storageBucket: "clp-msc.firebasestorage.app",
    messagingSenderId: "420260005726",
    appId: "1:420260005726:web:18e86c34f7fa100294b1cf",
    measurementId: "G-ESJHDQWPNE"
};

// Check for override in LocalStorage
const savedConfig = localStorage.getItem('clp_msc_firebase_config');
let firebaseConfig = defaultExposedConfig;

if (savedConfig) {
    try {
        const parsed = JSON.parse(savedConfig);
        // If saved config has keys, use it
        if (parsed.apiKey) {
            console.log("Using Firebase config from LocalStorage.");
            firebaseConfig = parsed;
        }
    } catch (e) {
        console.warn("Error parsing saved config, using default.");
    }
}

// Initialize Firebase
if (firebaseConfig.apiKey) {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    // Initialize services
    const db = firebase.firestore();
    const storage = firebase.storage();
    // Expose to window for script.js
    window.db = db;
    window.storage = storage;
    console.log("Firebase Initialized.");
} else {
    console.error("Firebase Configuration Missing!");
}
