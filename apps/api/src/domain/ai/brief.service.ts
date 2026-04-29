import type { AiConfigRepository } from '../../infrastructure/db/repositories/ai-config.repository.js';
import type { AiService } from './ai.service.js';

export type BriefSection =
  | 'audience'
  | 'goals'
  | 'hooks'
  | 'titles'
  | 'outline'
  | 'format';

export interface BriefContext {
  contentTitle: string;
  contentType: string;
  platform?: string;
  audience?: string;
  goals?: string[];
  hooks?: string;
  outline?: string;
  additionalRequirements?: string;
}

const SECTION_PROMPTS: Record<BriefSection, (ctx: BriefContext, language: string) => string> = {
  audience: (ctx, lang) => `You are a content strategy expert. Based on the following content, generate a target audience profile.

Content title: "${ctx.contentTitle}"
Content type: ${ctx.contentType}
${ctx.platform ? `Platform: ${ctx.platform}` : ''}
${ctx.additionalRequirements ? `Additional context: ${ctx.additionalRequirements}` : ''}

Respond in ${lang} with a valid JSON object only, no markdown, no explanation:
{
  "ageRange": "e.g. 18-35",
  "personaTags": ["tag1", "tag2", "tag3"],
  "painPoints": "2-3 sentences describing the audience's main pain points",
  "reachScenario": "1-2 sentences describing where and how to reach this audience"
}`,

  goals: (ctx, lang) => `You are a content strategy expert. Suggest content goals and KPI targets.

Content title: "${ctx.contentTitle}"
Content type: ${ctx.contentType}
${ctx.audience ? `Target audience: ${ctx.audience}` : ''}
${ctx.additionalRequirements ? `Additional context: ${ctx.additionalRequirements}` : ''}

Available goal types: grow_followers, convert, traffic, branding

Respond in ${lang} with a valid JSON object only, no markdown, no explanation:
{
  "goals": ["grow_followers", "branding"],
  "goalDescription": "1-2 sentences explaining the goal strategy",
  "kpiTargets": { "likes": 500, "comments": 50, "shares": 100, "followers": 200 }
}`,

  hooks: (ctx, lang) => `You are a viral content strategist. Create a powerful hook analysis.

Content title: "${ctx.contentTitle}"
Content type: ${ctx.contentType}
${ctx.audience ? `Target audience: ${ctx.audience}` : ''}
${ctx.goals ? `Goals: ${ctx.goals.join(', ')}` : ''}
${ctx.additionalRequirements ? `Additional context: ${ctx.additionalRequirements}` : ''}

Respond in ${lang} with a valid JSON object only, no markdown, no explanation:
{
  "coreHook": "The single most compelling reason to watch/read this content",
  "conflict": "The tension or problem this content addresses",
  "goldenOpening": "A powerful first 10-15 words to open the content",
  "memoryPoint": "The one thing viewers should remember after consuming this"
}`,

  titles: (ctx, lang) => `You are a headline copywriter. Generate 5 title candidates for this content.

Content title (working title): "${ctx.contentTitle}"
Content type: ${ctx.contentType}
${ctx.audience ? `Target audience: ${ctx.audience}` : ''}
${ctx.hooks ? `Core hook: ${ctx.hooks}` : ''}
${ctx.additionalRequirements ? `Additional context: ${ctx.additionalRequirements}` : ''}

Respond in ${lang} with a valid JSON array only, no markdown, no explanation:
[
  { "text": "Title 1", "isPrimary": true, "usedOnPlatforms": [] },
  { "text": "Title 2", "isPrimary": false, "usedOnPlatforms": [] },
  { "text": "Title 3", "isPrimary": false, "usedOnPlatforms": [] },
  { "text": "Title 4", "isPrimary": false, "usedOnPlatforms": [] },
  { "text": "Title 5", "isPrimary": false, "usedOnPlatforms": [] }
]`,

  outline: (ctx, lang) => `You are a content structure expert. Create a detailed content outline.

Content title: "${ctx.contentTitle}"
Content type: ${ctx.contentType}
${ctx.audience ? `Target audience: ${ctx.audience}` : ''}
${ctx.goals ? `Goals: ${ctx.goals.join(', ')}` : ''}
${ctx.hooks ? `Core hook: ${ctx.hooks}` : ''}
${ctx.additionalRequirements ? `Additional context: ${ctx.additionalRequirements}` : ''}

Respond in ${lang} with a valid JSON array only, no markdown, no explanation. Include 5-8 sections:
[
  { "order": 1, "section": "Section name", "timeMark": "0:00", "note": "Brief note about this section" },
  { "order": 2, "section": "Section name", "timeMark": "1:30", "note": "Brief note" }
]
Use empty string "" for timeMark if not applicable (articles, blog posts).`,

  format: (ctx, lang) => `You are a content production expert. Suggest the optimal format configuration.

Content title: "${ctx.contentTitle}"
Content type: ${ctx.contentType}
${ctx.audience ? `Target audience: ${ctx.audience}` : ''}
${ctx.additionalRequirements ? `Additional context: ${ctx.additionalRequirements}` : ''}

Respond in ${lang} with a valid JSON object only, no markdown, no explanation.
For video content include duration (seconds) and aspectRatio. For others, include relevant fields only:
{
  "duration": 180,
  "aspectRatio": "9:16",
  "note": "Brief explanation of these format choices"
}`,
};

const LOCALE_LANGUAGE: Record<string, string> = {
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  'en-US': 'English',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
};

export class BriefService {
  constructor(
    private aiConfigRepo: AiConfigRepository,
    private aiSvc: AiService,
  ) {}

  async generateSection(
    userId: string,
    section: BriefSection,
    ctx: BriefContext,
    locale = 'en-US',
  ): Promise<unknown> {
    const config = await this.aiConfigRepo.findByUser(userId);
    if (!config) throw new Error('AI not configured. Please add your AI settings first.');

    const language = LOCALE_LANGUAGE[locale] ?? 'English';
    const prompt = SECTION_PROMPTS[section](ctx, language);

    // callAiApi is private — call through the parent service's public wrapper
    const raw = await this.aiSvc.callBriefPrompt(config, prompt);

    // Strip any markdown fences the model might add
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  }
}
