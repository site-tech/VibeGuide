# Quick Image Swap Guide

## Available Ad Slots

### 1. Header Ad Banner (Top of Grid)
- **File:** `public/images/ad-banner.png`
- **Size:** 1900px × 200px
- **Aspect ratio:** 9.5:1 (very wide and short)
- **Location:** Top header row, spans 2 columns

### 2. Blank Row Ads (4 Total - Loop Seamlessly)
These 4 ads appear in the blank rows and repeat for seamless scrolling:
- **File 1:** `public/images/ad-row-1.png`
- **File 2:** `public/images/ad-row-2.png`
- **File 3:** `public/images/ad-row-3.png`
- **File 4:** `public/images/ad-row-4.png`
- **Size:** 5700px × 200px (3x wider than header ad)
- **Aspect ratio:** 28.5:1 (extremely wide)
- **Location:** Blank rows between channels (top and bottom match for loop)

---

## How to Replace Images

### Method 1: Manual Replacement (Fastest)
1. Create your PNG at the correct size (see specs above)
2. Name it exactly as shown (e.g., `ad-row-1.png`)
3. Drop it into `public/images/` folder (replace existing)
4. Refresh browser - done!

### Method 2: Ask Kiro to Replace
Simply say:
> "Replace ad-row-1.png with [drag your image file here]"

Or:
> "Update all blank row ads with these 4 images: [drag files]"

Or for the header:
> "Replace ad-banner.png with [drag file]"

---

## Image Specifications Summary

| Ad Slot | File Name | Dimensions | Aspect Ratio |
|---------|-----------|------------|--------------|
| Header Banner | `ad-banner.png` | 1900 × 200 | 9.5:1 |
| Blank Row 1 | `ad-row-1.png` | 5700 × 200 | 28.5:1 |
| Blank Row 2 | `ad-row-2.png` | 5700 × 200 | 28.5:1 |
| Blank Row 3 | `ad-row-3.png` | 5700 × 200 | 28.5:1 |
| Blank Row 4 | `ad-row-4.png` | 5700 × 200 | 28.5:1 |

**All images:**
- Format: PNG (supports transparency)
- Max file size: Keep under 500KB each for fast loading
- Color space: sRGB

---

## Design Tips

### For Header Banner (9.5:1)
- Wide and short format
- Keep important content centered (safe zone: middle 80%)
- Account for 5px border inset on all sides

### For Blank Row Ads (28.5:1)
- Extremely wide format - think panoramic
- Design for horizontal scrolling (users scroll left/right)
- Keep key message in the left 30% (most visible)
- Can use repeating patterns or gradients
- These loop seamlessly, so top and bottom rows match

### General Tips
- Use high contrast colors (displays on purple #423352 background)
- Test on both light and dark backgrounds
- Consider the 3D border effect (5px inset)
- Use 2x resolution for crisp display on high-DPI screens

---

## Troubleshooting

- **Image not showing?** Check filename matches exactly (case-sensitive)
- **Image looks blurry?** Use recommended 2x resolution sizes
- **Image stretched?** Verify aspect ratio matches specs
- **Cache issue?** Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Wrong ad showing?** Check you replaced the correct file (1-4)

---

## File Structure Reference
```
project-root/
  └── public/
      └── images/
          ├── ad-banner.png    ← Header ad (1900×200)
          ├── ad-row-1.png     ← Blank row ad 1 (5700×200)
          ├── ad-row-2.png     ← Blank row ad 2 (5700×200)
          ├── ad-row-3.png     ← Blank row ad 3 (5700×200)
          └── ad-row-4.png     ← Blank row ad 4 (5700×200)
```

---

## Quick Commands for Kiro

**Replace single ad:**
- "Replace ad-row-2.png"
- "Update the header banner image"

**Replace multiple ads:**
- "Replace all 4 blank row ads"
- "Update ad-row-1.png, ad-row-2.png, and ad-row-3.png"

**Check current ads:**
- "Show me the current ad images"
- "List all ad files in public/images"
