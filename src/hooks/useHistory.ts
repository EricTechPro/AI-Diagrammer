import { useState, useCallback, useRef } from 'react';
import { DiagramData } from '../types/diagram';

interface HistoryState {
  past: DiagramData[];
  present: DiagramData;
  future: DiagramData[];
}

const MAX_HISTORY_SIZE = 50;

export function useHistory(initialState: DiagramData) {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: initialState,
    future: [],
  });

  const isUndoRedoAction = useRef(false);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const setState = useCallback((newState: DiagramData, skipHistory = false) => {
    if (skipHistory || isUndoRedoAction.current) {
      setHistory(prev => ({
        ...prev,
        present: newState,
      }));
      return;
    }

    setHistory(prev => {
      const newPast = [...prev.past, prev.present];
      if (newPast.length > MAX_HISTORY_SIZE) {
        newPast.shift();
      }

      return {
        past: newPast,
        present: newState,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    if (!canUndo) return null;

    isUndoRedoAction.current = true;

    const newState = {
      past: history.past.slice(0, -1),
      present: history.past[history.past.length - 1],
      future: [history.present, ...history.future],
    };

    setHistory(newState);

    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 0);

    return newState.present;
  }, [history, canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return null;

    isUndoRedoAction.current = true;

    const newState = {
      past: [...history.past, history.present],
      present: history.future[0],
      future: history.future.slice(1),
    };

    setHistory(newState);

    setTimeout(() => {
      isUndoRedoAction.current = false;
    }, 0);

    return newState.present;
  }, [history, canRedo]);

  const reset = useCallback((newState: DiagramData) => {
    setHistory({
      past: [],
      present: newState,
      future: [],
    });
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  };
}
