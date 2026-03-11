import type { StorageEngine } from 'multer';
import type { IUploader, UploadOptions } from '../interfaces/IUploader';

export type ReqLike = Record<string, any>;

export type MulterIncomingFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size?: number;
  stream: import('stream').Readable;
  destination?: string;
  filename?: string;
  path?: string;
  buffer?: Buffer;
};

export type MulterKeyResolver = (req: ReqLike, file: MulterIncomingFile) => string | Promise<string>;

export type CreateMulterUploaderOptions = {
  /**
   * Resolve the destination key/path for the uploaded file.
   *
   * Tip: return something like `/uploads/${Date.now()}-${file.originalname}`.
   */
  key: MulterKeyResolver;

  /** Optional hook to derive uploader metadata from the incoming Multer file. */
  buildUploadOptions?: (req: ReqLike, file: MulterIncomingFile) => UploadOptions | Promise<UploadOptions>;

  /** Optional hook to run after a successful upload. */
  onUploaded?: (args: { req: ReqLike; file: MulterIncomingFile; key: string; location: string }) => void | Promise<void>;

  /**
   * Whether to keep the file buffer on `req.file.buffer`.
   * Default: true (for compatibility with Multer memory storage).
   */
  keepBuffer?: boolean;

  /**
   * Whether to prefer uploader streaming when available.
   * Default: true. Note that `keepBuffer !== false` still requires buffering.
   */
  preferStream?: boolean;
};

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * Multer StorageEngine that writes incoming files via an `IUploader`.
 *
 * Works with your `FileSystemUploader`, `S3CompatibleUploader`, `AzureBlobUploader`,
 * or any custom implementation of `IUploader`.
 */
export class FilesStorageEngine implements StorageEngine {
  constructor(private uploader: IUploader, private options: CreateMulterUploaderOptions) {}

  _handleFile(req: ReqLike, file: any, cb: (error?: any, info?: Partial<any>) => void) {
    const f = file as MulterIncomingFile;
    let settled = false;

    const done = (error?: any, info?: Partial<any>) => {
      if (settled) return;
      settled = true;
      cb(error, info);
    };

    void (async () => {
      let key: string | undefined;
      let location: string | undefined;

      try {
        key = await this.options.key(req, f);

        const customUploadOptions = (await this.options.buildUploadOptions?.(req, f)) || {};
        const uploadOptions: UploadOptions = {
          ...customUploadOptions,
          contentType: customUploadOptions.contentType || f.mimetype,
          originalName: customUploadOptions.originalName || f.originalname,
        };

        const shouldBuffer = this.options.keepBuffer !== false || !this.uploader.uploadStream || this.options.preferStream === false;

        let size = f.size;

        if (shouldBuffer) {
          const buffer = await streamToBuffer(f.stream);
          size = buffer.length;
          uploadOptions.contentLength = uploadOptions.contentLength || size;
          location = await this.uploader.upload(key, buffer, uploadOptions);

          if (this.options.keepBuffer !== false) {
            // Keep compatibility with downstream middlewares expecting `req.file.buffer`.
            (file as any).buffer = buffer;
          }
        } else {
          location = await this.uploader.uploadStream!(key, f.stream, uploadOptions);
        }

        await this.options.onUploaded?.({ req, file: f, key, location });

        done(null, {
          destination: '',
          filename: key,
          key,
          path: location,
          location,
          size,
          mimetype: f.mimetype,
          originalname: f.originalname,
          encoding: f.encoding,
          fieldname: f.fieldname,
        });
      } catch (err) {
        if (key && location) {
          await Promise.resolve(this.uploader.delete(key)).catch(() => undefined);
        }

        done(err);
      }
    })();
  }

  // Multer calls this on error or when cleanup is needed.
  _removeFile(_req: ReqLike, file: any, cb: (error: Error | null) => void) {
    const key = ((file as any).key || (file as any).filename) as string | undefined;

    const clearFileState = () => {
      delete (file as any).buffer;
      delete (file as any).path;
      delete (file as any).location;
      delete (file as any).key;
    };

    if (key) {
      Promise.resolve(this.uploader.delete(key))
        .catch(() => undefined)
        .finally(() => {
          clearFileState();
          cb(null);
        });
      return;
    }

    clearFileState();
    cb(null);
  }
}

/** Convenience factory for `new FilesStorageEngine(uploader, options)` */
export function createMulterUploader(uploader: IUploader, options: CreateMulterUploaderOptions): StorageEngine {
  return new FilesStorageEngine(uploader, options);
}
