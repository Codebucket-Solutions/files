import type { Readable } from 'stream';

export type UploadOptions = {
  contentType?: string;
  contentLength?: number;
  originalName?: string;
  metadata?: Record<string, string>;
};

export interface IUploader {
  upload(filePath: string, data: Buffer, options?: UploadOptions): Promise<string>;
  uploadStream?(filePath: string, stream: Readable, options?: UploadOptions): Promise<string>;
  download(filePath: string, res?: any): Promise<void | Buffer>;
  downloadZip(filePaths: string[], res?: any): Promise<void | Buffer>;

  /** Remove a previously uploaded file (best-effort). */
  delete(filePath: string): Promise<void>;

  getPublicUrl?(filePath: string): string;
}
