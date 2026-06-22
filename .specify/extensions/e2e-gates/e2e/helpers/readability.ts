/**
 * UI Readability Gate — Computed style checks for visibility, readability, and overlay detection.
 *
 * This module asserts that UI elements are:
 * 1. Visible in the DOM (not display:none, visibility:hidden, etc.)
 * 2. Readable (text not invisible via opacity, font-size, color-on-color, clip, offscreen)
 * 3. Not blocked by overlays (element at center point is self or descendant)
 *
 * Uses getComputedStyle — NOT pixel diffing.
 */
import { Page, Locator, expect } from '@playwright/test';

export interface ReadabilityResult {
  selector: string;
  label: string;
  visible: boolean;
  readable: boolean;
  blocked: boolean;
  details: Record<string, string>;
}

export interface ReadabilityStyles {
  color: string;
  backgroundColor: string;
  opacity: string;
  visibility: string;
  display: string;
  fontSize: string;
  clipPath: string;
  clip: string;
  textIndent: string;
  overflow: string;
  width: string;
  height: string;
  position: string;
  left: string;
  top: string;
}

/**
 * Assert that an element is visible, readable, and not blocked by an overlay.
 * Throws on failure with descriptive assertion messages.
 */
export async function assertReadable(
  page: Page,
  selector: string,
  label: string,
): Promise<ReadabilityResult> {
  const el = page.locator(selector).first();

  // 1. Element must exist and be visible (Playwright's built-in visibility check)
  await expect(el, `${label}: element must be visible`).toBeVisible();

  // 2. Computed style checks for readability
  const styles = await getComputedStyles(el);
  const readableIssues = checkReadability(styles);
  const readable = readableIssues.length === 0;

  // 3. Overlay blocking check
  const blocked = await isBlockedByOverlay(el);

  const result: ReadabilityResult = {
    selector,
    label,
    visible: true,
    readable,
    blocked,
    details: styles as unknown as Record<string, string>,
  };

  // Assert readability with specific failure messages
  expect(
    readable,
    `${label}: text must be readable. Issues: ${readableIssues.join(', ')}`,
  ).toBe(true);

  expect(
    blocked,
    `${label}: element must not be blocked by overlay`,
  ).toBe(false);

  return result;
}

/**
 * Batch-check multiple selectors for readability. Returns all results,
 * throws on first failure.
 */
export async function assertAllReadable(
  page: Page,
  checks: Array<{ selector: string; label: string }>,
): Promise<ReadabilityResult[]> {
  const results: ReadabilityResult[] = [];
  for (const { selector, label } of checks) {
    results.push(await assertReadable(page, selector, label));
  }
  return results;
}

// --- Internal helpers ---

async function getComputedStyles(el: Locator): Promise<ReadabilityStyles> {
  return el.evaluate((node) => {
    const cs = window.getComputedStyle(node);
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      opacity: cs.opacity,
      visibility: cs.visibility,
      display: cs.display,
      fontSize: cs.fontSize,
      clipPath: cs.clipPath,
      clip: cs.clip,
      textIndent: cs.textIndent,
      overflow: cs.overflow,
      width: cs.width,
      height: cs.height,
      position: cs.position,
      left: cs.left,
      top: cs.top,
    };
  });
}

function checkReadability(styles: ReadabilityStyles): string[] {
  const issues: string[] = [];

  // Invisible via opacity
  if (parseFloat(styles.opacity) < 0.1) {
    issues.push(`opacity=${styles.opacity} (< 0.1)`);
  }

  // Hidden via visibility
  if (styles.visibility === 'hidden' || styles.visibility === 'collapse') {
    issues.push(`visibility=${styles.visibility}`);
  }

  // Hidden via display
  if (styles.display === 'none') {
    issues.push(`display=none`);
  }

  // Zero or sub-pixel font size
  if (parseFloat(styles.fontSize) < 1) {
    issues.push(`fontSize=${styles.fontSize} (< 1px)`);
  }

  // Clipped away entirely
  if (styles.clipPath === 'inset(100%)') {
    issues.push(`clipPath=inset(100%)`);
  }

  // Legacy clip: rect(0,0,0,0)
  if (styles.clip === 'rect(0px, 0px, 0px, 0px)') {
    issues.push(`clip=rect(0,0,0,0)`);
  }

  // Offscreen via text-indent
  const textIndent = parseFloat(styles.textIndent);
  if (textIndent < -9000 || textIndent > 9000) {
    issues.push(`textIndent=${styles.textIndent} (offscreen)`);
  }

  // Zero dimensions with overflow hidden
  if (styles.overflow === 'hidden') {
    const w = parseFloat(styles.width);
    const h = parseFloat(styles.height);
    if (w < 1 || h < 1) {
      issues.push(`overflow=hidden with ${styles.width}x${styles.height}`);
    }
  }

  // Offscreen positioning
  if (styles.position === 'absolute' || styles.position === 'fixed') {
    const left = parseFloat(styles.left);
    const top = parseFloat(styles.top);
    if (left < -9000 || top < -9000) {
      issues.push(`positioned offscreen (left=${styles.left}, top=${styles.top})`);
    }
  }

  // Color-on-color: text same as background
  // Skip if background is transparent (alpha ≈ 0) — element inherits parent bg
  const textColor = parseRGBA(styles.color);
  const bgColor = parseRGBA(styles.backgroundColor);
  const bgAlpha = parseAlpha(styles.backgroundColor);
  if (textColor && bgColor && bgAlpha > 0.1 && colorsMatch(textColor, bgColor)) {
    issues.push(`text color ${styles.color} matches background ${styles.backgroundColor}`);
  }

  return issues;
}

function parseRGBA(color: string): number[] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function parseAlpha(color: string): number {
  const match = color.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
  if (!match) return 1; // rgb() without alpha = fully opaque
  return parseFloat(match[1]);
}

function colorsMatch(a: number[], b: number[]): boolean {
  // Colors are "too close" if all channels within threshold
  const threshold = 15;
  return (
    Math.abs(a[0] - b[0]) < threshold &&
    Math.abs(a[1] - b[1]) < threshold &&
    Math.abs(a[2] - b[2]) < threshold
  );
}

async function isBlockedByOverlay(el: Locator): Promise<boolean> {
  return el.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(centerX, centerY);

    if (!topEl) return true;
    return !node.contains(topEl) && !topEl.contains(node) && topEl !== node;
  });
}
