// 檔案驗證工具函數

// 允許的圖片檔案類型
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// 檔案大小限制（MB）
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 驗證上傳的檔案
 * @param file 要驗證的檔案
 * @param maxSizeMB 最大檔案大小（MB），預設為 10MB
 * @returns 驗證結果
 */
export function validateImageFile(
  file: File | null | undefined,
  maxSizeMB: number = MAX_FILE_SIZE_MB
): FileValidationResult {
  // 檢查檔案是否存在
  if (!file) {
    return {
      valid: false,
      error: 'fileRequired'
    };
  }

  // 檢查檔案類型
  if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'invalidFileType'
    };
  }

  // 檢查檔案大小
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: 'fileTooLarge'
    };
  }

  return { valid: true };
}
