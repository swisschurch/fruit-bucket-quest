// Zurich Fruit Bucket Quest settings
// 1) Paste the firebaseConfig from Firebase console > Project settings > Your apps (Web) into firebase: below.
// 2) While firebase is null the game runs in demo mode (saved only in this browser, for previewing).
window.HARVEST_CONFIG = {
  firebase: apiKey: "AIzaSyCM8t-9EJ7BEDwzECTw320_VyKWBuOY61E",
  authDomain: "zurich-fruit-bucket-quest.firebaseapp.com",
  projectId: "zurich-fruit-bucket-quest",
  storageBucket: "zurich-fruit-bucket-quest.firebasestorage.app",
  messagingSenderId: "257106342717",
  appId: "1:257106342717:web:35cdecd844b3c10f014b54",
  measurementId: "G-9WJCK1MPGQ",
  /* Example:
  firebase: {
    apiKey: "AIza...",
    authDomain: "my-harvest.firebaseapp.com",
    projectId: "my-harvest",
    storageBucket: "my-harvest.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef"
  },
  */

  // How often (seconds) participant phones refresh team and overall totals.
  // 30 keeps a one-hour game inside the free Spark plan's 50,000 reads/day.
  // A participant's own bucket shows instantly; the big screen is always live.
  pollSeconds: 30
};
