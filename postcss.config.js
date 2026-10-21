export default {
  plugins: {
    'postcss-import': {},
    // Tailwind 4: el plugin de PostCSS vive en su propio paquete (@tailwindcss/postcss).
    // El paquete `tailwindcss` ya no se registra como plugin de PostCSS.
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
