import { IUploader } from './interfaces/IUploader';
import { FileSystemUploader } from './uploaders/FileSystemUploader';
import { S3CompatibleUploader } from './uploaders/S3CompatibleUploader';

export class Files implements IUploader {
  private uploader: IUploader;

  constructor(config: { type: 'filesystem'; baseDir: string; publicBaseUrl?: string } | { type: 's3';  baseDir?: string; publicBaseUrl?: string;bucketName: string; endpoint: string; s3Config?: any }) {
    if (config.type === 'filesystem') {
      this.uploader = new FileSystemUploader(config.baseDir, config.publicBaseUrl);
    } else {
      this.uploader = new S3CompatibleUploader(config.bucketName, config.endpoint, config.baseDir, config.publicBaseUrl, config.s3Config);
    }
  }

  upload(filePath: string, data: Buffer): Promise<string> {
    return this.uploader.upload(filePath, data);
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
}

export { IUploader, FileSystemUploader, S3CompatibleUploader };