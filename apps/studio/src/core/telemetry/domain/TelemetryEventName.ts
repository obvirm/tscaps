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
  | 'handoff_recovery_offered'
  | 'handoff_recovered'
  | 'project_opened'
  | 'project_open_failed'
  | 'project_open_blocked'
  | 'project_video_recovery_offered'
  | 'template_selected'
  | 'hook_scenes_set'
  | 'role_sheet_created'
  | 'speaker_sheet_created'
  | 'export_started'
  | 'export_completed'
  | 'export_cancelled'
  | 'export_failed'
  | 'subtitles_exported'
  | 'template_used_at_export'
  | 'app_notice_published'
  | 'sprite_sheet_single_tile_fallback'
  | 'preview_proxy_fallback'
  | 'preview_proxy_generated'
  | 'preview_proxy_generation_failed'
  | 'behind_actor_measurement_failed'
  | 'project_save_failed'
  | 'project_video_store_failed'
  | 'auth_started'
  | 'auth_succeeded'
  | 'auth_failed'
  | 'email_verification_sent'
  | 'pricing_viewed'
  | 'pricing_plan_clicked'
  | 'checkout_started'
  | 'billing_portal_opened'
  | 'support_opened';
