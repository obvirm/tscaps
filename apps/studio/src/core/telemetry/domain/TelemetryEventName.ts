/**
 * Exhaustive set of telemetry event names the app emits. New events
 * are added here first so call sites are typo-checked at compile time
 * and the taxonomy stays discoverable from a single place.
 *
 * Each name is snake_case, past-tense for completed effects
 * (`export_completed`) and present-tense for intents
 * (`video_dropped`). Event-specific properties travel alongside the
 * name in the `capture` call.
 */
export type TelemetryEventName =
  | 'page_viewed'
  | 'preprocessing_started'
  | 'preprocessing_completed'
  | 'preprocessing_failed'
  | 'transcription_gaps_detected'
  | 'transcription_model_cache_failed'
  | 'video_rejected_over_cap'
  | 'template_selected'
  | 'hook_scenes_set'
  | 'export_started'
  | 'export_completed'
  | 'export_cancelled'
  | 'export_failed'
  | 'subtitles_exported'
  | 'template_used_at_export'
  | 'app_notice_published'
  | 'preview_proxy_fallback'
  | 'project_save_failed'
  | 'auth_started'
  | 'auth_succeeded'
  | 'auth_failed'
  | 'email_verification_sent'
  | 'pricing_viewed'
  | 'pricing_plan_clicked'
  | 'checkout_started'
  | 'billing_portal_opened';
