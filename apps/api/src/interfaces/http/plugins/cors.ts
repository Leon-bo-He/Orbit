import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { config } from '../../../config.js';

export const corsPlugin = fp(async (app) => {
  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
});
