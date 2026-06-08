import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import { env } from '@documenso/lib/utils/env';
import slugify from '@sindresorhus/slugify';

import { ONE_HOUR } from '../../../constants/time';
import { alphaid } from '../../id';
import type { PresignedUrl, StorageProvider, UploadFileInput, UploadFileResult } from './storage-provider';

export class GCSProvider implements StorageProvider {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    const clientEmail = env('NEXT_PRIVATE_GCS_CLIENT_EMAIL');
    const privateKey = env('NEXT_PRIVATE_GCS_PRIVATE_KEY');
    const googleApplicationCredentials = env('GOOGLE_APPLICATION_CREDENTIALS');
    const projectId = env('NEXT_PRIVATE_GCS_PROJECT_ID');

    const credentials =
      clientEmail && privateKey
        ? {
            client_email: clientEmail,
            private_key: privateKey.replace(/\\n/g, '\n'),
            project_id: projectId,
          }
        : undefined;

    this.storage = new Storage({
      projectId,
      keyFilename: googleApplicationCredentials || undefined,
      credentials,
    });

    this.bucketName = String(env('NEXT_PRIVATE_GCS_BUCKET'));

    if (!this.bucketName) {
      throw new Error('GCS bucket name is undefined');
    }
  }

  async getPresignPostUrl(fileName: string, contentType: string, userId?: number): Promise<PresignedUrl> {
    const { name, ext } = path.parse(fileName);

    let key = `${alphaid(12)}/${slugify(name)}${ext}`;

    if (userId) {
      key = `${userId}/${key}`;
    }

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + ONE_HOUR,
      contentType,
    });

    return { key, url };
  }

  async getAbsolutePresignPostUrl(key: string): Promise<PresignedUrl> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + ONE_HOUR,
    });

    return { key, url };
  }

  async getPresignGetUrl(key: string): Promise<PresignedUrl> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + ONE_HOUR,
    });

    return { key, url };
  }

  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const { name, ext } = path.parse(input.name);

    const key = `${alphaid(12)}/${slugify(name)}${ext}`;

    const body = input.body instanceof ArrayBuffer ? Buffer.from(input.body) : input.body;

    const bucket = this.storage.bucket(this.bucketName);
    const gcsFile = bucket.file(key);

    await gcsFile.save(body, {
      contentType: input.type,
    });

    return { key };
  }

  async deleteFile(key: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);

    await file.delete();
  }
}
