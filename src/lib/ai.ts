import { DiagramData, DiagramNode, DiagramEdge } from '../types/diagram';

const API_KEY = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
const ENDPOINT = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;

export async function generateDiagram(userPrompt: string): Promise<DiagramData> {
  if (!API_KEY || !ENDPOINT) {
    throw new Error('Missing Azure OpenAI credentials');
  }

  const systemPrompt = `You are an expert at converting natural language descriptions into structured diagram data.
When given a description, extract entities, relationships, and flow logic, then return a JSON object with this exact structure:

{
  "nodes": [
    {
      "id": "unique-id",
      "type": "rectangle" | "ellipse" | "diamond",
      "text": "Node label",
      "position": { "x": 0, "y": 0 },
      "dimensions": { "width": 180, "height": 80 }
    }
  ],
  "edges": [
    {
      "id": "unique-id",
      "from": "source-node-id",
      "to": "target-node-id",
      "label": "optional label"
    }
  ]
}

Guidelines:
- Use "rectangle" for process steps, actions, or general boxes
- Use "ellipse" for start/end points or states
- Use "diamond" for decision points or conditional logic
- Keep text concise and clear
- Don't set positions (they will be auto-calculated)
- Ensure all edge "from" and "to" IDs reference existing nodes
- Return ONLY valid JSON, no markdown or additional text`;

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : content;
    const diagramData: DiagramData = JSON.parse(jsonString);

    if (!diagramData.nodes || !Array.isArray(diagramData.nodes)) {
      throw new Error('Invalid diagram data: missing nodes array');
    }

    if (!diagramData.edges) {
      diagramData.edges = [];
    }

    diagramData.nodes.forEach((node: DiagramNode, index: number) => {
      if (!node.id) node.id = `node-${index}`;
      if (!node.type) node.type = 'rectangle';
      if (!node.dimensions) node.dimensions = { width: 180, height: 80 };
      if (!node.position) node.position = { x: 0, y: 0 };
    });

    diagramData.edges.forEach((edge: DiagramEdge, index: number) => {
      if (!edge.id) edge.id = `edge-${index}`;
    });

    return diagramData;
  } catch (error) {
    console.error('AI generation error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate diagram');
  }
}
