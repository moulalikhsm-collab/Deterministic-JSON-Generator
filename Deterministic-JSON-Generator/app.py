#!/usr/bin/env python3
"""
STRUCTURED DATA EXTRACTION STATION CLI (Deterministic JSON Generator)
====================================================================
A command-line companion companion for the Web Structured Data Extractor.
Uses the modern Google GenAI Python SDK to parse unstructured source documents 
into highly structured JSON payloads following customized JSON schema specs.

Required Packages:
  pip install google-genai pydantic python-dotenv
"""

import os
import sys
import argparse
import json
from typing import List, Dict, Any, Type, Optional, Union
from pydantic import BaseModel, create_model, Field
from dotenv import load_dotenv

# Load API key configuration
load_dotenv()

# We import the modern google-genai SDK
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("\033[91mError: The 'google-genai' library is missing.\033[0m")
    print("Please install missing dependencies first:")
    print("  pip install google-genai pydantic python-dotenv")
    sys.exit(1)


# Default built-in schema configurations matching client-side presets
DEFAULT_SCHEMAS = {
    "contact-details": [
        {"key": "full_name", "type": "STRING", "description": "The exact full name of the person.", "required": True},
        {"key": "job_title", "type": "STRING", "description": "Company title or professional role.", "required": False},
        {"key": "email", "type": "STRING", "description": "Primary electronic contact address.", "required": False},
        {"key": "phone", "type": "STRING", "description": "Telephone or cellular number details.", "required": False},
        {"key": "languages", "type": "ARRAY", "itemType": "STRING", "description": "Spoken languages stated.", "required": False},
        {"key": "years_experience", "type": "INTEGER", "description": "Number of active industry years.", "required": False}
    ],
    "invoice-receipt": [
        {"key": "invoice_id", "type": "STRING", "description": "Invoice number or unique text string identifier.", "required": True},
        {"key": "issuer", "type": "STRING", "description": "Provider, seller company, or shop name issuing the receipt.", "required": True},
        {"key": "total_due", "type": "NUMBER", "description": "Final total monetary aggregate value due.", "required": True},
        {"key": "tax_amount", "type": "NUMBER", "description": "Allocated tax amount sum.", "required": False},
        {"key": "due_date", "type": "STRING", "description": "Payment expiration threshold date.", "required": False},
        {"key": "items", "type": "ARRAY", "itemType": "STRING", "description": "Names of listed products or services bought.", "required": False}
    ],
    "property-listing": [
        {"key": "address", "type": "STRING", "description": "Full physical location address of the unit.", "required": True},
        {"key": "num_bedrooms", "type": "INTEGER", "description": "Count of bedrooms.", "required": True},
        {"key": "num_bathrooms", "type": "NUMBER", "description": "Count of complete bathrooms.", "required": False},
        {"key": "square_footage", "type": "INTEGER", "description": "Total indoor liveable surface size in square feet.", "required": False},
        {"key": "features", "type": "ARRAY", "itemType": "STRING", "description": "Amenities listed (balcony, multi-zone HVAC, balcony, etc.).", "required": False},
        {"key": "estimated_value", "type": "NUMBER", "description": "Quoted listing worth or price estimate.", "required": False}
    ]
}


def build_dynamic_pydantic_model(fields: List[Dict[str, Any]]) -> Type[BaseModel]:
    """
    Dynamically constructs a Pydantic v2 compatible BaseModel based on client-defined 
    declarations. This acts as the structured target payload layout.
    """
    field_definitions = {}
    
    # Map raw string types to Python validation counterparts
    type_mapping = {
        "STRING": str,
        "NUMBER": float,
        "INTEGER": int,
        "BOOLEAN": bool
    }
    
    for f in fields:
        field_key = f.get("key")
        field_type_str = f.get("type", "STRING")
        field_required = f.get("required", False)
        field_desc = f.get("description", "")
        
        if not field_key:
            continue
            
        # Determine Python base type
        if field_type_str == "ARRAY":
            array_item_str = f.get("itemType", "STRING")
            item_type = type_mapping.get(array_item_str, str)
            base_type = List[item_type]
        else:
            base_type = type_mapping.get(field_type_str, str)
            
        # Pydantic v2 metadata definition
        if field_required:
            # Field is mandatory, no fallback value
            field_def = (base_type, Field(description=field_desc))
        else:
            # Field is optional, fallback can be None
            field_def = (Optional[base_type], Field(default=None, description=field_desc))
            
        field_definitions[field_key] = field_def
        
    # Construct model using create_model
    return create_model("DynamicSchemaTarget", **field_definitions)


def extract_structured_data(
    unstructured_text: str, 
    fields_schema: List[Dict[str, Any]], 
    system_instruction: str,
    model_name: str = "gemini-2.5-flash"
) -> Dict[str, Any]:
    """
    Initializes standard Google GenAI client and executes Gemini structured completion call.
    """
    # Initialize connection using standard environment parameters (GEMINI_API_KEY)
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\033[91mError: GEMINI_API_KEY environment variable is not defined.\033[0m")
        print("Set it using: export GEMINI_API_KEY='your_api_key'")
        print("Or write a '.env' file containing: GEMINI_API_KEY=your_api_key in this directory.")
        sys.exit(1)
        
    client = genai.Client(api_key=api_key)
    
    # Compile schema structure class dynamically via Pydantic
    pydantic_schema = build_dynamic_pydantic_model(fields_schema)
    
    # Run client inference with response schema format enforced
    response = client.models.generate_content(
        model=model_name,
        contents=unstructured_text,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.1, # Enforce reproducibility
            response_mime_type="application/json",
            response_schema=pydantic_schema,
        )
    )
    
    # Safely load the returned structured output
    try:
        return json.loads(response.text)
    except json.JSONDecodeError:
        # Fallback to display string in case of extreme format issues
        return {"raw_response": response.text}


def main():
    parser = argparse.ArgumentParser(
         description="Structured Logic Extractor utilizing Gemini GenAI platform and Pydantic validation schemas."
    )
    parser.add_argument(
        "-i", "--input", 
        help="Path to file containing raw unstructured inputs. If omitted, takes stdin or defaults to presets."
    )
    parser.add_argument(
        "-s", "--schema", 
        help="Path to JSON file containing target schema definition array list. Or preset ID: 'contact-details', 'invoice-receipt', 'property-listing'."
    )
    parser.add_argument(
        "-p", "--prompt", 
        help="Path to file containing guidelines instructions. Or custom text string instructions configuration."
    )
    parser.add_argument(
        "-o", "--output", 
        help="Output location to save returned JSON variables. Standard out if missing."
    )
    parser.add_argument(
        "-m", "--model", 
        default="gemini-2.5-flash", 
        help="Google Gemini model identifier (default: gemini-2.5-flash)"
    )

    args = parser.parse_args()

    # 1. Gather guidelines Instructions
    system_instructions = (
        "Extract only information explicitly present in the text. Do not infer, assume, or hallucinate missing values. "
        "If a field is unavailable, set it to null. Maintain exact spelling, capitalization, and original values from "
        "the text where appropriate."
    )
    if args.prompt:
        if os.path.exists(args.prompt):
            with open(args.prompt, "r", encoding="utf-8") as f:
                system_instructions = f.read().strip()
        else:
            system_instructions = args.prompt

    # 2. Gather Unstructured Inputs Text Payload
    input_text = ""
    if args.input:
        if os.path.exists(args.input):
            with open(args.input, "r", encoding="utf-8") as f:
                input_text = f.read()
        else:
            print(f"\033[31mError: Target file '{args.input}' not found.\033[0m")
            sys.exit(1)
    else:
        # Check standard input streaming redirection
        if not sys.stdin.isatty():
            input_text = sys.stdin.read()
        else:
            # Default fallback sample load in lack of inputs parameters
            print("\033[36m// No inputs specified. Streaming default sample invoice documents context...\033[0m")
            input_text = (
                "ACME SERVICES CORP.\n"
                "INVOICE #INV-2026-98124\n"
                "Date Issued: June 1, 2026\n"
                "Client: Global Tech Ventures LLC\n"
                "Enterprise Gemini Integration Suite - Qty 1 - Unit Price $12,500.00\n"
                "Subtotal: $12,500.00\n"
                "Tax (8.5%): $1,062.50\n"
                "Total Due: $13,562.50\n"
            )

    # 3. Choose Schema Definition Model structure
    active_fields_schema = DEFAULT_SCHEMAS["invoice-receipt"] # Default model if omitted
    schema_label = "invoice-receipt (built-in)"
    
    if args.schema:
        if args.schema in DEFAULT_SCHEMAS:
            active_fields_schema = DEFAULT_SCHEMAS[args.schema]
            schema_label = f"{args.schema} (built-in)"
        elif os.path.exists(args.schema):
            try:
                with open(args.schema, "r", encoding="utf-8") as fs:
                    active_fields_schema = json.load(fs)
                schema_label = f"Loaded from path: {args.schema}"
            except Exception as ex:
                print(f"\033[31mError: Failed parsing target custom schema file: {ex}\033[0m")
                sys.exit(1)
        else:
            print(f"\033[31mError: Custom schema path or ID '{args.schema}' not available.\033[0m")
            print("Supported values: " + ", ".join(DEFAULT_SCHEMAS.keys()) + " or absolute filepath")
            sys.exit(1)

    # 4. Trigger Structured extraction execution
    print("\033[1m=============================================================\033[0m")
    print(f"\033[1;35m[SYSTEM] Target Schema:\033[0m {schema_label}")
    print(f"\033[1;35m[SYSTEM] Engine Model: \033[0m {args.model}")
    print(f"\033[1;35m[SYSTEM] Running Deterministic Inference pipeline...\033[0m")
    print("\033[1m=============================================================\033[0m")

    try:
        parsed_result = extract_structured_data(
            unstructured_text=input_text,
            fields_schema=active_fields_schema,
            system_instruction=system_instructions,
            model_name=args.model
        )
        
        formatted_json = json.dumps(parsed_result, indent=2)
        
        # Write payload results
        if args.output:
            with open(args.output, "w", encoding="utf-8") as out:
                out.write(formatted_json)
            print(f"\033[1;32m[SUCCESS] Extraction completed. Structured payload written to: {args.output}\033[0m")
        else:
            print("\033[1;32m[COMPLETED] Parsed JSON variables:\033[0m")
            print(formatted_json)
            
    except Exception as e:
        print(f"\033[31m[FAILED] Extraction process terminated with error: {e}\033[0m")
        sys.exit(1)


if __name__ == "__main__":
    main()
