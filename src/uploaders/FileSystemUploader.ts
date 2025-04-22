import fs from 'fs-extra';
import archiver from 'archiver';
import { IUploader } from '../interfaces/IUploader';
import mime from 'mime';

export class FileSystemUploader implements IUploader {
  constructor(private baseDir: string, private publicBaseUrl?: string) {
    fs.ensureDirSync(this.baseDir);
  }

  async upload(filePath: string, data: Buffer): Promise<string> {
    const fullPath = `${this.baseDir}${filePath}`;
    await fs.outputFile(fullPath, data);
    return fullPath;
  }

  async download(filePath: string,res?:any):  Promise<void | Buffer> {
    const fullPath = `${this.baseDir}${filePath}`;
    if(res) {
      const contentType = mime.getType(fullPath) || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", fs.statSync(fullPath).size);
      res.setHeader("Content-Disposition", "inline");
      fs.createReadStream(fullPath).pipe(res);
    } else
      return fs.readFile(fullPath);
  }

  async downloadZip(filePaths: string[], res?:any): Promise<void | Buffer>  {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    if(!res)
      archive.on('data', chunk => chunks.push(chunk));

    filePaths.forEach(path => {
      archive.file(`${this.baseDir}${path}`, { name: path });
    });

    if(res)
      archive.pipe(res);

    await archive.finalize();

    if(!res)
      return Buffer.concat(chunks);
  }

  getPublicUrl(filePath: string): string {
    if (!this.publicBaseUrl) throw new Error('Public base URL is not configured');


    return `${this.publicBaseUrl}${filePath}`;
  }
}