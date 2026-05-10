// Minimal A2UI v0.8 wire types — only what the renderer consumes.
// Cribbed from the Lit IIFE's Zod schemas in a2glimpse-host.html. Not
// exhaustive: optional sub-properties used elsewhere in the spec are
// only typed when the renderer actually reads them.

export type LiteralString = { literalString: string };
export type Path = { path: string };
export type StringRef = LiteralString | Path;

export type LiteralArray<T> = { literalArray: T[] };
export type ListRef<T> = { explicitList: string[] } | LiteralArray<T>;

export type Action = {
  name: string;
  context?: { key: string; value: StringRef }[];
};

export type ChoiceOption = { label: StringRef; value: string };

// Component variants — each is an object with the type as the single key.
export type Component =
  | { Column: { children: ListRef<string> } }
  | { Row: { children: ListRef<string> } }
  | { Card: { child: string } }
  | { Text: { text: StringRef; usageHint?: string } }
  | { Button: { child: string; primary?: boolean; action?: Action } }
  | { TextField: { label?: StringRef; text: Path; textFieldType?: string } }
  | { Slider: { label?: StringRef; value: Path; minValue?: number; maxValue?: number } }
  | {
      MultipleChoice: {
        label?: StringRef;
        selections: Path | LiteralArray<string>;
        options: ChoiceOption[];
        maxAllowedSelections?: number;
        type?: 'radio' | 'checkbox';
      };
    }
  | { CheckBox: { label?: StringRef; value: Path } }
  | {
      Modal: {
        child: string;
        open: Path | { literalBoolean: boolean };
      };
    }
  | {
      Tabs: {
        selected: Path;
        tabs: { label: StringRef; child: string; value: string }[];
      };
    }
  | { Icon: { name: StringRef; size?: number } };

export type ComponentNode = {
  id: string;
  component: Component;
};

export type Surface = {
  surfaceId: string;
  components: ComponentNode[];
};

export type DataModelEntry =
  | { key: string; valueString: string }
  | { key: string; valueNumber: number }
  | { key: string; valueArray: unknown[] }
  | { key: string; valueBoolean: boolean };

export type IncomingMessage =
  | { surfaceUpdate: Surface }
  | { dataModelUpdate: { surfaceId: string; contents: DataModelEntry[]; path?: string } }
  | { beginRendering: { surfaceId: string; root: string } }
  | { deleteSurface: { surfaceId: string } };
