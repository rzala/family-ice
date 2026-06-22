/**
 * Upload Helper — File upload utilities for E2E tests.
 *
 * Supports standard file input uploads (setInputFiles) and
 * drag-and-drop uploads via synthetic DataTransfer events.
 */

import { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { basename } from 'path';

export interface UploadFilesOptions {
  /** CSS selector for the file input element */
  inputSelector: string;
  /** Path(s) to the file(s) to upload */
  files: string | string[];
  /** Optional: selector of a submit button to click after upload */
  submitSelector?: string;
  /** Optional: selector to wait for after upload completes (e.g. success message) */
  waitForSelector?: string;
  /** Timeout for waiting (ms, default 10000) */
  timeoutMs?: number;
}

/**
 * Upload files via a standard `<input type="file">` element.
 *
 * Uses Playwright's setInputFiles which handles hidden inputs correctly.
 */
export async function uploadFiles(
  page: Page,
  options: UploadFilesOptions,
): Promise<void> {
  const { inputSelector, files, submitSelector, waitForSelector, timeoutMs = 10000 } = options;

  // Set files on the input element
  await page.setInputFiles(inputSelector, files);

  // Click submit if specified
  if (submitSelector) {
    await page.click(submitSelector);
  }

  // Wait for success indicator if specified
  if (waitForSelector) {
    await page.waitForSelector(waitForSelector, {
      state: 'visible',
      timeout: timeoutMs,
    });
  }
}

/**
 * Upload a file via synthetic drag-and-drop onto a dropzone element.
 *
 * Creates a DataTransfer with the file contents and dispatches
 * dragenter, dragover, and drop events on the target element.
 */
export async function uploadViaDragDrop(
  page: Page,
  dropzoneSelector: string,
  filePath: string,
  mimeType: string,
): Promise<void> {
  const fileName = basename(filePath);
  const fileBuffer = readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');

  await page.evaluate(
    async ({ selector, name, mime, data }) => {
      const dropzone = document.querySelector(selector);
      if (!dropzone) throw new Error(`Dropzone not found: ${selector}`);

      // Convert base64 back to ArrayBuffer
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const file = new File([bytes], name, { type: mime });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const eventInit = {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      };

      dropzone.dispatchEvent(new DragEvent('dragenter', eventInit));
      dropzone.dispatchEvent(new DragEvent('dragover', eventInit));
      dropzone.dispatchEvent(new DragEvent('drop', eventInit));
    },
    { selector: dropzoneSelector, name: fileName, mime: mimeType, data: base64 },
  );
}
