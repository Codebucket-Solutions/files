`npm i @codebucket/files`

> Optional integrations:
> - Azure Blob uploader requires a peer dependency:
>   - `npm i @azure/storage-blob`

---

## Quick start

This package provides:

- A simple `Files` facade (filesystem or S3-compatible)
- Standalone uploaders (`FileSystemUploader`, `S3CompatibleUploader`, `AzureBlobUploader`)
- A Multer storage engine helper (`createMulterUploader`) for plug-and-play uploads

---

## S3 / S3-compatible example

```js
// utils/storage.js
const { Files } = require('@codebucket/files');

const fileStorage = new Files({
  type: 's3',
  publicBaseUrl: process.env.BASEURL + '/files/',
  bucketName: process.env.S3_BUCKET_NAME,
  endpoint: process.env.S3_ENDPOINT,
  s3Config: {
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  },
});

module.exports = { fileStorage };
```

### Upload

```js
const fs = require('fs');
const path = require('path');
const { fileStorage } = require('./storage');

async function upload(files, body, key = 'document') {
  const fileName =
    new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase() + path.extname(files[key].originalFilename);

  await fileStorage.upload(`/${body.userId}/${fileName}`, fs.readFileSync(files[key].filepath));

  return {
    name: fileName,
    url: fileStorage.getPublicUrl(`/${body.userId}/${fileName}`),
  };
}
```

### Download (stream to response)

```js
async function download(req, res) {
  let fullPath = req.path;
  fullPath = fullPath.replace('/files', '');
  await fileStorage.download(fullPath, res);
}

// Express route
app.get('/files/*', async (req, res) => {
  await download(req, res);
});
```

### Download ZIP

```js
async function downloadZip(res) {
  const filePaths = ['/folder/file1.txt', '/folder/file2.txt'];
  await fileStorage.downloadZip(filePaths, res);
}
```

---

## Filesystem example

```js
// utils/storage.js
const { Files } = require('@codebucket/files');

const fileStorage = new Files({
  type: 'filesystem',
  publicBaseUrl: process.env.BASEURL + '/',
  baseDir: './public',
});

module.exports = { fileStorage };
```

Upload/download usage is the same as the S3 example above.

---

## Using standalone uploaders

You can instantiate uploaders directly (useful when you don’t want the `Files` facade).

### FileSystemUploader

```js
const { FileSystemUploader } = require('@codebucket/files');

const uploader = new FileSystemUploader('./public', process.env.BASEURL + '/');

const location = await uploader.upload('/avatars/a.png', Buffer.from('...'), {
  contentType: 'image/png',
  metadata: { scope: 'avatars' },
});
const publicUrl = uploader.getPublicUrl('/avatars/a.png');
```

### S3CompatibleUploader

```js
const { S3CompatibleUploader } = require('@codebucket/files');

const uploader = new S3CompatibleUploader(
  process.env.S3_BUCKET_NAME,
  process.env.S3_ENDPOINT,
  '/base-prefix', // optional baseDir
  process.env.BASEURL + '/files/', // optional publicBaseUrl
  {
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  },
);

const location = await uploader.upload('/docs/readme.txt', Buffer.from('hello'), {
  contentType: 'text/plain',
});
```

### AzureBlobUploader (Azure Blob Storage)

Azure is shipped as an **optional peer dependency**.

Install:

```bash
npm i @codebucket/files @azure/storage-blob
```

Use:

```js
const { AzureBlobUploader } = require('@codebucket/files');

const uploader = new AzureBlobUploader(
  process.env.AZURE_CONTAINER_NAME,
  process.env.AZURE_STORAGE_CONNECTION_STRING,
  {
    baseDir: '/uploads', // optional
    publicBaseUrl: process.env.AZURE_PUBLIC_BASE_URL, // optional
  },
);

const location = await uploader.upload('/user-1/a.png', Buffer.from('...'), {
  contentType: 'image/png',
});
const url = uploader.getPublicUrl('/user-1/a.png');
```

---

## Multer integration (Express / Nest / any Multer-based stack)

This library exposes a Multer storage engine so you can write incoming files using any `IUploader`.

### What the storage engine supports

- Direct use with `multer({ storage: createMulterUploader(...) })`
- Buffer uploads for backwards compatibility
- Streamed uploads for uploaders that implement `uploadStream(...)`
- Upload metadata (`contentType`, `contentLength`, custom `metadata`)
- Cleanup via `uploader.delete(key)` if Multer aborts or post-upload hooks fail
- Richer `req.file` info:
  - `req.file.key`
  - `req.file.location`
  - `req.file.mimetype`
  - `req.file.originalname`

### Example: Multer + S3CompatibleUploader

```js
const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  S3CompatibleUploader,
  createMulterUploader,
} = require('@codebucket/files');

const app = express();

const uploader = new S3CompatibleUploader(
  process.env.S3_BUCKET_NAME,
  process.env.S3_ENDPOINT,
  undefined,
  process.env.BASEURL + '/files/',
  {
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  },
);

function sanitizeFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename, ext).replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-');
  return `${base || 'file'}${ext}`;
}

const upload = multer({
  storage: createMulterUploader(uploader, {
    key: (req, file) => `/uploads/${req.user.id}/${Date.now()}-${sanitizeFilename(file.originalname)}`,
    keepBuffer: false, // enables true streaming when the uploader supports uploadStream(...)
    buildUploadOptions: (req, file) => ({
      contentType: file.mimetype,
      metadata: {
        uploadedBy: String(req.user.id),
        field: file.fieldname,
      },
    }),
    onUploaded: async ({ key, location }) => {
      // optional hook: persist DB row, emit event, etc.
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: (req, file, cb) => {
    if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.mimetype)) {
      return cb(new Error('Unsupported file type'));
    }
    cb(null, true);
  },
});

app.post('/upload', upload.single('file'), (req, res) => {
  // Multer sets req.file.path and req.file.location to the returned uploader location
  res.json({
    key: req.file.key,
    location: req.file.location,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
  });
});
```

### Example: keep compatibility with `req.file.buffer`

If your downstream code expects `req.file.buffer`, keep the default `keepBuffer: true`:

```js
const upload = multer({
  storage: createMulterUploader(uploader, {
    key: (req, file) => `/uploads/${Date.now()}-${file.originalname}`,
  }),
});
```

That preserves the old behavior and still uploads through your configured uploader.

### Example: multiple files

```js
app.post('/photos', upload.array('photos', 5), (req, res) => {
  res.json(
    req.files.map((file) => ({
      key: file.key,
      location: file.location,
      size: file.size,
    })),
  );
});
```

### Example: mixed fields

```js
const mixedUpload = multer({
  storage: createMulterUploader(uploader, {
    key: (req, file) => `/${file.fieldname}/${Date.now()}-${sanitizeFilename(file.originalname)}`,
    keepBuffer: false,
  }),
});

app.post(
  '/profile',
  mixedUpload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
  ]),
  (req, res) => {
    res.json({
      avatar: req.files.avatar?.[0]?.location,
      resume: req.files.resume?.[0]?.location,
    });
  },
);
```

### Example: custom storage metadata

```js
const upload = multer({
  storage: createMulterUploader(uploader, {
    key: (req, file) => `/documents/${Date.now()}-${sanitizeFilename(file.originalname)}`,
    keepBuffer: false,
    buildUploadOptions: async (req, file) => ({
      contentType: file.mimetype,
      metadata: {
        tenantId: String(req.tenant.id),
        category: req.body.category || 'general',
      },
    }),
  }),
});
```

### Using the storage engine in NestJS

```ts
import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { S3CompatibleUploader, createMulterUploader } from '@codebucket/files';

const uploader = new S3CompatibleUploader(
  process.env.S3_BUCKET_NAME!,
  process.env.S3_ENDPOINT!,
  undefined,
  process.env.BASEURL + '/files/',
  {
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  },
);

const storage = createMulterUploader(uploader, {
  key: (req, file) => `/uploads/${Date.now()}-${file.originalname}`,
  keepBuffer: false,
});

@Controller('files')
export class FilesController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage }))
  upload(@UploadedFile() file: Express.Multer.File) {
    return {
      key: (file as any).key,
      location: (file as any).location,
      size: file.size,
    };
  }
}
```

### Multer cleanup behavior

If Multer aborts an upload and calls `_removeFile`, the storage engine will best-effort call `uploader.delete(key)` (where `key` is the same value returned by your `key()` resolver).

---

## Delete semantics

All uploaders implement:

- `delete(filePath: string): Promise<void>`

Example:

```js
await fileStorage.delete('/user-1/old-file.png');
```
