// Azure uploader intentionally does NOT import '@azure/storage-blob' as a hard dependency.
// It's an optional peerDependency. We require it lazily so builds work without it.

import archiver from 'archiver';
import mime from 'mime';
import { Readable } from 'stream';
import { IUploader, UploadOptions } from '../interfaces/IUploader';

type BlobServiceClientLike = any;

export type AzureBlobUploaderOptions = {
  /** Optional prefix to store all keys under a virtual folder */
  baseDir?: string;

  /** Optional public base URL to build public URLs from. */
  publicBaseUrl?: string;

  /**
   * When downloading with `res`, sets Content-Disposition.
   * Default: inline
   */
  contentDisposition?: 'inline' | 'attachment';
};

/**
 * Azure Blob Storage uploader.
 *
 * This file uses a dynamic dependency on `@azure/storage-blob`.
 * Consumers must install it:
 *   npm i @azure/storage-blob
 */
export class AzureBlobUploader implements IUploader {
  private serviceClient: BlobServiceClientLike;

  constructor(
    private containerName: string,
    connectionStringOrClient: string | BlobServiceClientLike,
    private options: AzureBlobUploaderOptions = {},
  ) {
    if (typeof connectionStringOrClient === 'string') {
      const BlobServiceClient = AzureBlobUploader.getBlobServiceClientCtor();
      this.serviceClient = BlobServiceClient.fromConnectionString(connectionStringOrClient);
    } else {
      this.serviceClient = connectionStringOrClient;
    }
  }

  private static getBlobServiceClientCtor(): any {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('@azure/storage-blob');
      return mod.BlobServiceClient;
    } catch {
      throw new Error(
        "AzureBlobUploader requires '@azure/storage-blob' to be installed. Run: npm i @azure/storage-blob",
      );
    }
  }

  private normalizeKey(filePath: string): string {
    let key = filePath;

    if (this.options.baseDir) key = `${this.options.baseDir}${key}`;

    if (key.startsWith('/')) key = key.slice(1);

    // Azure blob names can contain URL-encoded characters; keep consistent with other uploaders.
    return decodeURIComponent(key);
  }

  private container() {
    return this.serviceClient.getContainerClient(this.containerName);
  }

  async upload(filePath: string, data: Buffer, options?: UploadOptions): Promise<string> {
    const key = this.normalizeKey(filePath);
    const blob = this.container().getBlockBlobClient(key);

    const contentType = options?.contentType || mime.getType(key) || 'application/octet-stream';
    await blob.uploadData(data, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
      metadata: options?.metadata,
    });

    if (this.options.publicBaseUrl) return `${this.options.publicBaseUrl}${key}`;

    return blob.url;
  }

  async uploadStream(filePath: string, stream: Readable, options?: UploadOptions): Promise<string> {
    const key = this.normalizeKey(filePath);
    const blob = this.container().getBlockBlobClient(key);

    await blob.uploadStream(stream, undefined, undefined, {
      blobHTTPHeaders: {
        blobContentType: options?.contentType || mime.getType(key) || 'application/octet-stream',
      },
      metadata: options?.metadata,
    });

    if (this.options.publicBaseUrl) return `${this.options.publicBaseUrl}${key}`;

    return blob.url;
  }

  async download(filePath: string, res?: any): Promise<void | Buffer> {
    const key = this.normalizeKey(filePath);
    const blob = this.container().getBlobClient(key);

    const response = await blob.download();
    const stream = response.readableStreamBody as Readable | undefined;

    if (!stream) {
      if (res) return;
      return Buffer.alloc(0);
    }

    if (res) {
      const contentType =
        response.contentType || mime.getType(key) || 'application/octet-stream';

      if (typeof response.contentLength === 'number') {
        res.setHeader('Content-Length', response.contentLength.toString());
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        this.options.contentDisposition || 'inline',
      );
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      stream.pipe(res);
      return;
    }

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async downloadZip(filePaths: string[], res?: any): Promise<void | Buffer> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    if (!res) archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    if (res) archive.pipe(res);

    await Promise.all(
      filePaths.map(async (path) => {
        const key = this.normalizeKey(path);
        const file = await this.download(key);
        archive.append(file as Buffer, { name: key });
      }),
    );

    await archive.finalize();

    if (!res) return Buffer.concat(chunks);
  }

  async delete(filePath: string): Promise<void> {
    const key = this.normalizeKey(filePath);
    const blob = this.container().getBlobClient(key);

    // Best effort: ignore missing blobs.
    await blob.deleteIfExists();
  }

  getPublicUrl(filePath: string): string {
    const key = this.normalizeKey(filePath);

    if (this.options.publicBaseUrl) return `${this.options.publicBaseUrl}${key}`;

    return this.container().getBlobClient(key).url;
  }
}
