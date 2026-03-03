/**
 * Bếp Ấm - Design System
 * Theme: Warm Terracotta & Creamy White
 * 
 * Phong cách: Ấm áp, gần gũi, hiện đại
 */

export const COLORS = {
  // === MÀU CHÍNH (Primary) ===
  primary: '#E67E22',           // Cam đất nồng ấm - CTA buttons, active icons
  primaryDark: '#D35400',       // Cam sẫm - Hover/Active states
  primaryLight: '#F5B041',      // Cam nhạt - Highlights, badges
  primaryMuted: '#FAD7A0',      // Cam mờ - Backgrounds, shadows

  // === MÀU NỀN (Background) ===
  background: '#FFFDF5',        // Trắng kem - Main background
  backgroundLight: '#FFFDF5',   // Giữ alias cho compatibility
  backgroundCard: '#FFFFFF',    // Trắng tinh - Cards
  backgroundDark: '#4A2311',    // Nâu đậm - Dark mode background

  // === MÀU VĂN BẢN (Typography) ===
  textPrimary: '#4A2311',       // Nâu đậm gỗ - Headings
  textSecondary: '#6D4C41',     // Nâu xám - Body text
  textMuted: '#A1887F',         // Nâu nhạt - Captions, hints
  textOnPrimary: '#FFFFFF',     // Text trên nền cam

  // === MÀU CẢNH BÁO (Alerts) ===
  warning: '#FAD7A0',           // Vàng cam nhạt - Gentle reminders
  warningDark: '#F39C12',       // Vàng đậm hơn
  danger: '#E74C3C',            // Đỏ gạch - Urgent alerts (expiry)
  dangerLight: '#F1948A',       // Đỏ nhạt - Background
  success: '#27AE60',           // Xanh lá - Success states
  successLight: '#ABEBC6',      // Xanh nhạt

  // === MÀU TIỆN ÍCH (Utility) ===
  white: '#FFFFFF',
  black: '#4A2311',             // Dùng nâu đậm thay vì đen thuần
  gray: '#A1887F',              // Nâu xám nhạt
  grayLight: '#D7CCC8',         // Xám ấm
  grayDark: '#6D4C41',

  // === BORDER & SHADOW ===
  border: '#E8DFD8',            // Border ấm
  borderLight: '#F5F0EB',
  shadow: 'rgba(230, 126, 34, 0.15)', // Shadow cam mờ
};

export const FONTS = {
  // Be Vietnam Pro
  regular: 'BeVietnamPro-Regular',
  medium: 'BeVietnamPro-Medium',
  semiBold: 'BeVietnamPro-SemiBold',
  bold: 'BeVietnamPro-Bold',
};

export const TYPOGRAPHY = {
  display1: {
    fontSize: 32,
    fontFamily: FONTS.bold,
    lineHeight: 40,
  },
  heading1: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    lineHeight: 32,
  },
  heading2: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    lineHeight: 28,
  },
  bodyLarge: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    lineHeight: 24,
  },
  bodyRegular: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    lineHeight: 16,
  },
};

export const SPACING = {
  xs: 4,     // Extra Small: Icon & text
  sm: 8,     // Small: Line spacing in block
  md: 16,    // Medium: Card padding, small spacing
  lg: 24,    // Large: Major section spacing
  xl: 32,    // Extra Large: Screen margin L/R, top spacing
  xxl: 48,
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const RADIUS = {
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  pill: 50,
};
