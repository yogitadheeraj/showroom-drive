import { apiStorageList, apiStoragePublicUrl, apiStorageRemove, apiStorageSignedUrl, apiStorageUpload } from '@/lib/apiClient';

export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File,
  options?: { upsert?: boolean }
) {
  await apiStorageUpload(bucket, path, file, options);
  return path;
}

export async function getStoragePublicUrl(bucket: string, path: string) {
  return apiStoragePublicUrl(bucket, path);
}

export async function getStorageSignedUrl(bucket: string, path: string, expiresIn = 300) {
  return apiStorageSignedUrl(bucket, path, expiresIn);
}

export async function listStorageFiles(bucket: string, prefix: string, limit = 100) {
  return apiStorageList(bucket, prefix, limit);
}

export async function removeStorageFiles(bucket: string, paths: string[]) {
  return apiStorageRemove(bucket, paths);
}
