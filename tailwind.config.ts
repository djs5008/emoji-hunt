import type { Config } from 'tailwindcss'

/**
 * Tailwind CSS Configuration
 * 
 * @description Configuration for Tailwind CSS utility-first framework.
 * Minimal setup using default Tailwind utilities for styling the game UI.
 */
const config: Config = {
  // Specify which files Tailwind should scan for class names
  // This ensures only used styles are included in the final CSS bundle
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',      // Pages directory (if used)
    './components/**/*.{js,ts,jsx,tsx,mdx}', // Components directory (if used)
    './app/**/*.{js,ts,jsx,tsx,mdx}',       // App directory (main source)
  ],
  
  theme: {
    // No custom theme extensions - using Tailwind defaults
    // This keeps the styling consistent and predictable
    extend: {},
  },
  
  // No additional plugins needed for this project
  // Tailwind's built-in utilities are sufficient
  plugins: [],
}

export default config