# Documenso Theme & Color System Analysis

## Executive Summary

**Primary Brand Color:** **GREEN** (Lime/Mint Green)
- HSL: `95.08 71.08% 67.45%`
- Hex equivalent: Approximately `#A2E771` (bright lime green)
- This is the dominant color used throughout the application

**Is the Theme System Generic?** 
**YES** - The theme system is designed to be generic and customizable, though the default implementation uses Documenso's green brand color.

---

## Color Palette Breakdown

### 1. Primary Colors (Green Theme)

The app uses a **green-based color scheme** as its primary brand identity:

#### Main Primary Color
- **Primary**: `95.08 71.08% 67.45%` (Bright lime/mint green)
- **Primary Foreground**: `95.08 71.08% 10%` (Dark green for text)
- **Ring/Focus**: `95.08 71.08% 67.45%` (Same as primary)

#### Extended Primary Palette (New System)
```css
--new-primary-50: 98, 73%, 97%   /* Lightest green tint */
--new-primary-100: 95, 73%, 94%
--new-primary-200: 94, 70%, 87%
--new-primary-300: 95, 71%, 81%
--new-primary-400: 95, 71%, 74%
--new-primary-500: 95, 71%, 67%  /* Main primary */
--new-primary-600: 95, 71%, 54%
--new-primary-700: 95, 71%, 41%
--new-primary-800: 95, 71%, 27%
--new-primary-900: 95, 72%, 14%
--new-primary-950: 95, 72%, 7%   /* Darkest green */
```

#### Documenso Brand Color (Hardcoded)
- **Documenso Green**: `#A2E771` (defined in Tailwind config)
- Full scale: 50-950 shades available
- Used for brand-specific elements

### 2. Semantic Colors

#### Background & Surface
- **Background**: `0 0% 100%` (White in light mode)
- **Foreground**: `222.2 47.4% 11.2%` (Dark blue-gray text)
- **Card**: `0 0% 100%` (White)
- **Muted**: `210 40% 96.1%` (Light blue-gray)
- **Widget**: `0 0% 97%` (Off-white)

#### Interactive Elements
- **Border**: `214.3 31.8% 91.4%` (Light gray-blue)
- **Input**: `214.3 31.8% 91.4%` (Same as border)
- **Ring**: `95.08 71.08% 67.45%` (Primary green for focus)

#### Status Colors
- **Destructive**: `0 100% 50%` (Red)
- **Warning**: `54 96% 45%` (Yellow/Amber)
- **Gold**: `47.9 95.8% 53.1%` (Gold accent)

#### Secondary Colors
- **Info** (Blue): Full scale 50-950
- **Error** (Red): Full scale 50-950  
- **Warning** (Orange/Yellow): Full scale 50-950

### 3. Recipient Colors (Multi-color System)

Used for differentiating document recipients:
- **Green**: `100 48% 55%`
- **Blue**: `212 56% 50%`
- **Purple**: `266 100% 64%`
- **Orange**: `36 92% 54%`
- **Yellow**: `51 100% 43%`
- **Pink**: `313 65% 57%`

### 4. Neutral Grays

Complete neutral scale (50-950) for text, borders, and backgrounds:
- **Neutral-50**: `0, 0%, 96%` (Lightest)
- **Neutral-950**: `0, 0%, 9%` (Darkest)

### 5. Dark Mode Colors

Dark mode maintains the same primary green but adjusts:
- **Background**: `0 0% 14.9%` (Dark gray)
- **Foreground**: `0 0% 97%` (Near white)
- **Primary**: Same green (`95.08 71.08% 67.45%`)
- **Card**: `0 0% 14.9%` (Dark gray)

---

## Theme System Architecture

### 1. CSS Variables System

**Location**: `packages/ui/styles/theme.css`

The theme uses CSS custom properties (variables) defined in HSL format:
- All colors are defined as HSL values
- Variables are prefixed with `--`
- Supports both light and dark modes
- Uses semantic naming (primary, secondary, destructive, etc.)

### 2. Tailwind Integration

**Location**: `packages/tailwind-config/index.cjs`

Colors are mapped to Tailwind utilities:
```javascript
primary: {
  DEFAULT: 'hsl(var(--primary))',
  foreground: 'hsl(var(--primary-foreground))',
}
```

### 3. Dynamic Theme Customization

**Location**: `apps/remix/app/utils/css-vars.ts`

The system provides utilities for **runtime theme customization**:

#### Key Functions:
- `ZCssVarsSchema`: Zod schema for validating theme variables
- `toNativeCssVars()`: Converts color values to CSS variables
- `injectCss()`: Dynamically injects custom CSS variables

#### Supported Customizations:
- Background colors
- Foreground colors
- Primary/secondary/accent colors
- Destructive/warning colors
- Border radius
- All semantic color tokens

### 4. Embedding/White-label Support

**Location**: `apps/documentation/pages/developers/embedding/css-variables.mdx`

The documentation explicitly shows the theme system is designed for:
- **White-labeling**: Customers can customize colors
- **Embedding**: CSS variables can be passed to embedded components
- **Brand customization**: Primary colors can be changed to match customer brands

---

## Is the Theme System Generic?

### ✅ YES - Generic Features:

1. **CSS Variable Architecture**
   - All colors use CSS variables, making them easily overridable
   - No hardcoded color values in components (mostly)
   - Semantic naming allows easy theme swapping

2. **Runtime Customization API**
   - `css-vars.ts` provides programmatic theme injection
   - Supports any CSS color format (hex, rgb, hsl, named)
   - Automatic conversion to HSL format

3. **Embedding Support**
   - Documentation shows white-labeling capabilities
   - CSS variables can be passed to embedded components
   - Designed for multi-tenant customization

4. **Semantic Color Tokens**
   - Uses semantic names (primary, secondary, destructive)
   - Not tied to specific color values
   - Easy to swap entire color schemes

5. **Dark Mode Support**
   - Generic dark mode implementation
   - Works with any color scheme
   - Can be disabled via `.dark-mode-disabled`

### ⚠️ Partially Generic - Brand-Specific Elements:

1. **Default Green Theme**
   - Default implementation uses Documenso's green brand
   - Primary color is hardcoded to green in theme.css
   - Some components may reference green directly

2. **Documenso Brand Color**
   - Hardcoded `documenso-*` color scale in Tailwind config
   - Used in some components (e.g., `text-documenso-700`)
   - Not part of the generic theme system

3. **Field Card Colors**
   - Field cards use green tints by default
   - `--field-card`: `95 74% 90%` (light green)
   - `--field-card-border`: `95.08 71.08% 67.45%` (primary green)

---

## Color Usage Patterns

### Most Common Colors:

1. **Primary Green** (`95.08 71.08% 67.45%`)
   - Buttons, links, focus states
   - Active states, selected items
   - Brand elements

2. **Neutral Grays**
   - Text, borders, backgrounds
   - Muted elements
   - Secondary UI elements

3. **Recipient Colors**
   - Document recipient differentiation
   - Field highlighting
   - Multi-user workflows

### Component Usage:

- **Buttons**: Primary green for primary actions
- **Links**: Green hover states
- **Focus Rings**: Green outline
- **Selected States**: Green backgrounds/borders
- **Cards**: White with green border accents
- **Fields**: Light green backgrounds

---

## Recommendations for Customization

To make the theme fully generic for white-labeling:

1. **Remove Hardcoded Green References**
   - Replace any direct green color references
   - Use semantic tokens exclusively

2. **Make Primary Color Configurable**
   - Ensure all components use `--primary` variable
   - No direct HSL values in components

3. **Document Customization Process**
   - Already documented in embedding docs
   - Could add more examples

4. **Test with Different Color Schemes**
   - Verify all components work with non-green themes
   - Ensure contrast ratios are maintained

---

## File Index

### Core Theme Files:
- `packages/ui/styles/theme.css` - Main theme definitions
- `packages/tailwind-config/index.cjs` - Tailwind color mappings
- `apps/remix/app/utils/css-vars.ts` - Theme customization utilities

### Theme Management:
- `apps/remix/app/routes/api+/theme.tsx` - Theme API endpoint
- `apps/remix/app/storage/theme-session.server.ts` - Theme session storage
- `packages/ui/primitives/theme-switcher.tsx` - Theme switcher component

### Documentation:
- `apps/documentation/pages/developers/embedding/css-variables.mdx` - Customization guide

### Usage Examples:
- `apps/remix/app/components/general/envelope-editor/envelope-editor.tsx` - Primary color usage
- `packages/ui/lib/recipient-colors.ts` - Recipient color system
- `apps/remix/app/components/dialogs/team-member-create-dialog.tsx` - Documenso brand color usage

---

## Conclusion

**Primary Color**: **GREEN** (Bright lime/mint green - `#A2E771` equivalent)

**Generic Status**: The theme system is **architecturally generic** with:
- ✅ CSS variable-based architecture
- ✅ Runtime customization API
- ✅ White-labeling support
- ✅ Semantic color tokens
- ⚠️ Default green implementation (customizable)
- ⚠️ Some brand-specific hardcoded colors

The system is designed to be generic and customizable, but currently defaults to Documenso's green brand identity. With proper configuration, it can support any color scheme.
