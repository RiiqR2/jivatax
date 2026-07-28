import { registerAs } from "@nestjs/config";

export const storageConfig = registerAs("storage", () => ({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  bucket: process.env.S3_BUCKET ?? "jivatax",
  accessKey: process.env.S3_ACCESS_KEY,
  secretKey: process.env.S3_SECRET_KEY,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  signedUrlExpiresIn: Number(process.env.S3_SIGNED_URL_EXPIRES_IN ?? 900),
  maxFileSizeBytes: process.env.FILE_MAX_SIZE_BYTES ?? "52428800",
}));
