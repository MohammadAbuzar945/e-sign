import type {
  TGetPresignedPostUrlResponse,
  TUploadPdfResponse,
} from '@documenso/remix/server/api/files/files.types';
import { DocumentDataType } from '@prisma/client';
import { base64 } from '@scure/base';
import { match } from 'ts-pattern';

import { formatPath } from '../../constants/app';
import { AppError } from '../../errors/app-error';
import { env } from '../../utils/env';

type File = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

/**
 * Options for uploads that are not authorized by a logged-in session.
 *
 * Embedded authoring flows run cross-origin without a session cookie, so they
 * must authorize uploads with their embedding presign token instead.
 */
export type PutFileOptions = {
  presignToken?: string;
};

const buildUploadAuthHeaders = (options?: PutFileOptions): Record<string, string> => {
  if (!options?.presignToken) {
    return {};
  }

  return {
    Authorization: `Bearer ${options.presignToken}`,
  };
};

export const putPdfFile = async (file: File, options?: PutFileOptions) => {
  const formData = new FormData();

  // Create a proper File object from the data
  const buffer = await file.arrayBuffer();
  const blob = new Blob([buffer], { type: file.type });
  const properFile = new File([blob], file.name, { type: file.type });

  formData.append('file', properFile);

  const response = await fetch(formatPath('/api/files/upload-pdf'), {
    method: 'POST',
    headers: buildUploadAuthHeaders(options),
    body: formData,
  });

  if (!response.ok) {
    console.error('Upload failed:', response.statusText);
    throw new AppError('UPLOAD_FAILED');
  }

  const result: TUploadPdfResponse = await response.json();

  return result;
};

/**
 * Uploads a file to the appropriate storage location (client-side).
 */
export const putFile = async (file: File) => {
  const NEXT_PUBLIC_UPLOAD_TRANSPORT = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');

  return await match(NEXT_PUBLIC_UPLOAD_TRANSPORT)
    .with('s3', async () => putFileInObjectStorage(file))
    .with('gcs', async () => putFileInObjectStorage(file))
    .with('azure-blob', async () => putFileInObjectStorage(file))
    .otherwise(async () => putFileInDatabase(file));
};

const putFileInDatabase = async (file: File) => {
  const contents = await file.arrayBuffer();

  const binaryData = new Uint8Array(contents);

  const asciiData = base64.encode(binaryData);

  return {
    type: DocumentDataType.BYTES_64,
    data: asciiData,
  };
};

const putFileInObjectStorage = async (file: File) => {
  const getPresignedUrlResponse = await fetch(formatPath('/api/files/presigned-post-url'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
    }),
  });

  if (!getPresignedUrlResponse.ok) {
    throw new Error(
      `Failed to get presigned post url, failed with status code ${getPresignedUrlResponse.status}`,
    );
  }

  const { url, key }: TGetPresignedPostUrlResponse = await getPresignedUrlResponse.json();

  const body = await file.arrayBuffer();

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file "${file.name}", failed with status code ${response.status}`);
  }

  return {
    type: DocumentDataType.S3_PATH,
    data: key,
  };
};
