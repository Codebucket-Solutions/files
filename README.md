```
import { Files } from '@codebucket/uploads';
import { readFileSync, writeFileSync } from 'fs';

async function s3Example() {
  const files = new Files({
    type: 's3',
    bucketName: 'my-bucket',
    endpoint: 'https://s3-compatible-service.com',
    s3Config: {
      credentials: {
        accessKeyId: 'YOUR_ACCESS_KEY',
        secretAccessKey: 'YOUR_SECRET_KEY',
      },
      region: 'us-east-1',
    },
  });

  const fileData = readFileSync('./example.txt');

  // Upload file
  const uploadedPath = await files.upload('folder/example.txt', fileData);
  console.log('Uploaded to:', uploadedPath);

  // Download file
  const downloadedData = await files.download('folder/example.txt');
  writeFileSync('./downloaded_example.txt', downloadedData);
  console.log('File downloaded to ./downloaded_example.txt');

  // Download multiple files as ZIP
  const zipBuffer = await files.downloadZip(['folder/example.txt', 'folder/another-file.txt']);
  writeFileSync('./files.zip', zipBuffer);
  console.log('ZIP downloaded to ./files.zip');

  // Get public URL
  const publicUrl = files.getPublicUrl('folder/example.txt');
  console.log('Public URL:', publicUrl);
}

s3Example();
```
