export function isAwsEndpoint(endpoint: string): boolean {
    const awsPatterns = [
        /\.amazonaws\.com$/,
        /\.amazonaws\.com\.cn$/,
        /\.s3-[a-z0-9-]+\.amazonaws\.com$/,
    ];

    return awsPatterns.some((pattern) => pattern.test(endpoint));
}
