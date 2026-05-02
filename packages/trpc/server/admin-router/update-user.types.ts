import { Role } from '@prisma/client';
import { z } from 'zod';

import { zEmail } from '@documenso/lib/utils/zod';

export const ZUpdateUserRequestSchema = z.object({
  id: z.number().min(1),
  name: z.string().nullish(),
  email: zEmail().optional(),
  roles: z.array(z.nativeEnum(Role)).optional(),
  maxOrganisationCount: z.number().int().min(0).optional(),
});

export const ZUpdateUserResponseSchema = z.void();

export type TUpdateUserRequest = z.infer<typeof ZUpdateUserRequestSchema>;
export type TUpdateUserResponse = z.infer<typeof ZUpdateUserResponseSchema>;
