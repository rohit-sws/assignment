# API Documentation - Learning Yogi Timetable System

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, no authentication is required. In production, implement JWT or API key authentication.

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
