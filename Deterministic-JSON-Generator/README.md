# Deterministic JSON Generator (Python SDK Companion CLI)

An offline-first, highly reproducible companion utility for the **Web Structured Data Extraction Engine** (`EXTRACTOR.ENGINE`). This tool utilizes the official modern Google GenAI SDK (`google-genai`) and dynamic validation models built with Pydantic to parse and map raw, unstructured documents into highly-structured, schema-accurate JSON payloads without hallucinations.

## Key Capabilities

*   **Dynamic Pydantic Schemas**: Constructs robust target validation classes at runtime from flat JSON field descriptions.
*   **Gemini Structured Output Integration**: Enforces structure accuracy directly at the inference level utilizing Gemini's native `"application/json"` response schemas.
*   **0% Hallucination Guidelines**: Pre-configured deterministic options (temperature: 0.1) and verification safety layers.
*   **Built-in & Custom Presets**: Pre-packaged fields for Receipt Summaries, Profile Sheets, and Real Estate Property specs, with support for customizable JSON schema templates.

---

## Workspace Directory Map

```
Deterministic-JSON-Generator/
├── app.py                      # Core Python CLI extractor execution script
├── requirements.txt            # System dependencies manifest file
├── README.md                   # Setup documentation & execution instructions
├── prompts/
│   └── extraction_prompt.txt   # Guiding instructions to limit hallucinations
└── examples/
    └── sample_inputs.txt       # Example records for testing 
```

---

## Setup Instructions

### 1. Requirements & Dependencies
Make sure you have Python 3.9+ installed, and run `pip` to load system dependencies:

```bash
pip install -r requirements.txt
```

### 2. Configure Your Gemini Secret Key
Create a `.env` file in the folder, or export your key directly to your terminal environment variables:

```bash
# Set environment parameter
export GEMINI_API_KEY="your-actual-api-key-here"
```

---

## Commands & Execution Examples

### 1. Default Quick Run

Executing the script without parameter overrides streams standard mock invoices data and transforms it using the built-in `invoice-receipt` schema model:

```bash
python app.py
```

### 2. Extrapolating Contact Information

Provide one of the built-in presets (`contact-details`, `invoice-receipt`, or `property-listing`) and stream customized inputs:

```bash
python app.py --schema contact-details --input examples/sample_inputs.txt
```

### 3. Using fully customizable JSON Schemas

Export your customized schema model from the web generator as a JSON file, and specify its path using `--schema`:

Create a local `custom_schema.json` format file:
```json
[
  {
    "key": "company_name",
    "type": "STRING",
    "description": "The exact legal name of the organization.",
    "required": true
  },
  {
    "key": "employee_count",
    "type": "INTEGER",
    "description": "Total active headcount.",
    "required": false
  }
]
```

Run extraction:
```bash
python app.py --schema custom_schema.json --input raw_company_report.txt --output results.json
```

---

## Command Parameter Specifications

| Flag | Meaning | Direct Fallback / Behavior |
| :--- | :--- | :--- |
| `-i`, `--input` | Input text file to extract | If omitted, reads piped stdin, or falls back to standard example text |
| `-s`, `--schema` | Preset schema ID OR custom json file path | Defaults to built-in Invoice Summary schema |
| `-p`, `--prompt` | System guidelines override string/filepath | Defaults to contents of `prompts/extraction_prompt.txt` |
| `-o`, `--output` | Save location for resulting structured JSON | Prints output directly to terminal console stdout if omitted |
| `-m`, `--model` | Target Gemini model standard ID | Defaults to `gemini-2.5-flash` for stellar cost-to-speed ratios |

---

*Powered by Google AI Studio & Google DeepMind Antigravity Platform.*
