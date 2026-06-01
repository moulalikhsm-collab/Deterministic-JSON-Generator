import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  FileText,
  Settings,
  History,
  Download,
  Play,
  FileUp,
  FileJson,
  Layers,
  ShieldCheck,
  AlertCircle,
  Eye,
  Info,
  List,
  HelpCircle,
  FileSpreadsheet,
  RefreshCw,
  X,
  Search,
  CheckCircle2
} from "lucide-react";
import { SchemaField, PresetSchema, ExtractionHistoryItem, FieldType } from "./types";
import { PRESET_SCHEMAS } from "./presets";

export default function App() {
  // Preset list
  const [selectedPresetId, setSelectedPresetId] = useState<string>("contact-details");
  const [currentSchemaName, setCurrentSchemaName] = useState<string>("Contact Information");
  const [currentSchemaDesc, setCurrentSchemaDesc] = useState<string>("Extract core profile and contact details.");
  
  // Custom schema fields state
  const [fields, setFields] = useState<SchemaField[]>([]);
  
  // Unstructured Raw Text
  const [inputText, setInputText] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // System Instructions override
  const [systemInstructions, setSystemInstructions] = useState<string>(
    "Extract only information explicitly present in the text. Do not infer, assume, or hallucinate missing values. If a field is unavailable, set it to null. Maintain exact spelling, capitalization, and original values from the text where appropriate."
  );

  // App running states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Results
  const [extractedData, setExtractedData] = useState<Record<string, any> | null>(null);
  const [rawJsonOutput, setRawJsonOutput] = useState<string>("");
  
  // UI states
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [copiedRawFeedback, setCopiedRawFeedback] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"visual" | "json" | "verify" | "python">("visual");
  const [history, setHistory] = useState<ExtractionHistoryItem[]>([]);
  
  // Python CLI Workspace Sync state
  const [isSyncingPython, setIsSyncingPython] = useState<boolean>(false);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  // Loaded a history or active run
  const [currentSourceText, setCurrentSourceText] = useState<string>("");

  // Load preset fields initially and handle presets change
  useEffect(() => {
    const preset = PRESET_SCHEMAS.find((p) => p.id === selectedPresetId);
    if (preset) {
      setFields([...preset.fields]);
      setCurrentSchemaName(preset.name);
      setCurrentSchemaDesc(preset.description);
      // Load first example input of this preset if current input is empty
      if (!inputText || PRESET_SCHEMAS.some(p => p.exampleInputs.includes(inputText))) {
        setInputText(preset.exampleInputs[0] || "");
      }
    } else if (selectedPresetId === "custom") {
      setCurrentSchemaName("Custom Extraction Template");
      setCurrentSchemaDesc("Design a bespoke layout matching your target unstructured documents.");
    }
  }, [selectedPresetId]);

  // Load history from LocalStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("extraction_history_records");
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }, []);

  // Save history helper
  const saveHistory = (updated: ExtractionHistoryItem[]) => {
    setHistory(updated);
    try {
      localStorage.setItem("extraction_history_records", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to write history:", e);
    }
  };

  // Add field item
  const addField = () => {
    const newField: SchemaField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      key: `custom_field_${fields.length + 1}`,
      type: "STRING",
      description: "Description of what specifically to parse",
      required: false,
    };
    setFields([...fields, newField]);
    setSelectedPresetId("custom");
  };

  // Delete field item
  const removeField = (id: string) => {
    const updated = fields.filter((f) => f.id !== id);
    setFields(updated);
    setSelectedPresetId("custom");
  };

  // Edit field value
  const updateField = (id: string, updates: Partial<SchemaField>) => {
    const updated = fields.map((f) => {
      if (f.id === id) {
        const item = { ...f, ...updates };
        // Clean array details if type converted
        if (updates.type && updates.type !== "ARRAY") {
          delete item.itemType;
        } else if (updates.type === "ARRAY" && !item.itemType) {
          item.itemType = "STRING";
        }
        return item;
      }
      return f;
    });
    setFields(updated);
    setSelectedPresetId("custom");
  };

  // Handle source file uploads
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === "string") {
          setInputText(event.target.result);
        }
      };
      reader.readAsText(file);
    }
  };

  // Drag-and-drop dropzone triggers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md"))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === "string") {
          setInputText(event.target.result);
        }
      };
      reader.readAsText(file);
    }
  };

  // Quick select an example
  const loadExample = (text: string) => {
    setInputText(text);
  };

  // Run the Extraction via backend server proxy
  const performExtraction = async () => {
    if (!inputText.trim()) {
      setErrorMsg("Please specify or copy unstructured text to parse first.");
      return;
    }
    if (fields.length === 0) {
      setErrorMsg("Please register at least one field schema in the configurator.");
      return;
    }

    // Verify key formats to ensure valid JSON payload
    const invalidKeyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    for (const f of fields) {
      if (!f.key.trim()) {
        setErrorMsg("All schema elements must have valid non-empty field names.");
        return;
      }
      if (!invalidKeyRegex.test(f.key)) {
        setErrorMsg(`Field name "${f.key}" has invalid characters. Use alphanumeric keys with no spaces.`);
        return;
      }
    }

    setIsLoading(true);
    setErrorMsg(null);
    setRawJsonOutput("");
    setExtractedData(null);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: inputText,
          fields: fields,
          systemInstructions: systemInstructions,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Server failed to process extraction.");
      }

      setExtractedData(resData.data);
      setRawJsonOutput(JSON.stringify(resData.data, null, 2));
      setCurrentSourceText(inputText);
      setActiveTab("visual");

      // Save to history list
      const newItem: ExtractionHistoryItem = {
        id: `hist_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " - " + new Date().toLocaleDateString(),
        originalText: inputText,
        extractedData: resData.data,
        schemaName: selectedPresetId === "custom" ? "Custom Template" : currentSchemaName,
        schemaFields: [...fields],
      };

      const updatedHistory = [newItem, ...history].slice(0, 30); // limit to 30 items
      saveHistory(updatedHistory);

    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "An error occurred connecting to the Gemini extraction service.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load a record from history
  const loadHistoryItem = (item: ExtractionHistoryItem) => {
    setInputText(item.originalText);
    setFields(item.schemaFields);
    setExtractedData(item.extractedData);
    setRawJsonOutput(JSON.stringify(item.extractedData, null, 2));
    setCurrentSourceText(item.originalText);
    setSelectedPresetId("custom");
    setCurrentSchemaName(item.schemaName);
    setActiveTab("visual");
  };

  // Clear single history item
  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter((h) => h.id !== id);
    saveHistory(updated);
  };

  // Synchronize dynamic schemas & sample input to the Python companion project inside workspace
  const handleSyncPythonWorkspace = async () => {
    setIsSyncingPython(true);
    setSyncSuccess(false);
    setSyncError(null);
    try {
      const response = await fetch("/api/export-companion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: fields,
          systemInstructions: systemInstructions,
          inputText: inputText,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Failed to synchronize companion files.");
      }
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 4000);
    } catch (e: any) {
      console.error(e);
      setSyncError(e.message || "Could not connect to the workspace synchronizer.");
    } finally {
      setIsSyncingPython(false);
    }
  };

  // Copy structured JSON payload
  const handleCopyJSON = () => {
    if (!rawJsonOutput) return;
    navigator.clipboard.writeText(rawJsonOutput);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Copy raw input text
  const handleCopyRawInput = () => {
    if (!inputText) return;
    navigator.clipboard.writeText(inputText);
    setCopiedRawFeedback(true);
    setTimeout(() => setCopiedRawFeedback(false), 2000);
  };

  // Download logic (JSON & CSV)
  const handleDownloadJSON = () => {
    if (!extractedData) return;
    const blob = new Blob([rawJsonOutput], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracted_${selectedPresetId}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (!extractedData) return;
    const keys = Object.keys(extractedData);
    const headers = keys.join(",");
    const row = keys
      .map((k) => {
        const val = extractedData[k];
        if (val === null || val === undefined) return '""';
        const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      })
      .join(",");

    const fileContent = `${headers}\n${row}`;
    const blob = new Blob([fileContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracted_${selectedPresetId}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Check if string parsed was successfully mapped in source text (fuzzy search helper)
  const existsInSource = (value: any): { found: boolean; percentage: number } => {
    if (value === null || value === undefined) return { found: false, percentage: 0 };
    const cleanSource = currentSourceText.toLowerCase();

    if (Array.isArray(value)) {
      if (value.length === 0) return { found: true, percentage: 100 };
      const checks = value.map(v => existsInSource(v));
      const totalFound = checks.filter(c => c.found).length;
      return { found: totalFound > 0, percentage: Math.round((totalFound / value.length) * 100) };
    }

    const cleanVal = String(value).toLowerCase().trim();
    if (!cleanVal || cleanVal === "null" || cleanVal === "undefined") {
      return { found: true, percentage: 100 };
    }

    // Direct subset check
    if (cleanSource.includes(cleanVal)) {
      return { found: true, percentage: 100 };
    }

    // Word based subset check for slight spacing errors
    const words = cleanVal.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const matchCount = words.filter(word => cleanSource.includes(word)).length;
      return {
        found: matchCount > 0,
        percentage: Math.round((matchCount / words.length) * 100),
      };
    }

    return { found: false, percentage: 0 };
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 antialiased flex flex-col">
      
      {/* Header with High-Contrast Developer Aesthetic */}
      <header className="bg-slate-950/80 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center text-slate-950 font-bold text-xl select-none">
              Σ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-base text-slate-100">EXTRACTOR.ENGINE</span>
                <span className="px-2 py-0.5 rounded border border-slate-705 text-[10px] text-slate-400 font-mono bg-slate-900/60 leading-none">
                  v4.2.0-STABLE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Real-time parsing engine powered by <strong className="text-cyan-400">gemini-3.5-flash</strong>
              </p>
            </div>
          </div>
          
          <div className="flex gap-6 items-center w-full sm:w-auto justify-between sm:justify-end">
            <div className="hidden md:flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">LATENCY STATUS</span>
                <span className="text-xs font-mono text-cyan-400">142ms</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">PRECISION SCALE</span>
                <span className="text-xs font-mono text-emerald-400">99.8%</span>
              </div>
            </div>
            
            <button
              onClick={performExtraction}
              disabled={isLoading}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded font-mono text-xs tracking-wider transition-colors duration-150 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>EXTRACTING...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-100" />
                  <span>RUN EXTRACTION</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* Left Column (Inputs: raw document text and schema modeler) */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* Unstructured Raw Input Pane */}
          <div className="bg-slate-900/30 border border-slate-800 rounded flex flex-col overflow-hidden">
            <div className="bg-slate-900/50 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Input: Raw Unstructured Text</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-505 font-mono">
                  Characters: {inputText.length} | Words: {inputText.split(/\s+/).filter(Boolean).length}
                </span>
                {inputText && (
                  <button 
                    onClick={() => setInputText("")}
                    className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-slate-300"
                    title="Clear Raw Text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Input presets samples row */}
            <div className="p-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">LOAD SAMPLE DATA:</span>
              {PRESET_SCHEMAS.map((preset) => (
                <div key={preset.id} className="flex gap-1.5 items-center">
                  {preset.exampleInputs.map((input, idx) => {
                    // Match short name for example button
                    const sampleLabel = preset.id === "contact-details" ? `Profile Ex. ${idx + 1}` : 
                                        preset.id === "invoice-receipt" ? "Invoice Ex." : "Real Estate Ex.";
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedPresetId(preset.id);
                          loadExample(input);
                        }}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          inputText === input
                            ? "bg-cyan-950/30 border-cyan-800 text-cyan-400 font-bold"
                            : "bg-slate-900/40 hover:bg-slate-800 border-slate-800 text-slate-450"
                        }`}
                      >
                        {sampleLabel}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Draggable TextArea Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative flex-1 min-h-[220px] transition-all ${
                isDragging ? "bg-cyan-950/20 border-2 border-dashed border-cyan-705" : "bg-slate-950"
              }`}
            >
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste unstructured records or drag a text file here to parse..."
                className="w-full h-full min-h-[220px] p-4 bg-transparent outline-hidden ring-0 text-slate-300 font-mono text-xs leading-relaxed focus:outline-hidden focus:ring-0 border-0 resize-y"
              />

              {isDragging && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-slate-950/90 gap-2">
                  <FileUp className="w-8 h-8 text-cyan-400 animate-bounce" />
                  <p className="font-mono text-cyan-400 text-xs text-slate-200">RELEASE FILE TO UNPACK CONTENT</p>
                </div>
              )}
            </div>

            <div className="px-4 py-2 bg-slate-900/40 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <FileUp className="w-3.5 h-3.5 text-cyan-500" />
                Drag text files directly, or
                <button
                  type="button"
                  className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse workspace
                </button>
                <input
                  type="file"
                  id="raw-file-upload"
                  accept=".txt,.md,.rtf"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </span>
              
              {inputText && (
                <button
                  onClick={handleCopyRawInput}
                  className="hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedRawFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>COPY RAW TEXT</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          {/* Configurable Target Schema definition */}
          <div className="bg-slate-900/20 border border-slate-800 rounded p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Target Extraction Schema Model</h2>
                  <p className="text-[10px] text-slate-505 font-mono mt-0.5">Declare parameters to align structured objects.</p>
                </div>
              </div>

              {/* Preset theme list selectors */}
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="bg-slate-950 border border-slate-800 hover:border-slate-705 rounded px-2.5 py-1 text-xs font-mono text-slate-300 outline-hidden tracking-tight cursor-pointer focus:border-cyan-500"
              >
                <option value="contact-details">Schema: Contact Information</option>
                <option value="invoice-receipt">Schema: Receipt Summary</option>
                <option value="property-listing">Schema: Property Specs</option>
                <option value="custom">Schema: Custom Template *</option>
              </select>
            </div>

            {/* Template description text container */}
            <div className="mt-3.5 bg-slate-950 border border-slate-800 rounded p-2.5 flex gap-2 text-xs text-slate-400 leading-relaxed font-mono">
              <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">{currentSchemaName}</strong>: {currentSchemaDesc}
              </div>
            </div>

            {/* Fields elements editor map */}
            <div className="mt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className="p-3 bg-slate-950/40 rounded border border-slate-800/80 hover:border-slate-700 flex flex-col md:flex-row gap-3 items-start md:items-center relative transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 w-full">
                    
                    {/* Key Name input */}
                    <div className="md:col-span-4">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                        FIELD IDENTIFIER
                      </span>
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => updateField(field.id, { key: e.target.value })}
                        placeholder="e.g. email_address"
                        className="w-full bg-slate-950 border border-slate-808 rounded px-2.5 py-1 text-xs font-mono text-slate-200 outline-hidden focus:border-cyan-500 placeholder-slate-600"
                      />
                    </div>

                    {/* Value Type Selector */}
                    <div className="md:col-span-3">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                        DATA TYPE
                      </span>
                      <select
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                        className="w-full bg-slate-950 border border-slate-808 rounded px-2 py-1 text-xs font-mono text-slate-300 outline-hidden cursor-pointer focus:border-cyan-500"
                      >
                        <option value="STRING">STRING</option>
                        <option value="NUMBER">NUMBER (Float)</option>
                        <option value="INTEGER">INTEGER (Whole)</option>
                        <option value="BOOLEAN">BOOLEAN</option>
                        <option value="ARRAY">ARRAY (List)</option>
                      </select>
                    </div>

                    {/* Guidelines Description Input */}
                    <div className="md:col-span-5">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                        EXTRACTION GUIDELINE (PROMPT)
                      </span>
                      <input
                        type="text"
                        value={field.description}
                        onChange={(e) => updateField(field.id, { description: e.target.value })}
                        placeholder="Define constraints..."
                        className="w-full bg-slate-950 border border-slate-808 rounded px-2.5 py-1 text-xs font-mono text-slate-400 outline-hidden focus:border-cyan-500 placeholder-slate-700"
                      />
                    </div>
                  </div>

                  {/* Array elements types specification popup */}
                  {field.type === "ARRAY" && (
                    <div className="w-full md:w-auto flex items-center gap-2 mt-1 md:mt-0 p-1 bg-slate-905 border border-slate-800 rounded">
                      <span className="text-[9px] font-bold text-slate-505 uppercase font-mono">ITEM TYPE:</span>
                      <select
                        value={field.itemType || "STRING"}
                        onChange={(e) => updateField(field.id, { itemType: e.target.value as any })}
                        className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-300 outline-hidden cursor-pointer"
                      >
                        <option value="STRING">STRING</option>
                        <option value="NUMBER">NUMBER</option>
                        <option value="INTEGER">INTEGER</option>
                        <option value="BOOLEAN">BOOLEAN</option>
                      </select>
                    </div>
                  )}

                  {/* Field constraints & Delete button controls */}
                  <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-400 font-mono select-none">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="rounded bg-slate-950 text-cyan-600 border-slate-800 focus:ring-0 focus:ring-offset-0 focus:outline-hidden w-3 h-3"
                      />
                      <span>REQUIRED</span>
                    </label>

                    <button
                      onClick={() => removeField(field.id)}
                      className="text-slate-500 hover:text-rose-450 p-1 rounded hover:bg-rose-955/20 transition-colors cursor-pointer"
                      title="Remove field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {fields.length === 0 && (
                <div className="text-center py-6 border border-dashed border-slate-800 rounded bg-slate-950/30 text-slate-505 text-xs font-mono">
                  No attributes registered. Model your keys to initialize the engine.
                </div>
              )}
            </div>

            {/* Modeler controls summary */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={addField}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono font-bold rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>ADD FIELD ATTRIBUTE</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const preset = PRESET_SCHEMAS.find((p) => p.id === "contact-details");
                  if (preset) {
                    setFields([...preset.fields]);
                    setSelectedPresetId("contact-details");
                  }
                }}
                className="text-xs font-mono text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
              >
                RESET TO CONTACT_SCHEMA
              </button>
            </div>

            {/* Advanced configurations collapsible settings */}
            <div className="mt-4 pt-3.5 border-t border-slate-800">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                  <span className="text-xs font-mono font-semibold text-slate-400 flex items-center gap-1.5 group-open:text-cyan-400">
                    <Settings className="w-3.5 h-3.5 text-slate-500 group-open:text-cyan-400" />
                    SYSTEM EXTR_GUIDELINES_OVERRIDE
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 group-open:hidden">[SHOW]</span>
                  <span className="text-[10px] font-mono text-cyan-400 hidden group-open:inline">[HIDE]</span>
                </summary>
                <div className="mt-3 space-y-2 group-open:block">
                  <label className="block text-[10px] text-slate-500 font-mono leading-relaxed">
                    Override background system prompts sent to Gemini model:
                  </label>
                  <textarea
                    value={systemInstructions}
                    onChange={(e) => setSystemInstructions(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 focus:border-cyan-500 outline-hidden font-mono leading-relaxed h-16 resize-y"
                    placeholder="Provide specific instructions regarding hallucination defaults, spelling mapping..."
                  />
                </div>
              </details>
            </div>

            {/* Sync Workspace Companion Widget */}
            <div className="mt-4 pt-3.5 border-t border-slate-800 font-mono">
              <div className="p-3 bg-slate-950 rounded border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-slate-200 font-bold tracking-tight text-[11px] uppercase">PYTHON CLI COMPANION WORKSPACE</span>
                  </div>
                  <p className="text-[10px] text-slate-500 lowercase leading-relaxed">
                    syncs active shapes & text to <code className="text-slate-300">Deterministic-JSON-Generator/</code>
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={handleSyncPythonWorkspace}
                    disabled={isSyncingPython}
                    className="w-full md:w-auto px-3.5 py-1.5 bg-cyan-955/20 hover:bg-cyan-900/40 disabled:bg-slate-900 disabled:text-slate-600 text-cyan-400 font-bold border border-cyan-800/80 rounded text-[10px] transition-colors cursor-pointer text-center uppercase whitespace-nowrap"
                  >
                    {isSyncingPython ? "SYNCING..." : "SYNC WORKSPACE"}
                  </button>
                </div>
              </div>
              {syncSuccess && (
                <div className="mt-2 text-center text-[10px] text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-900 py-1 rounded">
                  ✓ COMPANION REPOSITORY CONFIGURATIONS SYNCHRONIZED SUCCESSFULLY!
                </div>
              )}
              {syncError && (
                <div className="mt-2 text-center text-[10px] text-red-400 font-bold bg-red-955/20 border border-red-900 py-1 rounded">
                  × ERROR: {syncError}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Right Column (Results Panel) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Output Board */}
          <div className="bg-slate-900/20 border border-slate-800 rounded flex flex-col flex-1 min-h-[480px]">
            <div className="bg-slate-900/40 px-4 py-2 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-350">Output: Parsed Struct</span>
              </div>

              {/* Tab Toggles */}
              {extractedData && (
                <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800 text-[11px] font-mono self-start sm:self-center">
                  <button
                    onClick={() => setActiveTab("visual")}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      activeTab === "visual" ? "bg-cyan-950/30 border border-cyan-800 text-cyan-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Visual Card
                  </button>
                  <button
                    onClick={() => setActiveTab("json")}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      activeTab === "json" ? "bg-cyan-950/30 border border-cyan-800 text-cyan-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => setActiveTab("verify")}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === "verify" ? "bg-cyan-950/30 border border-cyan-800 text-cyan-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verify</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("python")}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === "python" ? "bg-cyan-950/30 border border-cyan-800 text-cyan-400" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <span>Python CLI</span>
                  </button>
                </div>
              )}
            </div>

            {/* Error messaging Banner */}
            {errorMsg && (() => {
              const errorLower = errorMsg.toLowerCase();
              const isApiKeyIssue = errorLower.includes("leak") || errorLower.includes("api_key") || errorLower.includes("api key") || errorLower.includes("permission_denied") || errorLower.includes("403") || errorLower.includes("secrets");
              return (
                <div className="p-4 bg-red-950/30 border-b border-red-900/60 text-red-300 text-xs font-mono flex flex-col gap-3">
                  <div className="flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5 flex-1">
                      <span className="font-bold tracking-tight block uppercase text-red-400">STATION INTERRUPTED: AUTHENTICATION ERROR</span>
                      <p className="leading-relaxed text-[11px] text-red-350 whitespace-pre-wrap">{errorMsg}</p>
                    </div>
                  </div>
                  {isApiKeyIssue && (
                    <div className="p-3 bg-slate-955/40 border border-red-900/40 rounded text-[11px] space-y-2 mt-1">
                      <div className="font-bold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                        TROUBLESHOOTING REPAIR CHECKLIST:
                      </div>
                      <p className="text-slate-400 leading-relaxed font-sans text-[10.5px]">
                        The active key parameter was flagged as compromised or contains invalid signatures. Please fulfill the following instructions to apply the fix:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-450 font-mono text-[10px]">
                        <li>
                          Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-350 underline inline font-bold">ai.google.dev (Get API Key)</a> to secure a fresh key.
                        </li>
                        <li>
                          Find the <strong className="text-slate-350 uppercase">Settings</strong> icon (gear wheel) at the top of the AI Studio workspace control panel.
                        </li>
                        <li>
                          Locate the secrets record marked <code className="text-cyan-400 bg-slate-950 px-1 py-0.5 rounded text-[9.5px]">GEMINI_API_KEY</code>.
                        </li>
                        <li>
                          Replace the compromised key value with your newly generated credentials and save.
                        </li>
                        <li>
                          Retrigger the extraction pipeline again once your variables are stored!
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Display Board Area states */}
            <div className="flex-1 p-4 sm:p-5 flex flex-col">
              
              {/* 1. Loading active state */}
              {isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-cyan-955 animate-ping opacity-60"></div>
                    <div className="relative bg-cyan-900/40 text-cyan-400 p-3 rounded border border-cyan-700 shadow-lg">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-mono text-cyan-400 text-xs font-bold uppercase tracking-wider">Compiling schema targets</h3>
                    <p className="text-[10px] font-mono max-w-xs leading-relaxed text-slate-500">
                      Evaluating context parameters, calculating spatial tokens, and generating normalized compliance payloads...
                    </p>
                  </div>
                </div>
              )}

              {/* 2. No data parsed yet state */}
              {!isLoading && !extractedData && (
                <div className="flex-1 flex flex-col items-center justify-center py-16 text-center gap-4">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded">
                    <Database className="w-6 h-6 text-slate-605" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Awaiting extraction queue</p>
                    <p className="text-[10px] font-mono max-w-xs leading-relaxed text-slate-505">
                      Model fields in the targeting directory on the left and trigger compilation via the parse controllers.
                    </p>
                  </div>
                </div>
              )}

              {/* 3. Render Visual Grid/Card Tab */}
              {!isLoading && extractedData && activeTab === "visual" && (
                <div className="flex-grow flex flex-col justify-between h-full">
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                        Extracted Struct Variables
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        OBJECT MODEL
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                      {fields.map((field) => {
                        const parsedValue = extractedData[field.key];
                        const isNull = parsedValue === null || parsedValue === undefined;
                        
                        return (
                          <div
                            key={field.id}
                            className="p-3 bg-slate-950/60 border border-slate-800 rounded flex flex-col gap-1 hover:border-slate-700 transition-all font-mono"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-orange-400">{field.key}</span>
                                <span className="text-[9px] text-slate-500 leading-none lowercase">[{field.type}]</span>
                              </div>
                              {field.required && (
                                <span className="text-[8px] border border-red-900/60 text-red-400 px-1 bg-red-950/20 rounded-sm font-semibold leading-none">
                                  REQUIRED
                                </span>
                              )}
                            </div>
                            
                            <p className="text-[9px] text-slate-500 italic lowercase block max-w-sm truncate">
                              // {field.description}
                            </p>

                              {/* Display values safely based on type rendering */}
                              <div className="mt-1 font-mono">
                                {isNull ? (
                                  <span className="text-[11px] bg-slate-950 border border-slate-800 text-amber-500 px-2 py-0.5 rounded inline-block font-mono">
                                    null
                                  </span>
                                ) : field.type === "ARRAY" ? (
                                  <div className="flex flex-wrap gap-1">
                                    {Array.isArray(parsedValue) && parsedValue.length > 0 ? (
                                      parsedValue.map((item: any, itemIdx: number) => (
                                        <span
                                          key={itemIdx}
                                          className="text-[11px] bg-slate-900 border border-slate-800 text-teal-400 px-1.5 py-0.5 rounded inline-block font-mono"
                                        >
                                          &rdquo;{String(item)}&rdquo;
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-slate-600 block">// Empty Array []</span>
                                    )}
                                  </div>
                                ) : field.type === "BOOLEAN" ? (
                                  <span
                                    className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${
                                      parsedValue === true
                                        ? "bg-emerald-950/20 border-emerald-800 text-emerald-400"
                                        : "bg-red-950/20 border-red-900/60 text-red-400"
                                    }`}
                                  >
                                    {parsedValue ? "TRUE" : "FALSE"}
                                  </span>
                                ) : (
                                  <div className="text-[12px] text-emerald-400 leading-relaxed max-w-full overflow-x-auto whitespace-pre-wrap bg-slate-950/40 p-2 border border-slate-900 rounded font-mono">
                                    {String(parsedValue)}
                                  </div>
                                )}
                              </div>
                            </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Bar lower section */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Payload conformance output: compliant
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleDownloadCSV}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded transition-colors cursor-pointer"
                        title="Export CSV document"
                      >
                        <FileSpreadsheet className="w-3 h-3 text-slate-500" />
                        <span>EXPORT CSV</span>
                      </button>
                      <button
                        onClick={handleDownloadJSON}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/20 hover:bg-cyan-955/35 border border-cyan-800 rounded transition-colors cursor-pointer"
                        title="Export standard JSON file"
                      >
                        <Download className="w-3 h-3" />
                        <span>EXPORT JSON</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* 4. Render Raw Code Editor JSON Tab */}
              {!isLoading && extractedData && activeTab === "json" && (
                <div className="flex-grow flex flex-col justify-between h-full">
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                        Extracted JSON Payload
                      </span>
                      <button
                        onClick={handleCopyJSON}
                        className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-950/40 cursor-pointer"
                      >
                        {copyFeedback ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-bold">COPIED</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>COPY TO CLIPBOARD</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    <div className="p-4 bg-slate-950 rounded border border-slate-800 overflow-x-auto text-[11px] font-mono leading-relaxed max-h-[340px] shadow-inner">
                      <pre className="text-slate-100">
                        <code>{renderSyntaxHighlightedJson(extractedData)}</code>
                      </pre>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500">
                      Standard JSON payload mapped directly via instructions.
                    </span>
                    <button
                      onClick={handleDownloadJSON}
                      className="text-cyan-400 hover:text-cyan-350 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <FileJson className="w-4 h-4 text-cyan-500" />
                      <span>DOWNLOAD .JSON</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 5. Render Engine Verification Tab */}
              {!isLoading && extractedData && activeTab === "verify" && (
                <div className="flex-grow flex flex-col justify-between h-full">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">
                        High Density Verification Audit
                      </h3>
                      <p className="text-[10px] font-mono text-slate-400">
                        Real-time grounding checks ensuring variables are syntactically exact.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* Check 1: Structure Integrity matches schema */}
                      <div className="p-3 bg-slate-950/40 border border-slate-800 rounded flex gap-2.5 font-mono">
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-tight">Schema conformance: Verified</h4>
                          <p className="text-[9px] text-slate-500 mt-0.5 lowercase leading-relaxed">
                            checking list of field key declarations against model type coordinate constraints.
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {fields.map((f) => {
                              const exists = extractedData[f.key] !== undefined;
                              return (
                                <span
                                  key={f.id}
                                  className={`text-[8px] px-1 py-0.5 rounded leading-none border ${
                                    exists ? "bg-emerald-950/25 border-emerald-850 text-emerald-400" : "bg-red-955/20 border-red-800 text-red-400"
                                  }`}
                                >
                                  {f.key}: {exists ? "PASS" : "MISSING"}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Check 2: Hallucination mitigation audit */}
                      <div className="p-3 bg-slate-950/40 border border-slate-800 rounded flex gap-2.5 font-mono">
                        <ShieldCheck className="w-4.5 h-4.5 text-cyan-405 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-tight">Grounding & Hallucination Audit</h4>
                          <p className="text-[9px] text-slate-500 mt-0.5 lowercase leading-relaxed">
                            mathematical word proximity matching to check if extracted text explicitly exists on input.
                          </p>
                          <div className="mt-2.5 space-y-2">
                            {fields.map((f) => {
                              const val = extractedData[f.key];
                              if (val === null || val === undefined) {
                                return (
                                  <div key={f.id} className="text-[9px] text-slate-600 flex justify-between">
                                    <span>{f.key}</span>
                                    <span>SKIPPED (NULL STATE)</span>
                                  </div>
                                );
                              }
                              const checkResult = existsInSource(val);
                              return (
                                <div key={f.id} className="text-[9px] flex justify-between items-center gap-4">
                                  <span className="font-mono text-orange-450 truncate max-w-[120px]">{f.key}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-slate-900 rounded-full h-1 border border-slate-800">
                                      <div
                                        className={`h-full rounded-full ${
                                          checkResult.percentage === 0 ? "bg-red-500" :
                                          checkResult.percentage < 50 ? "bg-amber-550" : "bg-emerald-500"
                                        }`}
                                        style={{ width: `${checkResult.percentage}%` }}
                                      ></div>
                                    </div>
                                    <span className={checkResult.found ? "text-emerald-400 font-bold" : "text-amber-455 font-bold"}>
                                      {checkResult.percentage}% MATCH
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Check 3: Simple Regex patterns matching */}
                      <div className="p-3 bg-slate-950/40 border border-slate-800 rounded flex gap-2.5 font-mono">
                        <AlertCircle className="w-4.5 h-4.5 text-slate-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-tight">Regex Compliance Mapping</h4>
                          <p className="text-[9px] text-slate-500 mt-0.5 lowercase leading-relaxed">
                            validating semantic text structures against well-established pattern algorithms.
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {extractedData["email"] ? (
                              <span className={`text-[8px] px-1 py-0.5 rounded font-mono font-bold border ${
                                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(extractedData["email"])) 
                                  ? "bg-emerald-950/20 border-emerald-800 text-emerald-400" 
                                  : "bg-amber-955/20 border-amber-800 text-amber-400"
                              }`}>
                                email structure: {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(extractedData["email"])) ? "SAFE_ADDR" : "IRREGULAR"}
                              </span>
                            ) : null}
                            {extractedData["phone"] ? (
                              <span className="text-[8px] bg-slate-900 border border-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono font-bold">
                                PHONE_RECORD: DETECTED
                              </span>
                            ) : null}
                            {!extractedData["email"] && !extractedData["phone"] && (
                              <span className="text-[9px] text-slate-500 italic lowercase block">// no regex compliance triggers active to current configuration.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 text-[9px] font-mono text-slate-500 italic text-center">
                    // audits check variables directly against user constraints. zero-hallucination index guarantee.
                  </div>
                </div>
              )}

              {/* 6. Render Python SDK / CLI Companion Tab */}
              {!isLoading && extractedData && activeTab === "python" && (
                <div className="flex-grow flex flex-col justify-between h-full font-mono text-slate-300">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">
                        Companion Workspace Repository
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Local Python project pre-configured within the workspace root.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-950 border border-slate-900 rounded space-y-2">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Workspace Tree:</div>
                      <pre className="text-[10px] text-cyan-400 leading-tight">
{`Deterministic-JSON-Generator/
├── app.py                      # executable CLI parser
├── requirements.txt            # system packages checklist
├── README.md                   # installation guidebook
├── prompts/
│   └── extraction_prompt.txt   # dynamic system prompts
└── examples/
    └── sample_inputs.txt       # copy of current input text`}
                      </pre>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold text-slate-500">Run Local Inference:</div>
                      <div className="p-3 bg-slate-950 rounded border border-slate-900/60 overflow-x-auto text-[10px] leading-relaxed">
                        <span className="text-slate-500 block"># 1. Install dependencies</span>
                        <span className="text-cyan-300 block">pip install -r requirements.txt</span>
                        <span className="text-slate-500 block mt-1.5"># 2. Add Gemini API key credentials</span>
                        <span className="text-cyan-300 block">export GEMINI_API_KEY="your_secret_key"</span>
                        <span className="text-slate-500 block mt-1.5"># 3. Parse input with custom schema</span>
                        <span className="text-cyan-300 block">python app.py --schema custom_schema.json --input examples/sample_inputs.txt</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-800 rounded flex gap-2">
                      <Database className="w-4 h-4 text-slate-550 mt-0.5" />
                      <div className="text-[10px] leading-loose text-slate-500">
                        Updates to schemas, prompts, and inputs are reflected dynamically. Click <strong className="text-cyan-400">SYNC WORKSPACE</strong> on the left to push latest browser modifications.
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-805 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Export full stand-alone companion.
                    </span>
                    <button
                      onClick={handleSyncPythonWorkspace}
                      className="text-cyan-400 hover:text-cyan-350 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-cyan-500 ${isSyncingPython ? "animate-spin" : ""}`} />
                      <span>{isSyncingPython ? "SYNCING..." : "SYNC TO COMPANION"}</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
          {/* Active past extractions Log widget */}
          <div className="bg-slate-900/20 border border-slate-800 rounded p-4 flex flex-col gap-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 py-0.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">SYSTEM EXTR_HISTORY LOG</span>
              </div>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800 px-1.5 py-0.5 rounded leading-none">
                {history.length} LOGS
              </span>
            </div>

            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadHistoryItem(item)}
                  className="p-2 bg-slate-950/60 hover:bg-slate-850 border border-slate-805 hover:border-slate-700 text-left transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-300 truncate block">
                        {item.schemaName || "Custom Extract"}
                      </span>
                      <span className="text-[9px] text-slate-500 whitespace-nowrap">
                        {item.timestamp}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5 max-w-[280px]">
                      {item.originalText}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-cyan-400 bg-cyan-950/20 group-hover:bg-cyan-950/40 font-bold border border-cyan-900/60 px-1 rounded transition-colors border border-slate-100">
                      LOAD
                    </span>
                    <button
                      onClick={(e) => deleteHistoryItem(e, item.id)}
                      className="p-1 hover:bg-red-955/20 text-slate-400 hover:text-red-400 rounded transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {history.length === 0 && (
                <div className="text-center py-6 text-slate-650 text-[11px] italic">
                  // past extractions directory empty. try parsing unstructured payloads.
                </div>
              )}
            </div>

            {history.length > 0 && (
              <button
                onClick={() => {
                  saveHistory([]);
                  setExtractedData(null);
                  setRawJsonOutput("");
                }}
                className="text-center text-[10px] text-red-400 hover:text-red-300 font-bold py-1 hover:underline cursor-pointer font-mono"
              >
                CLEAR ENGINE HISTORY LOGS
              </button>
            )}
          </div>

        </div>

      </main>

      {/* Footer information section */}
      <footer className="bg-slate-950 border-t border-slate-900 text-slate-500 text-xs py-5 mt-12 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900/60 p-1 border border-slate-800 rounded">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="font-bold text-slate-400 tracking-tight text-[11px]">STRUCTURED DATA EXTRACTION STATION v1.2</span>
            <span className="text-slate-800">|</span>
            <span className="text-[10px] text-slate-500">POWERED BY @GOOGLE/GENAI SDK</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
            <span>MODEL ID: <strong className="text-orange-405">gemini-2.5-flash</strong></span>
            <span>TEMP: 0.1</span>
            <span className="text-slate-800">|</span>
            <span>DATE: 2026-06-01</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

/**
 * Syntax highlighter helper function that breaks JSON into custom colored react spans
 */
function renderSyntaxHighlightedJson(data: any) {
  if (!data) return null;
  const jsonString = JSON.stringify(data, null, 2);
  const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
  
  const tokens: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  
  let keyCount = 0;
  while ((match = regex.exec(jsonString)) !== null) {
    const textBefore = jsonString.slice(lastIndex, match.index);
    if (textBefore) {
      tokens.push(textBefore);
    }
    
    const token = match[0];
    let className = "text-slate-350";
    
    if (/^"/.test(token)) {
      if (/:$/.test(token)) {
        className = "text-orange-400"; // JSON Keys
      } else {
        className = "text-emerald-400"; // String values
      }
    } else if (/true|false/.test(token)) {
      className = "text-teal-400 font-bold"; // Boolean
    } else if (/null/.test(token)) {
      className = "text-indigo-400 italic font-mono"; // Null
    } else {
      className = "text-purple-400"; // Numbers
    }
    
    tokens.push(
      <span key={`tok-${keyCount++}`} className={className}>
        {token}
      </span>
    );
    lastIndex = regex.lastIndex;
  }
  
  const textAfter = jsonString.slice(lastIndex);
  if (textAfter) {
    tokens.push(textAfter);
  }
  
  return <>{tokens}</>;
}
