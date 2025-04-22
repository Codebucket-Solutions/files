import fs from 'fs-extra';
import archiver from 'archiver';
import { IUploader } from '../interfaces/IUploader';

export class FileSystemUploader implements IUploader {
  constructor(private baseDir: string, private publicBaseUrl?: string) {
    fs.ensureDirSync(this.baseDir);
  }

  async upload(filePath: string, data: Buffer): Promise<string> {
    const fullPath = `${this.baseDir}${filePath}`;
    await fs.outputFile(fullPath, data);
    return fullPath;
  }

  async download(filePath: string): Promise<Buffer> {
    const fullPath = `${this.baseDir}${filePath}`;
    return fs.readFile(fullPath);
  }

  async downloadZip(filePaths: string[]): Promise<Buffer> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', chunk => chunks.push(chunk));

    filePaths.forEach(path => {
      archive.file(`${this.baseDir}${path}`, { name: path });
    });

    await archive.finalize();

    return Buffer.concat(chunks);
  }

  getPublicUrl(filePath: string): string {
    if (!this.publicBaseUrl) throw new Error('Public base URL is not configured');


    return `${this.publicBaseUrl}${filePath}`;
  }
}