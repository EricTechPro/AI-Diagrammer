# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-Diagrammer is an AI-powered diagram creation tool that allows users to generate diagrams from natural language prompts. Built with React, TypeScript, Vite, and Supabase, it features manual drawing tools, AI-assisted diagram generation via Azure OpenAI, and persistent storage with authentication.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Type check without emitting files
npm run typecheck

# Preview production build
npm run preview
```

## Environment Variables

Required environment variables (create a `.env` file):

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_AZURE_OPENAI_API_KEY=your_azure_openai_key
VITE_AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint
```

## Architecture Overview

### Application Flow

1. **Authentication Layer** (`src/contexts/AuthContext.tsx`): Manages user authentication state using Supabase Auth. The `AuthProvider` wraps the entire app and conditionally renders either `AuthForm` for unauthenticated users or `DiagramEditor` for authenticated users.

2. **Main Editor** (`src/components/DiagramEditor.tsx`): Core orchestrator that manages:
   - Tool selection (select, rectangle, ellipse, diamond, text, pen)
   - AI diagram generation workflow
   - Auto-save with 2-second debounce
   - Undo/redo history (max 50 states)
   - Diagram persistence to Supabase
   - Image uploads to Supabase Storage
   - Import/export of diagram JSON

3. **Canvas Rendering** (`src/components/Canvas.tsx`): Handles all diagram rendering and user interactions:
   - Node rendering with RoughJS for hand-drawn aesthetic
   - Edge connections with arrow markers
   - Freehand drawing paths
   - Drag-and-drop node positioning
   - Node resizing and selection
   - Text editing via double-click

4. **AI Integration** (`src/lib/ai.ts`): Communicates with Azure OpenAI to convert natural language prompts into structured diagram data (nodes and edges). The AI returns JSON that gets auto-layouted before merging into the existing diagram.

5. **Auto-Layout System** (`src/lib/layout.ts`): Implements hierarchical graph layout algorithm:
   - Assigns levels to nodes based on edge relationships
   - Positions nodes in horizontal levels with consistent spacing
   - Handles cyclic graphs by falling back to first node as root
   - Calculates positions to center each level

### Data Model

Core type: `DiagramData` contains:
- `nodes`: Array of `DiagramNode` (rectangle, ellipse, diamond, image)
- `edges`: Array of `DiagramEdge` (connections between nodes)
- `paths`: Array of `DrawingPath` (freehand pen strokes)

Each node has: `id`, `type`, `text`, `position`, `dimensions`, and optional `imageUrl`.

### State Management

- **History Management** (`src/hooks/useHistory.ts`): Custom hook implementing undo/redo with a circular buffer (max 50 states). Tracks past, present, and future states.
- **Auto-Save**: Changes trigger a debounced save (2s delay) to Supabase. Manual save via Ctrl/Cmd+S bypasses debounce.
- **Keyboard Shortcuts**:
  - `Ctrl/Cmd + S`: Manual save
  - `Ctrl/Cmd + Z`: Undo
  - `Ctrl/Cmd + Shift + Z`: Redo

### Database Schema

**Table: `diagrams`**
- Stores diagram data as JSONB
- RLS policies ensure users only access their own diagrams
- Indexed on `user_id` and `created_at`
- Auto-updates `updated_at` timestamp

**Storage: `diagram-images`**
- Public bucket for uploaded images
- Images organized by `user_id/timestamp.ext`
- Images referenced via public URLs in diagram nodes

### Key Libraries

- **RoughJS**: Renders diagrams with hand-drawn aesthetic
- **Supabase**: Authentication, database (PostgreSQL), and file storage
- **Lucide React**: Icon library
- **Tailwind CSS**: Utility-first styling

## Development Guidelines

### Adding New Node Types

1. Update `NodeType` in `src/types/diagram.ts`
2. Add rendering logic in `src/components/Canvas.tsx` (within the node rendering switch)
3. Update toolbar in `src/components/Toolbar.tsx`
4. Update AI prompt in `src/lib/ai.ts` to include new type

### Modifying Auto-Layout

The layout algorithm in `src/lib/layout.ts` uses breadth-first traversal to assign levels. Adjust `LEVEL_SPACING` and `NODE_SPACING` constants to change spacing.

### Working with Supabase

- Migrations are in `supabase/migrations/`
- Always respect RLS policies when querying
- Use the initialized client from `src/lib/supabase.ts`

### AI Prompt Engineering

The system prompt in `src/lib/ai.ts` instructs the AI to return structured JSON. When modifying:
- Maintain strict JSON format requirements
- Keep guidelines concise but clear
- Test with various prompt types (processes, workflows, hierarchies)
