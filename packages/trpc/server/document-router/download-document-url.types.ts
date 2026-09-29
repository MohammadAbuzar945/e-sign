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
    description:
      'Get a pre-signed download URL for the original or signed version of a document. Single-item documents return a flat object; multi-item envelopes return an array of download URLs.',
    tags: ['Document'],
  },
};

export const ZDownloadDocumentUrlRequestSchema = ZDownloadDocumentRequestSchema;

const ZDownloadDocumentUrlMultiItemSchema = z.object({
  envelopeItemId: z.string().describe('The ID of the envelope item'),
  downloadUrl: z.string().describe('Pre-signed URL for downloading the PDF file'),
  filename: z.string().describe('The filename of the PDF file'),
  contentType: z.string().describe('MIME type of the file'),
});

export const ZDownloadDocumentUrlResponseSchema = z.union([
  ZDownloadDocumentResponseSchema,
  z.array(ZDownloadDocumentUrlMultiItemSchema),
]);

export type TDownloadDocumentUrlRequest = z.infer<typeof ZDownloadDocumentUrlRequestSchema>;
export type TDownloadDocumentUrlResponse = z.infer<typeof ZDownloadDocumentUrlResponseSchema>;
