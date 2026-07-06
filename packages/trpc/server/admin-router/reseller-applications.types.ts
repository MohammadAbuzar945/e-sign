import { z } from 'zod';

import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZResellerTermsVariableValuesSchema = z.record(z.string(), z.string());

export const ZSendResellerTermsApplicationSchema = z.object({
  applicationId: z.string(),
  variableValues: ZResellerTermsVariableValuesSchema,
  docGenOptions: z.object({
    showInNomia: z.boolean(),
    buildForEsign: z.boolean(),
    sendForEsign: z.boolean(),
    esignApiKey: z.string().optional(),
  }),
});

export const ZFindResellerApplicationsRequestSchema = ZFindSearchParamsSchema.extend({
  status: z.string().optional(),
});

export const ZFindResellerApplicationsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      appliedAt: z.date(),
      termsSentAt: z.date().nullable(),
      snapshotOrgName: z.string(),
      snapshotApplicantName: z.string(),
      snapshotApplicantEmail: z.string(),
      snapshotCompletedDocCount: z.number(),
      snapshotUniqueSignerCount: z.number(),
      snapshotOrgUserCount: z.number(),
      snapshotOrgSignupDate: z.date(),
      liveCompletedDocCount: z.number(),
      liveUniqueSignerCount: z.number(),
      liveOrgUserCount: z.number(),
      organisation: z.object({
        id: z.string(),
        name: z.string(),
        url: z.string(),
        createdAt: z.date(),
      }),
      applicantUser: z.object({
        id: z.number(),
        name: z.string().nullable(),
        email: z.string(),
      }),
    }),
  ),
  count: z.number(),
  currentPage: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
});

export const ZSendResellerTermsRequestSchema = z.object({
  applications: z.array(ZSendResellerTermsApplicationSchema).min(1),
});

export const ZSendResellerTermsResponseSchema = z.object({
  sentCount: z.number(),
});

export const ZRejectResellerApplicationRequestSchema = z.object({
  applicationId: z.string(),
  rejectionReason: z.string().optional(),
});

export const ZRejectResellerApplicationResponseSchema = z.object({
  success: z.literal(true),
});

export const ZRetryResellerApplicationActivationRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZRetryResellerApplicationActivationResponseSchema = z.object({
  success: z.literal(true),
});
