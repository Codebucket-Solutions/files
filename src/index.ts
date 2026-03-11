import { IUploader } from './interfaces/IUploader';
import type { UploadOptions } from './interfaces/IUploader';
import { FileSystemUploader } from './uploaders/FileSystemUploader';
import { S3CompatibleUploader } from './uploaders/S3CompatibleUploader';
import { AzureBlobUploader } from './uploaders/AzureBlobUploader';
import { createMulterUploader, FilesStorageEngine } from './multer/createMulterUploader';
import type { Readable } from 'stream';

export class Files implements IUploader {
  private uploader: IUploader;

  constructor(config: { type: 'filesystem'; baseDir: string; publicBaseUrl?: string } | { type: 's3';  baseDir?: string; publicBaseUrl?: string;bucketName: string; endpoint: string; s3Config?: any }) {
    if (config.type === 'filesystem') {
      this.uploader = new FileSystemUploader(config.baseDir, config.publicBaseUrl);
    } else {
      this.uploader = new S3CompatibleUploader(config.bucketName, config.endpoint, config.baseDir, config.publicBaseUrl, config.s3Config);
    }
  }

  upload(filePath: string, data: Buffer, options?: UploadOptions): Promise<string> {
    return this.uploader.upload(filePath, data, options);
  }

  uploadStream(filePath: string, stream: Readable, options?: UploadOptions): Promise<string> {
    if (!this.uploader.uploadStream) {
      throw new Error('uploadStream is not supported by the configured uploader');
    }

    return this.uploader.uploadStream(filePath, stream, options);
  }

  download(filePath: string, res?:any): Promise<Buffer|void> {
    return this.uploader.download(filePath,res);
  }

  downloadZip(filePaths: string[], res?:any): Promise<Buffer|void> {
    return this.uploader.downloadZip(filePaths,res);
  }

  getPublicUrl(filePath: string): string {
    return this.uploader.getPublicUrl ? this.uploader.getPublicUrl(filePath) : '';
  }

  delete(filePath: string): Promise<void> {
    return this.uploader.delete(filePath);
  }
}

export type { UploadOptions } from './interfaces/IUploader';
export { IUploader, FileSystemUploader, S3CompatibleUploader, AzureBlobUploader, createMulterUploader, FilesStorageEngine };
