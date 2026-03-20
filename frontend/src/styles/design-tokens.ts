// Apple-inspired Design Tokens for NexusAI Protocol

export const colors = {
  light: {
    // Primary
    primary: '#007AFF',
    primaryHover: '#0051D5',
    primaryActive: '#004FC4',
    
    // Background
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F7',
    backgroundTertiary: '#E8E8ED',
    
    // Surface
    surface: '#FFFFFF',
    surfaceHover: '#F5F5F7',
    
    // Text
    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textTertiary: '#86868B',
    
    // Border
    border: '#D2D2D7',
    borderHover: '#B8B8BD',
    
    // Status
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#007AFF',
    
    // Semantic
    positive: '#34C759',
    negative: '#FF3B30',
    
    // Glass morphism
    glassBackground: 'rgba(255, 255, 255, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.18)',
  },
  dark: {
    // Primary
    primary: '#0A84FF',
    primaryHover: '#409CFF',
    primaryActive: '#0077ED',
    
    // Background
    background: '#000000',
    backgroundSecondary: '#1C1C1E',
    backgroundTertiary: '#2C2C2E',
    
    // Surface
    surface: '#1C1C1E',
    surfaceHover: '#2C2C2E',
    
    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textTertiary: '#EBEBF599',
    
    // Border
    border: '#38383A',
    borderHover: '#48484A',
    
    // Status
    success: '#32D74B',
    warning: '#FF9F0A',
    error: '#FF453A',
    info: '#0A84FF',
    
    // Semantic
    positive: '#32D74B',
    negative: '#FF453A',
    
    // Glass morphism
    glassBackground: 'rgba(28, 28, 30, 0.7)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
  },
} as const;

export const typography = {
  // Display
  displayLarge: {
    fontSize: '56px',
    lineHeight: '64px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  displayMedium: {
    fontSize: '48px',
    lineHeight: '56px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  displaySmall: {
    fontSize: '40px',
    lineHeight: '48px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  
  // Heading
  h1: {
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  h2: {
    fontSize: '28px',
    lineHeight: '36px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: 600,
  },
  h4: {
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: 600,
  },
  
  // Body
  bodyLarge: {
    fontSize: '17px',
    lineHeight: '24px',
    fontWeight: 400,
  },
  bodyMedium: {
    fontSize: '15px',
    lineHeight: '22px',
    fontWeight: 400,
  },
  bodySmall: {
    fontSize: '13px',
    lineHeight: '20px',
    fontWeight: 400,
  },
  
  // Label
  labelLarge: {
    fontSize: '15px',
    lineHeight: '20px',
    fontWeight: 500,
  },
  labelMedium: {
    fontSize: '13px',
    lineHeight: '18px',
    fontWeight: 500,
  },
  labelSmall: {
    fontSize: '11px',
    lineHeight: '16px',
    fontWeight: 500,
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  base: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
  '4xl': '96px',
} as const;

export const borderRadius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
} as const;

export const animations = {
  // Durations
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  
  // Easing
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  
  // Framer Motion variants
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
  
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
  
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2 },
  },
  
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.2 },
  },
} as const;

// Breakpoints
export const breakpoints = {
  mobile: '320px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1440px',
} as const;

// Z-index layers
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
} as const;
