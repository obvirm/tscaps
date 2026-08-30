import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsRightLeft, Pencil } from 'lucide-react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { HOOK_SHEET_ID, HOOK_SHEET_COLOR } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import type { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { SheetMatcher, SheetMatcherRunResult } from '@core/sheet-matchers/domain/SheetMatcher';
import { useTranscriptCallbacks } from '@ui/pages/editor/features/transcript/hooks/useTranscriptCallbacks';
import type { SegmentTextareaFocuser } from '@presentation/editor/services/SegmentTextareaFocuser';
import {
  FindAndLocateShortcutsController,
  FIND_SHORTCUT,
  LOCATE_SHORTCUT,
} from '@presentation/editor/controllers/FindAndLocateShortcutsController';
import { useKeyboardShortcutLabeler } from '@ui/pages/editor/contexts/KeyboardShortcutLabelerContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { FreeTranscriptView } from '@ui/pages/editor/features/transcript/components/FreeTranscriptView';
import { AdvancedTranscriptView } from '@ui/pages/editor/features/transcript/components/AdvancedTranscriptView';
import { AutoAssignDialog } from '@ui/pages/editor/features/transcript/components/AutoAssignDialog';
import { TranscriptActionsPopover } from '@ui/pages/editor/features/transcript/components/TranscriptActionsPopover';
import { PickModeHeader } from '@ui/pages/editor/features/transcript/components/pick-mode/PickModeHeader';
import { PickModeBottomBar } from '@ui/pages/editor/features/transcript/components/pick-mode/PickModeBottomBar';
import { useScenePickController } from '@ui/pages/editor/features/transcript/contexts/ScenePickContext';
import { useScenePickSnapshot } from '@ui/pages/editor/features/transcript/hooks/useScenePickSnapshot';
import {
  AutoAssignResultToast,
  type AutoAssignResultToastState,
} from '@ui/pages/editor/features/transcript/components/AutoAssignResultToast';
import { LocateButton } from '@ui/pages/editor/components/LocateButton';
import { SearchToggleButton } from '@ui/pages/editor/components/SearchToggleButton';
import { SegmentSearchInputBar } from '@ui/pages/editor/components/SegmentSearchInputBar';
import {
  useSegmentSearchControls,
  type SearchableSegment,
} from '@ui/pages/editor/hooks/useSegmentSearchControls';
import { useActiveEditorMode } from '@ui/pages/editor/hooks/useActiveEditorMode';

type CaptionsMode = 'free' | 'advanced';

export interface SortedEntry {
  segment: Segment;
  flatIdx: number;
  /** `kind` of the section that owns `segment`; used to look up the owning Sheet. */
  sectionKind: string;
}

export interface TranscriptPanelProps {
  document: Document | null;
  activeSegmentId: string | null;
  sheets: Sheet[];
  activeSheetId: string | null;
  elementStyles: ElementStyles;
  behindActorOverrides: BehindActorSegmentOverrideRegistry;
  frozenSegments: FrozenSegmentSet;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  isPlaying: boolean;
  cuts: CutRegistry;
  cutAwareDocumentBuilder: CutAwareDocumentBuilder;
  textareaFocus: SegmentTextareaFocuser;
  onSeek: (time: number) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onInsertWord: (segIdx: number, lineIdx: number, wordIdx: number) => string;
  onInsertSegment: (segIdx: number, position: 'before' | 'after') => string;
  onEditWordText: (wordId: string, text: string) => void;
  onEditWordTime: (wordId: string, start: number, end: number) => void;
  onEditWordTags: (wordId: string, tagNames: ReadonlySet<string>) => void;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onAutoAssignSegments: <P>(sheetId: string, matcher: SheetMatcher<P>, params: P) => SheetMatcherRunResult;
  onCreateSheet: (name: string) => string | null;
  onResetSegmentLayout: (segmentId: string) => void;
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set();

const MODE_TOGGLE =
  'inline-flex items-center gap-1.5 px-2 py-1 rounded-xs text-xs ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2';

export const TranscriptPanel = memo(function TranscriptPanel(props: TranscriptPanelProps) {
  const {
    document, activeSegmentId, sheets, activeSheetId,
    elementStyles, behindActorOverrides, frozenSegments, decorationOverrides,
    videoDuration, isPlaying, cuts, cutAwareDocumentBuilder, textareaFocus,
    onSeek, onDeleteWords,
    onApplyStructureEdit, onInsertWord, onInsertSegment,
    onEditWordText, onEditWordTime, onEditWordTags,
    onAssignSegmentSheet, onAutoAssignSegments, onCreateSheet,
    onResetSegmentLayout,
  } = props;

  const captions = useTranscriptCallbacks();
  const isMobile = useIsMobileViewport();
  const activeMode = useActiveEditorMode();
  const shortcutLabeler = useKeyboardShortcutLabeler();
  const findShortcutLabel = useMemo(() => shortcutLabeler.label(FIND_SHORTCUT), [shortcutLabeler]);
  const locateShortcutLabel = useMemo(() => shortcutLabeler.label(LOCATE_SHORTCUT), [shortcutLabeler]);
  const [mode, setMode] = useState<CaptionsMode>('free');
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [wandMenuOpen, setWandMenuOpen] = useState(false);
  const [autoAssignToast, setAutoAssignToast] = useState<AutoAssignResultToastState | null>(null);
  const sheetsModule = useSheets();
  const registry = sheetsModule.matcherRegistry;
  const setHookScenes = sheetsModule.actions.sheets.setHookScenes;
  const canAutoAssign = !isMobile && registry.list().length > 0;

  const pickSnapshot = useScenePickSnapshot();
  const pickActive = pickSnapshot.isActive;

  const handleCommitSegmentTime = useCallback((segmentId: string, start: number, end: number) => {
    captions.editSegmentTime({ segmentId, start, end });
  }, [captions]);

  const sorted = useMemo<SortedEntry[]>(() => {
    if (!document) return [];
    const entries: SortedEntry[] = [];
    let flatIdx = 0;
    for (const section of document.sections) {
      for (const segment of section.segments) {
        if (cutAwareDocumentBuilder.buildSegment(segment, cuts) !== null) {
          entries.push({ segment, flatIdx, sectionKind: section.kind });
        }
        flatIdx++;
      }
    }
    return entries.sort((a, b) => {
      const ds = a.segment.time.start - b.segment.time.start;
      if (ds !== 0) return ds;
      const de = a.segment.time.end - b.segment.time.end;
      if (de !== 0) return de;
      return a.flatIdx - b.flatIdx;
    });
  }, [document, cuts, cutAwareDocumentBuilder]);

  const searchableItems = useMemo<SearchableSegment[]>(
    () => sorted.map((e) => ({ id: e.segment.id, searchableText: e.segment.getText() })),
    [sorted],
  );
  const search = useSegmentSearchControls(searchableItems, activeSegmentId);

  const shortcuts = useMemo(
    () => new FindAndLocateShortcutsController(search.openSearch, search.locate),
    [search.openSearch, search.locate],
  );
  useEffect(() => {
    if (activeMode !== 'captions') return;
    shortcuts.start();
    return () => shortcuts.stop();
  }, [activeMode, shortcuts]);

  const scenePickController = useScenePickController();

  const currentHookSegmentIds = useMemo<ReadonlySet<string>>(() => {
    if (!document) return EMPTY_ID_SET;
    const ids = new Set<string>();
    for (const section of document.sections) {
      if (section.kind !== HOOK_SHEET_ID) continue;
      for (const segment of section.segments) ids.add(segment.id);
    }
    return ids;
  }, [document]);

  const selectionDurationSeconds = useMemo(() => {
    if (!pickActive) return 0;
    let total = 0;
    for (const entry of sorted) {
      if (pickSnapshot.selection.has(entry.segment.id)) total += entry.segment.time.end - entry.segment.time.start;
    }
    return total;
  }, [pickActive, pickSnapshot.selection, sorted]);

  const handleEnterHookPick = useCallback(() => {
    setWandMenuOpen(false);
    scenePickController.enter({
      constraint: 'contiguous-from-start',
      initialSelection: currentHookSegmentIds,
    });
    // The selection runs from the first scene, and what the user picks is
    // where it ends. Reading that off a list scrolled to the middle of the
    // video means guessing what is selected above the fold.
    const first = sorted[0];
    if (first) search.scrollTo(first.segment.id);
  }, [scenePickController, currentHookSegmentIds, sorted, search]);

  const handleOpenAutoAssign = useCallback(() => {
    setWandMenuOpen(false);
    setAutoAssignOpen(true);
  }, []);

  const handleConfirmPick = useCallback(() => {
    setHookScenes.execute(scenePickController.snapshot().selection);
    scenePickController.exit();
  }, [scenePickController, setHookScenes]);

  const handleClearPick = useCallback(() => {
    setHookScenes.execute(EMPTY_ID_SET);
    scenePickController.exit();
  }, [scenePickController, setHookScenes]);

  const handleCancelPick = useCallback(() => {
    scenePickController.exit();
  }, [scenePickController]);

  useEffect(() => {
    if (!pickActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      scenePickController.exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickActive, scenePickController]);

  useEffect(() => () => scenePickController.exit(), [scenePickController]);

  // Desktop only. Mobile sticks to 'free'.
  const effectiveMode: CaptionsMode = isMobile ? 'free' : mode;
  const showTopbar = !isMobile;

  // The topbar is sticky inside the scroll ancestor and overlays the
  // scrolling content. Reserve its height as `scroll-padding-top` on
  // the ancestor so any scrollIntoView (e.g. textarea focus on arrow-
  // key navigation) lands the target below the bar instead of
  // underneath it.
  const topbarRef = useRef<HTMLDivElement>(null);
  const scrollAncestorRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const topbar = topbarRef.current;
    if (!topbar) return;
    if (!scrollAncestorRef.current) {
      let el: HTMLElement | null = topbar.parentElement;
      while (el) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === 'auto' || overflowY === 'scroll') break;
        el = el.parentElement;
      }
      scrollAncestorRef.current = el;
    }
    const scrollEl = scrollAncestorRef.current;
    if (!scrollEl) return;
    scrollEl.style.scrollPaddingTop = `${topbar.offsetHeight}px`;
    return () => { scrollEl.style.scrollPaddingTop = ''; };
  }, [showTopbar, search.searchOpen]);

  if (!document) {
    return (
      <div className="py-6 text-center text-sm text-fg-faint">
        Transcribe a video to see captions here.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {pickActive ? (
        <PickModeHeader
          ref={topbarRef}
          title="Choose your hook scenes"
          hint="Click a scene to mark where the hook ends."
          accentColor={HOOK_SHEET_COLOR}
          cancelLabel="Cancel hook selection"
          cancelHint="Cancel (Esc)"
          onCancel={handleCancelPick}
        />
      ) : (
        showTopbar && (
          <div ref={topbarRef} className="sticky top-0 z-10 bg-surface-1 border-b border-edge-subtle">
            <div className="flex items-center justify-between gap-2 px-1 py-1.5">
              <Tooltip
                text={effectiveMode === 'free' ? 'Switch to advanced mode (edit each word)' : 'Switch to free mode (edit as text)'}
                position="bottom"
              >
                <button
                  type="button"
                  className={MODE_TOGGLE}
                  onClick={() => setMode(effectiveMode === 'free' ? 'advanced' : 'free')}
                  aria-label={effectiveMode === 'free' ? 'Free mode, click to switch to advanced' : 'Advanced mode, click to switch to free'}
                >
                  {effectiveMode === 'free' ? <Pencil size={12} /> : <ChevronsRightLeft size={12} />}
                  {effectiveMode === 'free' ? 'Free' : 'Advanced'}
                </button>
              </Tooltip>
              <div className="flex items-center gap-0.5">
                <LocateButton
                  disabled={!search.canLocate}
                  shortcutLabel={locateShortcutLabel}
                  onLocate={search.locate}
                />
                <SearchToggleButton
                  open={search.searchOpen}
                  shortcutLabel={findShortcutLabel}
                  onToggle={() => (search.searchOpen ? search.closeSearch() : search.openSearch())}
                />
                <TranscriptActionsPopover
                  open={wandMenuOpen}
                  onOpenChange={setWandMenuOpen}
                  canAutoAssign={canAutoAssign}
                  onSetHookScenes={handleEnterHookPick}
                  onOpenAutoAssign={handleOpenAutoAssign}
                />
              </div>
            </div>
            {search.searchOpen && (
              <SegmentSearchInputBar
                inputRef={search.searchInputRef}
                query={search.searchQuery}
                matchCount={search.matchCount}
                currentMatchOrdinal={search.currentMatchOrdinal}
                onQueryChange={search.setSearchQuery}
                onNext={search.nextMatch}
                onPrev={search.prevMatch}
                onClose={search.closeSearch}
              />
            )}
          </div>
        )
      )}
      <AutoAssignDialog
        open={autoAssignOpen}
        document={document}
        sheets={sheets}
        initialSheetId={activeSheetId}
        onApply={(sheetId, matcher, params) => {
          const result = onAutoAssignSegments(sheetId, matcher, params);
          const sheetName = sheets.find((s) => s.id === sheetId)?.name ?? 'the sheet';
          setAutoAssignToast({ key: Date.now(), result, sheetName });
          setAutoAssignOpen(false);
        }}
        onCancel={() => setAutoAssignOpen(false)}
      />
      <AutoAssignResultToast
        state={autoAssignToast}
        onDismiss={() => setAutoAssignToast(null)}
      />

      {effectiveMode === 'advanced' ? (
        <AdvancedTranscriptView
          document={document}
          sorted={sorted}
          activeSegmentId={activeSegmentId}
          isPlaying={isPlaying}
          scrollRequest={search.scrollRequest}
          highlightedSegmentId={search.highlightedSegmentId}
          sheets={sheets}
          elementStyles={elementStyles}
          behindActorOverrides={behindActorOverrides}
          frozenSegments={frozenSegments}
          decorationOverrides={decorationOverrides}
          videoDuration={videoDuration}
          cuts={cuts}
          onSeek={onSeek}
          onEditWordText={onEditWordText}
          onEditWordTime={onEditWordTime}
          onEditWordTags={onEditWordTags}
          onDeleteWords={onDeleteWords}
          onApplyStructureEdit={onApplyStructureEdit}
          onInsertWord={onInsertWord}
          onInsertSegment={onInsertSegment}
          onAssignSegmentSheet={onAssignSegmentSheet}
          onCreateSheet={onCreateSheet}
          onCommitSegmentTime={handleCommitSegmentTime}
          onRedistributeWords={captions.redistributeWords}
          onResetSegmentLayout={onResetSegmentLayout}
        />
      ) : (
        <FreeTranscriptView
          document={document}
          sorted={sorted}
          activeSegmentId={activeSegmentId}
          isPlaying={isPlaying}
          scrollRequest={search.scrollRequest}
          highlightedSegmentId={search.highlightedSegmentId}
          sheets={sheets}
          elementStyles={elementStyles}
          behindActorOverrides={behindActorOverrides}
          frozenSegments={frozenSegments}
          decorationOverrides={decorationOverrides}
          videoDuration={videoDuration}
          cuts={cuts}
          cutAwareDocumentBuilder={cutAwareDocumentBuilder}
          textareaFocus={textareaFocus}
          onSeek={onSeek}
          onApplyStructureEdit={onApplyStructureEdit}
          onDeleteWords={onDeleteWords}
          onAssignSegmentSheet={onAssignSegmentSheet}
          onCreateSheet={onCreateSheet}
          onInsertSegment={onInsertSegment}
          onResetSegmentLayout={onResetSegmentLayout}
        />
      )}
      {pickActive && (
        <PickModeBottomBar
          selectionCount={pickSnapshot.selection.size}
          selectionDurationSeconds={selectionDurationSeconds}
          accentColor={HOOK_SHEET_COLOR}
          confirmLabel="Confirm as hook"
          clearLabel="Clear hook"
          canConfirm={pickSnapshot.selection.size > 0}
          showClear={pickSnapshot.initialSelection.size > 0}
          onConfirm={handleConfirmPick}
          onClear={handleClearPick}
        />
      )}
    </div>
  );
});
