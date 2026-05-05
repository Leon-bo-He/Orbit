import { chromium, type Browser, type BrowserContext } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STEALTH_PATH = join(__dirname, 'stealth.js');

let browserPromise: Promise<Browser> | null = null;
let cachedStealth: string | null = null;

/**
 * One Browser per process. New BrowserContext per job — never share state across jobs.
 */
export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const headless = (process.env['PUBLISHING_HEADED'] ?? 'false') !== 'true';
    browserPromise = chromium.launch({
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }
  return browserPromise;
}

export async function newJobContext(storageState: object): Promise<BrowserContext> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    storageState: storageState as Parameters<Browser['newContext']>[0] extends infer P
      ? P extends { storageState?: infer S }
        ? S
        : never
      : never,
  });
  if (!cachedStealth) {
    cachedStealth = await readFile(STEALTH_PATH, 'utf8');
  }
  await context.addInitScript({ content: cachedStealth });
  return context;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    browserPromise = null;
    await b.close();
  }
}
