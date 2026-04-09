export const Platform = {
  DOUYIN: 'douyin',
  XIAOHONGSHU: 'xiaohongshu',
  WEIXIN: 'weixin',
  WEIXIN_VIDEO: 'weixin_video',
  BILIBILI: 'bilibili',
  X: 'x',
  YOUTUBE: 'youtube',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  CUSTOM: 'custom',
} as const;

export type Platform = (typeof Platform)[keyof typeof Platform];

