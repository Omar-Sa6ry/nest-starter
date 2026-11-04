import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { IStorageProvider } from '../interfaces/IStorageProvider.interface.js';
import { MEDIA_CONSTANTS } from '../constants/media.constants.js';

@Injectable()
export class S3StorageService implements IStorageProvider {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly presignClient: S3Client;
  private readonly defaultBucket: string;
  private readonly publicEndpoint?: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    this.publicEndpoint = this.configService.get<string>('S3_PUBLIC_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    const accessKeyId =
      this.configService.get<string>('S3_ACCESS_KEY') || 'minioadmin';
    const secretAccessKey =
      this.configService.get<string>('S3_SECRET_KEY') || 'minioadmin';
    const forcePathStyle =
      this.configService.get<string>('S3_FORCE_PATH_STYLE') === 'true';

    this.defaultBucket =
      this.configService.get<string>('S3_BUCKET_NAME') || 'nest-starter-media';

    // Internal client for server-to-storage operations (uses S3_ENDPOINT, e.g. 127.0.0.1 or docker network)
    this.s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    });

    // Dedicated client for presigned URLs using publicEndpoint so SigV4 Host header matches browser requests
    this.presignClient = new S3Client({
      region,
      endpoint: this.publicEndpoint || endpoint || undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }



  getDefaultBucket(): string {
    return this.defaultBucket;
  }

  async getPresignedPutUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number = MEDIA_CONSTANTS.DEFAULT_PRESIGNED_EXPIRES_SECONDS,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.presignClient, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async getPresignedGetUrl(
    bucket: string,
    key: string,
    expiresInSeconds: number = MEDIA_CONSTANTS.DEFAULT_PRESIGNED_EXPIRES_SECONDS,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return getSignedUrl(this.presignClient, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async createMultipartUpload(
    bucket: string,
    key: string,
    contentType: string,
  ): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    const response = await this.s3Client.send(command);
    if (!response.UploadId) {
      throw new Error('Failed to create S3 multipart upload: missing UploadId');
    }
    return response.UploadId;
  }

  async getPresignedUploadPartUrl(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds: number = MEDIA_CONSTANTS.DEFAULT_PRESIGNED_EXPIRES_SECONDS,
  ): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    return getSignedUrl(this.presignClient, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
  ): Promise<{ location?: string; eTag?: string }> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    });
    const result = await this.s3Client.send(command);
    return {
      location: result.Location,
      eTag: result.ETag,
    };
  }

  async abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
  ): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    });
    await this.s3Client.send(command);
  }

  async headObject(
    bucket: string,
    key: string,
  ): Promise<{
    contentLength?: number;
    contentType?: string;
    eTag?: string;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const response = await this.s3Client.send(command);
      return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        eTag: response.ETag,
      };
    } catch (error: unknown) {
      this.logger.debug(
        `HeadObject check failed for s3://${bucket}/${key}: ${String(error)}`,
      );
      return null;
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await this.s3Client.send(command);
  }
}
