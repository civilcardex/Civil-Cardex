export default {
  plugins: {
    // Tailwind 4: el plugin de PostCSS vive en su propio paquete (@tailwindcss/postcss).
    // Sin postcss-import: Vite ya inlinea los @import de CSS de forma nativa (y Tailwind 4
    // también), y sin autoprefixer: Tailwind 4 ya prefija vía Lightning CSS.
    '@tailwindcss/postcss': {},
  },
};
