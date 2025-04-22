// src/uploaders/S3CompatibleUploader.ts
import {S3Client, PutObjectCommand, GetObjectCommand, S3ClientConfig} from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { IUploader } from '../interfaces/IUploader';
import {Readable} from 'stream';
import { isAwsEndpoint } from '../utils/isAwsEndpoint';
import mime from 'mime';

export class S3CompatibleUploader implements IUploader {
  private s3Client: S3Client;

  constructor(private bucketName: string, private endpoint: string, private baseDir?:string, private publicBaseUrl?: string ,config?: any) {

      let options:S3ClientConfig = {
          endpoint: this.endpoint,
          region: config?.region || 'us-east-1',
          credentials: config?.credentials,
          forcePathStyle: true,
      }

      if(!isAwsEndpoint(this.endpoint)) {
          options = {...options,requestChecksumCalculation: "WHEN_REQUIRED",responseChecksumValidation: "WHEN_REQUIRED",}
      }

      this.s3Client = new S3Client(options);

  }

  async upload(filePath: string, data: Buffer): Promise<string> {
      if(this.baseDir)
          filePath = `${this.baseDir}${filePath}`

      let contentType = mime.getType(filePath);

        await this.s3Client.send(new PutObjectCommand({
            Bucket: this.bucketName,
            Key: filePath,
            Body: data,
            ContentType: contentType || "application/octet-stream"
        }));

      if(this.publicBaseUrl) {
          return `${this.publicBaseUrl}${filePath}`;
      }

      return `${this.endpoint}/${this.bucketName}${filePath}`;
  }

  async download(filePath: string,res?:any): Promise<Buffer|void> {

      if(this.baseDir)
          filePath = `${this.baseDir}${filePath}`

    const result = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    }));

    const stream = result.Body as Readable;

    if(res) {
        let contentType = result.ContentType || "application/octet-stream";
        if(contentType==="application/octet-stream") {
            contentType = mime.getType(filePath) || "application/octet-stream";
        }
        if (typeof result.ContentLength === "number") {
            res.setHeader("Content-Length", result.ContentLength.toString());
        }
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", "inline");
        stream.pipe(res);
    } else {
        return new Promise<Buffer>((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
    }
  }

  async downloadZip(filePaths: string[],res?:any): Promise<Buffer|void> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    if(!res)
        archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    await Promise.all(filePaths.map(async path => {
        if(this.baseDir)
            path = `${this.baseDir}/${path}`;

      const file = await this.download(path);
      archive.append(file as Buffer, { name: path });
    }));

      if(res)
          archive.pipe(res);

    await archive.finalize();

      if(!res)
          return Buffer.concat(chunks);
  }

  getPublicUrl(filePath: string): string {
      if(this.publicBaseUrl)
          return `${this.publicBaseUrl}${filePath}`;

      if(this.baseDir)
          filePath = `${this.baseDir}${filePath}`
    return `${this.endpoint}/${this.bucketName}${filePath}`;
  }
}
