export const Platform = {
  DOUYIN: 'douyin',
  XIAOHONGSHU: 'xiaohongshu',
  WEIXIN_VIDEO: 'weixin_video',
  BILIBILI: 'bilibili',
  X: 'x',
  YOUTUBE: 'youtube',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
  FACEBOOK: 'facebook',
  CUSTOM: 'custom',
} as const;

export type Platform = (typeof Platform)[keyof typeof Platform];

