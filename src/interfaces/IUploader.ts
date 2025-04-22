export interface IUploader {
  upload(filePath: string, data: Buffer): Promise<string>;
  download(filePath: string,res?:any): Promise<void | Buffer> ;
  downloadZip(filePaths: string[],res?:any): Promise<void | Buffer> ;
  getPublicUrl?(filePath: string): string;
}