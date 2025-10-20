import { Square, Circle, Diamond, Type, Hand, Download, Upload, LogOut, Save, Image, Pen, Undo, Redo } from 'lucide-react';

type Tool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'pen';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved';

interface ToolbarProps {
  selectedTool: Tool;
  onToolSelect: (tool: Tool) => void;
  onExport: () => void;
  onImport: () => void;
  onImageUpload: () => void;
  onSignOut: () => void;
  onSave: () => void;
  saveStatus: SaveStatus;
  penColor: string;
  onPenColorChange: (color: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Purple', value: '#a855f7' },
];

export function Toolbar({
  selectedTool,
  onToolSelect,
  onExport,
  onImport,
  onImageUpload,
  onSignOut,
  onSave,
  saveStatus,
  penColor,
  onPenColorChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps) {
  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <Hand size={20} />, label: 'Select (V)' },
    { id: 'rectangle', icon: <Square size={20} />, label: 'Rectangle (R)' },
    { id: 'ellipse', icon: <Circle size={20} />, label: 'Ellipse (E)' },
    { id: 'diamond', icon: <Diamond size={20} />, label: 'Diamond (D)' },
    { id: 'text', icon: <Type size={20} />, label: 'Text (T)' },
    { id: 'pen', icon: <Pen size={20} />, label: 'Pen (P)' },
  ];

  const getSaveButtonClass = () => {
    const baseClass = 'p-2 rounded transition-colors';
    switch (saveStatus) {
      case 'saving':
        return `${baseClass} bg-yellow-100 text-yellow-600`;
      case 'saved':
        return `${baseClass} bg-green-100 text-green-600`;
      case 'unsaved':
        return `${baseClass} bg-red-100 text-red-600`;
      default:
        return `${baseClass} hover:bg-gray-100 text-gray-700`;
    }
  };

  const getSaveTitle = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'unsaved':
        return 'Unsaved changes (Ctrl+S)';
      default:
        return 'Save (Ctrl+S)';
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-2 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => onToolSelect(tool.id)}
            className={`p-2 rounded transition-colors ${
              selectedTool === tool.id
                ? 'bg-blue-100 text-blue-600'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}

        {selectedTool === 'pen' && (
          <>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <div className="flex items-center gap-1">
              {COLORS.map(color => (
                <button
                  key={color.value}
                  onClick={() => onPenColorChange(color.value)}
                  className={`w-6 h-6 rounded border-2 transition-all ${
                    penColor === color.value
                      ? 'border-blue-500 scale-110'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </>
        )}

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          onClick={onUndo}
          className={`p-2 rounded transition-colors ${
            canUndo
              ? 'hover:bg-gray-100 text-gray-700'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
        >
          <Undo size={20} />
        </button>

        <button
          onClick={onRedo}
          className={`p-2 rounded transition-colors ${
            canRedo
              ? 'hover:bg-gray-100 text-gray-700'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Shift+Z)"
          disabled={!canRedo}
        >
          <Redo size={20} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          onClick={onSave}
          className={getSaveButtonClass()}
          title={getSaveTitle()}
          disabled={saveStatus === 'saving'}
        >
          <Save size={20} />
        </button>

        <button
          onClick={onExport}
          className="p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors"
          title="Export as JSON"
        >
          <Download size={20} />
        </button>

        <button
          onClick={onImport}
          className="p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors"
          title="Import from JSON"
        >
          <Upload size={20} />
        </button>

        <button
          onClick={onImageUpload}
          className="p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors"
          title="Upload Image"
        >
          <Image size={20} />
        </button>

        <button
          onClick={onSignOut}
          className="p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors"
          title="Sign Out"
        >
          <LogOut size={20} />
        </button>
      </div>
    </div>
  );
}
