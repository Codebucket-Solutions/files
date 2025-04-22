

`npm i @codebucket/files`


## S3 EXAMPLE

```
//utils/upload.js
const {Files} = require("@codebucket/files");

let fileStorage = new Files(
	{
		type: "s3",
		publicBaseUrl: process.env.BASEURL+'/files',
		bucketName: process.env.S3_BUCKET_NAME,
		endpoint: process.env.S3_ENDPOINT,
		s3Config: {
			region:process.env.S3_REGION ,
			credentials: {
				accessKeyId: process.env.S3_ACCESS_KEY_ID,
				secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
			},
		}
	}
)

//upload file example
const upload = async (files, body, key = "document") => {
	try {

		let fileName = new Date()
			.toISOString()
			.replace(/:/g, "-")
			.replace(/[^a-z0-9]/gi, "_")
			.toLowerCase() + path.extname(files[key].originalFilename);

		await fileStorage.upload(`/${body.userId}/${fileName}`,fs.readFileSync((files[key].filepath)));

		const url = fileStorage.getPublicUrl(`/${body.userId}/${fileName}`);

		return {
			message: SUCCESS,
			url: url,
			name: fileName,
		};
	} catch (error) {
		throw new ErrorHandler(SERVER_ERROR, error);
	}
};

//download file example
const download = async (req,res) => {
	let fullPath = req.path;
	fullPath = fullPath.replace("/files","");
	await fileStorage.download(fullPath,res);
}

//download zip
const downloadZip = async (res) => {
    let filePaths = ['/folder/file1.txt','/folder/file2.txt'];
    await fileStorage.downloadZip(filePaths,res);
}

```
### Route 
```
//Download Route
//app.js
app.get("/files/*",async (req, res)=>{
  await download(req, res);
});
```

## FILESYSTEM EXAMPLE

```
//utils/upload.js
const {Files} = require("@codebucket/files");

let fileStorage = new Files(
	{
		type: "filesystem",
		publicBaseUrl: process.env.BASEURL,
		baseDir: "./public"
	}
)

//upload file example
const upload = async (files, body, key = "document") => {
	try {

		let fileName = new Date()
			.toISOString()
			.replace(/:/g, "-")
			.replace(/[^a-z0-9]/gi, "_")
			.toLowerCase() + path.extname(files[key].originalFilename);

		await fileStorage.upload(`/${body.userId}/${fileName}`,fs.readFileSync((files[key].filepath)));

		const url = fileStorage.getPublicUrl(`/${body.userId}/${fileName}`);

		return {
			message: SUCCESS,
			url: url,
			name: fileName,
		};
	} catch (error) {
		throw new ErrorHandler(SERVER_ERROR, error);
	}
};

//download file example
const download = async (req,res) => {
	let fullPath = req.path;
	fullPath = fullPath.replace("/files","");
	await fileStorage.download(fullPath,res);
}

//download zip
const downloadZip = async (res) => {
    let filePaths = ['/folder/file1.txt','/folder/file2.txt'];
    await fileStorage.downloadZip(filePaths,res);
}