import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();
console.log("Gemini key exists:", !!process.env.GEMINI_API_KEY);
console.log("Gemini key length:", process.env.GEMINI_API_KEY?.length || 0);
console.log(
  "Gemini key prefix:",
  process.env.GEMINI_API_KEY?.substring(0, 6) || "NONE"
);

// Initialize the GoogleGenAI client with the direct configuration requested
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is missing");
}

const ai = new GoogleGenAI({
  apiKey,
});

// Convert string types to @google/genai Type enum values
function mapFieldTypeToGenAiType(typeStr: string): Type {
  switch (typeStr.toUpperCase()) {
    case "STRING":
      return Type.STRING;
    case "NUMBER":
      return Type.NUMBER;
    case "INTEGER":
      return Type.INTEGER;
    case "BOOLEAN":
      return Type.BOOLEAN;
    case "ARRAY":
      return Type.ARRAY;
    case "OBJECT":
      return Type.OBJECT;
    default:
      return Type.STRING;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "5mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.post("/api/extract", async (req, res) => {
    try {
      const { text, fields, systemInstructions } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "No input text provided" });
      }

      if (!fields || !Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({ error: "No extraction fields specified" });
      }

      // Ensure API Key exists before calling the client
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is missing. Please set it in Settings > Secrets in the AI Studio panel.");
      }

      // Build the dynamic responseSchema
      const properties: Record<string, any> = {};
      const requiredFields: string[] = [];

      for (const field of fields) {
        if (!field.key) continue;

        const mappedType = mapFieldTypeToGenAiType(field.type);
        
        let schemaDef: any = {
          type: mappedType,
          description: field.description || `The ${field.key} property.`,
        };

        // If field type is ARRAY, we define items behavior
        if (mappedType === Type.ARRAY) {
          const itemTypeStr = field.itemType || "STRING";
          schemaDef.items = {
            type: mapFieldTypeToGenAiType(itemTypeStr),
          };
        }

        properties[field.key] = schemaDef;

        if (field.required) {
          requiredFields.push(field.key);
        }
      }

      const responseSchema = {
        type: Type.OBJECT,
        properties,
        ...(requiredFields.length > 0 ? { required: requiredFields } : {}),
      };

      const systemPrompt = `
        ${systemInstructions || "Extract information from the unstructured text."}
        
        Strict Guidelines:
        1. Extract only information explicitly present in the text.
        2. Do not infer, assume, or hallucinate missing values.
        3. If a field is unavailable, return null or leave empty if permitted.
        4. Maintain exact spelling, capitalization, and original values from the text where appropriate.
        5. Return a valid JSON object matching the requested schema.
      `;

      const promptText = `
        UNSTRUCTURED TEXT TO EXTRACT FROM:
        """
        ${text}
        """

        Please analyze the text above and extract the JSON according to the schema rules.
      `;

      // Call the recommended model 'gemini-2.5-flash' using the global ai client
      const response = await ai.models.generateContent({
        model:"gemini-2.5-flash",
        contents: promptText,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1, // low temperature for precise extraction
        },
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("Received an empty response from the extraction model.");
      }

      // Parse and return coordinates
      const parsedData = JSON.parse(resultText.trim());
      res.json({
        success: true,
        data: parsedData,
        rawResponse: resultText,
      });

    } catch (error: any) {
      console.error("Extraction error:", error);
      
      let errorMsg = "";
      if (error && typeof error === "object") {
        errorMsg = error.message || error.statusText || JSON.stringify(error);
      } else {
        errorMsg = String(error);
      }

      // Check if it's an API Key or leaked configuration issue
      const isLeaked = errorMsg.toLowerCase().includes("leaked") || errorMsg.includes("403") || errorMsg.toLowerCase().includes("permission_denied") || errorMsg.toLowerCase().includes("api key");
      if (isLeaked) {
        errorMsg = `Gemini API Authorization Denied: ${errorMsg}. Your GEMINI_API_KEY is inactive, invalid, or reported as leaked. Please update the key in Settings > Secrets in the top AI Studio panel.`;
      }

      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  });

  app.post("/api/export-companion", async (req, res) => {
    try {
      const { fields, systemInstructions, inputText } = req.body;

      const baseDir = path.join(process.cwd(), "Deterministic-JSON-Generator");
      
      // Ensure target directory layout exists
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      if (!fs.existsSync(path.join(baseDir, "prompts"))) {
        fs.mkdirSync(path.join(baseDir, "prompts"), { recursive: true });
      }
      if (!fs.existsSync(path.join(baseDir, "examples"))) {
        fs.mkdirSync(path.join(baseDir, "examples"), { recursive: true });
      }

      // Write active schemas & configurations
      if (fields) {
        fs.writeFileSync(
          path.join(baseDir, "custom_schema.json"),
          JSON.stringify(fields, null, 2),
          "utf-8"
        );
      }
      if (systemInstructions) {
        fs.writeFileSync(
          path.join(baseDir, "prompts", "extraction_prompt.txt"),
          systemInstructions.trim() + "\n",
          "utf-8"
        );
      }
      if (inputText) {
        fs.writeFileSync(
          path.join(baseDir, "examples", "sample_inputs.txt"),
          inputText.trim() + "\n",
          "utf-8"
        );
      }

      res.status(200).json({
        success: true,
        message: "Successfully synchronized workspace Python companion models & examples.",
      });
    } catch (e: any) {
      console.error("Export-Companion error:", e);
      res.status(500).json({
        success: false,
        error: e.message || "An internal error occurred writing files to the workspace.",
      });
    }
  });

  // Serve static assets or mount Vite in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
