---
name: Academic Presence
colors:
  surface: '#f6faf9'
  surface-dim: '#d7dbda'
  surface-bright: '#f6faf9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f4f3'
  surface-container: '#ebefee'
  surface-container-high: '#e5e9e8'
  surface-container-highest: '#dfe3e2'
  on-surface: '#181c1c'
  on-surface-variant: '#414849'
  inverse-surface: '#2d3131'
  inverse-on-surface: '#edf2f1'
  outline: '#71787a'
  outline-variant: '#c1c8c9'
  surface-tint: '#42646a'
  primary: '#00242a'
  on-primary: '#ffffff'
  primary-container: '#163a40'
  on-primary-container: '#81a4ab'
  inverse-primary: '#a9cdd4'
  secondary: '#775a20'
  on-secondary: '#ffffff'
  secondary-container: '#fdd48e'
  on-secondary-container: '#775a20'
  tertiary: '#00242a'
  on-tertiary: '#ffffff'
  tertiary-container: '#043b43'
  on-tertiary-container: '#78a5ae'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c4e9f0'
  primary-fixed-dim: '#a9cdd4'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#294c52'
  secondary-fixed: '#ffdea7'
  secondary-fixed-dim: '#e8c17c'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5c4208'
  tertiary-fixed: '#bceaf4'
  tertiary-fixed-dim: '#a0ced8'
  on-tertiary-fixed: '#001f24'
  on-tertiary-fixed-variant: '#1e4d55'
  background: '#f6faf9'
  on-background: '#181c1c'
  surface-variant: '#dfe3e2'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  caption:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar_width: 17.5rem
  container_padding: 2rem
  gutter: 1.5rem
  stack_sm: 0.5rem
  stack_md: 1rem
  stack_lg: 2rem
---

## Brand & Style

The design system is engineered for high-stakes institutional management, balancing the rigor of academic administration with a premium, distinguished aesthetic. The brand personality is authoritative yet welcoming, utilizing a **Corporate Modern** style with **Tactile** accents to evoke a sense of tradition and reliability.

The interface prioritizes clarity and efficiency for staff while maintaining a "luxury-educational" feel through the use of deep botanical greens and metallic gold accents. The visual language uses heavy whitespace, sophisticated typography, and subtle depth to transform a utilitarian task—attendance tracking—into a refined administrative experience.

## Colors

The palette is rooted in a deep "Academic Green" (`--brand`), providing a stable, institutional foundation. This is contrasted by "Prestige Gold" (`--accent`), used sparingly to highlight primary actions and denote excellence. 

**Application Rules:**
- **Backgrounds:** Use the cool-toned neutral (`--background`) for the main canvas to reduce eye strain.
- **Surface:** Main content areas must use pure white to ensure high legibility and contrast.
- **Gradients:** Apply a subtle linear gradient (135deg) from `--brand` to `--brand-soft` for headers, and a very faint overlay of `--accent-soft` in decorative background elements to add warmth.
- **Status:** Attendance colors should be used in high-chroma for indicators (dots, icons) and low-chroma (soft versions) for background washes in table rows or calendar cells.

## Typography

The system utilizes **Hanken Grotesk** for its exceptional readability in Hebrew and English, offering a clean, contemporary grotesque feel that aligns with the institutional theme.

- **Alignment:** All text is Right-to-Left (RTL) by default.
- **Hierarchy:** Use Bold (700) for section headers and Medium (500) for sub-headers. 
- **Body Text:** Use Regular (400) for general content. In data-heavy tables, reduce the body size to `body-md` for maximum information density without sacrificing clarity.
- **Numbers:** Tabular lining should be used for attendance figures and dates to ensure vertical alignment in columns.

## Layout & Spacing

The layout follows a **Fixed Grid** model for administrative clarity, centered on a wide right-hand sidebar.

- **Sidebar (Right):** A fixed width of `17.5rem`. This area serves as the primary navigation and global filter hub. It should use a dark theme (`--brand`) to contrast with the light content area.
- **Content Area:** A fluid container with a maximum width of 1440px, utilizing a 12-column grid.
- **Rhythm:** An 8px base unit drives all spacing. Component internal padding should default to `1rem` (16px), while page margins should be `2rem` (32px).
- **Responsive:** On tablets, the sidebar collapses into a drawer. On mobile, the grid collapses to a single column with cards stacking vertically.

## Elevation & Depth

Visual hierarchy is established through **Tonal Layers** and **Ambient Shadows**.

- **Level 0 (Background):** `--background` (#eef2f1).
- **Level 1 (Cards/Tables):** `--surface` (#ffffff) with a very soft, diffused shadow: `0 4px 20px rgba(22, 58, 64, 0.05)`.
- **Level 2 (Modals/Popovers):** `--surface` with a deeper shadow: `0 12px 32px rgba(22, 58, 64, 0.12)`.
- **Interactions:** Hover states on clickable cards should slightly lift the element (move up 2px) and deepen the shadow to create a tactile physical response.

## Shapes

The shape language is sophisticated and modern, avoiding sharp corners in favor of approachable, geometric curves.

- **Standard Elements:** Buttons, inputs, and small containers use `rounded-lg` (0.5rem / 8px).
- **Major Containers:** Large dashboard cards and the main content wrapper use `rounded-xl` (1rem / 16px).
- **Pills:** Status indicators and chips use a fully rounded (pill) shape to distinguish them from structural elements.
- **Borders:** Use `--border` at 1px width for subtle separation between list items or table rows.

## Components

### Buttons
- **Primary:** Background `--brand`, text `--surface`. Heavy, authoritative.
- **Secondary:** Background `--accent`, text `--brand`. Used for "Add New" or "Export" actions.
- **Ghost:** Outline `--border`, text `--brand`. Used for secondary navigation.

### Cards
Cards are the primary container for student profiles and attendance summaries. They must include a 4px top border in `--accent` for "featured" cards or the relevant status color (e.g., `--attendance-absent`) for individual records.

### StatusPills
- **OK:** Background `rgba(16, 185, 129, 0.1)`, text `--attendance-present`.
- **Warning:** Background `rgba(245, 158, 11, 0.1)`, text `--attendance-late`.
- **Blocked:** Background `rgba(244, 63, 94, 0.1)`, text `--attendance-absent`.

### Tables
Clean, minimal styling. Header rows should have a subtle background wash of `--background`. Row hover states use a faint tint of `--accent-soft`. Use specific cell coloring for "Day Completed" (`--day-completed`) and "Day Partial" (`--day-partial`) to provide instant heat-map visual feedback on attendance sheets.

### Input Fields
Fields use a 1px border of `--border`. On focus, the border transitions to `--brand` with a 2px outer glow of `--accent-soft`.

### Sidebar
The right-hand sidebar should feature a hierarchical menu. Selected items are highlighted with a vertical gold strip on the right edge (RTL) and a background wash of `--brand-soft`.