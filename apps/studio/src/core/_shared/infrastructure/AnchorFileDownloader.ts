import type { FileDownloader } from '@core/_shared/domain/FileDownloader';

/**
 * Downloads through a hidden anchor pointing at a temporary object URL.
 *
 * The anchor is attached to the document before the click because
 * Firefox ignores a click on a detached element, and the URL is
 * released immediately afterwards so the blob does not stay alive for
 * the lifetime of the page.
 */
export class AnchorFileDownloader implements FileDownloader {

  download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
