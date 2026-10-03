// build แล้วส่งโฟลเดอร์ dist ขึ้น branch gh-pages (GitHub Pages เสิร์ฟจาก branch นี้)
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const run = (cmd, cwd) => execSync(cmd, { stdio: "inherit", cwd });
const remote = execSync("git remote get-url origin").toString().trim();
run("npm run build");
writeFileSync("dist/.nojekyll", ""); // ให้ GitHub Pages ไม่แปลงไฟล์ด้วย Jekyll
run("git init -q -b gh-pages", "dist");
run("git add -A", "dist");
run('git commit -q -m "Deploy to GitHub Pages"', "dist");
run(`git push -f ${remote} gh-pages`, "dist");
console.log("✅ deployed → https://opongpangs-star.github.io/baanbrew-lab1/");
