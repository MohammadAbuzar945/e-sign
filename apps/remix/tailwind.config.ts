/* eslint-disable @typescript-eslint/no-var-requires */
const baseConfig = require('@documenso/ui/tailwind.config.cjs');
const path = require('path');

module.exports = {
  presets: [baseConfig],
  content: [
    './app/**/*.{ts,tsx}',
    `${path.join(require.resolve('@documenso/ui'), '..')}/components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/ui'), '..')}/icons/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/ui'), '..')}/lib/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/ui'), '..')}/primitives/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/email'), '..')}/templates/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/email'), '..')}/template-components/**/*.{ts,tsx}`,
    `${path.join(require.resolve('@documenso/email'), '..')}/providers/**/*.{ts,tsx}`,
  ],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
      colors: {
        ...baseConfig.theme?.extend?.colors,
        // Override green colors with purple (#4c33ff) shades - this changes all green-* Tailwind classes to use purple instead
        green: {
          50: '#F5F3FF',   // Very light purple (from documenso-50)
          100: '#E9E5FF',  // Light purple (from documenso-100)
          200: '#D4CCFF',  // Light purple border/background (from documenso-200)
          300: '#B8A6FF',  // Medium-light purple (from documenso-300)
          400: '#9A7AFF',  // Medium purple (from documenso-400)
          500: '#4C33FF',  // Main purple color (from documenso-500)
          600: '#3D29CC',  // Darker purple (from documenso-600)
          700: '#2E1F99',  // Dark purple (from documenso-700)
          800: '#1F1566',  // Very dark purple (from documenso-800)
          900: '#100A33',  // Darkest purple text (from documenso-900)
          950: '#080519',  // Almost black purple (from documenso-950)
        },
      },
    },
  },
};
