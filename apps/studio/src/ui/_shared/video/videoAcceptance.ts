/**
 * Single source of truth for which video files the editor accepts.
 * Shared by the in-editor dropzone and the projects-page drop catcher
 * so both agree on the format list and the rejection message.
 */
export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

export const ACCEPTED_VIDEO_LABEL = 'MP4 · WEBM · MOV';

export const VIDEO_UNSUPPORTED_MESSAGE =
  'Unsupported format. Please use MP4, WebM, or MOV.';
