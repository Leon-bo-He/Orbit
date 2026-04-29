import type { FastifyInstance } from 'fastify';
import type { BriefService, BriefSection } from '../../../domain/ai/brief.service.js';
import type { UserService } from '../../../domain/user/user.service.js';
import { ValidationError } from '../../../domain/errors.js';

const VALID_SECTIONS = new Set<BriefSection>([
  'audience', 'goals', 'hooks', 'titles', 'outline',
]);

export function briefRoutes(app: FastifyInstance, svc: BriefService, userSvc: UserService) {
  app.post('/api/ai-brief', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string };
    const { section, context } = req.body as {
      section?: string;
      context?: Record<string, unknown>;
    };

    if (!section || !VALID_SECTIONS.has(section as BriefSection)) {
      return reply.code(400).send({ error: 'Invalid section' });
    }
    if (!context?.contentTitle) {
      return reply.code(400).send({ error: 'context.contentTitle is required' });
    }

    try {
      const user = await userSvc.findById(sub);
      const result = await svc.generateSection(
        sub,
        section as BriefSection,
        context as unknown as Parameters<BriefService['generateSection']>[2],
        user?.locale,
      );
      return reply.send({ result });
    } catch (err) {
      if (err instanceof ValidationError) return reply.code(400).send({ error: err.message });
      if (err instanceof SyntaxError) return reply.code(400).send({ error: 'AI returned malformed JSON. Try again.' });
      throw err;
    }
  });
}
