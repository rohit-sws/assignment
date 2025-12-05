# API Documentation - Learning Yogi Timetable System

## Base URL

http://localhost:3000/api

## Authentication

Currently, no authentication is required. In production, implement JWT or API key authentication.

## Endpoints

### 1. Get Available LLM Providers

**Endpoint:** `GET /timetables/providers`

**Description:** Returns list of configured LLM providers

**Response:**

```json
{
  "success": true,
  "default_provider": "openai",
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
      "model": "gemini-1.5-pro",
      "available": true
    }
  ]
}
```
