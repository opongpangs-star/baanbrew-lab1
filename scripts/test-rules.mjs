// ทดสอบ Security Rules กับฐานข้อมูลจริง: npm run test:rules
// ใช้ผู้ใช้ทดสอบชั่วคราว (custom token จาก firebase-admin) แล้วลบทิ้งพร้อมข้อมูลทดสอบเมื่อเสร็จ
import { readFileSync } from "node:fs";
import { initializeApp as adminApp, cert } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminDb } from "firebase-admin/firestore";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import {
  getFirestore, collection, doc, getDocs, limit, query, setDoc, updateDoc, deleteDoc, serverTimestamp, terminate,
} from "firebase/firestore";

const env = process.env;
adminApp({ credential: cert(JSON.parse(readFileSync(env.SERVICE_ACCOUNT_PATH, "utf8"))) });
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);
const UID = "rules-test-bot";
const testIds = [];
let pass = 0, fail = 0;

async function expect(label, shouldSucceed, fn) {
  let ok;
  try { await fn(); ok = true; } catch (e) { ok = false; if (!String(e.code).includes("permission-denied")) console.log(`     (${e.code || e.message})`); }
  const good = ok === shouldSucceed;
  good ? pass++ : fail++;
  console.log(`${good ? "✅" : "❌"} ${label} → ${ok ? "อนุญาต" : "ปฏิเสธ"} (ควร${shouldSucceed ? "อนุญาต" : "ปฏิเสธ"})`);
}

const sale = (over = {}) => {
  const id = `WEBTEST${Date.now()}${Math.floor(Math.random() * 1000)}-P001`;
  testIds.push(id);
  return [id, { order_id: id.split("-")[0], date: "2026-10-04", hour: 10, branch: "สยาม", product_id: "P001", qty: 2, unit_price: 55, revenue: 110,
    customer_id: null, payment_method: "เงินสด", channel: "หน้าร้าน", source: "web", created_by: UID, created_by_name: "Rules Test",
    created_at: serverTimestamp(), ...over }];
};

console.log("— ยังไม่ล็อกอิน —");
await expect("อ่าน sales", false, () => getDocs(query(collection(db, "sales"), limit(1))));
await expect("เพิ่มยอดขาย", false, () => { const [id, d] = sale(); return setDoc(doc(db, "sales", id), d); });

await signInWithCustomToken(auth, await adminAuth().createCustomToken(UID));
console.log("— ล็อกอินแล้ว —");
await expect("อ่าน sales", true, () => getDocs(query(collection(db, "sales"), limit(1))));
const [goodId, good] = sale();
await expect("เพิ่มยอดขายที่ถูกต้อง (qty 2 × ฿55 = ฿110)", true, () => setDoc(doc(db, "sales", goodId), good));
await expect("qty = -5 (ตามสไลด์)", false, () => { const [id, d] = sale({ qty: -5, revenue: -275 }); return setDoc(doc(db, "sales", id), d); });
await expect("qty = 0", false, () => { const [id, d] = sale({ qty: 0, revenue: 0 }); return setDoc(doc(db, "sales", id), d); });
await expect("qty = 1.5 (ไม่ใช่จำนวนเต็ม)", false, () => { const [id, d] = sale({ qty: 1.5, revenue: 82.5 }); return setDoc(doc(db, "sales", id), d); });
await expect("revenue ไม่ตรงกับ qty × ราคา", false, () => { const [id, d] = sale({ revenue: 999999 }); return setDoc(doc(db, "sales", id), d); });
await expect("สาขาที่ไม่มีจริง", false, () => { const [id, d] = sale({ branch: "ปลอม" }); return setDoc(doc(db, "sales", id), d); });
await expect("บันทึกในชื่อคนอื่น (created_by ปลอม)", false, () => { const [id, d] = sale({ created_by: "someone-else" }); return setDoc(doc(db, "sales", id), d); });
await expect("แนบ field แปลกปลอม", false, () => { const [id, d] = sale({ is_admin: true }); return setDoc(doc(db, "sales", id), d); });
await expect("แก้ไขรายการ", false, () => updateDoc(doc(db, "sales", goodId), { qty: 50, revenue: 2750 }));
await expect("ลบรายการ", false, () => deleteDoc(doc(db, "sales", goodId)));
await expect("เขียน collection อื่น", false, () => setDoc(doc(db, "admins", "x"), { a: 1 }));

// เก็บกวาด: ลบข้อมูลทดสอบและผู้ใช้ทดสอบด้วยสิทธิ์ admin
await signOut(auth);
await terminate(db);
const adb = adminDb();
await Promise.all(testIds.map((id) => adb.collection("sales").doc(id).delete()));
await adminAuth().deleteUser(UID).catch(() => {});
console.log(`\nผล: ผ่าน ${pass} / ${pass + fail} ข้อ · ลบข้อมูลทดสอบและผู้ใช้ทดสอบแล้ว`);
process.exit(fail ? 1 : 0);
