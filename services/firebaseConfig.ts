import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// TODO: 忘年会本番用: 以下の値をFirebaseコンソールからコピーして書き換えてください
// 手順: Firebase Console -> プロジェクトの設定 -> マイアプリ -> SDKの設定と構成
const firebaseConfig = {
  apiKey: "AIzaSyDAuFHa2FVxecDatTVzrvutjTeMDyNRQGs",
  authDomain: "quiz-bonenkai-2025.firebaseapp.com",
  databaseURL: "https://quiz-bonenkai-2025-default-rtdb.firebaseio.com",
  projectId: "quiz-bonenkai-2025",
  storageBucket: "quiz-bonenkai-2025.firebasestorage.app",
  messagingSenderId: "425590911798",
  appId: "1:425590911798:web:7cd73742a67122e2f83997"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };
