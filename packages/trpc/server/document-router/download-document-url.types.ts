import { z } from 'zod';

import {
  ZDownloadDocumentRequestSchema,
  ZDownloadDocumentResponseSchema,
} from './download-document-beta.types';
import type { TrpcRouteMeta } from '../trpc';

export const downloadDocumentUrlMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/document/{documentId}/download-url-nomia',
    summary: 'Get document download URL',
    description: 'Get a pre-signed download URL for the original or signed version of a document.',
    tags: ['Document'],
  },
};

export const ZDownloadDocumentUrlRequestSchema = ZDownloadDocumentRequestSchema;

export const ZDownloadDocumentUrlResponseSchema = ZDownloadDocumentResponseSchema;

export type TDownloadDocumentUrlRequest = z.infer<typeof ZDownloadDocumentUrlRequestSchema>;
export type TDownloadDocumentUrlResponse = z.infer<typeof ZDownloadDocumentUrlResponseSchema>;

