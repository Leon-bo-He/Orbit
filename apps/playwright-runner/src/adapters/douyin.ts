import type { Page } from 'playwright';
import { newJobContext } from '../browser/launch.js';
import { LogBuffer } from '../lib/log-buffer.js';
import type {
  PublishAdapter,
  PublishPayload,
  PublishResult,
  ProgressEvent,
  ValidateResult,
} from './base.js';

const UPLOAD_URL = 'https://creator.douyin.com/creator-micro/content/upload';
const PUBLISH_URL_V1 = 'https://creator.douyin.com/creator-micro/content/publish?enter_from=publish_page';
const PUBLISH_URL_V2 = 'https://creator.douyin.com/creator-micro/content/post/video?enter_from=publish_page';
const POST_IMAGE_PATTERN = '**/creator-micro/content/post/image?**';
const MANAGE_URL_PATTERN = 'https://creator.douyin.com/creator-micro/content/manage**';

export class DouyinAdapter implements PublishAdapter {
  readonly platform = 'douyin';
  readonly supportsVideo = true;
  readonly supportsNote = true;
  readonly supportsScheduling = true;

  // per SAU uploader/douyin_uploader/main.py:51-69 (cookie_auth)
  async validateCookie(storageState: object): Promise<ValidateResult> {
    const ctx = await newJobContext(storageState);
    try {
      const page = await ctx.newPage();
      await page.goto(UPLOAD_URL);
      try {
        await page.waitForURL(UPLOAD_URL, { timeout: 5000 });
      } catch {
        return { valid: false, reason: 'Did not reach upload page (likely redirected to login)' };
      }
      const phoneLogin = await page.getByText('手机号登录').count();
      const qrLogin = await page.getByText('扫码登录').count();
      if (phoneLogin > 0 || qrLogin > 0) {
        return { valid: false, reason: 'Login wall encountered — cookie expired' };
      }
      const finalState = await ctx.storageState();
      return { valid: true, finalStorageState: finalState as unknown as object };
    } finally {
      await ctx.close();
    }
  }

  // per SAU uploader/douyin_uploader/main.py:469-561 (DouYinVideo.upload)
  async publishVideo(payload: PublishPayload, onProgress: (e: ProgressEvent) => void): Promise<PublishResult> {
    if (!payload.videoPath) {
      return failResult('publishVideo requires videoPath', new LogBuffer());
    }
    const log = new LogBuffer();
    const ctx = await newJobContext(payload.storageState);
    const page = await ctx.newPage();
    try {
      onProgress({ step: 'opening_upload', percent: 5 });
      await page.goto(UPLOAD_URL);
      await page.waitForURL(UPLOAD_URL, { timeout: 30_000 });
      log.append(`Reached ${UPLOAD_URL}`);

      onProgress({ step: 'attaching_video', percent: 10 });
      const videoInput = page.locator("div[class^='container'] input").first();
      await videoInput.setInputFiles(payload.videoPath);
      log.append(`Attached video ${payload.videoPath}`);

      onProgress({ step: 'awaiting_publish_form', percent: 20 });
      await waitForPublishForm(page, 60_000);
      log.append('Reached publish form');

      onProgress({ step: 'filling_metadata', percent: 35 });
      await fillTitleAndDescription(page, payload.title, payload.description || payload.title, payload.tags);
      log.append(`Filled metadata: title=${truncate(payload.title, 30)}, tags=${payload.tags.length}`);

      onProgress({ step: 'awaiting_video_upload', percent: 55 });
      await waitForVideoUploadComplete(page, payload.videoPath, log);
      log.append('Video upload complete');

      if (payload.thumbnailPath) {
        onProgress({ step: 'uploading_thumbnail', percent: 70 });
        await setThumbnail(page, payload.thumbnailPath);
        log.append(`Set thumbnail ${payload.thumbnailPath}`);
      }

      if (payload.scheduledAt) {
        onProgress({ step: 'setting_schedule', percent: 78 });
        await setScheduleTime(page, new Date(payload.scheduledAt));
        log.append(`Scheduled at ${payload.scheduledAt}`);
      }

      onProgress({ step: 'submitting', percent: 90 });
      await clickPublishAndAwaitManage(page);
      log.append('Submitted; reached manage page');

      onProgress({ step: 'done', percent: 100 });
      const finalState = (await ctx.storageState()) as unknown as object;
      return {
        success: true,
        postUrl: page.url(),
        logExcerpt: log.toString(),
        finalStorageState: finalState,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.append(`ERROR: ${msg}`);
      return {
        success: false,
        failureReason: msg,
        logExcerpt: log.toString(),
        finalStorageState: (await ctx.storageState()) as unknown as object,
      };
    } finally {
      await ctx.close();
    }
  }

  // per SAU uploader/douyin_uploader/main.py:618-660 (DouYinNote.upload_note_content)
  async publishNote(payload: PublishPayload, onProgress: (e: ProgressEvent) => void): Promise<PublishResult> {
    if (!payload.imagePaths || payload.imagePaths.length === 0) {
      return failResult('publishNote requires imagePaths', new LogBuffer());
    }
    const log = new LogBuffer();
    const ctx = await newJobContext(payload.storageState);
    const page = await ctx.newPage();
    try {
      onProgress({ step: 'opening_upload', percent: 5 });
      await page.goto(UPLOAD_URL);
      await page.waitForURL(UPLOAD_URL, { timeout: 30_000 });

      onProgress({ step: 'switching_to_note_mode', percent: 15 });
      await page.getByText('发布图文', { exact: true }).click();
      await page.waitForTimeout(1000);

      onProgress({ step: 'attaching_images', percent: 25 });
      const input = page.locator("div[class^='container'] input[accept*='image']").first();
      await input.setInputFiles(payload.imagePaths);
      log.append(`Attached ${payload.imagePaths.length} images`);

      onProgress({ step: 'awaiting_note_form', percent: 40 });
      await page.waitForURL(POST_IMAGE_PATTERN, { timeout: 60_000 });

      onProgress({ step: 'filling_metadata', percent: 60 });
      await fillTitleAndDescription(page, payload.title, payload.description || payload.title, payload.tags);

      if (payload.scheduledAt) {
        onProgress({ step: 'setting_schedule', percent: 78 });
        await setScheduleTime(page, new Date(payload.scheduledAt));
      }

      onProgress({ step: 'submitting', percent: 90 });
      await clickPublishAndAwaitManage(page);

      onProgress({ step: 'done', percent: 100 });
      const finalState = (await ctx.storageState()) as unknown as object;
      return {
        success: true,
        postUrl: page.url(),
        logExcerpt: log.toString(),
        finalStorageState: finalState,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.append(`ERROR: ${msg}`);
      return {
        success: false,
        failureReason: msg,
        logExcerpt: log.toString(),
        finalStorageState: (await ctx.storageState()) as unknown as object,
      };
    } finally {
      await ctx.close();
    }
  }
}

// ---------- helpers ----------

function failResult(reason: string, log: LogBuffer): PublishResult {
  log.append(reason);
  return {
    success: false,
    failureReason: reason,
    logExcerpt: log.toString(),
    finalStorageState: {},
  };
}

async function waitForPublishForm(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await page.waitForURL(PUBLISH_URL_V1, { timeout: 3000 });
      return;
    } catch {
      try {
        await page.waitForURL(PUBLISH_URL_V2, { timeout: 3000 });
        return;
      } catch {
        await page.waitForTimeout(500);
      }
    }
  }
  throw new Error('Timed out waiting for publish form');
}

// per SAU uploader/douyin_uploader/main.py:265-285
async function fillTitleAndDescription(
  page: Page,
  title: string,
  description: string,
  tags: string[],
): Promise<void> {
  const section = page
    .getByText('作品描述', { exact: true })
    .locator('xpath=ancestor::div[2]')
    .locator('xpath=following-sibling::div[1]');
  const titleInput = section.locator('input[type="text"]').first();
  await titleInput.waitFor({ state: 'visible', timeout: 10_000 });
  await titleInput.fill(truncate(title, 30));

  const descEditor = section.locator('.zone-container[contenteditable="true"]').first();
  await descEditor.waitFor({ state: 'visible', timeout: 10_000 });
  await descEditor.click();
  await page.keyboard.press('Control+KeyA');
  await page.keyboard.press('Delete');
  await page.keyboard.type(description);

  for (const tag of tags) {
    await page.keyboard.type(' #' + tag);
    await page.keyboard.press('Space');
  }
}

// per SAU uploader/douyin_uploader/main.py:513-526 (upload-complete polling)
async function waitForVideoUploadComplete(page: Page, videoPath: string, log: LogBuffer): Promise<void> {
  const deadline = Date.now() + 10 * 60 * 1000; // 10 min
  while (Date.now() < deadline) {
    try {
      const completed = await page.locator('[class^="long-card"] div:has-text("重新上传")').count();
      if (completed > 0) return;
      const failed = await page.locator('div.progress-div > div:has-text("上传失败")').count();
      if (failed > 0) {
        log.append('Detected upload failure; retrying');
        await page.locator('div.progress-div [class^="upload-btn-input"]').setInputFiles(videoPath);
      }
    } catch {
      // tolerate transient locator errors
    }
    await page.waitForTimeout(2000);
  }
  throw new Error('Video upload did not complete within 10 minutes');
}

// per SAU uploader/douyin_uploader/main.py:440-467
async function setThumbnail(page: Page, thumbnailPath: string): Promise<void> {
  await page.click('text="选择封面"');
  const cover = page.locator('div[id*="creator-content-modal"]');
  await cover.waitFor();
  const upload = cover.locator("div[class^='semi-upload upload'] >> input.semi-upload-hidden-input");
  await page.waitForTimeout(1000);
  await upload.setInputFiles(thumbnailPath);
  await page.waitForTimeout(2000);
  await cover.locator('button:visible:has-text("完成")').click();
  await page.waitForSelector('div.extractFooter', { state: 'detached' });
}

// per SAU uploader/douyin_uploader/main.py:252-263
async function setScheduleTime(page: Page, when: Date): Promise<void> {
  const radio = page.locator("[class^='radio']:has-text('定时发布')");
  await radio.click();
  await page.waitForTimeout(1000);
  const ts = formatScheduleTimestamp(when);
  await page.locator('.semi-input[placeholder="日期和时间"]').click();
  await page.keyboard.press('Control+KeyA');
  await page.keyboard.type(ts);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
}

function formatScheduleTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// per SAU uploader/douyin_uploader/main.py:543-559
async function clickPublishAndAwaitManage(page: Page): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const btn = page.getByRole('button', { name: '发布', exact: true });
      if (await btn.count()) {
        await btn.click();
      }
      await page.waitForURL(MANAGE_URL_PATTERN, { timeout: 3000 });
      return;
    } catch {
      // SAU's loop also retries the auto-cover prompt before trying again.
      try {
        const coverPrompt = page.getByText('请设置封面后再发布').first();
        if (await coverPrompt.isVisible()) {
          const recommend = page.locator('[class^="recommendCover-"]').first();
          if (await recommend.count()) {
            await recommend.click();
            await page.waitForTimeout(1000);
            const confirm = page.getByText('是否确认应用此封面？').first();
            if (await confirm.isVisible()) {
              await page.getByRole('button', { name: '确定' }).click();
              await page.waitForTimeout(1000);
            }
          }
        }
      } catch {
        // ignore
      }
      await page.waitForTimeout(500);
    }
  }
  throw new Error('Publish button never reached manage page within 60s');
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}
