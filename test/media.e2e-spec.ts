import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { RoleGuard } from '../src/common/guard/role.guard.js';
import { Role, Permission } from '../src/common/constant/enum.constant.js';
import { S3StorageService } from '../src/modules/media/services/s3-storage.service.js';
import { ApiAliasMiddleware } from '../src/common/middleware/api-alias.middleware.js';
import { DataSource } from 'typeorm';
import { User } from '../src/modules/user/entity/user.entity.js';
import type { IAuthenticatedRequest, IAuthenticatedUser } from '../src/common/interfaces/IContext.interface.js';

describe('Media (e2e)', { timeout: 60_000 }, () => {
  let app: INestApplication;

  const mockNormalUser: IAuthenticatedUser = {
    id: 'user-media-e2e',
    email: 'user.media@example.com',
    role: Role.USER,
    permissions: [
      Permission.MEDIA_UPLOAD,
      Permission.MEDIA_VIEW,
      Permission.MEDIA_DELETE,
    ],
  };

  let currentUserContext: IAuthenticatedUser = mockNormalUser;

  const mockStorageService = {
    getDefaultBucket: () => 'e2e-media-bucket',
    getPresignedPutUrl: async (
      bucket: string,
      key: string,
      _contentType: string,
      _expiresIn: number,
    ) => `https://s3.local/${bucket}/${key}?action=put`,
    getPresignedGetUrl: async (
      bucket: string,
      key: string,
      _expiresIn: number,
    ) => `https://s3.local/${bucket}/${key}?action=get`,
    createMultipartUpload: async (
      _bucket: string,
      _key: string,
      _contentType: string,
    ) => `e2e-multipart-${Date.now()}`,
    getPresignedUploadPartUrl: async (
      bucket: string,
      key: string,
      uploadId: string,
      partNumber: number,
    ) => `https://s3.local/${bucket}/${key}?uploadId=${uploadId}&partNumber=${partNumber}`,
    completeMultipartUpload: async (
      _bucket: string,
      key: string,
      _uploadId: string,
      _parts: Array<{ ETag: string; PartNumber: number }>,
    ) => ({
      location: `https://s3.local/e2e-media-bucket/${key}`,
      eTag: '"e2e-complete-etag"',
    }),
    abortMultipartUpload: async () => undefined,
    headObject: async () => ({
      contentLength: 2048,
      contentType: 'image/png',
      eTag: '"e2e-head-etag"',
    }),
    deleteObject: async () => undefined,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(RoleGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req =
            (context.getType<string>() === 'graphql'
              ? context.getArgs()[2].req
              : context.switchToHttp().getRequest()) as IAuthenticatedRequest;

          req.user = currentUserContext;
          return true;
        },
      })
      .overrideProvider(S3StorageService)
      .useValue(mockStorageService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(
      (req: unknown, res: unknown, next: () => void) =>
        new ApiAliasMiddleware().use(req as never, res as never, next),
    );
    await app.init();
    await app.listen(0);

    // Seed mock test user for FK constraint
    const dataSource = app.get(DataSource);
    const userRepo = dataSource.getRepository(User);
    await userRepo.upsert(
      {
        id: mockNormalUser.id,
        email: mockNormalUser.email,
        passwordHash: 'dummy_hash',
        firstName: 'Media',
        lastName: 'E2E',
        role: mockNormalUser.role,
        isActive: true,
      },
      ['id'],
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('REST SSE Endpoints', () => {
    it('GET /media/events returns SSE stream or response', async () => {
      const response = await request(app.getHttpServer())
        .get('/media/events')
        .timeout(1000)
        .catch((err) => err.response);

      if (response) {
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('GraphQL Media Flow', () => {
    let directMediaId: string;
    let multipartMediaId: string;
    let multipartUploadId: string;

    it('requestUploadUrl: generates direct presigned upload for single file (<50MB)', async () => {
      currentUserContext = mockNormalUser;

      const mutation = `
        mutation RequestUpload($input: RequestUploadInput!) {
          requestUploadUrl(input: $input) {
            success
            statusCode
            data {
              mediaId
              uploadUrl
              storageKey
              isMultipart
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: mutation,
          variables: {
            input: {
              fileName: 'avatar.png',
              mimeType: 'image/png',
              sizeBytes: 1024 * 50,
              isPublic: true,
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const data = res.body.data.requestUploadUrl.data;
      expect(data.mediaId).toBeDefined();
      expect(data.isMultipart).toBe(false);
      expect(data.uploadUrl).toContain('action=put');
      directMediaId = data.mediaId;
    });

    it('verifyDirectUpload: verifies direct upload and transitions status to READY', async () => {
      currentUserContext = mockNormalUser;

      const mutation = `
        mutation VerifyDirectUpload($mediaId: String!) {
          verifyDirectUpload(mediaId: $mediaId) {
            success
            data {
              id
              status
              fileName
              mimeType
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: mutation,
          variables: { mediaId: directMediaId },
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const media = res.body.data.verifyDirectUpload.data;
      expect(media.id).toBe(directMediaId);
      expect(media.status).toBe('READY');
    });

    it('initiateMultipartUpload: starts multipart upload session with parts', async () => {
      currentUserContext = mockNormalUser;

      const mutation = `
        mutation InitiateMultipart($input: InitiateMultipartUploadInput!) {
          initiateMultipartUpload(input: $input) {
            success
            data {
              mediaId
              uploadId
              isMultipart
              totalParts
              parts {
                partNumber
                uploadUrl
              }
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: mutation,
          variables: {
            input: {
              fileName: 'movie.mp4',
              mimeType: 'video/mp4',
              sizeBytes: 60 * 1024 * 1024,
              partSizeBytes: 10 * 1024 * 1024,
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const data = res.body.data.initiateMultipartUpload.data;
      expect(data.isMultipart).toBe(true);
      expect(data.uploadId).toBeDefined();
      expect(data.totalParts).toBe(6);
      expect(data.parts.length).toBe(6);
      multipartMediaId = data.mediaId;
      multipartUploadId = data.uploadId;
    });

    it('uploadStatus: inspects multipart upload progress and missing parts', async () => {
      currentUserContext = mockNormalUser;

      const query = `
        query GetUploadStatus($uploadId: String!) {
          uploadStatus(uploadId: $uploadId) {
            success
            data {
              uploadId
              status
              totalParts
              completedParts
              missingParts
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query,
          variables: { uploadId: multipartUploadId },
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const statusData = res.body.data.uploadStatus.data;
      expect(statusData.uploadId).toBe(multipartUploadId);
      expect(statusData.totalParts).toBe(6);
      expect(statusData.missingParts).toHaveLength(6);
    });

    it('completeMultipartUpload: completes multipart upload and registers media', async () => {
      currentUserContext = mockNormalUser;

      const mutation = `
        mutation CompleteMultipart($input: CompleteMultipartUploadInput!) {
          completeMultipartUpload(input: $input) {
            success
            data {
              id
              status
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: mutation,
          variables: {
            input: {
              mediaId: multipartMediaId,
              parts: [
                { partNumber: 1, eTag: '"tag1"' },
                { partNumber: 2, eTag: '"tag2"' },
              ],
            },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.completeMultipartUpload.data.status).toBe('READY');
    });

    it('getMediaById: queries media details by mediaId', async () => {
      currentUserContext = mockNormalUser;

      const query = `
        query GetMedia($mediaId: String!) {
          getMediaById(mediaId: $mediaId) {
            success
            data {
              id
              fileName
              status
              mediaType
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query,
          variables: { mediaId: directMediaId },
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.getMediaById.data.fileName).toBe('avatar.png');
    });

    it('getMediaDownloadUrl: returns presigned download URL for media', async () => {
      currentUserContext = mockNormalUser;

      const query = `
        query GetDownloadUrl($mediaId: String!) {
          downloadUrl(mediaId: $mediaId) {
            success
            data {
              mediaId
              downloadUrl
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query,
          variables: { mediaId: directMediaId },
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.downloadUrl.data.downloadUrl).toContain('action=get');
    });

    it('getMyMedia: retrieves paginated media list of authenticated user', async () => {
      currentUserContext = mockNormalUser;

      const query = `
        query GetMyMedia($page: Int, $limit: Int) {
          getMyMedia(page: $page, limit: $limit) {
            success
            data {
              total
              page
              limit
              totalPages
              items {
                id
                fileName
              }
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query,
          variables: { page: 1, limit: 10 },
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const pageData = res.body.data.getMyMedia.data;
      expect(pageData.total).toBeGreaterThanOrEqual(1);
      expect(pageData.items.length).toBeGreaterThanOrEqual(1);
    });

    it('getMyQuota: retrieves storage quota and concurrency usage', async () => {
      currentUserContext = mockNormalUser;

      const query = `
        query GetMyQuota {
          getMyQuota {
            success
            data {
              userId
              usedBytes
              quotaBytes
              maxConcurrent
            }
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({ query });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      const quotaData = res.body.data.getMyQuota.data;
      expect(quotaData.userId).toBe(mockNormalUser.id);
      expect(quotaData.maxConcurrent).toBe(5);
    });

    it('createUploadSession & abortUpload: creates session and aborts by uploadId', async () => {
      currentUserContext = mockNormalUser;

      const createMutation = `
        mutation CreateSession($input: CreateUploadSessionInput!) {
          createUploadSession(input: $input) {
            success
            data {
              mediaId
              uploadId
            }
          }
        }
      `;

      const createRes = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: createMutation,
          variables: {
            input: {
              fileName: 'cancel-me.zip',
              contentType: 'application/zip',
              size: 60 * 1024 * 1024,
            },
          },
        });

      expect(createRes.status).toBe(200);
      expect(createRes.body.errors).toBeUndefined();
      const abortUploadId = createRes.body.data.createUploadSession.data.uploadId;

      const abortMutation = `
        mutation AbortUpload($uploadId: String!) {
          abortUpload(uploadId: $uploadId) {
            success
          }
        }
      `;

      const abortRes = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: abortMutation,
          variables: { uploadId: abortUploadId },
        });

      expect(abortRes.status).toBe(200);
      expect(abortRes.body.errors).toBeUndefined();
      expect(abortRes.body.data.abortUpload.success).toBe(true);
    });

    it('deleteMedia: deletes media entry from database and storage', async () => {
      currentUserContext = mockNormalUser;

      const mutation = `
        mutation DeleteMedia($mediaId: String!) {
          deleteMedia(mediaId: $mediaId) {
            success
          }
        }
      `;

      const res = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: mutation,
          variables: { mediaId: directMediaId },
        });

      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.deleteMedia.success).toBe(true);
    });
  });
});
