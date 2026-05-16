// TODO(Member 5): Tailwind v3. content includes src/**/*.{ts,tsx}. theme.extend.colors maps to var(--vscode-*) via theme/vsCodeTheme.css.
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: []
};
