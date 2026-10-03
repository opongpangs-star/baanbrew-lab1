import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base = ชื่อ repo เพราะ GitHub Pages เสิร์ฟที่ https://<user>.github.io/baanbrew-lab1/
export default defineConfig({
  base: "/baanbrew-lab1/",
  plugins: [react(), tailwindcss()],
});
