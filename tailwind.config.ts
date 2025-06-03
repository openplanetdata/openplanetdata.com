import type { Config } from "tailwindcss";
export default <Partial<Config>>{
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: { extend: {} },
  plugins: []
};