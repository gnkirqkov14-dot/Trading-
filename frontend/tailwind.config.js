/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f14",
        panel: "#121822",
        panel2: "#1a2230",
        border: "#242e3d",
        accent: "#3ddc97",
        danger: "#ff6b6b",
        muted: "#8a97a8",
      },
    },
  },
  plugins: [],
};
