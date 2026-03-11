# Changelog

This changelog compares the current workspace against the last npm-published package:

- Package: [`@codebucket/files`](https://www.npmjs.com/package/@codebucket/files?activeTab=code)
- Published version compared: `1.0.32`
- Published tarball: `https://registry.npmjs.org/@codebucket/files/-/files-1.0.32.tgz`

## Unreleased

### Added

- `AzureBlobUploader` support for Azure Blob Storage.
- `createMulterUploader(...)` and `FilesStorageEngine` for direct Multer integration.
- `delete(filePath)` across uploader implementations and the `Files` facade.
- `UploadOptions` for passing upload metadata such as `contentType`, `contentLength`, and `metadata`.
- Optional `uploadStream(...)` support for stream-first uploads.
- Expanded README examples for S3, filesystem, Azure, Multer, and NestJS.

### Changed

- `IUploader.upload(...)` now accepts an optional third argument: `options?: UploadOptions`.
- `Files.upload(...)` forwards optional upload metadata to the configured uploader.
- `FileSystemUploader` and `S3CompatibleUploader` now support stream uploads through `uploadStream(...)`.
- `S3CompatibleUploader` now supports object deletion and upload metadata.
- Multer uploads can now preserve legacy buffer behavior or switch to streaming mode with `keepBuffer: false`.
- Multer upload results now include richer file metadata such as `key` and `location`.

### Documentation

- The README was rewritten from a small set of examples into a usage guide covering:
  - facade usage
  - standalone uploaders
  - Azure setup
  - Multer `single`, `array`, and `fields` usage
  - metadata and validation examples
  - NestJS integration

### Dependency changes

- Added runtime dependency: `multer`
- Added dev dependency: `@types/multer`
- Added optional peer dependency: `@azure/storage-blob`

## Upgrade notes

### Existing code keeps working

Code written like this still works:

```js
await fileStorage.upload('/user-1/report.pdf', buffer);
```

The new upload metadata argument is optional.

### New upload metadata support

You can now pass content type and custom metadata:

```js
await fileStorage.upload('/user-1/report.pdf', buffer, {
  contentType: 'application/pdf',
  metadata: {
    tenantId: 'acme',
    category: 'reports',
  },
});
```

### New delete support

Before this change, the published package did not expose delete behavior consistently across the facade and uploaders. The current workspace does:

```js
await fileStorage.delete('/user-1/old-report.pdf');
```

### New Azure Blob uploader

```js
const { AzureBlobUploader } = require('@codebucket/files');

const uploader = new AzureBlobUploader(
  process.env.AZURE_CONTAINER_NAME,
  process.env.AZURE_STORAGE_CONNECTION_STRING,
  {
    baseDir: '/uploads',
    publicBaseUrl: process.env.AZURE_PUBLIC_BASE_URL,
  },
);

const location = await uploader.upload('/user-1/avatar.png', Buffer.from('...'), {
  contentType: 'image/png',
});
```

### New Multer integration

The published npm package does not include the Multer storage engine source currently present in this workspace. The current workspace supports direct integration:

```js
const multer = require('multer');
const { S3CompatibleUploader, createMulterUploader } = require('@codebucket/files');

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

const upload = multer({
  storage: createMulterUploader(uploader, {
    key: (req, file) => `/uploads/${Date.now()}-${file.originalname}`,
  }),
});
```

### Stream uploads for large files

If you want to avoid buffering files in memory, disable buffer retention:

```js
const upload = multer({
  storage: createMulterUploader(uploader, {
    key: (req, file) => `/uploads/${Date.now()}-${file.originalname}`,
    keepBuffer: false,
  }),
});
```

When the uploader supports `uploadStream(...)`, this uses a stream-first path.

## Published vs current summary

Compared with the npm-published `1.0.32` tarball, the current workspace differs in these source areas:

- [src/index.ts](/Users/abhinavgautam/WebstormProjects/files/src/index.ts)
- [src/interfaces/IUploader.ts](/Users/abhinavgautam/WebstormProjects/files/src/interfaces/IUploader.ts)
- [src/uploaders/FileSystemUploader.ts](/Users/abhinavgautam/WebstormProjects/files/src/uploaders/FileSystemUploader.ts)
- [src/uploaders/S3CompatibleUploader.ts](/Users/abhinavgautam/WebstormProjects/files/src/uploaders/S3CompatibleUploader.ts)
- [src/uploaders/AzureBlobUploader.ts](/Users/abhinavgautam/WebstormProjects/files/src/uploaders/AzureBlobUploader.ts)
- [src/multer/createMulterUploader.ts](/Users/abhinavgautam/WebstormProjects/files/src/multer/createMulterUploader.ts)
- [README.md](/Users/abhinavgautam/WebstormProjects/files/README.md)
- [package.json](/Users/abhinavgautam/WebstormProjects/files/package.json)
