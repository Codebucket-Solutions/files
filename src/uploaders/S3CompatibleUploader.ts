// src/uploaders/S3CompatibleUploader.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import archiver from 'archiver';
import { IUploader } from '../interfaces/IUploader';
import {Readable} from 'stream';

export class S3CompatibleUploader implements IUploader {
  private s3Client: S3Client;

  constructor(private bucketName: string, private endpoint: string, config?: any) {
    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: config?.region || 'us-east-1',
      credentials: config?.credentials,
      forcePathStyle: true,
    });
  }

  async upload(filePath: string, data: Buffer): Promise<string> {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
      Body: data,
    }));

    return `${this.endpoint}/${this.bucketName}/${filePath}`;
  }

  async download(filePath: string): Promise<Buffer> {
    const result = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    }));

    const stream = result.Body as Readable;

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async downloadZip(filePaths: string[]): Promise<Buffer> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    await Promise.all(filePaths.map(async path => {
      const file = await this.download(path);
      archive.append(file, { name: path });
    }));

    await archive.finalize();

    return Buffer.concat(chunks);
  }

  getPublicUrl(filePath: string): string {
    return `${this.endpoint}/${this.bucketName}/${filePath}`;
  }
}
