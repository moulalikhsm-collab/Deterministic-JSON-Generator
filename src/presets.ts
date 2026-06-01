import { PresetSchema } from "./types";

export const PRESET_SCHEMAS: PresetSchema[] = [
  {
    id: "contact-details",
    name: "Contact Information",
    description: "Extract core profile and contact details such as name, age, email, phone, and city of residence.",
    fields: [
      {
        id: "c1",
        key: "name",
        type: "STRING",
        description: "The complete name of the person.",
        required: true
      },
      {
        id: "c2",
        key: "age",
        type: "INTEGER",
        description: "The age of the person as an integer.",
        required: false
      },
      {
        id: "c3",
        key: "email",
        type: "STRING",
        description: "The primary email address.",
        required: false
      },
      {
        id: "c4",
        key: "phone",
        type: "STRING",
        description: "The phone, cell, or contact number.",
        required: false
      },
      {
        id: "c5",
        key: "city",
        type: "STRING",
        description: "The city, state, or birthplace where they reside or live.",
        required: false
      }
    ],
    exampleInputs: [
      `John Smith is 25 years old.
He lives in Hyderabad.
Email: johnsmith@gmail.com
Phone: 9876543210`,

      `Sarah Johnson can be reached at
sarah.j@gmail.com.
She currently resides in Bangalore.`,

      `Name: David Lee
Age: 32
Contact Number: 9988776655`
    ]
  },
  {
    id: "invoice-receipt",
    name: "Invoice & Receipt Summary",
    description: "Extract vendor names, receipt coordinates, dates, transaction references, item catalogs, and totals.",
    fields: [
      {
        id: "i1",
        key: "vendorName",
        type: "STRING",
        description: "Name of the merchant or service provider.",
        required: true
      },
      {
        id: "i2",
        key: "invoiceNumber",
        type: "STRING",
        description: "The receipt number, reference ID, or invoice sequence code.",
        required: false
      },
      {
        id: "i3",
        key: "invoiceDate",
        type: "STRING",
        description: "The date of the transaction.",
        required: false
      },
      {
        id: "i4",
        key: "totalAmount",
        type: "NUMBER",
        description: "The final total amount charged including tax.",
        required: true
      },
      {
        id: "i5",
        key: "lineItems",
        type: "ARRAY",
        itemType: "STRING",
        description: "An array of items, products or services listed in the invoice.",
        required: false
      }
    ],
    exampleInputs: [
      `ACME Corp - INVOICE
Invoice ID: #INV-2026-88091
Billing Date: April 14, 2026
---------------------------------
Descriptions:
1. Premium Software Subscription ($150.00)
2. Cloud Storage Add-On ($45.50)
Total due: $195.50. Paid via Visa ending 4011.`
    ]
  },
  {
    id: "property-listing",
    name: "Real Estate Property Listing",
    description: "Extract specification facts like price, home type, bedroom/bathroom structure, size, and amenities.",
    fields: [
      {
        id: "r1",
        key: "propertyType",
        type: "STRING",
        description: "Type of housing (e.g., Duplex, Condo, Studio, Townhouse, Villa).",
        required: true
      },
      {
        id: "r2",
        key: "price",
        type: "INTEGER",
        description: "The asking price of the property in local currency.",
        required: true
      },
      {
        id: "r3",
        key: "bedrooms",
        type: "NUMBER",
        description: "The count of bedroom rooms.",
        required: false
      },
      {
        id: "r4",
        key: "bathrooms",
        type: "NUMBER",
        description: "The count of full or half bathrooms.",
        required: false
      },
      {
        id: "r5",
        key: "squareFeet",
        type: "INTEGER",
        description: "Size area in square feet.",
        required: false
      },
      {
        id: "r6",
        key: "hasGarage",
        type: "BOOLEAN",
        description: "True if the property includes a garage, carport, or parking space.",
        required: false
      }
    ],
    exampleInputs: [
      `GORGEOUS MODERN TOWNHOUSE AVAILABLE NOW!
Listing for $890,000 in Sunnyvale, CA.
This charming property has 3 beds, 2.5 baths, spread over 1540 square feet of hardwood floors. Attached 2-car garage included. Central HVAC, low HOA fees. No pets allowed.`
    ]
  }
];
