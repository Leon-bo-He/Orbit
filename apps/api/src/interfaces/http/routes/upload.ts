import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ICONS_DIR = path.join(__dirname, '../../../../uploads/workspace-icons');
const AVATARS_DIR         = path.join(__dirname, '../../../../uploads/avatars');
const PUB_VIDEOS_DIR      = path.join(__dirname, '../../../../uploads/publications/videos');
const PUB_NOTE_IMAGES_DIR = path.join(__dirname, '../../../../uploads/publications/note-images');
const PUB_THUMBNAILS_DIR  = path.join(__dirname, '../../../../uploads/publications/thumbnails');

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']);
const VIDEO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
};

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;       // 2 MB (icons / avatars)
const NOTE_IMG_MAX_BYTES = 10 * 1024 * 1024;   // 10 MB (note images, thumbnails)
const VIDEO_MAX_BYTES = 500 * 1024 * 1024;     // 500 MB (publication videos)

async function saveSingleImage(
  _app: FastifyInstance,
  req: FastifyRequest,
  reply: FastifyReply,
  destDir: string,
  urlPrefix: string,
  maxBytes: number,
) {
  const data = await req.file({ limits: { fileSize: maxBytes } });
  if (!data) return reply.code(400).send({ error: 'No file uploaded' });

  if (!IMAGE_MIME.has(data.mimetype)) {
    return reply.code(400).send({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' });
  }
  const ext = IMAGE_EXT[data.mimetype]!;
  const filename = `${randomUUID()}.${ext}`;
  const dest = path.join(destDir, filename);
  await mkdir(destDir, { recursive: true });
  try {
    await pipeline(data.file, createWriteStream(dest));
  } catch {
    return reply.code(500).send({ error: 'Failed to save file' });
  }
  return reply.code(201).send({ url: `${urlPrefix}/${filename}`, path: dest });
}

export function uploadRoutes(app: FastifyInstance) {
  // POST /api/upload/workspace-icon
  app.post('/api/upload/workspace-icon', { onRequest: [app.authenticate] }, (req, reply) =>
    saveSingleImage(app, req, reply, WORKSPACE_ICONS_DIR, '/uploads/workspace-icons', IMAGE_MAX_BYTES),
  );

  // POST /api/upload/avatar
  app.post('/api/upload/avatar', { onRequest: [app.authenticate] }, (req, reply) =>
    saveSingleImage(app, req, reply, AVATARS_DIR, '/uploads/avatars', IMAGE_MAX_BYTES),
  );

  // POST /api/upload/video — single video for publication payload
  app.post('/api/upload/video', { onRequest: [app.authenticate] }, async (req, reply) => {
    const data = await req.file({ limits: { fileSize: VIDEO_MAX_BYTES } });
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });
    if (!VIDEO_MIME.has(data.mimetype)) {
      return reply
        .code(400)
        .send({ error: 'Only MP4, MOV, WebM, and MKV videos are allowed' });
    }
    const ext = VIDEO_EXT[data.mimetype]!;
    const filename = `${randomUUID()}.${ext}`;
    const dest = path.join(PUB_VIDEOS_DIR, filename);
    await mkdir(PUB_VIDEOS_DIR, { recursive: true });
    try {
      await pipeline(data.file, createWriteStream(dest));
    } catch {
      return reply.code(500).send({ error: 'Failed to save file' });
    }
    return reply
      .code(201)
      .send({ url: `/uploads/publications/videos/${filename}`, path: dest, size: data.file.bytesRead });
  });

  // POST /api/upload/note-images — up to 9 images
  app.post('/api/upload/note-images', { onRequest: [app.authenticate] }, async (req, reply) => {
    const parts = req.files({ limits: { fileSize: NOTE_IMG_MAX_BYTES, files: 9 } });
    const out: Array<{ url: string; path: string }> = [];
    await mkdir(PUB_NOTE_IMAGES_DIR, { recursive: true });
    for await (const data of parts) {
      if (!IMAGE_MIME.has(data.mimetype)) {
        return reply.code(400).send({ error: `Unsupported image mime: ${data.mimetype}` });
      }
      const ext = IMAGE_EXT[data.mimetype]!;
      const filename = `${randomUUID()}.${ext}`;
      const dest = path.join(PUB_NOTE_IMAGES_DIR, filename);
      try {
        await pipeline(data.file, createWriteStream(dest));
      } catch {
        return reply.code(500).send({ error: 'Failed to save file' });
      }
      out.push({ url: `/uploads/publications/note-images/${filename}`, path: dest });
    }
    if (out.length === 0) return reply.code(400).send({ error: 'No files uploaded' });
    return reply.code(201).send({ files: out });
  });

  // POST /api/upload/thumbnail — landscape or portrait thumbnail for video publication
  app.post('/api/upload/thumbnail', { onRequest: [app.authenticate] }, (req, reply) =>
    saveSingleImage(app, req, reply, PUB_THUMBNAILS_DIR, '/uploads/publications/thumbnails', NOTE_IMG_MAX_BYTES),
  );
}
