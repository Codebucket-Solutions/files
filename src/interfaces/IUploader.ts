export interface IUploader {
  upload(filePath: string, data: Buffer): Promise<string>;
  download(filePath: string): Promise<Buffer>;
  downloadZip(filePaths: string[]): Promise<Buffer>;
  getPublicUrl?(filePath: string): string;
}