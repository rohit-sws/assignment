# API Documentation - Learning Yogi Timetable System

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Response Format](#response-format)
5. [Endpoints](#endpoints)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [File Upload Constraints](#file-upload-constraints)
10. [LLM Provider Configuration](#llm-provider-configuration)
11. [Advanced Features](#advanced-features)
12. [Usage Examples](#usage-examples)
13. [Best Practices](#best-practices)
14. [Troubleshooting](#troubleshooting)
15. [Performance Considerations](#performance-considerations)

---

## Quick Reference

| Method | Endpoint                | Description                  | Auth Required |
| ------ | ----------------------- | ---------------------------- | ------------- |
| GET    | `/timetables/providers` | Get available LLM providers  | No            |
| POST   | `/timetables/upload`    | Upload and process timetable | No            |
| GET    | `/timetables`           | Get all timetables           | No            |
| GET    | `/timetables/:id`       | Get specific timetable       | No            |
| DELETE | `/timetables/:id`       | Delete timetable             | No            |
| GET    | `/timetables/:id/logs`  | Get processing logs          | No            |
| GET    | `/config`               | Get server configuration     | No            |
| GET    | `/health`               | Health check endpoint        | No            |

---

## Base URL

```
http://localhost:3000/api
```

**Production:** Replace with your production domain (e.g., `https://api.learningyogi.com/api`)

---

## Authentication

### Current Status

Currently, **no authentication is required** for API access. This is suitable for development and demo purposes.

### Production Recommendations

For production deployment, implement one of the following:

#### 1. API Key Authentication

```bash
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/api/timetables
```

#### 2. JWT (JSON Web Tokens)

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:3000/api/timetables
```

#### 3. OAuth 2.0

For third-party integrations and multi-tenant scenarios.

### LLM API Key Handling

- **Server-side Keys**: LLM provider API keys are stored server-side in `.env` file
- **Custom Keys**: Users can optionally provide their own API keys via the `api_key` parameter in upload requests
- **Security**: API keys are never exposed in responses or client-side code

## Response Format

All API responses follow this standard format:

**Success Response:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Error message description",
  "status": 400
}
```

---

## Endpoints

### 1. Get Available LLM Providers

**Endpoint:** `GET /timetables/providers`

**Description:** Returns list of configured LLM providers and their availability status.

**Query Parameters:** None

**Response:**

```json
{
  "success": true,
  "default_provider": "gemini",
  "providers": [
    {
      "name": "openai",
      "displayName": "OpenAI GPT-4",
      "model": "gpt-4-turbo-preview",
      "available": true
    },
    {
      "name": "gemini",
      "displayName": "Google Gemini",
      "model": "gemini-2.5-flash",
      "available": true
    },
    {
      "name": "anthropic",
      "displayName": "Anthropic Claude",
      "model": "claude-3-opus-20240229",
      "available": false
    }
  ]
}
```

**Status Codes:**

- `200 OK` - Success

---

### 2. Upload and Process Timetable

**Endpoint:** `POST /timetables/upload`

**Description:** Upload a timetable file (PDF, DOCX, or Image) and extract schedule data using AI vision/text processing.

**Content-Type:** `multipart/form-data`

**Request Body:**

| Field          | Type    | Required | Description                                                                      |
| -------------- | ------- | -------- | -------------------------------------------------------------------------------- |
| `timetable`    | File    | Yes      | Timetable file (PDF, DOCX, PNG, JPG, JPEG)                                       |
| `llm_provider` | String  | No       | LLM provider to use (`openai`, `gemini`, `anthropic`). Defaults to `gemini`      |
| `api_key`      | String  | No       | Custom API key for the LLM provider. If not provided, uses server-configured key |
| `teacher_id`   | Integer | No       | Teacher ID. If not provided, uses/creates demo teacher                           |

**Example Request (cURL):**

```bash
curl -X POST http://localhost:3000/api/timetables/upload \
  -F "timetable=@/path/to/timetable.png" \
  -F "llm_provider=gemini"
```

**Example Request (JavaScript):**

```javascript
const formData = new FormData();
formData.append("timetable", fileInput.files[0]);
formData.append("llm_provider", "gemini");

const response = await fetch("http://localhost:3000/api/timetables/upload", {
  method: "POST",
  body: formData,
});

const data = await response.json();
```

**Success Response (201 Created):**

```json
{
  "success": true,
  "message": "Timetable uploaded and processed successfully",
  "llm_provider_used": "gemini",
  "data": {
    "timetable_id": 5,
    "file_name": "Teacher Timetable Example 1.1.png",
    "processing_status": "completed",
    "timeblocks": [
      {
        "id": 45,
        "day": "Monday",
        "event_name": "Registration",
        "start_time": "08:35",
        "end_time": "08:50",
        "notes": "Early Morning Work",
        "color_code": null
      },
      {
        "id": 46,
        "day": "Monday",
        "event_name": "RWI",
        "start_time": "09:00",
        "end_time": "09:30",
        "notes": null,
        "color_code": null
      }
      // ... more timeblocks
    ]
  }
}
```

**Error Responses:**

- `400 Bad Request` - No file uploaded or invalid LLM provider

  ```json
  {
    "error": "No file uploaded"
  }
  ```

- `500 Internal Server Error` - Processing failed
  ```json
  {
    "error": "No timeblocks extracted from document. Check server logs for validation details."
  }
  ```

**Processing Notes:**

- Images (PNG, JPG, JPEG) are processed using Vision/Multimodal APIs
- PDFs are processed using Gemini's native PDF support (multimodal) or text extraction for other providers
- DOCX files are converted to text and processed
- Processing may take 10-30 seconds depending on file complexity
- The AI automatically handles:
  - Matrix layouts (column headers define times for all rows)
  - Locked blocks (recurring events like Break, Lunch, Registration)
  - Multiple subjects in one time slot (auto-splits equally)
  - Cell-specific times that override column headers
  - Abbreviated day names (M, Tu, W, Th, F)

---

### 3. Get All Timetables

**Endpoint:** `GET /timetables`

**Description:** Retrieve all uploaded timetables with statistics (timeblock count, days count).

**Query Parameters:**

| Parameter    | Type    | Required | Description                     |
| ------------ | ------- | -------- | ------------------------------- |
| `teacher_id` | Integer | No       | Filter timetables by teacher ID |

**Example Request:**

```bash
# Get all timetables
curl http://localhost:3000/api/timetables

# Get timetables for specific teacher
curl http://localhost:3000/api/timetables?teacher_id=1
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 5,
      "teacher_id": 1,
      "original_filename": "Teacher Timetable Example 1.1.png",
      "file_path": "/uploads/timetable_1733456789123.png",
      "file_type": "image",
      "upload_date": "2025-12-06T01:52:30.000Z",
      "processing_status": "completed",
      "extraction_method": "vision",
      "llm_provider": "gemini",
      "teacher_name": "Demo Teacher",
      "timeblock_count": 59,
      "days_count": 5
    },
    {
      "id": 4,
      "teacher_id": 1,
      "original_filename": "Teacher Timetable Example 4.jpeg",
      "file_path": "/uploads/timetable_1733456123456.jpeg",
      "file_type": "image",
      "upload_date": "2025-12-06T01:35:15.000Z",
      "processing_status": "completed",
      "extraction_method": "vision",
      "llm_provider": "gemini",
      "teacher_name": "Demo Teacher",
      "timeblock_count": 47,
      "days_count": 5
    }
    // ... more timetables
  ]
}
```

**Status Codes:**

- `200 OK` - Success

---

### 4. Get Timetable by ID

**Endpoint:** `GET /timetables/:id`

**Description:** Retrieve a specific timetable with all its timeblocks.

**Path Parameters:**

| Parameter | Type    | Required | Description  |
| --------- | ------- | -------- | ------------ |
| `id`      | Integer | Yes      | Timetable ID |

**Example Request:**

```bash
curl http://localhost:3000/api/timetables/5
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": 5,
    "teacher_id": 1,
    "original_filename": "Teacher Timetable Example 1.1.png",
    "file_path": "/uploads/timetable_1733456789123.png",
    "file_type": "image",
    "upload_date": "2025-12-06T01:52:30.000Z",
    "processing_status": "completed",
    "extraction_method": "vision",
    "raw_extracted_text": "[Processed via Vision/Multimodal API]",
    "teacher_name": "Demo Teacher",
    "teacher_email": "demo@example.com",
    "timeblocks": [
      {
        "id": 45,
        "timetable_id": 5,
        "day_of_week": "Monday",
        "event_name": "Registration and Early Morning Work",
        "start_time": "08:35:00",
        "end_time": "08:50:00",
        "duration_minutes": 15,
        "notes": null,
        "color_code": null,
        "order_index": 0,
        "created_at": "2025-12-06T01:52:35.000Z"
      },
      {
        "id": 46,
        "timetable_id": 5,
        "day_of_week": "Monday",
        "event_name": "RWI",
        "start_time": "09:00:00",
        "end_time": "09:30:00",
        "duration_minutes": 30,
        "notes": null,
        "color_code": null,
        "order_index": 1,
        "created_at": "2025-12-06T01:52:35.000Z"
      }
      // ... more timeblocks (sorted by day and time)
    ]
  }
}
```

**Error Response (404 Not Found):**

```json
{
  "error": "Timetable not found"
}
```

**Status Codes:**

- `200 OK` - Success
- `404 Not Found` - Timetable ID doesn't exist

**Notes:**

- Timeblocks are automatically sorted by day (Monday-Sunday) and start time
- `duration_minutes` is auto-calculated from start and end times

---

### 5. Delete Timetable

**Endpoint:** `DELETE /timetables/:id`

**Description:** Delete a timetable and all associated timeblocks and logs.

**Path Parameters:**

| Parameter | Type    | Required | Description  |
| --------- | ------- | -------- | ------------ |
| `id`      | Integer | Yes      | Timetable ID |

**Example Request:**

```bash
curl -X DELETE http://localhost:3000/api/timetables/5
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Timetable deleted successfully"
}
```

**Status Codes:**

- `200 OK` - Successfully deleted
- `404 Not Found` - Timetable doesn't exist (handled by foreign key constraint)

**Notes:**

- Cascading delete removes all associated timeblocks and processing logs
- File is also deleted from the filesystem

---

### 6. Get Processing Logs

**Endpoint:** `GET /timetables/:id/logs`

**Description:** Retrieve processing logs for a specific timetable (useful for debugging).

**Path Parameters:**

| Parameter | Type    | Required | Description  |
| --------- | ------- | -------- | ------------ |
| `id`      | Integer | Yes      | Timetable ID |

**Example Request:**

```bash
curl http://localhost:3000/api/timetables/5/logs
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "timetable_id": 5,
      "log_level": "info",
      "message": "Timetable processed successfully",
      "details": {
        "llmProvider": "gemini",
        "strategy": "vision",
        "total_events": 59,
        "days_covered": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      },
      "created_at": "2025-12-06T01:52:35.000Z"
    },
    {
      "id": 11,
      "timetable_id": 5,
      "log_level": "info",
      "message": "Starting timetable processing",
      "details": {
        "file_type": "image",
        "extraction_method": "vision"
      },
      "created_at": "2025-12-06T01:52:30.000Z"
    }
  ]
}
```

**Log Levels:**

- `info` - General processing information
- `warning` - Non-critical issues (e.g., some timeblocks filtered out)
- `error` - Processing failures

**Status Codes:**

- `200 OK` - Success

---

## Data Models

### Timetable Object

| Field                | Type      | Description                                    |
| -------------------- | --------- | ---------------------------------------------- |
| `id`                 | Integer   | Unique timetable identifier                    |
| `teacher_id`         | Integer   | Associated teacher ID                          |
| `original_filename`  | String    | Original uploaded filename                     |
| `file_path`          | String    | Server file path                               |
| `file_type`          | Enum      | `pdf`, `docx`, or `image`                      |
| `upload_date`        | Timestamp | Upload timestamp                               |
| `processing_status`  | Enum      | `pending`, `processing`, `completed`, `failed` |
| `extraction_method`  | String    | `vision`, `text`, or `pdf-text`                |
| `raw_extracted_text` | Text      | Raw text extracted (if applicable)             |
| `llm_provider`       | String    | LLM provider used                              |
| `teacher_name`       | String    | Teacher's name (joined)                        |
| `teacher_email`      | String    | Teacher's email (joined)                       |
| `timeblock_count`    | Integer   | Total number of timeblocks (computed)          |
| `days_count`         | Integer   | Number of unique days (computed)               |

### Timeblock Object

| Field              | Type      | Description                                                                  |
| ------------------ | --------- | ---------------------------------------------------------------------------- |
| `id`               | Integer   | Unique timeblock identifier                                                  |
| `timetable_id`     | Integer   | Parent timetable ID                                                          |
| `day_of_week`      | Enum      | `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday` |
| `event_name`       | String    | Name of the event/subject                                                    |
| `start_time`       | Time      | Start time (HH:MM:SS)                                                        |
| `end_time`         | Time      | End time (HH:MM:SS)                                                          |
| `duration_minutes` | Integer   | Auto-calculated duration                                                     |
| `notes`            | Text      | Additional notes/details                                                     |
| `color_code`       | String    | Hex color code (optional)                                                    |
| `order_index`      | Integer   | Display order within the day                                                 |
| `created_at`       | Timestamp | Creation timestamp                                                           |

---

## Error Handling

### Common Error Codes

| Status Code                 | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `400 Bad Request`           | Invalid input (missing file, invalid provider, etc.) |
| `404 Not Found`             | Resource not found (timetable ID doesn't exist)      |
| `500 Internal Server Error` | Server-side processing error                         |

### Error Response Format

```json
{
  "error": "Descriptive error message",
  "status": 500
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. In production, consider:

- Rate limiting by IP address
- Request throttling for expensive operations (file uploads)
- API key-based quotas

---

## File Upload Constraints

**Supported File Types:**

- PDF (`.pdf`)
- Microsoft Word (`.docx`)
- Images (`.png`, `.jpg`, `.jpeg`)

**File Size Limits:**

- Maximum file size: 10 MB (configurable in `upload.middleware.js`)

**Processing Time:**

- Typical: 10-30 seconds
- Complex timetables: Up to 60 seconds

---

## LLM Provider Configuration

### Environment Variables

```env
# Default LLM Provider
DEFAULT_LLM_PROVIDER=gemini

# API Keys
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_anthropic_key

# Model Selection
OPENAI_MODEL=gpt-4-turbo-preview
GEMINI_MODEL=gemini-2.5-flash
ANTHROPIC_MODEL=claude-3-opus-20240229
```

### Provider Capabilities

| Provider  | Vision Support | PDF Support             | Text Support |
| --------- | -------------- | ----------------------- | ------------ |
| OpenAI    | ✅ Yes         | ⚠️ Text extraction only | ✅ Yes       |
| Gemini    | ✅ Yes         | ✅ Native multimodal    | ✅ Yes       |
| Anthropic | ✅ Yes         | ⚠️ Text extraction only | ✅ Yes       |

**Recommended:** Use Gemini for best results with image and PDF timetables.

---

## Advanced Features

### AI Extraction Capabilities

The system uses advanced prompt engineering to handle complex timetable formats:

1. **Matrix Layout Detection**
   - Column headers define time slots for all rows
   - Automatic time inference from header structure

2. **Locked Blocks**
   - Recurring events (Break, Lunch, Registration) automatically duplicated across all days
   - Vertical text and gray blocks recognized as recurring

3. **Time Splitting**
   - Multiple subjects in one cell automatically split equally
   - Example: 2 subjects in 75 minutes = 37-38 minutes each

4. **Cell-Specific Times**
   - Times written inside cells override column headers
   - Highest priority for explicit time ranges

5. **Sparse Timetables**
   - Empty cells are skipped
   - Only extracts actual content

6. **Day Name Handling**
   - Supports full names (Monday, Tuesday, etc.)
   - Supports abbreviations (M, Tu, W, Th, F, Sa, Su)

7. **Multi-Column Daily Schedules**
   - Handles side-by-side daily schedules (e.g., "Monday, Tuesday, Thursday" | "Wednesday" | "Friday")
   - Each column represents a separate daily schedule
   - Events are duplicated for all days listed in the column header
   - Example: "Daily Schedule—Monday, Tuesday, Thursday" creates the same events for all three days

---

## Usage Examples

### Complete Upload Workflow

```javascript
// 1. Get available providers
const providersRes = await fetch(
  "http://localhost:3000/api/timetables/providers"
);
const providers = await providersRes.json();
console.log("Available:", providers.providers);

// 2. Upload timetable
const formData = new FormData();
formData.append("timetable", fileInput.files[0]);
formData.append("llm_provider", "gemini");

const uploadRes = await fetch("http://localhost:3000/api/timetables/upload", {
  method: "POST",
  body: formData,
});

const uploadData = await uploadRes.json();
const timetableId = uploadData.data.timetable_id;

// 3. Get timetable details
const detailsRes = await fetch(
  `http://localhost:3000/api/timetables/${timetableId}`
);
const details = await detailsRes.json();
console.log("Timeblocks:", details.data.timeblocks);

// 4. Get all timetables
const allRes = await fetch("http://localhost:3000/api/timetables");
const all = await allRes.json();
console.log("Total timetables:", all.count);
```

### Multi-Column Daily Schedule Example

For timetables with multiple daily schedules displayed side-by-side (e.g., separate columns for different days):

**Input Format:**

```
Daily Schedule—Monday, Tuesday, Thursday | Daily Schedule—Wednesday | Daily Schedule—Friday
```

**How It Works:**

1. The AI identifies each column as a separate daily schedule
2. Events in the "Monday, Tuesday, Thursday" column are duplicated for all three days
3. Events in the "Wednesday" column apply only to Wednesday
4. Events in the "Friday" column apply only to Friday

**Example Extraction:**

```javascript
// Input: Side-by-side schedules
// Column 1: "Monday, Tuesday, Thursday" - 8:35 "Students are allowed inside"
// Column 2: "Wednesday" - 8:35 "Students are allowed inside"
// Column 3: "Friday" - 8:35 "Students are allowed inside"

// Output: 5 separate timeblocks (one for each day)
{
  "timeblocks": [
    {
      "day": "Monday",
      "event_name": "Students are allowed inside",
      "start_time": "08:35",
      "end_time": "09:00",
      "notes": "From Daily Schedule—Monday, Tuesday, Thursday"
    },
    {
      "day": "Tuesday",
      "event_name": "Students are allowed inside",
      "start_time": "08:35",
      "end_time": "09:00",
      "notes": "From Daily Schedule—Monday, Tuesday, Thursday"
    },
    {
      "day": "Wednesday",
      "event_name": "Students are allowed inside",
      "start_time": "08:35",
      "end_time": "09:00",
      "notes": "From Daily Schedule—Wednesday"
    },
    {
      "day": "Thursday",
      "event_name": "Students are allowed inside",
      "start_time": "08:35",
      "end_time": "09:00",
      "notes": "From Daily Schedule—Monday, Tuesday, Thursday"
    },
    {
      "day": "Friday",
      "event_name": "Students are allowed inside",
      "start_time": "08:35",
      "end_time": "09:00",
      "notes": "From Daily Schedule—Friday"
    }
  ]
}
```

**Benefits:**

- Automatically handles varying schedules across the week
- Reduces redundancy in timetable creation
- Maintains accuracy for days with unique schedules

---

## Changelog

### Version 1.0.0 (Current)

- Initial API release
- Support for PDF, DOCX, and Image uploads
- Multi-provider LLM support (OpenAI, Gemini, Anthropic)
- Advanced timetable extraction with matrix layout and locked blocks
- CRUD operations for timetables
- Processing logs for debugging

---

## Support

For issues or questions:

- Check processing logs: `GET /timetables/:id/logs`
- Review server console for detailed error messages
- Ensure LLM API keys are correctly configured in `.env`

---

## Best Practices

### 1. File Upload Optimization

#### Compress Images Before Upload

```javascript
// Compress image client-side before uploading
async function compressImage(file, maxSizeMB = 5) {
  const options = {
    maxSizeMB: maxSizeMB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };

  // Use a library like browser-image-compression
  const compressedFile = await imageCompression(file, options);
  return compressedFile;
}
```

#### Validate File Size Client-Side

```javascript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (file.size > MAX_FILE_SIZE) {
  alert("File size exceeds 10MB limit");
  return;
}
```

### 2. Error Handling

#### Always Check Response Status

```javascript
const response = await fetch("/api/timetables/upload", {
  method: "POST",
  body: formData,
});

if (!response.ok) {
  const error = await response.json();
  console.error("Upload failed:", error.error);
  // Show user-friendly error message
  showToast("error", "Upload Failed", error.error);
  return;
}

const data = await response.json();
```

#### Implement Retry Logic for Transient Failures

```javascript
async function uploadWithRetry(formData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch("/api/timetables/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        return await response.json();
      }

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(await response.text());
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

### 3. Provider Selection

#### Check Provider Availability Before Upload

```javascript
// Get available providers first
const providersRes = await fetch("/api/timetables/providers");
const { providers } = await providersRes.json();

// Filter to only available providers
const availableProviders = providers.filter((p) => p.available);

if (availableProviders.length === 0) {
  alert("No LLM providers are currently available. Please configure API keys.");
  return;
}

// Use the first available provider
const selectedProvider = availableProviders[0].name;
```

### 4. Progress Indication

#### Show Upload Progress

```javascript
const xhr = new XMLHttpRequest();

xhr.upload.addEventListener("progress", (e) => {
  if (e.lengthComputable) {
    const percentComplete = (e.loaded / e.total) * 100;
    updateProgressBar(percentComplete);
  }
});

xhr.addEventListener("load", () => {
  const response = JSON.parse(xhr.responseText);
  handleSuccess(response);
});

xhr.open("POST", "/api/timetables/upload");
xhr.send(formData);
```

### 5. Data Validation

#### Validate Extracted Timeblocks

```javascript
function validateTimeblocks(timeblocks) {
  const issues = [];

  timeblocks.forEach((block, index) => {
    // Check for valid time format
    if (!/^\d{2}:\d{2}$/.test(block.start_time)) {
      issues.push(`Invalid start_time at index ${index}`);
    }

    // Check for logical time order
    if (block.start_time >= block.end_time) {
      issues.push(`End time before start time at index ${index}`);
    }

    // Check for valid day
    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    if (!validDays.includes(block.day)) {
      issues.push(`Invalid day "${block.day}" at index ${index}`);
    }
  });

  return issues;
}
```

### 6. Caching Strategy

#### Cache Timetable List

```javascript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let timetableCache = {
  data: null,
  timestamp: null,
};

async function getTimetables(forceRefresh = false) {
  const now = Date.now();

  if (
    !forceRefresh &&
    timetableCache.data &&
    now - timetableCache.timestamp < CACHE_DURATION
  ) {
    return timetableCache.data;
  }

  const response = await fetch("/api/timetables");
  const data = await response.json();

  timetableCache = {
    data: data.data,
    timestamp: now,
  };

  return data.data;
}
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "No file uploaded" Error

**Problem:** Server returns 400 error with "No file uploaded" message.

**Solutions:**

- Ensure the form field name is `timetable` (not `file` or other names)
- Verify `Content-Type` is `multipart/form-data`
- Check that the file input has a selected file

```javascript
// Correct
formData.append("timetable", fileInput.files[0]);

// Incorrect
formData.append("file", fileInput.files[0]); // Wrong field name
```

#### 2. "Invalid file type" Error

**Problem:** File upload rejected due to invalid MIME type.

**Solutions:**

- Only upload PDF, DOCX, PNG, JPG, or JPEG files
- Check the actual file MIME type, not just the extension
- Some files may have incorrect MIME types

```javascript
// Check MIME type before upload
const allowedTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];

if (!allowedTypes.includes(file.type)) {
  alert("Invalid file type. Please upload PDF, DOCX, PNG, or JPG files.");
  return;
}
```

#### 3. "No timeblocks extracted" Error

**Problem:** LLM successfully processes the file but extracts no valid timeblocks.

**Possible Causes:**

- Timetable image is too blurry or low quality
- Timetable format is too complex or unusual
- Text in the document is not readable (handwritten, stylized fonts)
- LLM provider is having issues

**Solutions:**

1. **Improve Image Quality**: Use higher resolution images (minimum 1000px width)
2. **Try Different Provider**: Switch from OpenAI to Gemini or vice versa
3. **Simplify Format**: Use standard table layouts with clear headers
4. **Check Processing Logs**: Review `/api/timetables/:id/logs` for details

```javascript
// Try with different provider if first attempt fails
const providers = ["gemini", "openai", "anthropic"];

for (const provider of providers) {
  try {
    formData.set("llm_provider", provider);
    const response = await fetch("/api/timetables/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (data.success && data.data.timeblocks.length > 0) {
      console.log(`Success with ${provider}`);
      return data;
    }
  } catch (error) {
    console.log(`Failed with ${provider}:`, error);
  }
}
```

#### 4. Slow Processing Times

**Problem:** Upload takes longer than 30 seconds.

**Causes:**

- Large file size (close to 10MB limit)
- Complex timetable with many events
- LLM API rate limiting or slow response
- Network latency

**Solutions:**

1. **Compress Images**: Reduce file size before upload
2. **Use Gemini**: Generally faster for image processing
3. **Implement Timeout**: Set reasonable timeout limits

```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

try {
  const response = await fetch("/api/timetables/upload", {
    method: "POST",
    body: formData,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  // Handle response
} catch (error) {
  if (error.name === "AbortError") {
    console.error("Request timed out after 60 seconds");
  }
}
```

#### 5. CORS Errors

**Problem:** Browser blocks requests with CORS policy errors.

**Solutions:**

- Ensure your frontend domain is in `ALLOWED_ORIGINS` env variable
- For development, add `http://localhost:3000` and `http://localhost:5173`
- In production, add your production domain

```env
# .env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com
```

#### 6. Database Connection Errors

**Problem:** Server returns 500 error with database connection issues.

**Solutions:**

1. Verify MySQL is running: `mysql.server status`
2. Check database credentials in `.env`
3. Ensure database exists: `npm run db:init`
4. Check connection pool settings

```bash
# Test database connection
mysql -u root -p -e "USE learning_yogi; SHOW TABLES;"
```

#### 7. LLM API Key Errors

**Problem:** "API key not configured" or authentication errors from LLM providers.

**Solutions:**

1. Verify API keys are set in `.env` file
2. Check API key format (OpenAI starts with `sk-`, Gemini is alphanumeric)
3. Ensure API key has sufficient quota/credits
4. Test API key directly with provider's API

```bash
# Test OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test Gemini API key
curl "https://generativelanguage.googleapis.com/v1/models?key=$GEMINI_API_KEY"
```

### Debug Mode

#### Enable Verbose Logging

For debugging, check server console logs:

```bash
# Development mode with detailed logs
NODE_ENV=development npm run dev
```

#### Check Processing Logs

```javascript
// After upload, check processing logs
const logsRes = await fetch(`/api/timetables/${timetableId}/logs`);
const logs = await logsRes.json();

logs.data.forEach((log) => {
  console.log(`[${log.log_level}] ${log.message}`, log.details);
});
```

---

## Performance Considerations

### Response Times

| Operation                           | Expected Time | Notes                         |
| ----------------------------------- | ------------- | ----------------------------- |
| **GET /timetables**                 | < 100ms       | Cached with indexes           |
| **GET /timetables/:id**             | < 150ms       | Includes JOIN with timeblocks |
| **POST /timetables/upload** (Image) | 10-30s        | LLM Vision API processing     |
| **POST /timetables/upload** (PDF)   | 15-35s        | Text extraction + LLM         |
| **POST /timetables/upload** (DOCX)  | 12-28s        | Text extraction + LLM         |
| **DELETE /timetables/:id**          | < 100ms       | Cascading delete              |

### Optimization Tips

#### 1. Batch Operations

If uploading multiple timetables, process them sequentially to avoid overwhelming the LLM API:

```javascript
async function uploadMultiple(files) {
  const results = [];

  for (const file of files) {
    const formData = new FormData();
    formData.append("timetable", file);

    const result = await uploadTimetable(formData);
    results.push(result);

    // Small delay between uploads to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
```

#### 2. Lazy Load Timeblocks

When displaying a list of timetables, don't fetch full details until needed:

```javascript
// Step 1: Get list (lightweight)
const timetables = await fetch("/api/timetables").then((r) => r.json());

// Step 2: Only fetch details when user clicks
async function viewTimetable(id) {
  const details = await fetch(`/api/timetables/${id}`).then((r) => r.json());
  displayTimetable(details.data);
}
```

#### 3. Use Appropriate LLM Provider

| Provider      | Best For        | Speed       | Accuracy         |
| ------------- | --------------- | ----------- | ---------------- |
| **Gemini**    | Images, PDFs    | ⚡⚡⚡ Fast | ⭐⭐⭐ Excellent |
| **OpenAI**    | Text, DOCX      | ⚡⚡ Medium | ⭐⭐⭐ Excellent |
| **Anthropic** | Complex layouts | ⚡⚡ Medium | ⭐⭐⭐ Excellent |

**Recommendation:** Use Gemini for best balance of speed and accuracy.

#### 4. Database Query Optimization

The system uses several optimizations:

- **Indexes** on frequently queried columns (`teacher_id`, `processing_status`, `day_of_week`)
- **Computed columns** for `duration_minutes` (calculated at DB level)
- **Connection pooling** for concurrent requests
- **Selective loading** (timeblocks only loaded when needed)

#### 5. File Storage Optimization

```javascript
// For production, consider:
// 1. Storing files in cloud storage (S3, GCS)
// 2. Generating thumbnails for images
// 3. Implementing file cleanup for old uploads

// Example: Delete timetables older than 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const oldTimetables = await fetch(
  `/api/timetables?before=${thirtyDaysAgo.toISOString()}`
).then((r) => r.json());

for (const timetable of oldTimetables.data) {
  await fetch(`/api/timetables/${timetable.id}`, { method: "DELETE" });
}
```

### Monitoring Performance

```javascript
// Track API response times
const startTime = performance.now();

const response = await fetch("/api/timetables/upload", {
  method: "POST",
  body: formData,
});

const endTime = performance.now();
const duration = endTime - startTime;

console.log(`Upload completed in ${(duration / 1000).toFixed(2)}s`);

// Log slow requests
if (duration > 30000) {
  console.warn("Slow upload detected:", {
    duration,
    fileSize: formData.get("timetable").size,
    provider: formData.get("llm_provider"),
  });
}
```

---

## SDK / Client Library Examples

### JavaScript/TypeScript Client

```typescript
class TimetableClient {
  constructor(private baseUrl: string = "http://localhost:3000/api") {}

  async getProviders() {
    const response = await fetch(`${this.baseUrl}/timetables/providers`);
    return response.json();
  }

  async uploadTimetable(
    file: File,
    options: {
      provider?: string;
      apiKey?: string;
      teacherId?: number;
    } = {}
  ) {
    const formData = new FormData();
    formData.append("timetable", file);

    if (options.provider) formData.append("llm_provider", options.provider);
    if (options.apiKey) formData.append("api_key", options.apiKey);
    if (options.teacherId)
      formData.append("teacher_id", options.teacherId.toString());

    const response = await fetch(`${this.baseUrl}/timetables/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Upload failed");
    }

    return response.json();
  }

  async getTimetables(teacherId?: number) {
    const url = new URL(`${this.baseUrl}/timetables`);
    if (teacherId) url.searchParams.set("teacher_id", teacherId.toString());

    const response = await fetch(url.toString());
    return response.json();
  }

  async getTimetable(id: number) {
    const response = await fetch(`${this.baseUrl}/timetables/${id}`);

    if (!response.ok) {
      throw new Error("Timetable not found");
    }

    return response.json();
  }

  async deleteTimetable(id: number) {
    const response = await fetch(`${this.baseUrl}/timetables/${id}`, {
      method: "DELETE",
    });

    return response.json();
  }

  async getLogs(id: number) {
    const response = await fetch(`${this.baseUrl}/timetables/${id}/logs`);
    return response.json();
  }
}

// Usage
const client = new TimetableClient();

const providers = await client.getProviders();
const result = await client.uploadTimetable(file, { provider: "gemini" });
const timetables = await client.getTimetables();
```

### Python Client

```python
import requests
from typing import Optional, Dict, Any

class TimetableClient:
    def __init__(self, base_url: str = "http://localhost:3000/api"):
        self.base_url = base_url

    def get_providers(self) -> Dict[str, Any]:
        response = requests.get(f"{self.base_url}/timetables/providers")
        response.raise_for_status()
        return response.json()

    def upload_timetable(
        self,
        file_path: str,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        teacher_id: Optional[int] = None
    ) -> Dict[str, Any]:
        with open(file_path, 'rb') as f:
            files = {'timetable': f}
            data = {}

            if provider:
                data['llm_provider'] = provider
            if api_key:
                data['api_key'] = api_key
            if teacher_id:
                data['teacher_id'] = teacher_id

            response = requests.post(
                f"{self.base_url}/timetables/upload",
                files=files,
                data=data
            )
            response.raise_for_status()
            return response.json()

    def get_timetables(self, teacher_id: Optional[int] = None) -> Dict[str, Any]:
        params = {'teacher_id': teacher_id} if teacher_id else {}
        response = requests.get(f"{self.base_url}/timetables", params=params)
        response.raise_for_status()
        return response.json()

    def get_timetable(self, timetable_id: int) -> Dict[str, Any]:
        response = requests.get(f"{self.base_url}/timetables/{timetable_id}")
        response.raise_for_status()
        return response.json()

    def delete_timetable(self, timetable_id: int) -> Dict[str, Any]:
        response = requests.delete(f"{self.base_url}/timetables/{timetable_id}")
        response.raise_for_status()
        return response.json()

    def get_logs(self, timetable_id: int) -> Dict[str, Any]:
        response = requests.get(f"{self.base_url}/timetables/{timetable_id}/logs")
        response.raise_for_status()
        return response.json()

# Usage
client = TimetableClient()

providers = client.get_providers()
result = client.upload_timetable('timetable.png', provider='gemini')
timetables = client.get_timetables()
```

---

## Additional Endpoints

### Health Check

**Endpoint:** `GET /health`

**Description:** Check if the server is running and responsive.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-12-07T03:32:23.456Z"
}
```

**Usage:**

```javascript
// Ping server before making requests
const health = await fetch("http://localhost:3000/health").then((r) =>
  r.json()
);
if (health.status === "ok") {
  // Server is ready
}
```

### Server Configuration

**Endpoint:** `GET /api/config`

**Description:** Get public server configuration.

**Response:**

```json
{
  "success": true,
  "serverUrl": "http://localhost:3000"
}
```

**Usage:**

```javascript
// Get server URL dynamically
const config = await fetch("/api/config").then((r) => r.json());
const serverUrl = config.serverUrl;
```
