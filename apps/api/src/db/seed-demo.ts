/**
 * Demo seed — creates a realistic demo account with ~15 months of data.
 *
 * Usage:
 *   pnpm seed:demo            # skip if demo user already exists
 *   pnpm seed:demo --force    # delete existing demo user and re-seed
 *
 * Demo credentials:
 *   Email:    demo@orbit.app
 *   Password: demo1234
 */

import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from './client.js';
import {
  users, workspaces, ideas, contents,
  contentPlans, contentReferences, planTemplates,
  publications, metrics,
} from './schema/index.js';

const DEMO_EMAIL = 'demo@orbit.app';
const DEMO_PASSWORD = 'demo1234';

// ─── helpers ────────────────────────────────────────────────────────────────

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

function sh(...stages: Array<[string, number]>) {
  return stages.map(([stage, daysBack]) => ({
    stage,
    timestamp: daysAgo(daysBack).toISOString(),
  }));
}

function snapshotAges(publishedDaysBack: number): number[] {
  const ages = [2];
  if (publishedDaysBack >= 14) ages.push(10);
  if (publishedDaysBack >= 45) ages.push(30);
  if (publishedDaysBack >= 100) ages.push(60);
  if (publishedDaysBack >= 200) ages.push(120);
  ages.push(publishedDaysBack - 2);
  return ages.filter((a) => a > 0 && a < publishedDaysBack);
}

function platformMetrics(
  platform: string,
  ageDays: number,
  virality: number,
): { views: number; likes: number; comments: number; shares: number; saves: number; followersGained: number } {
  const g = Math.min(ageDays / 45, 1);
  const v = virality;
  switch (platform) {
    case 'douyin':
    case 'tiktok': {
      const b = Math.round(45000 * v * (0.25 + g * 0.75));
      return { views: b, likes: Math.round(b * 0.11), comments: Math.round(b * 0.016), shares: Math.round(b * 0.024), saves: Math.round(b * 0.007), followersGained: Math.round(b * 0.003) };
    }
    case 'bilibili': {
      const b = Math.round(12000 * v * (0.25 + g * 0.75));
      return { views: b, likes: Math.round(b * 0.09), comments: Math.round(b * 0.03), shares: Math.round(b * 0.018), saves: Math.round(b * 0.06), followersGained: Math.round(b * 0.004) };
    }
    case 'xiaohongshu': {
      const b = Math.round(22000 * v * (0.25 + g * 0.75));
      return { views: b, likes: Math.round(b * 0.14), comments: Math.round(b * 0.022), shares: 0, saves: Math.round(b * 0.29), followersGained: Math.round(b * 0.004) };
    }
    case 'instagram': {
      const b = Math.round(16000 * v * (0.25 + g * 0.75));
      return { views: b, likes: Math.round(b * 0.16), comments: Math.round(b * 0.025), shares: 0, saves: Math.round(b * 0.22), followersGained: Math.round(b * 0.005) };
    }
    case 'weixin': {
      const b = Math.round(14000 * v * (0.25 + g * 0.75));
      return { views: b, likes: Math.round(b * 0.10), comments: Math.round(b * 0.028), shares: Math.round(b * 0.056), saves: 0, followersGained: Math.round(b * 0.006) };
    }
    case 'x': {
      const b = Math.round(19000 * v * (0.25 + g * 0.75));
      return { views: b, likes: Math.round(b * 0.08), comments: Math.round(b * 0.018), shares: Math.round(b * 0.046), saves: 0, followersGained: Math.round(b * 0.002) };
    }
    case 'youtube': {
      const b = Math.round(18000 * v * (0.25 + g * 0.75));
      return { views: b, likes: Math.round(b * 0.07), comments: Math.round(b * 0.022), shares: Math.round(b * 0.012), saves: Math.round(b * 0.015), followersGained: Math.round(b * 0.005) };
    }
    case 'weixin_video': {
      const b = Math.round(11000 * v * (0.25 + g * 0.75));
      return { views: b, likes: Math.round(b * 0.09), comments: Math.round(b * 0.025), shares: Math.round(b * 0.048), saves: 0, followersGained: Math.round(b * 0.004) };
    }
    default: {
      const b = Math.round(5000 * v * (0.25 + g * 0.75));
      return { views: b, likes: Math.round(b * 0.10), comments: Math.round(b * 0.02), shares: Math.round(b * 0.01), saves: Math.round(b * 0.05), followersGained: Math.round(b * 0.003) };
    }
  }
}

async function insertPublished(
  contentId: string,
  platforms: string[],
  publishedDaysBack: number,
  virality: number,
  urlBase: string,
  extra?: { [platform: string]: { title?: string; copy?: string; tags?: string[] } },
) {
  for (const platform of platforms) {
    const ex = extra?.[platform] ?? {};
    const [pub] = await db.insert(publications).values({
      contentId, platform, status: 'published',
      platformTitle: ex.title, platformCopy: ex.copy,
      platformTags: ex.tags ?? [], platformSettings: {},
      publishedAt: daysAgo(publishedDaysBack),
      scheduledAt: daysAgo(publishedDaysBack + 1),
      platformUrl: `${urlBase}-${platform.slice(0, 2)}`,
      publishLog: [{ action: 'published', timestamp: daysAgo(publishedDaysBack).toISOString() }],
    }).returning();

    const ages = snapshotAges(publishedDaysBack);
    await db.insert(metrics).values(
      ages.map((age) => ({
        publicationId: pub!.id,
        ...platformMetrics(platform, age, virality),
        recordedAt: daysAgo(publishedDaysBack - age),
      })),
    );
  }
}

// Virality cycle: gives a natural mix of viral hits, average, and below-average
const VIRALITY = [1.0, 1.4, 0.7, 2.8, 1.1, 1.9, 0.8, 1.3, 3.2, 0.6, 1.0, 1.6, 0.9, 2.1, 0.7];

// ─── content banks ───────────────────────────────────────────────────────────

interface ContentDef {
  title: string;
  tags: string[];
  platforms: string[];
  contentType: string;
  notes?: string;
  reviewNotes?: string;
}

// 3 items/month × 13 months = 39 items (months 14 → 2)
const COMEDY_BANK: ContentDef[] = [
  { title: 'Expectation vs Reality: Working From Home', tags: ['relatable', 'wfh', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short', reviewNotes: 'Huge engagement. Surprise-ending format works.' },
  { title: 'Types of Coworkers in Every Stand-up Meeting', tags: ['work', 'relatable', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'When the Code Finally Works After 6 Hours', tags: ['dev-humor', 'relatable', 'coding'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: "POV: You're the Rubber Duck in a Dev Session", tags: ['dev-humor', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Office Monday vs Friday Energy', tags: ['work', 'relatable', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'The 5 Stages of Debugging Grief', tags: ['dev-humor', 'coding'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'Git Commit Messages Throughout Your Career', tags: ['dev-humor', 'coding', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: "When the PM Says 'It'll Only Take 5 Minutes'", tags: ['dev-humor', 'work', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Developer Zodiac Signs', tags: ['dev-humor', 'comedy', 'trending'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'Zoom Call Bingo: Remote Work Edition', tags: ['wfh', 'work', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: "When HR Sends a 'Quick Sync' Invite", tags: ['work', 'relatable', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: "Every Dev's Reaction to a New JS Framework", tags: ['dev-humor', 'javascript', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'Stack Overflow vs Reading the Docs', tags: ['dev-humor', 'relatable', 'coding'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Senior Dev vs Junior Dev: Same Bug', tags: ['dev-humor', 'coding', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'The Different Faces of Code Review', tags: ['dev-humor', 'work', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'What Clients Say vs What They Mean', tags: ['work', 'relatable', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'When You Finally Push to Production', tags: ['dev-humor', 'coding', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Tech Bro vs Normal Person Translator', tags: ['comedy', 'trending', 'tech'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'Monday Morning Bug Report Energy', tags: ['dev-humor', 'work', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'The App Store Review Reading Experience', tags: ['comedy', 'tech', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Types of GitHub Issues', tags: ['dev-humor', 'coding', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'When the Feature Is Already Built in CSS', tags: ['dev-humor', 'frontend', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Developer Imposter Syndrome Levels', tags: ['dev-humor', 'relatable', 'coding'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'The Sprint Planning Reality Show', tags: ['work', 'agile', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'Copy-Pasting from Stack Overflow in 2025', tags: ['dev-humor', 'coding', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Deploying on a Friday', tags: ['dev-humor', 'relatable', 'coding'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: "When Someone Asks 'Is It Urgent?'", tags: ['work', 'relatable', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'PM vs Designer vs Developer: One Feature', tags: ['work', 'comedy', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Stand-up Meeting Attention Span Chart', tags: ['work', 'dev-humor', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'New Feature vs Bug Report: Same Code', tags: ['dev-humor', 'coding', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'The Meeting That Could Have Been an Email', tags: ['work', 'relatable', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Reading Your Own Code 6 Months Later', tags: ['dev-humor', 'coding', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'Tech Interview Prep vs Actual Job', tags: ['dev-humor', 'work', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'The Agile Ceremony Collection', tags: ['work', 'agile', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'When the Intern Writes Better Code Than You', tags: ['dev-humor', 'coding', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'CSS Is Easy They Said', tags: ['dev-humor', 'frontend', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
  { title: 'Every API Documentation Experience', tags: ['dev-humor', 'coding', 'relatable'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: 'The Tech Stack Decision Flowchart', tags: ['dev-humor', 'comedy', 'tech'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], contentType: 'video_short' },
  { title: "When AI Writes Your Code but It's Wrong", tags: ['AI', 'dev-humor', 'comedy'], platforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], contentType: 'video_short' },
];

// 2 items/month × 13 months = 26 items (months 14 → 2)
const LIFESTYLE_BANK: ContentDef[] = [
  { title: 'My Capsule Wardrobe: 10 Pieces, 30 Outfits Under ¥500', tags: ['fashion', 'budget', 'capsule-wardrobe'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text', reviewNotes: 'Saves through the roof. Budget fashion consistently outperforms.' },
  { title: 'The Only Skincare Routine You Will Ever Need', tags: ['skincare', 'beauty', 'routine'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'How I Redesigned My Room for Under ¥1000', tags: ['home-decor', 'budget', 'diy'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'A Week of Meal Prep for Busy Professionals', tags: ['food', 'meal-prep', 'productivity'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Cherry Blossom Season: The Ultimate Outfit Guide', tags: ['fashion', 'spring', 'ootd', 'cherry-blossom'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Tokyo Ramen Spots Worth the Queue', tags: ['food', 'travel', 'japan', 'ramen'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Minimalist Home Office Setup Under ¥2000', tags: ['home-office', 'minimalist', 'setup'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'The Perfect Reading Nook on a Budget', tags: ['home-decor', 'books', 'lifestyle'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Summer Skincare Essentials: What Actually Works', tags: ['skincare', 'beauty', 'summer'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: "Shanghai's Hidden Street Food Gems", tags: ['food', 'shanghai', 'street-food', 'local'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Autumn Fashion Haul Under ¥800', tags: ['fashion', 'haul', 'autumn', 'budget'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Best Cafes in Shanghai for Remote Work', tags: ['cafe', 'shanghai', 'wfh', 'lifestyle'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'How I Stopped Impulse Buying (And Built a Better Wardrobe)', tags: ['fashion', 'mindset', 'finance', 'lifestyle'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Osaka on a Budget: 5 Days Under ¥3000', tags: ['travel', 'japan', 'budget', 'osaka'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Winter Layering Masterclass: Stylish and Warm', tags: ['fashion', 'winter', 'layering', 'ootd'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Tried 5 Viral Recipes — Honest Review', tags: ['food', 'recipe', 'review', 'trending'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Spring Clean Your Wardrobe: Keep vs Toss', tags: ['fashion', 'spring', 'declutter', 'capsule'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'The Self-Care Sunday Routine That Actually Works', tags: ['self-care', 'lifestyle', 'routine', 'wellness'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Affordable Luxury: What to Splurge On vs Save On', tags: ['fashion', 'beauty', 'budget', 'luxury'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Seoul Street Food Diary', tags: ['food', 'travel', 'korea', 'street-food'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Office Outfit Formula: 5 Basics, Infinite Looks', tags: ['fashion', 'office', 'ootd', 'workwear'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'My Apartment Transformation: Before and After', tags: ['home-decor', 'diy', 'interior', 'lifestyle'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'The Wellness Habits I Actually Kept This Year', tags: ['wellness', 'lifestyle', 'habits', 'health'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Budget Travel: Kyoto in 3 Days Under ¥2500', tags: ['travel', 'japan', 'kyoto', 'budget'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'Transitional Dressing: How to Style Any Season', tags: ['fashion', 'ootd', 'style', 'versatile'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
  { title: 'The Perfect Gift Guide: Under ¥200 Edition', tags: ['gift', 'budget', 'lifestyle', 'holiday'], platforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], contentType: 'image_text' },
];

// 2 items/month × 13 months = 26 items (months 14 → 2)
const TECH_BANK: ContentDef[] = [
  { title: 'The Real Difference Between Claude 4 and GPT-5 for Developers', tags: ['AI', 'LLM', 'developer-tools', 'comparison'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article', reviewNotes: 'High shares. Technical posts with code examples perform best.' },
  { title: 'Why Most AI Startups Will Fail in 2027', tags: ['AI', 'startup', 'prediction', 'opinion'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Vibe Coding Is Real: How Junior Devs Ship Faster with AI', tags: ['AI', 'productivity', 'coding', 'junior-dev'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'From Prompt Engineering to Agent Architecture', tags: ['AI', 'agents', 'architecture', 'LLM'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'The Hidden Cost of AI-First Development', tags: ['AI', 'engineering', 'opinion', 'cost'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Open Source LLMs in 2026: Llama, Mistral, and New Players', tags: ['AI', 'open-source', 'LLM', 'llama'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Why TypeScript Won (And What Comes Next)', tags: ['typescript', 'javascript', 'opinion', 'frontend'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'The Database Choice That Will Define Your Next 5 Years', tags: ['database', 'architecture', 'postgres', 'opinion'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'React Is Not Dying: A Data-Driven Rebuttal', tags: ['react', 'frontend', 'opinion', 'data'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Edge Computing vs Cloud: Real Trade-offs in 2026', tags: ['cloud', 'edge', 'architecture', 'infra'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'How AI Code Reviewers Are Changing Engineering Culture', tags: ['AI', 'code-review', 'culture', 'engineering'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'The Rise of Solo Developers: Building $1M Products Alone', tags: ['indie-dev', 'solo', 'startup', 'AI'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Microservices vs Monolith: What I Learned After 3 Rewrites', tags: ['architecture', 'microservices', 'monolith', 'opinion'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: "Why Your Startup's Engineering Culture Is Broken", tags: ['startup', 'engineering', 'culture', 'management'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Claude as a Coding Partner: 6 Months of Real Experience', tags: ['AI', 'claude', 'productivity', 'coding'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Rust in Production: Honest Assessment After 1 Year', tags: ['rust', 'systems', 'opinion', 'backend'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'The API Design Mistakes I Made (So You Don\'t Have To)', tags: ['api', 'design', 'backend', 'rest'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'AI-Assisted Testing: Does It Actually Improve Quality?', tags: ['AI', 'testing', 'quality', 'engineering'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'The State of Developer Tools in 2026', tags: ['dev-tools', 'productivity', 'survey', 'opinion'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Zero-to-Production Solo: Building Orbit in Public', tags: ['indie-dev', 'orbit', 'building-in-public', 'solo'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Next.js vs Remix vs Vite: An Honest Comparison', tags: ['nextjs', 'react', 'frontend', 'comparison'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'The Death of the Traditional Tech Interview', tags: ['interview', 'hiring', 'AI', 'opinion'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'How I Reduced LLM Costs 60% by Switching Providers', tags: ['AI', 'cost', 'LLM', 'optimization'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'The Content Creator Tech Stack (2026 Edition)', tags: ['tools', 'creator', 'productivity', 'stack'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'Reflections: 1 Year Building in Public', tags: ['building-in-public', 'indie-dev', 'reflection', 'personal'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
  { title: 'What No One Tells You About Building AI Products', tags: ['AI', 'product', 'startup', 'lessons'], platforms: ['weixin', 'x', 'bilibili', 'weixin_video'], contentType: 'article' },
];

// ─── main ────────────────────────────────────────────────────────────────────

async function seed() {
  const force = process.argv.includes('--force');

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing) {
    if (!force) { console.log('Demo user already exists. Run with --force to re-seed.'); process.exit(0); }
    console.log('Deleting existing demo data…');
    await db.delete(users).where(eq(users.email, DEMO_EMAIL));
  }

  console.log('Seeding demo account…');
  const t0 = Date.now();

  // ── 1. User ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [user] = await db.insert(users).values({
    email: DEMO_EMAIL, username: 'Alex Chen',
    locale: 'en-US', timezone: 'Asia/Shanghai', passwordHash,
  }).returning();
  const userId = user!.id;

  // ── 2. Workspaces ──────────────────────────────────────────────────────────
  const [wComedy, wLifestyle, wTech] = await db.insert(workspaces).values([
    { userId, name: 'Comedy', icon: '🎭', color: '#FF4757', about: 'Short comedy skits and relatable dev content', publishGoal: { count: 5, period: 'week' }, stageConfig: [] },
    { userId, name: 'Lifestyle', icon: '🌸', color: '#FF6B9D', about: 'Fashion, food, travel, and daily life', publishGoal: { count: 3, period: 'week' }, stageConfig: [] },
    { userId, name: 'Tech Insights', icon: '🔬', color: '#2ECC71', about: 'AI commentary, dev tools, and engineering opinion', publishGoal: { count: 2, period: 'week' }, stageConfig: [] },
  ]).returning();
  const wsD = wComedy!.id, wsX = wLifestyle!.id, wsW = wTech!.id;

  // ── 3. Plan templates ──────────────────────────────────────────────────────
  await db.insert(planTemplates).values([
    { workspaceId: wsD, name: 'Gen Z Comedy Hook', audience: { ageRange: '18-25', personaTags: ['Gen Z', 'student', 'trend-follower'], painPoint: 'Wants to escape stress', reachScenario: 'Scrolling Douyin before bed' }, goals: ['grow_followers', 'branding'], goalDescription: 'Grow followers through relatable comedy' },
    { workspaceId: wsX, name: 'Lifestyle Discovery Reader', audience: { ageRange: '22-30', personaTags: ['young professional', 'fashion-conscious', 'city dweller'], painPoint: 'Looking for inspiration and recommendations', reachScenario: 'Weekend morning browse' }, goals: ['traffic', 'convert'], goalDescription: 'Drive traffic to affiliate links and brand partnerships' },
    { workspaceId: wsW, name: 'Tech Professional Reader', audience: { ageRange: '25-40', personaTags: ['developer', 'product manager', 'tech enthusiast'], painPoint: 'Too much hype, needs high-signal analysis', reachScenario: 'Monday morning commute' }, goals: ['branding', 'grow_followers'], goalDescription: 'Build authority as a trusted tech commentator' },
  ]);

  // ── 4. Ideas ───────────────────────────────────────────────────────────────
  const [ideaConv1] = await db.insert(ideas).values({ userId, workspaceId: wsD, title: 'Expectation vs reality: remote work', tags: ['relatable', 'wfh'], priority: 'high', attachments: [], status: 'converted' }).returning();
  const [ideaConv2] = await db.insert(ideas).values({ userId, workspaceId: wsX, title: 'My capsule wardrobe essentials under ¥500', tags: ['fashion', 'budget'], priority: 'high', attachments: [], status: 'converted' }).returning();

  await db.insert(ideas).values([
    { userId, workspaceId: null, title: 'React vs Vue 2026 — which is actually winning?', tags: ['tech', 'frontend'], priority: 'high', attachments: [], status: 'active' },
    { userId, workspaceId: null, title: "What happens when you eat McDonald's for 30 days", tags: ['food', 'challenge'], priority: 'medium', attachments: [], status: 'active' },
    { userId, workspaceId: null, title: 'Morning routines of billionaires vs normal people', tags: ['lifestyle', 'productivity'], priority: 'low', attachments: [], status: 'active' },
    { userId, workspaceId: wsD, title: "POV: you're a debugging rubber duck", tags: ['dev-humor', 'relatable'], priority: 'high', attachments: [], status: 'active' },
    { userId, workspaceId: wsD, title: 'Types of programmers at 3am', tags: ['dev-humor', 'coding'], priority: 'medium', attachments: [], status: 'active' },
    { userId, workspaceId: wsX, title: 'Cherry blossom season outfit ideas', tags: ['fashion', 'spring'], priority: 'high', attachments: [], status: 'active' },
    { userId, workspaceId: wsX, title: "Tokyo ramen spots you can't miss", tags: ['food', 'travel', 'japan'], priority: 'medium', attachments: [], status: 'active' },
    { userId, workspaceId: wsW, title: "Claude 4 vs GPT-5 — a real developer's take", tags: ['AI', 'LLM', 'opinion'], priority: 'high', attachments: [], status: 'active', note: 'Focus on coding use-cases specifically.' },
    { userId, workspaceId: wsW, title: 'Why most AI startups will fail in 2027', tags: ['AI', 'startup', 'prediction'], priority: 'medium', attachments: [], status: 'active' },
    { userId, workspaceId: null, title: 'Old trend idea that faded', tags: [], priority: 'low', attachments: [], status: 'archived' },
  ]);

  // ── 5. Historical content: months 14 → 2 (all reviewed) ───────────────────
  // Track first-inserted content IDs for briefs
  let firstComedyId: string | null = null;
  let firstLifestyleId: string | null = null;
  let firstTechId: string | null = null;

  for (let monthBack = 14; monthBack >= 2; monthBack--) {
    const monthIdx = 14 - monthBack; // 0 = oldest month

    // Comedy: 3 items this month
    for (let w = 0; w < 3; w++) {
      const bankIdx = monthIdx * 3 + w;
      if (bankIdx >= COMEDY_BANK.length) break;
      const def = COMEDY_BANK[bankIdx]!;
      const pubDays = monthBack * 30 + w * 9 + 3;
      const virality = VIRALITY[bankIdx % VIRALITY.length]!;

      const [c] = await db.insert(contents).values({
        workspaceId: wsD, title: def.title, contentType: def.contentType,
        stage: 'reviewed', tags: def.tags, targetPlatforms: def.platforms,
        ideaId: bankIdx === 0 ? ideaConv1!.id : undefined,
        scheduledAt: daysAgo(pubDays + 1), publishedAt: daysAgo(pubDays),
        reviewNotes: def.reviewNotes, attachments: [],
        stageHistory: sh(['planned', pubDays + 14], ['creating', pubDays + 9], ['ready', pubDays + 3], ['published', pubDays], ['reviewed', pubDays - 7]),
      }).returning();
      if (firstComedyId === null) firstComedyId = c!.id;
      if (bankIdx === 0) await db.update(ideas).set({ convertedTo: c!.id }).where(eq(ideas.id, ideaConv1!.id));

      await insertPublished(c!.id, def.platforms, pubDays, virality, `https://orbit.demo/c/d${bankIdx}`);
    }

    // Lifestyle: 2 items this month
    for (let w = 0; w < 2; w++) {
      const bankIdx = monthIdx * 2 + w;
      if (bankIdx >= LIFESTYLE_BANK.length) break;
      const def = LIFESTYLE_BANK[bankIdx]!;
      const pubDays = monthBack * 30 + w * 12 + 5;
      const virality = VIRALITY[(bankIdx + 3) % VIRALITY.length]!;

      const [c] = await db.insert(contents).values({
        workspaceId: wsX, title: def.title, contentType: def.contentType,
        stage: 'reviewed', tags: def.tags, targetPlatforms: def.platforms,
        ideaId: bankIdx === 0 ? ideaConv2!.id : undefined,
        scheduledAt: daysAgo(pubDays + 1), publishedAt: daysAgo(pubDays),
        reviewNotes: def.reviewNotes, attachments: [],
        stageHistory: sh(['planned', pubDays + 14], ['creating', pubDays + 8], ['ready', pubDays + 2], ['published', pubDays], ['reviewed', pubDays - 7]),
      }).returning();
      if (firstLifestyleId === null) firstLifestyleId = c!.id;
      if (bankIdx === 0) await db.update(ideas).set({ convertedTo: c!.id }).where(eq(ideas.id, ideaConv2!.id));

      await insertPublished(c!.id, def.platforms, pubDays, virality, `https://orbit.demo/c/x${bankIdx}`);
    }

    // Tech: 2 items this month
    for (let w = 0; w < 2; w++) {
      const bankIdx = monthIdx * 2 + w;
      if (bankIdx >= TECH_BANK.length) break;
      const def = TECH_BANK[bankIdx]!;
      const pubDays = monthBack * 30 + w * 14 + 7;
      const virality = VIRALITY[(bankIdx + 6) % VIRALITY.length]!;

      const [c] = await db.insert(contents).values({
        workspaceId: wsW, title: def.title, contentType: def.contentType,
        stage: 'reviewed', tags: def.tags, targetPlatforms: def.platforms,
        scheduledAt: daysAgo(pubDays + 1), publishedAt: daysAgo(pubDays),
        reviewNotes: def.reviewNotes, attachments: [],
        stageHistory: sh(['planned', pubDays + 14], ['creating', pubDays + 9], ['ready', pubDays + 3], ['published', pubDays], ['reviewed', pubDays - 7]),
      }).returning();
      if (firstTechId === null) firstTechId = c!.id;

      await insertPublished(c!.id, def.platforms, pubDays, virality, `https://orbit.demo/c/w${bankIdx}`);
    }
  }

  // ── 6. Recent published content (month 1) ─────────────────────────────────
  const [rComedy1] = await db.insert(contents).values({
    workspaceId: wsD, title: 'POV: You\'re the Only One Who Reads the Docs',
    contentType: 'video_short', stage: 'published',
    tags: ['dev-humor', 'relatable'], targetPlatforms: ['douyin', 'tiktok', 'bilibili', 'youtube'],
    scheduledAt: daysAgo(15), publishedAt: daysAgo(14), attachments: [],
    stageHistory: sh(['planned', 28], ['creating', 22], ['ready', 16], ['published', 14]),
  }).returning();
  await insertPublished(rComedy1!.id, ['douyin', 'tiktok', 'bilibili', 'youtube'], 14, 1.8, 'https://orbit.demo/c/rc1', {
    douyin: { title: 'POV: 文档？我读过！📖', copy: '你们公司也有这种人吗？ #程序员日常 #dev', tags: ['#程序员', '#编程'] },
    tiktok: { title: 'POV: You actually read the docs 📖', copy: 'The rarest skill in software engineering 😭 #coding #developer #relatable', tags: ['#coding', '#developer'] },
    bilibili: { title: 'POV：你是公司里唯一看文档的人 📖', tags: ['程序员', '编程', '职场'] },
    youtube: { title: 'POV: You\'re the Only One Who Actually Reads the Docs 📖', copy: 'The rarest dev skill: reading documentation 😭 #coding #developer', tags: ['#coding', '#developer', '#devhumor'] },
  });

  const [rLifestyle1] = await db.insert(contents).values({
    workspaceId: wsX, title: 'Spring 2026 Outfit Ideas — Cherry Blossom Lookbook',
    contentType: 'image_text', stage: 'published',
    tags: ['fashion', 'spring', 'lookbook', 'cherry-blossom'], targetPlatforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'],
    scheduledAt: daysAgo(20), publishedAt: daysAgo(19), attachments: [],
    stageHistory: sh(['planned', 32], ['creating', 26], ['ready', 21], ['published', 19]),
  }).returning();
  await insertPublished(rLifestyle1!.id, ['xiaohongshu', 'instagram', 'douyin', 'weixin'], 19, 2.1, 'https://orbit.demo/c/rl1', {
    xiaohongshu: { title: '2026春季穿搭｜赏樱花的正确打开方式🌸', copy: '春天来了！分享我的赏花穿搭合集 🌸 #春季穿搭 #樱花 #ootd', tags: ['#春季穿搭', '#樱花'] },
    instagram: { title: 'Spring lookbook 🌸 Cherry blossom season is here', copy: 'Outfit ideas for cherry blossom season 🌸 #springfashion #ootd #cherryblossom', tags: ['#ootd', '#cherryblossom'] },
    douyin: { title: '2026春天穿搭合集🌸赏花季必备', copy: '春天来了，来看我的赏花穿搭！#春季穿搭 #ootd', tags: ['#春季穿搭', '#ootd'] },
    weixin: { title: '2026春季穿搭指南｜赏樱花的10种打开方式', copy: '春天是穿搭最美的季节，这些搭配你学会了吗？' },
  });

  const [rTech1] = await db.insert(contents).values({
    workspaceId: wsW, title: 'Vibe Coding Is Real: How Junior Devs Are Shipping Faster with AI',
    contentType: 'article', stage: 'published',
    tags: ['AI', 'productivity', 'coding', 'junior-dev'], targetPlatforms: ['weixin', 'x', 'bilibili', 'weixin_video'],
    scheduledAt: daysAgo(12), publishedAt: daysAgo(11), attachments: [],
    notes: 'Include code examples and real benchmarks.',
    stageHistory: sh(['planned', 22], ['creating', 17], ['ready', 13], ['published', 11]),
  }).returning();
  await insertPublished(rTech1!.id, ['weixin', 'x', 'bilibili', 'weixin_video'], 11, 2.4, 'https://orbit.demo/c/rt1', {
    weixin: { title: 'Vibe编程是真实的：AI让初级开发者越跑越快', copy: '没有废话，直接看数据。AI辅助开发的真实效率对比。' },
    x: { title: 'Vibe Coding Is Real — data from real junior devs using AI', copy: 'I tracked 12 junior devs for 3 months. Here\'s what AI actually did to their output 🧵 #AI #coding #developers', tags: ['#AI', '#developers'] },
    bilibili: { title: 'Vibe编程实测：AI到底让初级开发者快了多少？', tags: ['AI', '编程', '效率'] },
    weixin_video: { title: 'AI让初级开发者快了多少？真实数据来了', copy: '我追踪了12位初级开发者3个月，AI对他们的产出做了这些...' },
  });

  const [rComedy2] = await db.insert(contents).values({
    workspaceId: wsD, title: 'Debugging at 3am be like…',
    contentType: 'video_short', stage: 'published',
    tags: ['dev-humor', 'coding', 'relatable'], targetPlatforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'],
    scheduledAt: daysAgo(4), publishedAt: daysAgo(3), attachments: [],
    stageHistory: sh(['planned', 12], ['creating', 8], ['ready', 4], ['published', 3]),
  }).returning();
  await insertPublished(rComedy2!.id, ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], 3, 1.5, 'https://orbit.demo/c/rc2');

  // ── 7. Current pipeline ────────────────────────────────────────────────────

  // Ready
  const [pReady1] = await db.insert(contents).values({
    workspaceId: wsD, title: "When Your PM Says 'It'll Only Take 5 Minutes'",
    contentType: 'video_short', stage: 'ready',
    tags: ['dev-humor', 'work', 'relatable'], targetPlatforms: ['douyin', 'tiktok', 'bilibili', 'youtube'],
    scheduledAt: daysFromNow(2), attachments: [],
    stageHistory: sh(['planned', 12], ['creating', 7], ['ready', 2]),
  }).returning();
  const [pReady2] = await db.insert(contents).values({
    workspaceId: wsX, title: 'Best Cafés in Shanghai for Remote Work (2026 Edition)',
    contentType: 'image_text', stage: 'ready',
    tags: ['cafe', 'shanghai', 'work', 'lifestyle'], targetPlatforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'],
    scheduledAt: daysFromNow(3), attachments: [],
    stageHistory: sh(['planned', 10], ['creating', 6], ['ready', 1]),
  }).returning();
  const [pReady3] = await db.insert(contents).values({
    workspaceId: wsW, title: 'Why Most AI Startups Will Fail in 2027 (And What Survives)',
    contentType: 'article', stage: 'ready',
    tags: ['AI', 'startup', 'prediction', 'VC'], targetPlatforms: ['weixin', 'x', 'bilibili', 'weixin_video'],
    scheduledAt: daysFromNow(5), attachments: [],
    stageHistory: sh(['planned', 11], ['creating', 6], ['ready', 2]),
  }).returning();

  // Creating
  await db.insert(contents).values([
    { workspaceId: wsD, title: 'Office Monday vs Friday Energy', contentType: 'video_short', stage: 'creating', tags: ['work', 'relatable', 'comedy'], targetPlatforms: ['douyin', 'tiktok', 'bilibili', 'youtube', 'instagram'], notes: 'B-roll: coffee machine, commute, slack notifications', attachments: [], stageHistory: sh(['planned', 9], ['creating', 3]) },
    { workspaceId: wsX, title: 'Minimalist Home Office Setup Under ¥2000', contentType: 'image_text', stage: 'creating', tags: ['home-office', 'minimalist', 'setup'], targetPlatforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], attachments: [], stageHistory: sh(['planned', 7], ['creating', 2]) },
    { workspaceId: wsW, title: 'From Prompt Engineering to Agent Architecture: What Changed', contentType: 'article', stage: 'creating', tags: ['AI', 'agents', 'architecture', 'LLM'], targetPlatforms: ['weixin', 'x', 'bilibili', 'weixin_video'], attachments: [], stageHistory: sh(['planned', 8], ['creating', 2]) },
  ]);

  // Planned
  await db.insert(contents).values([
    { workspaceId: wsD, title: 'The 5 Stages of Debugging Grief', contentType: 'video_short', stage: 'planned', tags: ['dev-humor', 'coding'], targetPlatforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], attachments: [], stageHistory: sh(['planned', 4]) },
    { workspaceId: wsD, title: 'Zoom Call Bingo: Remote Work Edition', contentType: 'video_short', stage: 'planned', tags: ['wfh', 'relatable'], targetPlatforms: ['douyin', 'tiktok', 'bilibili', 'youtube'], attachments: [], stageHistory: sh(['planned', 2]) },
    { workspaceId: wsX, title: 'How I Stopped Impulse Buying (And Built a Better Wardrobe)', contentType: 'image_text', stage: 'planned', tags: ['fashion', 'mindset', 'finance'], targetPlatforms: ['xiaohongshu', 'instagram', 'douyin', 'weixin'], attachments: [], stageHistory: sh(['planned', 3]) },
    { workspaceId: wsW, title: 'The Hidden Cost of AI-First Development', contentType: 'article', stage: 'planned', tags: ['AI', 'engineering', 'opinion'], targetPlatforms: ['weixin', 'x', 'bilibili', 'weixin_video'], attachments: [], stageHistory: sh(['planned', 2]) },
    { workspaceId: wsW, title: 'Open Source LLMs in 2026: Llama, Mistral, and the New Players', contentType: 'article', stage: 'planned', tags: ['AI', 'open-source', 'LLM'], targetPlatforms: ['weixin', 'x', 'bilibili', 'weixin_video'], attachments: [], stageHistory: sh(['planned', 1]) },
  ]);

  // Queued publications for ready items
  await db.insert(publications).values([
    { contentId: pReady1!.id, platform: 'douyin',  status: 'queued', scheduledAt: daysFromNow(2), platformTags: ['#职场', '#打工人', '#搞笑'], platformSettings: {}, publishLog: [], platformTitle: "当PM说'就5分钟的事' 😶‍🌫️" },
    { contentId: pReady1!.id, platform: 'tiktok',  status: 'queued', scheduledAt: daysFromNow(2), platformTags: ['#pm', '#devlife', '#relatable'], platformSettings: {}, publishLog: [] },
    { contentId: pReady1!.id, platform: 'bilibili', status: 'queued', scheduledAt: daysFromNow(2), platformTags: ['程序员', '职场', '打工人'], platformSettings: {}, publishLog: [], platformTitle: "当需求方说「就5分钟」😶‍🌫️" },
    { contentId: pReady1!.id, platform: 'youtube',  status: 'queued', scheduledAt: daysFromNow(2), platformTags: ['#devhumor', '#pm', '#relatable'], platformSettings: {}, publishLog: [] },
    { contentId: pReady2!.id, platform: 'xiaohongshu', status: 'queued', scheduledAt: daysFromNow(3), platformTags: ['#咖啡店', '#上海', '#wfh'], platformSettings: {}, publishLog: [] },
    { contentId: pReady2!.id, platform: 'instagram',   status: 'queued', scheduledAt: daysFromNow(3), platformTags: ['#shanghai', '#cafe', '#remotework'], platformSettings: {}, publishLog: [] },
    { contentId: pReady2!.id, platform: 'douyin',      status: 'queued', scheduledAt: daysFromNow(3), platformTags: ['#上海咖啡', '#远程办公'], platformSettings: {}, publishLog: [] },
    { contentId: pReady2!.id, platform: 'weixin',      status: 'queued', scheduledAt: daysFromNow(3), platformTags: [], platformSettings: {}, publishLog: [] },
    { contentId: pReady3!.id, platform: 'weixin',       status: 'queued', scheduledAt: daysFromNow(5), platformTags: [], platformSettings: {}, publishLog: [] },
    { contentId: pReady3!.id, platform: 'x',            status: 'queued', scheduledAt: daysFromNow(5), platformTags: ['#AI', '#startups'], platformSettings: {}, publishLog: [] },
    { contentId: pReady3!.id, platform: 'bilibili',     status: 'queued', scheduledAt: daysFromNow(5), platformTags: ['AI', '创业', '预测'], platformSettings: {}, publishLog: [] },
    { contentId: pReady3!.id, platform: 'weixin_video', status: 'queued', scheduledAt: daysFromNow(5), platformTags: [], platformSettings: {}, publishLog: [] },
  ]);

  // ── 8. Content briefs (hero items only) ───────────────────────────────────
  if (firstComedyId) {
    await db.insert(contentPlans).values({
      contentId: firstComedyId,
      formatConfig: { duration: 30, aspectRatio: '9:16', music: 'trending' },
      audience: { ageRange: '22-30', personaTags: ['office worker', 'millennial', 'remote-worker'], painPoint: 'Romanticizes WFH, reality is messier', reachScenario: 'Evening Douyin scroll, post-work' },
      goals: ['grow_followers', 'branding'],
      goalDescription: 'Grow followers with relatable content that makes office workers feel seen',
      kpiTargets: { likes: 10000, comments: 500, shares: 1000, followers: 500 },
      hooks: { coreHook: 'The gap between imagined freedom and reality of home distractions', conflict: 'You wanted no commute — now your couch is your prison', goldenOpening: 'Open on someone triumphantly canceling commute, then immediate chaos', memoryAnchor: '"Remote work hits different at month 3"' },
      titleCandidates: [
        { text: 'Expectation vs Reality: Working From Home', isPrimary: true, usedOnPlatforms: ['douyin', 'tiktok'] },
        { text: 'WFH Month 1 vs Month 3', isPrimary: false, usedOnPlatforms: [] },
      ],
      outline: [
        { order: 1, section: 'Hook', timeMark: '0-3s', note: 'Calendar notification: "No commute today!" — huge smile' },
        { order: 2, section: 'Expectation montage', timeMark: '3-12s', note: 'Clean desk, focused, coffee in hand' },
        { order: 3, section: 'Reality reveal', timeMark: '12-25s', note: 'Bed as office, cat on keyboard, fridge trip #12' },
        { order: 4, section: 'Punchline', timeMark: '25-30s', note: '"Still better than the commute" shrug' },
      ],
    });
  }

  if (firstLifestyleId) {
    await db.insert(contentPlans).values({
      contentId: firstLifestyleId,
      formatConfig: { imageCount: 9, aspectRatio: '3:4' },
      audience: { ageRange: '20-28', personaTags: ['student', 'young professional', 'fashion-conscious'], painPoint: 'Want style but budget is tight', reachScenario: 'Browsing Xiaohongshu for outfit inspo on weekends' },
      goals: ['convert', 'grow_followers'],
      goalDescription: 'Drive saves and follows via actionable budget fashion advice',
      kpiTargets: { likes: 5000, saves: 8000, comments: 300 },
      hooks: { coreHook: 'Maximum outfits from minimum pieces for minimum spend', conflict: 'Fashion is expensive vs you can look great on a budget', goldenOpening: 'Grid of all 30 outfit combinations from just 10 pieces' },
      titleCandidates: [
        { text: 'My Capsule Wardrobe: 10 Pieces, 30 Outfits Under ¥500', isPrimary: true, usedOnPlatforms: ['xiaohongshu', 'instagram'] },
        { text: 'I Spent ¥500 and Never Got Dressed Again (In a Good Way)', isPrimary: false, usedOnPlatforms: [] },
      ],
      outline: [
        { order: 1, section: 'Opening flat lay', timeMark: '', note: 'All 10 pieces on white bed' },
        { order: 2, section: 'Each item with price tag', timeMark: '', note: 'Where bought, exact price' },
        { order: 3, section: 'Outfit combinations x9', timeMark: '', note: '3 casual, 3 office, 3 going out' },
        { order: 4, section: 'Shopping links', timeMark: '', note: 'Taobao/Pinduoduo links in comments' },
      ],
    });
  }

  if (firstTechId) {
    await db.insert(contentPlans).values({
      contentId: firstTechId,
      formatConfig: { wordCount: 3000, hasCodeBlocks: true },
      audience: { ageRange: '25-40', personaTags: ['developer', 'tech lead', 'CTO'], painPoint: 'Too many AI hype articles, not enough practical comparison', reachScenario: 'Monday morning, WeChat moments, first coffee' },
      goals: ['branding', 'grow_followers'],
      goalDescription: 'Establish credibility as a thoughtful, no-BS AI analyst',
      kpiTargets: { views: 20000, likes: 1000, shares: 500 },
      hooks: { coreHook: 'A working developer actually testing both tools on real tasks', conflict: 'Marketing claims vs actual code quality', goldenOpening: 'Side-by-side code generation comparison for a real-world task' },
      titleCandidates: [
        { text: 'The Real Difference Between Claude 4 and GPT-5 for Developers', isPrimary: true, usedOnPlatforms: ['weixin', 'x'] },
        { text: "I Tested Both AI Models on My Actual Work. Here's What I Found.", isPrimary: false, usedOnPlatforms: [] },
      ],
      outline: [
        { order: 1, section: 'Introduction', timeMark: '', note: 'Why another comparison? Because most are wrong.' },
        { order: 2, section: 'Test methodology', timeMark: '', note: '5 real tasks: code review, debugging, architecture, docs, test writing' },
        { order: 3, section: 'Results by task', timeMark: '', note: 'Winner for each with code examples' },
        { order: 4, section: 'When to use which', timeMark: '', note: 'Decision tree for developers' },
        { order: 5, section: 'Verdict', timeMark: '', note: 'Both have a place. Context matters.' },
      ],
    });
  }

  // ── 9. Competitive references ──────────────────────────────────────────────
  if (firstComedyId) {
    await db.insert(contentReferences).values({
      contentId: firstComedyId,
      authorName: '@funnyoffice99', contentTitle: 'Office Life in 2025: Expectations vs Reality',
      platform: 'douyin', url: 'https://www.douyin.com/video/example1',
      metricsSnapshot: { views: 2300000, likes: 180000, comments: 12000 },
      takeaway: 'Slow-motion reveal of messy reality works perfectly. Steal this transition technique.', attachments: [],
    });
  }
  if (firstTechId) {
    await db.insert(contentReferences).values({
      contentId: firstTechId,
      authorName: 'Lex Fridman', contentTitle: 'GPT-4 vs Claude: Which AI Is Actually Better?',
      platform: 'youtube', url: 'https://www.youtube.com/watch?v=example',
      metricsSnapshot: { views: 1200000, likes: 45000, comments: 8000 },
      takeaway: 'Long-form works but needs a shorter WeChat-friendly adaptation. Focus on the verdict.', attachments: [],
    });
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const totalContent = 39 + 26 + 26 + 4 + 3 + 2 + 5; // historical + recent published + ready + creating + planned
  console.log(`\n✓ Demo account seeded in ${elapsed}s`);
  console.log('\nDemo credentials:');
  console.log('  Email:    demo@orbit.app');
  console.log('  Password: demo1234');
  console.log('\nData summary:');
  console.log('  3 workspaces (Comedy, Lifestyle, Tech Insights)');
  console.log('  3 plan templates');
  console.log('  10 ideas (active, 2 converted, 1 archived)');
  console.log(`  ${totalContent} content items across 15 months (all stages)`);
  console.log('  Every content item has multiple target platforms');
  console.log('    Comedy: douyin + tiktok (some + bilibili)');
  console.log('    Lifestyle: xiaohongshu + instagram');
  console.log('    Tech: weixin + x');
  console.log('  3 content briefs with outlines + competitive references');
  console.log('  Publications + multi-snapshot metrics spanning 15 months');
}

seed()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => process.exit(0));
