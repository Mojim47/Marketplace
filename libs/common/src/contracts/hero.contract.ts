import { z } from 'zod';

export const HeroAssetSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  version: z.string().default('1.0.0'),
  spatialData: z.any().optional(),
});

export type HeroAsset = z.infer<typeof HeroAssetSchema>;
