
export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  "content-type": string;
  url: string;
  size: number;
  created_at: string;
  updated_at: string;
  locked: boolean;
  hidden: boolean;
  locked_for_user: boolean;
  hidden_for_user: boolean;
  thumbnail_url?: string | null;
}

export type CanvasFileCategory =
  | "pdf"
  | "image"
  | "word"
  | "powerpoint"
  | "excel"
  | "video"
  | "audio"
  | "other";

export async function getCanvasFile(
  baseUrl: string,
  token: string,
  courseId: string | number,
  fileId: number
): Promise<CanvasFile> {

  const canvasOrigin = new URL(baseUrl).origin;

  const url = new URL(
    `/api/v1/courses/${encodeURIComponent(courseId)}/files/${encodeURIComponent(fileId)}`,
    canvasOrigin
  );

  const response = await fetch(url, {
    redirect: "error",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Canvas API-fout bij bestand ${fileId}: ${response.status}`
    );
  }

  return response.json() as Promise<CanvasFile>;
}

export function classifyCanvasFile(
  file: CanvasFile
): CanvasFileCategory {

  const mimeType = (
    file["content-type"] ?? ""
  ).toLowerCase().split(";")[0].trim();

  const filename = (
    file.filename ?? file.display_name ?? ""
  ).toLowerCase();

  if (
    mimeType === "application/pdf" ||
    filename.endsWith(".pdf")
  ) {
    return "pdf";
  }

  if (
    mimeType.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(filename)
  ) {
    return "image";
  }

  if (
    mimeType === "application/msword" ||
    mimeType.includes("wordprocessingml") ||
    /\.(doc|docx)$/.test(filename)
  ) {
    return "word";
  }

  if (
    mimeType === "application/vnd.ms-powerpoint" ||
    mimeType.includes("presentationml") ||
    /\.(ppt|pptx)$/.test(filename)
  ) {
    return "powerpoint";
  }

  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType.includes("spreadsheetml") ||
    /\.(xls|xlsx)$/.test(filename)
  ) {
    return "excel";
  }

  if (mimeType.startsWith("video/")) {
    return "video";
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  return "other";
}

export function formatFileSize(bytes: number): string {

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
