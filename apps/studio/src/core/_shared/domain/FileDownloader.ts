/**
 * Hands a blob to the user as a downloaded file.
 *
 * The call returns as soon as the download has been handed to the
 * environment; whether the file lands in a download folder, opens a
 * save dialog, or is refused is outside the caller's control.
 */
export interface FileDownloader {
  download(blob: Blob, fileName: string): void;
}
