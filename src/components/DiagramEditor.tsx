import { useState, useCallback, useEffect, useRef } from 'react';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { AIInput } from './AIInput';
import { DiagramData } from '../types/diagram';
import { generateDiagram } from '../lib/ai';
import { autoLayout } from '../lib/layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useHistory } from '../hooks/useHistory';

type Tool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'pen';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved';

export function DiagramEditor() {
  const history = useHistory({ nodes: [], edges: [], paths: [] });
  const [selectedTool, setSelectedTool] = useState<Tool>('select');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [penColor, setPenColor] = useState('#000000');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const { signOut, user } = useAuth();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const diagramData = history.state;

  useEffect(() => {
    if (!user) return;

    const loadDiagram = async () => {
      const { data, error } = await supabase
        .from('diagrams')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading diagram:', error);
      } else if (data) {
        history.reset(data.diagram_data);
        setCurrentDiagramId(data.id);
      }
    };

    loadDiagram();
  }, [user, history]);

  const saveDiagram = useCallback(async (data: DiagramData) => {
    if (!user) return;

    setSaveStatus('saving');

    try {
      if (currentDiagramId) {
        const { error } = await supabase
          .from('diagrams')
          .update({
            diagram_data: data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentDiagramId);

        if (error) throw error;
      } else {
        const { data: newDiagram, error } = await supabase
          .from('diagrams')
          .insert({
            user_id: user.id,
            title: 'Untitled Diagram',
            diagram_data: data,
          })
          .select()
          .single();

        if (error) throw error;
        if (newDiagram) setCurrentDiagramId(newDiagram.id);
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving diagram:', error);
      setSaveStatus('unsaved');
    }
  }, [user, currentDiagramId]);

  const debouncedSave = useCallback((data: DiagramData) => {
    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDiagram(data);
    }, 2000);
  }, [saveDiagram]);

  const handleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveDiagram(diagramData);
  }, [diagramData, saveDiagram]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const updateDiagramData = useCallback((newData: DiagramData) => {
    history.setState(newData);
    debouncedSave(newData);
  }, [debouncedSave, history]);

  const handleGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const rawData = await generateDiagram(prompt);
      const layoutData = autoLayout(rawData);

      const maxX = diagramData.nodes.reduce((max, node) =>
        Math.max(max, node.position.x + node.dimensions.width), 0
      );

      const offsetX = maxX > 0 ? maxX + 100 : 0;

      const offsetNodes = layoutData.nodes.map(node => ({
        ...node,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y,
        },
      }));

      const mergedData: DiagramData = {
        nodes: [...diagramData.nodes, ...offsetNodes],
        edges: [...diagramData.edges, ...layoutData.edges],
        paths: diagramData.paths || [],
      };

      history.setState(mergedData);
      setSelectedNodeIds([]);

      if (user) {
        setSaveStatus('saving');
        if (currentDiagramId) {
          const { error: saveError } = await supabase
            .from('diagrams')
            .update({
              diagram_data: mergedData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentDiagramId);

          if (saveError) {
            console.error('Error saving diagram:', saveError);
            setSaveStatus('unsaved');
          } else {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
          }
        } else {
          const { data, error: saveError } = await supabase
            .from('diagrams')
            .insert({
              user_id: user.id,
              title: prompt.slice(0, 100),
              description: prompt,
              diagram_data: mergedData,
            })
            .select()
            .single();

          if (saveError) {
            console.error('Error saving diagram:', saveError);
            setSaveStatus('unsaved');
          } else if (data) {
            setCurrentDiagramId(data.id);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate diagram');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [user]);

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(diagramData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [diagramData]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importedData = JSON.parse(text) as DiagramData;

        if (!importedData.nodes || !Array.isArray(importedData.nodes)) {
          throw new Error('Invalid diagram format');
        }

        history.setState(importedData);
        setSelectedNodeIds([]);
        debouncedSave(importedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import diagram');
        console.error('Import error:', err);
      }
    };
    input.click();
  }, [debouncedSave, setError]);

  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !user) return;

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data, error: uploadError } = await supabase.storage
          .from('diagram-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('diagram-images')
          .getPublicUrl(data.path);

        const img = new window.Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          const maxWidth = 300;
          const width = Math.min(maxWidth, img.width);
          const height = width / aspectRatio;

          const newNode = {
            id: `node-${Date.now()}`,
            type: 'image' as const,
            text: '',
            position: { x: 500, y: 300 },
            dimensions: { width, height },
            imageUrl: publicUrl,
          };

          const newData = {
            ...diagramData,
            nodes: [...diagramData.nodes, newNode],
          };

          history.setState(newData);
          debouncedSave(newData);
          URL.revokeObjectURL(img.src);
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload image');
        console.error('Image upload error:', err);
      }
    };
    input.click();
  }, [user, diagramData, debouncedSave, setError, history]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }, [signOut]);

  const handleUndo = useCallback(() => {
    const previousState = history.undo();
    if (previousState) {
      debouncedSave(previousState);
    }
  }, [history, debouncedSave]);

  const handleRedo = useCallback(() => {
    const nextState = history.redo();
    if (nextState) {
      debouncedSave(nextState);
    }
  }, [history, debouncedSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className="relative w-full h-screen bg-gray-50 overflow-hidden">
      <Toolbar
        selectedTool={selectedTool}
        onToolSelect={setSelectedTool}
        onExport={handleExport}
        onImport={handleImport}
        onImageUpload={handleImageUpload}
        onSignOut={handleSignOut}
        onSave={handleSave}
        saveStatus={saveStatus}
        penColor={penColor}
        onPenColorChange={setPenColor}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
      />

      <Canvas
        diagramData={diagramData}
        setDiagramData={updateDiagramData}
        selectedNodeIds={selectedNodeIds}
        onNodeSelect={setSelectedNodeIds}
        selectedTool={selectedTool}
        onToolChange={setSelectedTool}
        penColor={penColor}
      />

      <AIInput
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        error={error}
      />
    </div>
  );
}
