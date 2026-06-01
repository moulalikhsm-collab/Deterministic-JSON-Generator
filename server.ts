import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Lazy-initialized Gemini Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please set it in Settings > Secrets in the AI Studio panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

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

      // Initialize Gemini Client safely
      const ai = getGeminiClient();

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

      // Call the recommended model 'gemini-3.5-flash'
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
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
      res.status(500).json({
        success: false,
        error: error.message || "An internal error occurred during data extraction.",
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
