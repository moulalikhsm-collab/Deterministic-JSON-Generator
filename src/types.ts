export type FieldType = "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY";

export interface SchemaField {
  id: string;
  key: string;
  type: FieldType;
  description: string;
  required: boolean;
  itemType?: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN";
}

export interface PresetSchema {
  id: string;
  name: string;
  description: string;
  fields: SchemaField[];
  exampleInputs: string[];
}

export interface ExtractionHistoryItem {
  id: string;
  timestamp: string;
  originalText: string;
  extractedData: Record<string, any>;
  schemaName: string;
  schemaFields: SchemaField[];
}
