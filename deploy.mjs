// build แล้วส่งโฟลเดอร์ dist ขึ้น branch gh-pages (GitHub Pages เสิร์ฟจาก branch นี้)
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
const run = (cmd, cwd) => execSync(cmd, { stdio: "inherit", cwd });
const git = (args) => execSync(`git ${args}`).toString().trim();
const remote = git("remote get-url origin");
// ใช้ชื่อ/อีเมลผู้ commit เดียวกับ repo หลัก (repo ชั่วคราวใน dist ไม่มี config ของตัวเอง)
const who = `-c user.name="${git("config user.name")}" -c user.email="${git("config user.email")}"`;
run("npm run build");
writeFileSync("dist/.nojekyll", ""); // ให้ GitHub Pages ไม่แปลงไฟล์ด้วย Jekyll
rmSync("dist/.git", { recursive: true, force: true });
run("git init -q -b gh-pages", "dist");
run("git add -A", "dist");
run(`git ${who} commit -q -m "Deploy to GitHub Pages"`, "dist");
run(`git push -f ${remote} gh-pages`, "dist");
console.log("✅ deployed → https://opongpangs-star.github.io/baanbrew-lab1/");
