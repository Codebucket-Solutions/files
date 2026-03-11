// src/uploaders/S3CompatibleUploader.ts
import {S3Client, PutObjectCommand, GetObjectCommand, S3ClientConfig, DeleteObjectCommand} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import archiver from 'archiver';
import { IUploader, UploadOptions } from '../interfaces/IUploader';
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

  private normalizeKey(filePath: string): string {
      if(this.baseDir)
          filePath = `${this.baseDir}${filePath}`

      if (filePath.startsWith('/')) {
          filePath = filePath.slice(1);
      }

      return filePath;
  }

  private buildLocation(filePath: string): string {
      if(this.publicBaseUrl) {
          return `${this.publicBaseUrl}${filePath}`;
      }

      return `${this.endpoint}/${this.bucketName}${filePath}`;
  }

  async upload(filePath: string, data: Buffer, options?: UploadOptions): Promise<string> {
      filePath = this.normalizeKey(filePath);

      let contentType = options?.contentType || mime.getType(filePath);

        await this.s3Client.send(new PutObjectCommand({
            Bucket: this.bucketName,
            Key: filePath,
            Body: data,
            ContentType: contentType || "application/octet-stream",
            ContentLength: options?.contentLength,
            Metadata: options?.metadata
        }));

      return this.buildLocation(filePath);
  }

  async uploadStream(filePath: string, stream: Readable, options?: UploadOptions): Promise<string> {
      filePath = this.normalizeKey(filePath);

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: filePath,
          Body: stream,
          ContentType: options?.contentType || mime.getType(filePath) || "application/octet-stream",
          ContentLength: options?.contentLength,
          Metadata: options?.metadata,
        },
      });

      await upload.done();
      return this.buildLocation(filePath);
  }

  async download(filePath: string,res?:any): Promise<Buffer|void> {
      filePath = this.normalizeKey(filePath);

      filePath = decodeURIComponent(filePath);


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
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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

        if (path.startsWith('/')) {
            path = path.slice(1);
        }

        path = decodeURIComponent(path);

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
      if (this.publicBaseUrl) {
          return `${this.publicBaseUrl}${filePath}`;
      }

      return this.buildLocation(this.normalizeKey(filePath));
  }

  async delete(filePath: string): Promise<void> {
    filePath = this.normalizeKey(filePath);

    filePath = decodeURIComponent(filePath);

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      }),
    );
  }
}
