/**
 * Demo seed — creates a realistic demo account with data across all features.
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

// ─── main ────────────────────────────────────────────────────────────────────

async function seed() {
  const force = process.argv.includes('--force');

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing) {
    if (!force) {
      console.log('Demo user already exists. Run with --force to re-seed.');
      process.exit(0);
    }
    console.log('Deleting existing demo data…');
    await db.delete(users).where(eq(users.email, DEMO_EMAIL));
  }

  console.log('Seeding demo account…');
  const t0 = Date.now();

  // ── 1. User ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [user] = await db.insert(users).values({
    email: DEMO_EMAIL,
    username: 'Alex Chen',
    locale: 'en-US',
    timezone: 'Asia/Shanghai',
    passwordHash,
  }).returning();
  const userId = user!.id;

  // ── 2. Workspaces ──────────────────────────────────────────────────────────
  // Workspaces represent content areas/verticals, not platforms.
  // Platform is chosen per publication.
  const [wDouyin, wXHS, wWeChat] = await db.insert(workspaces).values([
    {
      userId,
      name: 'Comedy',
      icon: '🎭',
      color: '#FF4757',
      about: 'Short comedy skits and trending relatable content',
      publishGoal: { count: 5, period: 'week' },
      stageConfig: [],
    },
    {
      userId,
      name: 'Lifestyle',
      icon: '🌸',
      color: '#FF6B9D',
      about: 'Fashion, food, travel, and daily life content',
      publishGoal: { count: 3, period: 'week' },
      stageConfig: [],
    },
    {
      userId,
      name: 'Tech Insights',
      icon: '🔬',
      color: '#2ECC71',
      about: 'In-depth tech analysis, AI commentary, and developer perspectives',
      publishGoal: { count: 2, period: 'week' },
      stageConfig: [],
    },
  ]).returning();

  const wsD = wDouyin!.id;
  const wsX = wXHS!.id;
  const wsW = wWeChat!.id;

  // ── 3. Plan templates ──────────────────────────────────────────────────────
  await db.insert(planTemplates).values([
    {
      workspaceId: wsD,
      name: 'Gen Z Comedy Hook',
      audience: { ageRange: '18-25', personaTags: ['Gen Z', 'student', 'trend-follower'], painPoint: 'Wants to escape stress', reachScenario: 'Scrolling Douyin before bed' },
      goals: ['grow_followers', 'branding'],
      goalDescription: 'Grow followers through relatable, shareable comedy',
    },
    {
      workspaceId: wsX,
      name: 'Lifestyle Discovery Reader',
      audience: { ageRange: '22-30', personaTags: ['young professional', 'fashion-conscious', 'city dweller'], painPoint: 'Looking for inspiration and product recommendations', reachScenario: 'Weekend morning browse' },
      goals: ['traffic', 'convert'],
      goalDescription: 'Drive traffic to affiliate links and brand partnerships',
    },
    {
      workspaceId: wsW,
      name: 'Tech Professional Reader',
      audience: { ageRange: '25-40', personaTags: ['developer', 'product manager', 'tech enthusiast'], painPoint: 'Needs curated, high-signal tech analysis', reachScenario: 'Monday morning commute or lunch break' },
      goals: ['branding', 'grow_followers'],
      goalDescription: 'Build authority as a trusted tech commentator',
    },
  ]);

  // ── 4. Ideas ───────────────────────────────────────────────────────────────

  // Insert converted ideas first so we can capture their IDs and link them to content
  const [ideaConv1] = await db.insert(ideas).values({
    userId, workspaceId: wsD, title: 'Expectation vs reality: remote work',
    tags: ['relatable', 'work-from-home'], priority: 'high', attachments: [], status: 'converted',
  }).returning();
  const [ideaConv2] = await db.insert(ideas).values({
    userId, workspaceId: wsX, title: 'My capsule wardrobe essentials under ¥500',
    tags: ['fashion', 'budget'], priority: 'high', attachments: [], status: 'converted',
  }).returning();

  await db.insert(ideas).values([
    // Global pool — active
    { userId, workspaceId: null, title: 'React vs Vue 2026 — which is actually winning?', tags: ['tech', 'frontend'], priority: 'high', attachments: [], status: 'active' },
    { userId, workspaceId: null, title: 'What happens when you eat McDonald\'s for 30 days', tags: ['food', 'challenge'], priority: 'medium', attachments: [], status: 'active' },
    { userId, workspaceId: null, title: 'Morning routines of billionaires vs normal people', tags: ['lifestyle', 'productivity'], priority: 'low', attachments: [], status: 'active' },
    // Douyin ideas
    { userId, workspaceId: wsD, title: 'POV: you\'re a debugging rubber duck', tags: ['dev-humor', 'relatable'], priority: 'high', attachments: [], status: 'active' },
    { userId, workspaceId: wsD, title: 'Types of programmers at 3am', tags: ['dev-humor', 'coding'], priority: 'medium', attachments: [], status: 'active' },
    { userId, workspaceId: wsD, title: 'Office vibes on Monday vs Friday', tags: ['relatable', 'work'], priority: 'medium', attachments: [], status: 'active' },
    // Xiaohongshu ideas
    { userId, workspaceId: wsX, title: 'Cherry blossom season outfit ideas', tags: ['fashion', 'spring'], priority: 'high', attachments: [], status: 'active' },
    { userId, workspaceId: wsX, title: 'Tokyo ramen spots you can\'t miss', tags: ['food', 'travel', 'japan'], priority: 'medium', attachments: [], status: 'active' },
    // WeChat ideas
    { userId, workspaceId: wsW, title: 'Claude 4 vs GPT-5 — a real developer\'s take', tags: ['AI', 'LLM', 'opinion'], priority: 'high', attachments: [], status: 'active', note: 'Focus on coding use-cases specifically, not general chat.' },
    { userId, workspaceId: wsW, title: 'Why most AI startups will fail in 2027', tags: ['AI', 'startup', 'prediction'], priority: 'medium', attachments: [], status: 'active' },
    // Archived
    { userId, workspaceId: null, title: 'Old trend idea that faded', tags: [], priority: 'low', attachments: [], status: 'archived' },
    { userId, workspaceId: wsD, title: 'That one meme format from 2024', tags: ['meme'], priority: 'low', attachments: [], status: 'archived' },
  ]);

  // ── 5. Contents ────────────────────────────────────────────────────────────

  // ── Douyin contents ────────────────────────────────────────────────────────
  const [
    dReviewed1, dReviewed2,
    dPublished1, dPublished2, dPublished3,
    dReady1, dReady2,
    dCreating1, dCreating2,
    dPlanned1, dPlanned2, dPlanned3,
  ] = await db.insert(contents).values([
    // Reviewed (fully done with post-mortem)
    {
      workspaceId: wsD, title: 'Expectation vs Reality: Remote Work Life',
      ideaId: ideaConv1!.id, contentType: 'video_short', stage: 'reviewed',
      tags: ['relatable', 'work-from-home', 'comedy'], targetPlatforms: ['douyin', 'tiktok'],
      scheduledAt: daysAgo(45), publishedAt: daysAgo(44),
      notes: 'Filmed 3 takes, final one nailed it.',
      reviewNotes: 'Exceeded all KPIs. The surprise ending got huge engagement. Reuse format.',
      attachments: [], stageHistory: sh(['planned', 52], ['creating', 50], ['ready', 47], ['published', 44], ['reviewed', 38]),
    },
    {
      workspaceId: wsD, title: 'When The Code Finally Works After 3 Hours',
      contentType: 'video_short', stage: 'reviewed',
      tags: ['dev-humor', 'relatable', 'coding'], targetPlatforms: ['douyin', 'tiktok'],
      scheduledAt: daysAgo(30), publishedAt: daysAgo(29),
      notes: 'Keep it under 30s for max retention.',
      reviewNotes: 'Strong performance on saves. Developers are a great niche on Douyin.',
      attachments: [], stageHistory: sh(['planned', 38], ['creating', 35], ['ready', 32], ['published', 29], ['reviewed', 22]),
    },
    // Published
    {
      workspaceId: wsD, title: 'POV: You\'re the Only One Who Reads the Docs',
      contentType: 'video_short', stage: 'published',
      tags: ['dev-humor', 'relatable'], targetPlatforms: ['douyin'],
      scheduledAt: daysAgo(15), publishedAt: daysAgo(14),
      notes: 'Use trending audio track #0923',
      attachments: [], stageHistory: sh(['planned', 22], ['creating', 20], ['ready', 17], ['published', 14]),
    },
    {
      workspaceId: wsD, title: 'Types of Colleagues in Every Stand-up Meeting',
      contentType: 'video_short', stage: 'published',
      tags: ['work', 'relatable', 'comedy'], targetPlatforms: ['douyin'],
      scheduledAt: daysAgo(8), publishedAt: daysAgo(7),
      attachments: [], stageHistory: sh(['planned', 16], ['creating', 13], ['ready', 9], ['published', 7]),
    },
    {
      workspaceId: wsD, title: 'Debugging at 3am be like…',
      contentType: 'video_short', stage: 'published',
      tags: ['dev-humor', 'coding', 'relatable'], targetPlatforms: ['douyin'],
      scheduledAt: daysAgo(3), publishedAt: daysAgo(2),
      attachments: [], stageHistory: sh(['planned', 10], ['creating', 8], ['ready', 4], ['published', 2]),
    },
    // Ready
    {
      workspaceId: wsD, title: 'When Your PM Says "It\'ll Only Take 5 Minutes"',
      contentType: 'video_short', stage: 'ready',
      tags: ['dev-humor', 'work', 'relatable'], targetPlatforms: ['douyin'],
      scheduledAt: daysFromNow(2),
      attachments: [], stageHistory: sh(['planned', 12], ['creating', 9], ['ready', 3]),
    },
    {
      workspaceId: wsD, title: 'Every Developer\'s Reaction to a New JavaScript Framework',
      contentType: 'video_short', stage: 'ready',
      tags: ['dev-humor', 'javascript', 'comedy'], targetPlatforms: ['douyin'],
      scheduledAt: daysFromNow(5),
      attachments: [], stageHistory: sh(['planned', 10], ['creating', 6], ['ready', 1]),
    },
    // Creating
    {
      workspaceId: wsD, title: 'Office Monday vs Friday Energy',
      contentType: 'video_short', stage: 'creating',
      tags: ['work', 'relatable', 'comedy'], targetPlatforms: ['douyin'],
      notes: 'B-roll: coffee machine, commute, slack notifications',
      attachments: [], stageHistory: sh(['planned', 8], ['creating', 4]),
    },
    {
      workspaceId: wsD, title: 'Git Commit Messages Through The Ages',
      contentType: 'video_short', stage: 'creating',
      tags: ['dev-humor', 'coding', 'relatable'], targetPlatforms: ['douyin'],
      attachments: [], stageHistory: sh(['planned', 6], ['creating', 2]),
    },
    // Planned
    {
      workspaceId: wsD, title: 'The 5 Stages of Debugging Grief',
      contentType: 'video_short', stage: 'planned',
      tags: ['dev-humor', 'coding'], targetPlatforms: ['douyin'],
      attachments: [], stageHistory: sh(['planned', 4]),
    },
    {
      workspaceId: wsD, title: 'Zoom Call Bingo: Remote Work Edition',
      contentType: 'video_short', stage: 'planned',
      tags: ['work-from-home', 'relatable'], targetPlatforms: ['douyin'],
      attachments: [], stageHistory: sh(['planned', 2]),
    },
    {
      workspaceId: wsD, title: 'POV: Being the Rubber Duck in a Dev Debugging Session',
      contentType: 'video_short', stage: 'planned',
      tags: ['dev-humor', 'comedy'], targetPlatforms: ['douyin'],
      attachments: [], stageHistory: sh(['planned', 0]),
    },
  ]).returning();

  // ── Xiaohongshu contents ───────────────────────────────────────────────────
  const [
    xReviewed1,
    xPublished1, xPublished2, xPublished3,
    xReady1, xReady2,
    xCreating1,
    xPlanned1,
  ] = await db.insert(contents).values([
    {
      workspaceId: wsX, title: 'My Capsule Wardrobe: 10 Pieces, 30 Outfits Under ¥500',
      ideaId: ideaConv2!.id, contentType: 'image_text', stage: 'reviewed',
      tags: ['fashion', 'budget', 'capsule-wardrobe'], targetPlatforms: ['xiaohongshu', 'instagram'],
      scheduledAt: daysAgo(42), publishedAt: daysAgo(41),
      reviewNotes: 'Saves through the roof. Budget fashion posts consistently outperform.',
      attachments: [], stageHistory: sh(['planned', 50], ['creating', 46], ['ready', 43], ['published', 41], ['reviewed', 35]),
    },
    {
      workspaceId: wsX, title: 'Spring 2026 Outfit Ideas — Cherry Blossom Season Lookbook',
      contentType: 'image_text', stage: 'published',
      tags: ['fashion', 'spring', 'lookbook', 'cherry-blossom'], targetPlatforms: ['xiaohongshu', 'instagram'],
      scheduledAt: daysAgo(20), publishedAt: daysAgo(19),
      attachments: [], stageHistory: sh(['planned', 28], ['creating', 24], ['ready', 21], ['published', 19]),
    },
    {
      workspaceId: wsX, title: 'Tokyo Food Diary: 7 Ramen Spots Worth the Queue',
      contentType: 'image_text', stage: 'published',
      tags: ['food', 'travel', 'japan', 'ramen'], targetPlatforms: ['xiaohongshu'],
      scheduledAt: daysAgo(11), publishedAt: daysAgo(10),
      attachments: [], stageHistory: sh(['planned', 20], ['creating', 16], ['ready', 12], ['published', 10]),
    },
    {
      workspaceId: wsX, title: 'The Only Skincare Routine You Need for Summer',
      contentType: 'image_text', stage: 'published',
      tags: ['skincare', 'beauty', 'summer'], targetPlatforms: ['xiaohongshu'],
      scheduledAt: daysAgo(4), publishedAt: daysAgo(3),
      attachments: [], stageHistory: sh(['planned', 12], ['creating', 8], ['ready', 5], ['published', 3]),
    },
    {
      workspaceId: wsX, title: 'Best Cafés in Shanghai for Remote Work (2026 Edition)',
      contentType: 'image_text', stage: 'ready',
      tags: ['cafe', 'shanghai', 'work', 'lifestyle'], targetPlatforms: ['xiaohongshu'],
      scheduledAt: daysFromNow(3),
      attachments: [], stageHistory: sh(['planned', 9], ['creating', 5], ['ready', 2]),
    },
    {
      workspaceId: wsX, title: 'Minimalist Home Office Setup Under ¥2000',
      contentType: 'image_text', stage: 'ready',
      tags: ['home-office', 'minimalist', 'setup'], targetPlatforms: ['xiaohongshu'],
      scheduledAt: daysFromNow(6),
      attachments: [], stageHistory: sh(['planned', 7], ['creating', 3], ['ready', 1]),
    },
    {
      workspaceId: wsX, title: 'Tried 5 Viral TikTok Recipes — Honest Review',
      contentType: 'image_text', stage: 'creating',
      tags: ['food', 'recipe', 'review'], targetPlatforms: ['xiaohongshu'],
      attachments: [], stageHistory: sh(['planned', 5], ['creating', 2]),
    },
    {
      workspaceId: wsX, title: 'How I Stopped Impulse Buying (And Built a Better Wardrobe)',
      contentType: 'image_text', stage: 'planned',
      tags: ['fashion', 'mindset', 'finance'], targetPlatforms: ['xiaohongshu'],
      attachments: [], stageHistory: sh(['planned', 1]),
    },
  ]).returning();

  // ── WeChat OA contents ────────────────────────────────────────────────────
  const [
    wPublished1,
    wReady1, wReady2,
    wCreating1,
    wPlanned1, wPlanned2,
  ] = await db.insert(contents).values([
    {
      workspaceId: wsW, title: 'The Real Difference Between Claude 4 and GPT-5 for Developers',
      contentType: 'article', stage: 'published',
      tags: ['AI', 'LLM', 'developer-tools', 'claude', 'gpt'], targetPlatforms: ['weixin', 'x'],
      scheduledAt: daysAgo(12), publishedAt: daysAgo(11),
      notes: 'Include code examples for tool use and function calling.',
      attachments: [], stageHistory: sh(['planned', 21], ['creating', 17], ['ready', 13], ['published', 11]),
    },
    {
      workspaceId: wsW, title: 'Why Most AI Startups Will Fail in 2027 (And What Survives)',
      contentType: 'article', stage: 'ready',
      tags: ['AI', 'startup', 'prediction', 'VC'], targetPlatforms: ['weixin'],
      scheduledAt: daysFromNow(4),
      attachments: [], stageHistory: sh(['planned', 10], ['creating', 6], ['ready', 2]),
    },
    {
      workspaceId: wsW, title: 'Vibe Coding Is Real: How Junior Devs Are Shipping Faster with AI',
      contentType: 'article', stage: 'ready',
      tags: ['AI', 'productivity', 'coding', 'junior-dev'], targetPlatforms: ['weixin'],
      scheduledAt: daysFromNow(8),
      attachments: [], stageHistory: sh(['planned', 8], ['creating', 4], ['ready', 1]),
    },
    {
      workspaceId: wsW, title: 'From Prompt Engineering to Agent Architecture: What Changed',
      contentType: 'article', stage: 'creating',
      tags: ['AI', 'agents', 'architecture', 'LLM'], targetPlatforms: ['weixin'],
      attachments: [], stageHistory: sh(['planned', 6], ['creating', 2]),
    },
    {
      workspaceId: wsW, title: 'The Hidden Cost of AI-First Development',
      contentType: 'article', stage: 'planned',
      tags: ['AI', 'engineering', 'opinion'], targetPlatforms: ['weixin'],
      attachments: [], stageHistory: sh(['planned', 3]),
    },
    {
      workspaceId: wsW, title: 'Open Source LLMs in 2026: Llama, Mistral, and the New Players',
      contentType: 'article', stage: 'planned',
      tags: ['AI', 'open-source', 'LLM', 'llama'], targetPlatforms: ['weixin'],
      attachments: [], stageHistory: sh(['planned', 1]),
    },
  ]).returning();

  // ── 5b. Close the idea → content bidirectional links ──────────────────────
  await db.update(ideas).set({ convertedTo: dReviewed1!.id }).where(eq(ideas.id, ideaConv1!.id));
  await db.update(ideas).set({ convertedTo: xReviewed1!.id }).where(eq(ideas.id, ideaConv2!.id));

  // ── 6. Content Briefs ──────────────────────────────────────────────────────
  // Add briefs to a selection of content items for richness
  await db.insert(contentPlans).values([
    {
      contentId: dReviewed1!.id,
      formatConfig: { duration: 30, aspectRatio: '9:16', music: 'trending' },
      audience: { ageRange: '22-30', personaTags: ['office worker', 'millennial', 'remote-worker'], painPoint: 'Romanticizes WFH, reality is messier', reachScenario: 'Evening Douyin scroll, post-work' },
      goals: ['grow_followers', 'branding'],
      goalDescription: 'Grow followers with relatable content that makes office workers feel seen',
      kpiTargets: { likes: 10000, comments: 500, shares: 1000, followers: 500 },
      hooks: { coreHook: 'The gap between imagined freedom and the reality of home distractions', conflict: 'You wanted no commute — now your couch is your prison', goldenOpening: 'Open on someone triumphantly canceling their commute, then immediate chaos', memoryAnchor: '"Remote work hits different at month 3"' },
      titleCandidates: [
        { text: 'Expectation vs Reality: Remote Work Life', isPrimary: true, usedOnPlatforms: ['douyin'] },
        { text: 'WFH Month 1 vs Month 3', isPrimary: false, usedOnPlatforms: [] },
      ],
      outline: [
        { order: 1, section: 'Hook', timeMark: '0-3s', note: 'Calendar notification: "No commute today!" — huge smile' },
        { order: 2, section: 'Expectation montage', timeMark: '3-12s', note: 'Clean desk, focused, productive, coffee in hand' },
        { order: 3, section: 'Reality reveal', timeMark: '12-25s', note: 'Bed as office, cat on keyboard, fridge trip #12' },
        { order: 4, section: 'Punchline', timeMark: '25-30s', note: '"Still better than the commute" shrug' },
      ],
    },
    {
      contentId: dPublished1!.id,
      formatConfig: { duration: 25, aspectRatio: '9:16' },
      audience: { ageRange: '20-28', personaTags: ['developer', 'student', 'tech-worker'], painPoint: 'Senior devs gatekeep docs knowledge', reachScenario: 'Late-night doom scroll between debugging sessions' },
      goals: ['grow_followers'],
      goalDescription: 'Niche down into developer humor to build a dedicated sub-audience',
      kpiTargets: { likes: 5000, shares: 500 },
      hooks: { coreHook: 'The lone developer who actually read the documentation', conflict: '"Why doesn\'t this work?!" vs "Did you read the docs?"', goldenOpening: 'Stack Overflow vs official docs side-by-side reaction' },
      titleCandidates: [
        { text: 'POV: You\'re the Only One Who Reads the Docs', isPrimary: true, usedOnPlatforms: ['douyin'] },
        { text: 'RTFDocs — the rarest developer skill', isPrimary: false, usedOnPlatforms: [] },
      ],
      outline: [
        { order: 1, section: 'Problem setup', timeMark: '0-5s', note: 'Team is confused about an API, everyone Googling' },
        { order: 2, section: 'Hero moment', timeMark: '5-15s', note: 'Open the official docs, find answer in 30 seconds' },
        { order: 3, section: 'Reaction', timeMark: '15-25s', note: 'Team stunned. "How did you know that?" "I read."' },
      ],
    },
    {
      contentId: xPublished1!.id,
      formatConfig: { imageCount: 9, aspectRatio: '3:4' },
      audience: { ageRange: '20-28', personaTags: ['student', 'young professional', 'fashion-conscious'], painPoint: 'Want style but budget is tight', reachScenario: 'Browsing Xiaohongshu for outfit inspo on weekends' },
      goals: ['convert', 'grow_followers'],
      goalDescription: 'Drive saves and follows via actionable budget fashion advice',
      kpiTargets: { likes: 5000, saves: 8000, comments: 300 },
      hooks: { coreHook: 'Maximum outfits from minimum pieces for minimum spend', conflict: 'Fashion is expensive vs you can look great on a budget', goldenOpening: 'Grid of all 30 outfit combinations from just 10 pieces' },
      titleCandidates: [
        { text: 'My Capsule Wardrobe: 10 Pieces, 30 Outfits Under ¥500', isPrimary: true, usedOnPlatforms: ['xiaohongshu'] },
        { text: 'I Spent ¥500 and Never Got Dressed Again (In a Good Way)', isPrimary: false, usedOnPlatforms: [] },
      ],
      outline: [
        { order: 1, section: 'Opening flat lay', timeMark: '', note: 'All 10 pieces laid out on white bed' },
        { order: 2, section: 'Each item with price tag', timeMark: '', note: 'Where bought, exact price' },
        { order: 3, section: 'Outfit combinations x9', timeMark: '', note: '3 casual, 3 office, 3 going out — one image each' },
        { order: 4, section: 'Shopping links', timeMark: '', note: 'Taobao/Pinduoduo links in comments' },
      ],
    },
    {
      contentId: wPublished1!.id,
      formatConfig: { wordCount: 3000, hasCodeBlocks: true },
      audience: { ageRange: '25-40', personaTags: ['developer', 'tech lead', 'CTO'], painPoint: 'Too many AI hype articles, not enough practical comparison', reachScenario: 'Monday morning, WeChat moments, first coffee' },
      goals: ['branding', 'grow_followers'],
      goalDescription: 'Establish credibility as a thoughtful, no-BS AI analyst',
      kpiTargets: { views: 20000, likes: 1000, shares: 500 },
      hooks: { coreHook: 'A working developer actually testing both tools on real tasks', conflict: 'Marketing claims vs actual code quality', goldenOpening: 'Side-by-side code generation comparison for a real-world task' },
      titleCandidates: [
        { text: 'The Real Difference Between Claude 4 and GPT-5 for Developers', isPrimary: true, usedOnPlatforms: ['weixin'] },
        { text: 'I Tested Both AI Models on My Actual Work. Here\'s What I Found.', isPrimary: false, usedOnPlatforms: [] },
      ],
      outline: [
        { order: 1, section: 'Introduction', timeMark: '', note: 'Why another comparison? Because most are wrong.' },
        { order: 2, section: 'Test methodology', timeMark: '', note: '5 real tasks: code review, debugging, architecture, docs, test writing' },
        { order: 3, section: 'Results by task', timeMark: '', note: 'Winner for each with code examples' },
        { order: 4, section: 'When to use which', timeMark: '', note: 'Decision tree for developers' },
        { order: 5, section: 'Verdict', timeMark: '', note: 'Both have a place. Context matters.' },
      ],
    },
  ]);

  // ── Competitive references ─────────────────────────────────────────────────
  await db.insert(contentReferences).values([
    {
      contentId: dReviewed1!.id,
      authorName: '@funnyoffice99',
      contentTitle: 'Office Life in 2025: Expectations vs Reality',
      platform: 'douyin',
      url: 'https://www.douyin.com/video/example1',
      metricsSnapshot: { views: 2300000, likes: 180000, comments: 12000 },
      takeaway: 'The slow-motion reveal of the messy reality works perfectly. Steal this transition technique.',
      attachments: [],
    },
    {
      contentId: wPublished1!.id,
      authorName: 'Lex Fridman',
      contentTitle: 'GPT-4 vs Claude: Which AI Is Actually Better?',
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=example',
      metricsSnapshot: { views: 1200000, likes: 45000, comments: 8000 },
      takeaway: 'Long-form comparison works but needs a shorter, WeChat-friendly adaptation. Focus on the verdict.',
      attachments: [],
    },
  ]);

  // ── 7. Publications & Metrics ──────────────────────────────────────────────

  // Helper: create a publication + 2 metric snapshots
  async function pubWithMetrics(
    contentId: string,
    platform: string,
    publishedDaysAgo: number,
    m1: { daysAgo: number; views: number; likes: number; comments: number; shares: number; saves: number; followers: number },
    m2: { daysAgo: number; views: number; likes: number; comments: number; shares: number; saves: number; followers: number },
    platformUrl: string,
    extraPubFields?: object,
  ) {
    const [pub] = await db.insert(publications).values({
      contentId,
      platform,
      status: 'published',
      platformTags: [],
      platformSettings: {},
      publishedAt: daysAgo(publishedDaysAgo),
      scheduledAt: daysAgo(publishedDaysAgo),
      platformUrl,
      publishLog: [{ action: 'published', timestamp: daysAgo(publishedDaysAgo).toISOString(), note: platformUrl }],
      ...extraPubFields,
    }).returning();

    await db.insert(metrics).values([
      {
        publicationId: pub!.id,
        views: m1.views, likes: m1.likes, comments: m1.comments,
        shares: m1.shares, saves: m1.saves, followersGained: m1.followers,
        recordedAt: daysAgo(m1.daysAgo),
      },
      {
        publicationId: pub!.id,
        views: m2.views, likes: m2.likes, comments: m2.comments,
        shares: m2.shares, saves: m2.saves, followersGained: m2.followers,
        recordedAt: daysAgo(m2.daysAgo),
      },
    ]);

    return pub!;
  }

  // Douyin published content
  await pubWithMetrics(
    dReviewed1!.id, 'douyin', 44,
    { daysAgo: 42, views: 180000, likes: 22000, comments: 3400, shares: 1800, saves: 900, followers: 1200 },
    { daysAgo: 35, views: 341000, likes: 41000, comments: 6100, shares: 3200, saves: 1500, followers: 2100 },
    'https://www.douyin.com/video/demo-001',
    { platformTitle: 'Expectation vs Reality: Remote Work Life 😅', platformCopy: '这个太真实了！评论区晒出你的WFH现实 👇 #打工人 #远程工作' },
  );
  await pubWithMetrics(
    dReviewed2!.id, 'douyin', 29,
    { daysAgo: 27, views: 92000, likes: 14500, comments: 2200, shares: 1100, saves: 600, followers: 780 },
    { daysAgo: 20, views: 157000, likes: 24000, comments: 3800, shares: 1700, saves: 950, followers: 1300 },
    'https://www.douyin.com/video/demo-002',
    { platformTitle: 'When The Code Finally Works 💻✨', platformCopy: '每个程序员都经历过这一刻 😂 #程序员 #编程 #debug' },
  );
  await pubWithMetrics(
    dPublished1!.id, 'douyin', 14,
    { daysAgo: 12, views: 54000, likes: 8200, comments: 1100, shares: 560, saves: 320, followers: 440 },
    { daysAgo: 6, views: 78000, likes: 11600, comments: 1700, shares: 820, saves: 490, followers: 660 },
    'https://www.douyin.com/video/demo-003',
    { platformTitle: 'POV: You Actually Read The Docs 📖', platformCopy: '文档？我看过！ #程序员日常 #dev #coding' },
  );
  await pubWithMetrics(
    dPublished2!.id, 'douyin', 7,
    { daysAgo: 5, views: 43000, likes: 6100, comments: 890, shares: 430, saves: 210, followers: 320 },
    { daysAgo: 2, views: 61000, likes: 9400, comments: 1400, shares: 690, saves: 340, followers: 480 },
    'https://www.douyin.com/video/demo-004',
    { platformTitle: 'Stand-up Meeting Archetypes 🎭', platformCopy: '你们公司也有这几种人吗？ #职场 #打工人 #搞笑' },
  );
  await pubWithMetrics(
    dPublished3!.id, 'douyin', 2,
    { daysAgo: 1, views: 12000, likes: 1800, comments: 240, shares: 130, saves: 70, followers: 95 },
    { daysAgo: 0, views: 18500, likes: 2700, comments: 380, shares: 210, saves: 110, followers: 150 },
    'https://www.douyin.com/video/demo-005',
  );

  // Comedy content cross-posted to TikTok
  await pubWithMetrics(
    dReviewed1!.id, 'tiktok', 43,
    { daysAgo: 41, views: 95000, likes: 12400, comments: 1800, shares: 2300, saves: 800, followers: 980 },
    { daysAgo: 34, views: 174000, likes: 22600, comments: 3200, shares: 4100, saves: 1400, followers: 1850 },
    'https://www.tiktok.com/@demo/video/demo-001',
    { platformTitle: 'Expectation vs Reality: Remote Work Life 😅', platformCopy: 'The reality of working from home hit different 💀 #remotework #wfh #comedy #relatable' },
  );
  await pubWithMetrics(
    dReviewed2!.id, 'tiktok', 28,
    { daysAgo: 26, views: 48000, likes: 7200, comments: 1100, shares: 1400, saves: 480, followers: 620 },
    { daysAgo: 19, views: 81000, likes: 11800, comments: 1900, shares: 2300, saves: 790, followers: 1050 },
    'https://www.tiktok.com/@demo/video/demo-002',
    { platformTitle: 'When the code finally works after 3 hours 💻✨', platformCopy: 'Every developer knows this feeling 😭 #coding #developer #programming #relatable' },
  );

  // Xiaohongshu published content
  await pubWithMetrics(
    xReviewed1!.id, 'xiaohongshu', 41,
    { daysAgo: 38, views: 64000, likes: 9800, comments: 1400, shares: 0, saves: 12000, followers: 890 },
    { daysAgo: 28, views: 98000, likes: 14200, comments: 2100, shares: 0, saves: 18500, followers: 1400 },
    'https://www.xiaohongshu.com/explore/demo-001',
    { platformTitle: '10件单品穿出30套造型｜500元打造胶囊衣橱', platformCopy: '整理了两个月的穿搭心得 💕 所有单品链接在评论区～ #穿搭 #胶囊衣橱 #省钱' },
  );
  await pubWithMetrics(
    xPublished1!.id, 'xiaohongshu', 19,
    { daysAgo: 16, views: 31000, likes: 5200, comments: 740, shares: 0, saves: 7800, followers: 520 },
    { daysAgo: 8, views: 47000, likes: 7600, comments: 1100, shares: 0, saves: 11200, followers: 790 },
    'https://www.xiaohongshu.com/explore/demo-002',
    { platformTitle: '2026春季穿搭｜赏樱花的正确打开方式🌸', platformCopy: '春天来了！和大家分享我的赏花穿搭合集 🌸 #春季穿搭 #樱花 #ootd' },
  );
  await pubWithMetrics(
    xPublished2!.id, 'xiaohongshu', 10,
    { daysAgo: 8, views: 22000, likes: 3800, comments: 520, shares: 0, saves: 5600, followers: 380 },
    { daysAgo: 3, views: 35000, likes: 5900, comments: 830, shares: 0, saves: 8200, followers: 610 },
    'https://www.xiaohongshu.com/explore/demo-003',
    { platformTitle: '东京7家拉面｜值得排队的真实测评🍜', platformCopy: '上周刚从东京回来，特别整理了这份拉面地图 🗾 收藏备用！ #东京美食 #拉面 #旅行' },
  );
  await pubWithMetrics(
    xPublished3!.id, 'xiaohongshu', 3,
    { daysAgo: 2, views: 8500, likes: 1400, comments: 190, shares: 0, saves: 2300, followers: 180 },
    { daysAgo: 0, views: 14200, likes: 2300, comments: 310, shares: 0, saves: 3900, followers: 290 },
    'https://www.xiaohongshu.com/explore/demo-004',
  );

  // Lifestyle content cross-posted to Instagram
  await pubWithMetrics(
    xReviewed1!.id, 'instagram', 40,
    { daysAgo: 37, views: 42000, likes: 6800, comments: 940, shares: 0, saves: 8900, followers: 710 },
    { daysAgo: 27, views: 68000, likes: 10500, comments: 1500, shares: 0, saves: 14200, followers: 1120 },
    'https://www.instagram.com/p/demo-001',
    { platformTitle: 'Capsule Wardrobe: 10 pieces, 30 outfits 💕', platformCopy: '¥500 capsule wardrobe challenge ✨ All links in bio! #capsulewardrobe #ootd #fashion #minimalist' },
  );
  await pubWithMetrics(
    xPublished1!.id, 'instagram', 18,
    { daysAgo: 15, views: 18500, likes: 3100, comments: 420, shares: 0, saves: 5200, followers: 390 },
    { daysAgo: 7, views: 29400, likes: 4800, comments: 650, shares: 0, saves: 7900, followers: 620 },
    'https://www.instagram.com/p/demo-002',
    { platformTitle: 'Spring lookbook 🌸 Cherry blossom season is here', platformCopy: 'Outfit ideas for cherry blossom season 🌸 #springfashion #ootd #cherryblossom #lookbook' },
  );

  // WeChat OA published content
  await pubWithMetrics(
    wPublished1!.id, 'weixin', 11,
    { daysAgo: 9, views: 18600, likes: 1240, comments: 287, shares: 456, saves: 0, followers: 312 },
    { daysAgo: 4, views: 27400, likes: 1890, comments: 423, shares: 698, saves: 0, followers: 461 },
    'https://mp.weixin.qq.com/s/demo-001',
    { platformTitle: '实测Claude 4 vs GPT-5：程序员视角的深度对比', platformCopy: '没有废话，直接测代码。5个真实任务，看谁更能打。' },
  );
  // Tech content cross-posted to X (Twitter)
  await pubWithMetrics(
    wPublished1!.id, 'x', 10,
    { daysAgo: 8, views: 24000, likes: 1860, comments: 342, shares: 891, saves: 0, followers: 267 },
    { daysAgo: 3, views: 38500, likes: 2940, comments: 528, shares: 1340, saves: 0, followers: 415 },
    'https://x.com/demo/status/demo-001',
    { platformTitle: 'Claude 4 vs GPT-5 for developers — I tested both on real work tasks', platformCopy: 'Forget the benchmarks. I tested Claude 4 and GPT-5 on 5 real dev tasks.\n\nCode review, debugging, architecture, docs, test writing.\n\nHere\'s what I found 🧵 #AI #developers #LLM' },
  );

  // Queued / ready publications
  await db.insert(publications).values([
    {
      contentId: dReady1!.id, platform: 'douyin', status: 'queued',
      scheduledAt: daysFromNow(2), platformTags: ['#职场', '#打工人', '#搞笑'],
      platformSettings: {}, publishLog: [],
      platformTitle: '当PM说"就5分钟的事" 😶‍🌫️',
    },
    {
      contentId: dReady2!.id, platform: 'douyin', status: 'queued',
      scheduledAt: daysFromNow(5), platformTags: ['#前端', '#javascript', '#程序员'],
      platformSettings: {}, publishLog: [],
    },
    {
      contentId: xReady1!.id, platform: 'xiaohongshu', status: 'queued',
      scheduledAt: daysFromNow(3), platformTags: ['#咖啡店', '#上海', '#ootd', '#打工人'],
      platformSettings: {}, publishLog: [],
    },
    {
      contentId: xReady2!.id, platform: 'xiaohongshu', status: 'ready',
      scheduledAt: daysFromNow(6), platformTags: ['#极简', '#居家', '#wfh'],
      platformSettings: {}, publishLog: [],
    },
    {
      contentId: wReady1!.id, platform: 'weixin', status: 'queued',
      scheduledAt: daysFromNow(4), platformTags: [],
      platformSettings: {}, publishLog: [],
    },
    {
      contentId: wReady2!.id, platform: 'weixin', status: 'ready',
      scheduledAt: daysFromNow(8), platformTags: [],
      platformSettings: {}, publishLog: [],
    },
  ]);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✓ Demo account seeded in ${elapsed}s`);
  console.log('\nDemo credentials:');
  console.log('  Email:    demo@orbit.app');
  console.log('  Password: demo1234');
  console.log('\nData summary:');
  console.log('  3 workspaces (Comedy, Lifestyle, Tech Insights)');
  console.log('  3 plan templates');
  console.log('  14 ideas (active, 2 converted with content links, archived)');
  console.log('  26 content items (all stages represented)');
  console.log('  4 content briefs with full outlines + references');
  console.log('  22 publications across Douyin, TikTok, Xiaohongshu, Instagram, WeChat, X');
  console.log('    — 3 content items cross-posted to 2 platforms each');
  console.log('  34 metric snapshots');
}

seed()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => process.exit(0));
