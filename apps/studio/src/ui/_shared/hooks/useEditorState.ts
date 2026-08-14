import { useEffect, useState } from 'react';
import type { EditorState } from '@core/editor/domain/EditorState';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';

/**
 * The editor's current state, re-read whenever the store changes.
 *
 * Takes no arguments: the store is a module the whole editor tree can
 * reach, so a component that needs state can ask for it where it is
 * used instead of being handed it from above. Threading state through
 * props costs every component in between a prop it does not read, and
 * makes adding one field to a leaf a change to its whole ancestry.
 */
export function useEditorState(): EditorState {
  const store = useEditor().store;
  const [state, setState] = useState(() => store.snapshot());
  useEffect(() => {
    const update = () => setState(store.snapshot());
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [store]);
  return state;
}
