export interface IStorageProvider {
  getPresignedPutUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds?: number,
  ): Promise<string>;

  getPresignedGetUrl(
    bucket: string,
    key: string,
    expiresInSeconds?: number,
  ): Promise<string>;

  createMultipartUpload(
    bucket: string,
    key: string,
    contentType: string,
  ): Promise<string>;

  getPresignedUploadPartUrl(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    expiresInSeconds?: number,
  ): Promise<string>;

  completeMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>,
  ): Promise<{ location?: string; eTag?: string }>;

  abortMultipartUpload(
    bucket: string,
    key: string,
    uploadId: string,
  ): Promise<void>;

  headObject(
    bucket: string,
    key: string,
  ): Promise<{ contentLength?: number; contentType?: string; eTag?: string } | null>;

  deleteObject(bucket: string, key: string): Promise<void>;
}

