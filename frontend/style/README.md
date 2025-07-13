# UNIVERSAL STYLE GUIDE

**Interface System Standard — JOHNJOHNFM, LLC**

---

## 1. SYSTEM PRINCIPLES

- Minimalist, expressive, performant
- Fully responsive, mobile-first layout
- No animation bloat or decorative excess
- Clear typographic and spatial hierarchy
- Designed for reuse in web apps, dashboards, builders, portals

---

## 2. COLOR PALETTE

| Role | Color Name | HEX |
| --- | --- | --- |
| Primary Accent | Concrete Yellow | `#fed001` |
| Primary Text | Charcoal Gray | `#333333` |
| Muted Text | Medium Gray | `#666666` |
| Input BG | White | `#ffffff` |
| Input Border | Light Gray | `#cccccc` |
| Tooltip Shadow | Soft Shadow | `rgba(0, 0, 0, 0.15)` |
| Tooltip Backdrop | Frosted White | `rgba(255, 255, 255, 0.95)` |

---

## 3. TYPOGRAPHY

| Element | Font Family | Size | Style |
| --- | --- | --- | --- |
| Headings | `Helvetica, sans-serif` | ~18–22px | Bold, centered |
| Labels | `Helvetica, sans-serif` | 14px | Bold, uppercase |
| Body Text | `Helvetica, sans-serif` | 13–15px | Normal |
| Tooltip Titles | System UI stack | 14px | Semi-bold |
| Tooltip Desc | System UI stack | 13px | Normal |

---

## 4. LAYOUT & SPACING

- Max container width: `350px`
- Side padding: `16px`
- Section margins: `24–32px`
- Input stack spacing: `16px`
- Fully box-model compliant (`box-sizing: border-box`)

---

## 5. UI ELEMENTS

### ✖️ Inputs

- Full-width text inputs
- `12px` padding, `15px` font-size
- Rounded corners (`5px`)
- Gray border (`#ccc`)
- Light placeholder text (`#999`)
- `margin-bottom: 16px`

---

### ✖️ Buttons

- Height: `36px`
- Padding: `0 24px`
- Background: black
- Text: white
- Border radius: `5px`
- On hover:
    - Background: `#fed001`
    - Text: black

---

### ✖️ Toggle Switch (Two-Option)

- Flex container with pill background (`#000`)
- Child `<span>` elements toggle styles based on active state:
    - Active: yellow background, black text
    - Inactive: white text, transparent background
- Reusable for quick/full, on/off, light/dark, etc.

---

### ✖️ Tooltip (Hover Info Callout)

- Triggered by hover or focus on icon
- Callout box:
    - Frosted white with `backdrop-filter`
    - Border radius: `12px`
    - Box shadow: `0 8px 24px rgba(0,0,0,0.15)`
    - Triangle arrow built with CSS border
    - Appears via opacity + transform transitions
- Hidden by default
- `.active` class enables animated visibility

---

### ✖️ Output Textarea

- Height: `240px`
- Padding: `12px`
- Font size: `15px`
- Border: `1px solid #ccc`
- Rounded corners: `5px`
- Non-resizable (`resize: none`)
- Read-only use case preferred

---

### ✖️ Status Messaging

- Used for inline feedback like “Copied!” or “Generated!”
- Font: `12px`, italic
- Color: `#fed001`
- Vertical margin: `8px`

---

## 6. ANIMATION

### ✖️ Marquee Scroll

```css
@keyframes scroll-left {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

```

---

- Used for scrolling text or persistent branding strips
- Typically on-brand yellow text (#fed001) on white, bold, `14px`

---

## 7. FOOTER

- Font size: `12px`
- Centered with `line-height: 1.5`
- Link styling:
    - Brand links: yellow (`#fed001`)
    - Legal/internal links: gray (`#333`)

---

## 8. RESPONSIVENESS

- Default: mobile-optimized layout
- No media queries required unless expanding width
- Containers center-aligned with intrinsic max-width

---

## 9. COMPONENT CLASSES

| Class Name | Purpose |
| --- | --- |
| `.form-section` | Wraps grouped form inputs |
| `.hidden` | Utility for display toggling |
| `.switch.active-*` | State-based toggle styles |
| `.submit-button` | Universal action button class |
| `.quick-info-callout` | Floating tooltip container |
| `.output` | Text output region |
| `.copy-status` | Copy action feedback |
| `.generate-status` | Generate action feedback |

---

## 10. ATTRIBUTION TEXT

> **© 2025 JOHNJOHNFM, LLC — All rights reserved.**

---

## 11. NOTES

> PDF version of this README can be found at: [https://drive.google.com/file/d/10c40Ae220P0rOJHNZd6WfjKdd5ErTCrX/view?usp=sharing]
