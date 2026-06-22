/**
 * Email Helper — IMAP-based email verification for signup/activation flows.
 *
 * Polls an IMAP inbox (e.g. Gmail with app password) for emails matching
 * a subject/recipient pattern, then extracts activation URLs from the body.
 *
 * Config-driven: reads `email` section from e2e.config.json.
 * App password loaded from file path (default: ~/.config/himalaya/.gmail-app-pw).
 */

import { ImapFlow } from 'imapflow';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { simpleParser, ParsedMail } from 'mailparser';

// Load config
const configPath = new URL('../e2e.config.json', import.meta.url).pathname;
const config = existsSync(configPath)
  ? JSON.parse(readFileSync(configPath, 'utf-8'))
  : {};

const IMAP_HOST: string = config.email?.imap?.host || 'imap.gmail.com';
const IMAP_PORT: number = config.email?.imap?.port || 993;
const IMAP_TLS: boolean = config.email?.imap?.tls ?? true;
const IMAP_USER: string = config.email?.auth?.user || '';
const APP_PASSWORD_FILE: string =
  config.email?.auth?.appPasswordFile || '~/.config/himalaya/.gmail-app-pw';
const POLL_INTERVAL_MS: number = config.email?.pollIntervalMs || 2000;
const TIMEOUT_MS: number = config.email?.timeoutMs || 60000;

function expandHome(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return filePath.replace('~', homedir());
  }
  return filePath;
}

function loadAppPassword(): string {
  const resolved = expandHome(APP_PASSWORD_FILE);
  if (!existsSync(resolved)) {
    throw new Error(
      `App password file not found: ${resolved}\n` +
      `Hint: Create the file or update email.auth.appPasswordFile in e2e.config.json`,
    );
  }
  return readFileSync(resolved, 'utf-8').trim();
}

function createClient(): ImapFlow {
  const password = loadAppPassword();
  if (!IMAP_USER) {
    throw new Error(
      'IMAP user not configured. Set email.auth.user in e2e.config.json',
    );
  }
  return new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_TLS,
    auth: { user: IMAP_USER, pass: password },
    logger: false,
  });
}

export interface WaitForEmailOptions {
  /** Subject line substring to match */
  subject?: string;
  /** Sender address substring to match */
  from?: string;
  /** Recipient address to match (defaults to IMAP_USER) */
  to?: string;
  /** Only consider emails after this date (defaults to ~2 min ago) */
  since?: Date;
  /** Polling interval in ms (defaults to config or 2000) */
  pollIntervalMs?: number;
  /** Timeout in ms (defaults to config or 60000) */
  timeoutMs?: number;
}

export interface EmailResult {
  subject: string;
  from: string;
  to: string;
  date: Date | undefined;
  textBody: string;
  htmlBody: string;
}

/**
 * Poll IMAP inbox for an email matching the given criteria.
 * Returns the parsed email once found, or throws on timeout.
 */
export async function waitForEmail(
  options: WaitForEmailOptions = {},
): Promise<EmailResult> {
  const timeout = options.timeoutMs ?? TIMEOUT_MS;
  const interval = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const since = options.since ?? new Date(Date.now() - 2 * 60 * 1000);
  const to = options.to ?? IMAP_USER;

  const deadline = Date.now() + timeout;
  let lastError: Error | null = null;

  while (Date.now() < deadline) {
    const client = createClient();
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        // Search for recent messages
        const messages = client.fetch(
          { since, seen: false },
          { envelope: true, source: true },
        );

        for await (const msg of messages) {
          const parsed: ParsedMail = await simpleParser(msg.source);

          // Match subject
          if (
            options.subject &&
            !parsed.subject?.toLowerCase().includes(options.subject.toLowerCase())
          ) {
            continue;
          }

          // Match from
          if (options.from) {
            const fromAddr = parsed.from?.text?.toLowerCase() || '';
            if (!fromAddr.includes(options.from.toLowerCase())) continue;
          }

          // Match to
          if (to) {
            const toAddr = parsed.to
              ? (Array.isArray(parsed.to)
                  ? parsed.to.map((a) => a.text).join(',')
                  : parsed.to.text
                ).toLowerCase()
              : '';
            if (!toAddr.includes(to.toLowerCase())) continue;
          }

          return {
            subject: parsed.subject || '',
            from: parsed.from?.text || '',
            to: typeof parsed.to === 'string' ? parsed.to : parsed.to?.text || '',
            date: parsed.date,
            textBody: parsed.text || '',
            htmlBody: parsed.html || '',
          };
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err) {
      lastError = err as Error;
      try {
        await client.logout();
      } catch {
        // ignore cleanup errors
      }
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(
    `Timed out waiting for email (${timeout}ms).\n` +
    `Criteria: subject=${options.subject || '*'}, from=${options.from || '*'}, to=${to}\n` +
    (lastError ? `Last error: ${lastError.message}` : ''),
  );
}

/**
 * Extract an activation/verification URL from an email body.
 *
 * @param email - The email result from waitForEmail
 * @param urlPattern - Regex or string to match the URL (defaults to any http(s) URL)
 * @returns The first matching URL, or null if none found
 */
export function extractActivationUrl(
  email: EmailResult,
  urlPattern?: string | RegExp,
): string | null {
  const body = email.htmlBody || email.textBody;
  if (!body) return null;

  const pattern =
    urlPattern instanceof RegExp
      ? urlPattern
      : urlPattern
        ? new RegExp(urlPattern)
        : /https?:\/\/[^\s"'<>]+/g;

  // For HTML, also check href attributes
  if (email.htmlBody) {
    const hrefPattern = /href=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = hrefPattern.exec(email.htmlBody)) !== null) {
      const url = match[1];
      if (urlPattern) {
        if (pattern.test(url)) return url;
      } else if (
        url.startsWith('http') &&
        (url.includes('activate') ||
          url.includes('verify') ||
          url.includes('confirm') ||
          url.includes('token'))
      ) {
        return url;
      }
    }
  }

  // Fallback: match in raw body text
  const bodyMatch = body.match(pattern);
  return bodyMatch ? bodyMatch[0] : null;
}
