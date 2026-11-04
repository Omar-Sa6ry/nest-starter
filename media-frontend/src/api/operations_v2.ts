import { gql } from '@apollo/client';
import { client } from './client.js';
import type {
  AuthPayload,
  CompletedPart,
  UploadSession,
  User,
} from '../upload/types.js';

const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      success
      statusCode
      message
      data {
        accessToken
        refreshToken
        user {
          id
          email
          firstName
          lastName
          role
          imageUrl
          phoneNumber
        }
      }
    }
  }
`;

const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      success
      statusCode
      message
      data {
        accessToken
        refreshToken
        user {
          id
          email
          firstName
          lastName
          role
          imageUrl
        }
      }
    }
  }
`;

const CREATE_UPLOAD_SESSION = gql`
  mutation CreateSession($input: CreateUploadSessionInput!) {
    createUploadSession(input: $input) {
      success
      statusCode
      message
      timeStamp
      data {
        mediaId
        uploadId
        uploadUrl
        partSize
        totalParts
        expiresAt
        storageKey
        isMultipart
        expiresInSeconds
        parts {
          partNumber
          uploadUrl
          presignedUrl
        }
      }
    }
  }
`;

const COMPLETE_UPLOAD = gql`
  mutation CompleteUpload($input: CompleteUploadInput!) {
    completeUpload(input: $input) {
      success
      statusCode
      message
      timeStamp
      data {
        id
        mediaId
        fileName
        storageKey
        mimeType
        sizeBytes
        status
        downloadUrl
      }
    }
  }
`;

const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      success
      statusCode
      message
      data {
        id
        email
        firstName
        lastName
        imageUrl
      }
    }
  }
`;

const MY_PROFILE = gql`
  query Me {
    myProfile {
      success
      message
      data {
        id
        email
        firstName
        lastName
        imageUrl
      }
    }
  }
`;

const ABORT_UPLOAD = gql`
  mutation AbortUpload($uploadId: String!) {
    abortUpload(uploadId: $uploadId) {
      success
      statusCode
      message
      timeStamp
    }
  }
`;

const DELETE_MEDIA = gql`
  mutation DeleteMedia($mediaId: String!) {
    deleteMedia(mediaId: $mediaId) {
      success
      statusCode
      message
      timeStamp
    }
  }
`;

const DOWNLOAD_URL = gql`
  query DownloadUrl($mediaId: String!, $versionType: String, $expirySeconds: Int) {
    downloadUrl(mediaId: $mediaId, versionType: $versionType, expirySeconds: $expirySeconds) {
      success
      statusCode
      message
      timeStamp
      data {
        mediaId
        downloadUrl
        expiresInSeconds
        expiresAt
        contentType
      }
    }
  }
`;

const UPLOAD_STATUS = gql`
  query UploadStatus($uploadId: String!) {
    uploadStatus(uploadId: $uploadId) {
      success
      statusCode
      message
      timeStamp
      data {
        uploadId
        status
        totalParts
        completedParts
        missingParts
        expiresAt
      }
    }
  }
`;

export interface RegisterArgs {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

export interface ApiErrorPayload {
  message: string;
}

function extractError(err: unknown): string {
  if (err instanceof Error) {
    const gqlErr = (err as unknown as { graphQLErrors?: Array<{ message: string; extensions?: { exception?: { response?: { message?: string | string[] } } } }> }).graphQLErrors?.[0];
    const msg = gqlErr?.message || err.message;
    if (gqlErr?.extensions?.exception?.response?.message) {
      const inner = gqlErr.extensions.exception.response.message;
      return Array.isArray(inner) ? inner.join(', ') : String(inner);
    }
    return msg;
  }
  return 'Unknown error';
}

export async function register(input: RegisterArgs): Promise<AuthPayload> {
  try {
    const res = await client.mutate<{ register: { data: AuthPayload } }>({
      mutation: REGISTER,
      variables: { input },
    });
    if (!res.data?.register?.data) throw new Error('register returned no data');
    return res.data.register.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthPayload> {
  try {
    const res = await client.mutate<{ login: { data: AuthPayload } }>({
      mutation: LOGIN,
      variables: { input },
    });
    if (!res.data?.login?.data) throw new Error('login returned no data');
    return res.data.login.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

export interface CreateSessionArgs {
  fileName: string;
  contentType: string;
  size: number;
  checksum?: string;
}

interface ServerPresignedUploadResponseData {
  mediaId: string;
  uploadId?: string | null;
  uploadUrl?: string | null;
  partSize?: number | null;
  totalParts?: number | null;
  expiresAt?: string | null;
  storageKey: string;
  isMultipart: boolean;
  parts?: Array<{ partNumber: number; uploadUrl: string; presignedUrl?: string | null }> | null;
}

export async function createUploadSession(
  input: CreateSessionArgs,
): Promise<UploadSession> {
  try {
    const res = await client.mutate<{
      createUploadSession: { data: ServerPresignedUploadResponseData };
    }>({
      mutation: CREATE_UPLOAD_SESSION,
      variables: { input },
    });

    const serverData = res.data?.createUploadSession?.data;
    if (!serverData) throw new Error('no upload session returned');

    const presignedParts = (serverData.parts || []).map((p) => ({
      partNumber: p.partNumber,
      presignedUrl: p.uploadUrl || p.presignedUrl || '',
    }));

    return {
      mediaId: serverData.mediaId,
      uploadId: serverData.uploadId || serverData.mediaId,
      s3UploadId: serverData.uploadId || serverData.mediaId,
      presignedParts,
      partSize: serverData.partSize || 5 * 1024 * 1024,
      totalParts: serverData.totalParts || 1,
      expiresAt: serverData.expiresAt ? Date.parse(serverData.expiresAt) : Date.now() + 3600000,
    };
  } catch (err) {
    throw new Error(extractError(err));
  }
}

export async function completeUpload(
  uploadId: string,
  parts: CompletedPart[],
): Promise<{ mediaId: string; status: string }> {
  try {
    const res = await client.mutate<{
      completeUpload: { data: { id: string; mediaId?: string; status: string } };
    }>({
      mutation: COMPLETE_UPLOAD,
      variables: { input: { uploadId, parts } },
    });
    if (!res.data?.completeUpload?.data) throw new Error('complete returned no data');
    const returned = res.data.completeUpload.data;
    return {
      mediaId: returned.mediaId || returned.id,
      status: returned.status,
    };
  } catch (err) {
    throw new Error(extractError(err));
  }
}

export async function updateProfileAvatar(
  avatarMediaId: string,
): Promise<User> {
  try {
    const res = await client.mutate<{
      updateProfile: { message?: string; data: User };
    }>({
      mutation: UPDATE_PROFILE,
      variables: { input: { avatarMediaId } },
    });
    if (!res.data?.updateProfile?.data) throw new Error('updateProfile returned no data');
    return res.data.updateProfile.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

export async function fetchMyProfile(): Promise<User> {
  try {
    const res = await client.query<{ myProfile: { data: User } }>({
      query: MY_PROFILE,
      fetchPolicy: 'network-only',
    });
    if (!res.data?.myProfile?.data) throw new Error('myProfile returned no data');
    return res.data.myProfile.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

export async function abortUpload(uploadId: string): Promise<boolean> {
  try {
    const res = await client.mutate<{ abortUpload: { success: boolean } }>({
      mutation: ABORT_UPLOAD,
      variables: { uploadId },
    });
    return res.data?.abortUpload?.success || false;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

export async function deleteMedia(mediaId: string): Promise<boolean> {
  try {
    const res = await client.mutate<{ deleteMedia: { success: boolean } }>({
      mutation: DELETE_MEDIA,
      variables: { mediaId },
    });
    return res.data?.deleteMedia?.success || false;
  } catch (err) {
    throw new Error(extractError(err));
  }
}

export interface DownloadUrlData {
  url: string;
  expiresAt: number;
  contentType: string;
}

export async function getDownloadUrl(mediaId: string, versionType?: string, expirySeconds?: number): Promise<DownloadUrlData> {
  try {
    const res = await client.query<{ downloadUrl: { data: { downloadUrl: string; expiresAt?: number; contentType?: string } } }>({
      query: DOWNLOAD_URL,
      variables: { mediaId, versionType, expirySeconds },
      fetchPolicy: 'network-only',
    });
    if (!res.data?.downloadUrl?.data) throw new Error('downloadUrl query returned no data');
    const data = res.data.downloadUrl.data;
    return {
      url: data.downloadUrl,
      expiresAt: data.expiresAt || 0,
      contentType: data.contentType || '',
    };
  } catch (err) {
    throw new Error(extractError(err));
  }
}

export interface BackendUploadStatus {
  uploadId: string;
  status: string;
  totalParts: number;
  completedParts: number;
  missingParts: number[];
  expiresAt: number;
}

export async function getUploadStatus(uploadId: string): Promise<BackendUploadStatus> {
  try {
    const res = await client.query<{ uploadStatus: { data: BackendUploadStatus } }>({
      query: UPLOAD_STATUS,
      variables: { uploadId },
      fetchPolicy: 'network-only',
    });
    if (!res.data?.uploadStatus?.data) throw new Error('uploadStatus query returned no data');
    return res.data.uploadStatus.data;
  } catch (err) {
    throw new Error(extractError(err));
  }
}
