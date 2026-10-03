// สคริปต์ตรวจตัวเลข: รัน metrics.js เดียวกับที่หน้าเว็บใช้ แล้วพิมพ์ผลออกมาเทียบกับ Pivot Table
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { parseRows, computeKpis, salesByBranch, dailySales, billsByHour } from "./src/lib/metrics.js";
const csv = readFileSync("public/sales.csv", "utf8");
const rows = parseRows(Papa.parse(csv, { header: true, skipEmptyLines: true }).data);
console.log(computeKpis(rows));
console.table(salesByBranch(rows));
const d = dailySales(rows); console.log("days", d.length, d[0], d.at(-1));
console.table(billsByHour(rows));
