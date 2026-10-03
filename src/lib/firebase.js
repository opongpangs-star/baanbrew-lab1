// เชื่อมต่อ Firebase (Lab 3.2–3.3)
// ค่า config อ่านจาก .env.local (VITE_*) — เป็นแค่ "ที่อยู่" ของโปรเจกต์ เปิดเผยได้ ความปลอดภัยจริงอยู่ที่ firestore.rules
import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ยังไม่ได้ตั้งค่า Firebase → หน้ายอดขาย/ลูกค้า (CSV) ยังใช้ได้ปกติ แค่แท็บ Real-time จะแจ้งว่ายังไม่เชื่อมต่อ
export const firebaseReady = Boolean(config.apiKey && config.projectId && config.appId);
const app = firebaseReady ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export const logOut = () => signOut(auth);

// สถานะผู้ใช้: undefined = กำลังตรวจ, null = ยังไม่ล็อกอิน, object = ล็อกอินแล้ว
export function useAuthUser() {
  const [user, setUser] = useState(auth ? undefined : null);
  useEffect(() => (auth ? onAuthStateChanged(auth, setUser) : undefined), []);
  return user;
}

// วันที่/ชั่วโมงปัจจุบันตามเวลาไทย (ไม่ใช้ toISOString ที่เป็น UTC — จะทำให้วันเลื่อนช่วงก่อน 7 โมงเช้า)
export function bangkokNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

// แปลข้อผิดพลาดของ Firebase ที่เจอบ่อยเป็นภาษาไทย
export function firebaseErrorText(err) {
  const code = err?.code || "";
  if (code.includes("permission-denied")) return "ไม่มีสิทธิ์ (Security Rules ปฏิเสธ) — ตรวจว่าล็อกอินแล้ว และข้อมูลถูกต้อง";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "ปิดหน้าต่างล็อกอินก่อนเสร็จ";
  if (code.includes("unauthorized-domain")) return "โดเมนนี้ยังไม่ได้รับอนุญาต — เพิ่มใน Firebase Console → Authentication → Settings → Authorized domains";
  if (code.includes("operation-not-allowed")) return "ยังไม่ได้เปิด Google sign-in ใน Firebase Console → Authentication → Sign-in method";
  if (code.includes("unavailable")) return "เชื่อมต่อฐานข้อมูลไม่ได้ ตรวจอินเทอร์เน็ต";
  return err?.message || "เกิดข้อผิดพลาด";
}
