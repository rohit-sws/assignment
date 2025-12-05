const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;

class LLMService {
    constructor() {
        // Initialize OpenAI
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Initialize Gemini
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        this.defaultProvider = process.env.DEFAULT_LLM_PROVIDER || 'gemini';
    }

    /**
     * Extract timetable data using specified LLM provider
     * @param {string|Buffer} input - Raw text or Image Buffer/Path
     * @param {string} provider - 'openai', 'gemini', or 'anthropic'
     * @param {string} inputType - 'text' or 'image'
     * @param {string} apiKey - Optional custom API key
     */
    async extractTimetableData(input, provider = null, inputType = 'text', apiKey = null, mimeType = 'image/png') {
        const selectedProvider = provider || this.defaultProvider;

        console.log(`🤖 Using LLM Provider: ${selectedProvider.toUpperCase()} (${inputType})`);

        try {
            let result;

            // Vision processing route
            if (inputType === 'image') {
                result = await this.extractWithVision(input, selectedProvider, apiKey, mimeType);
            }
            // Text processing route
            else {
                switch (selectedProvider.toLowerCase()) {
                    case 'openai':
                        result = await this.extractWithOpenAI(input, apiKey);
                        break;
                    case 'gemini':
                        result = await this.extractWithGemini(input, apiKey);
                        break;
                    case 'anthropic':
                        result = await this.extractWithAnthropic(input, apiKey);
                        break;
                    default:
                        throw new Error(`Unsupported LLM provider: ${selectedProvider}`);
                }
            }

            console.log('DEBUG Raw Extracted Data:', JSON.stringify(result, null, 2));

            return this.validateAndNormalize(result);

        } catch (error) {
            console.error(`Error extracting timetable data with ${selectedProvider}:`, error);
            throw error;
        }
    }

    /**
     * Handle Vision requests (Images)
     */
    async extractWithVision(imagePath, provider, customApiKey = null, mimeType = 'image/png') {
        const imageBuffer = await fs.readFile(imagePath);
        const base64Image = imageBuffer.toString('base64');

        if (provider === 'gemini') {
            return await this.extractWithGeminiVision(base64Image, customApiKey, mimeType);
        } else if (provider === 'openai') {
            return await this.extractWithOpenAIVision(base64Image, customApiKey);
        } else {
            throw new Error('Vision not supported for this provider yet');
        }
    }

    /**
     * Gemini Vision
     */
    async extractWithGeminiVision(base64Image, customApiKey = null, mimeType = 'image/png') {
        const apiKey = customApiKey || process.env.GEMINI_API_KEY;
        const geminiClient = new GoogleGenerativeAI(apiKey);
        const model = geminiClient.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', // Latest robust model
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const prompt = `${this.getSystemPrompt()}\n\nAnalyze this timetable document/image. Extract the schedule into the specified JSON format. \n\nIMPORTANT: The root object MUST contain a "timeblocks" array. \n\nExample Output Structure:\n{\n  "timeblocks": [ ... ],\n  "metadata": { ... }\n}`;

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        let responseText = response.text();

        // No need to strip markdown if using responseMimeType usually, but safe to keep regex check just in case
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(responseText);
    }

    /**
     * OpenAI Vision
     */
    async extractWithOpenAIVision(base64Image, customApiKey = null) {
        const client = customApiKey ? new OpenAI({ apiKey: customApiKey }) : this.openai;

        const response = await client.chat.completions.create({
            model: "gpt-4-turbo", // Vision capable
            messages: [
                {
                    role: "system",
                    content: "You are an expert at extracting structured data from timetable images. Return ONLY valid JSON."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: this.buildExtractionPrompt("Extraction from Image") },
                        {
                            type: "image_url",
                            image_url: {
                                "url": `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4096,
            response_format: { type: "json_object" }
        });

        return JSON.parse(response.choices[0].message.content);
    }

    /**
     * Extract using OpenAI GPT-4 (Text)
     */
    async extractWithOpenAI(text, customApiKey = null) {
        const client = customApiKey ? new OpenAI({ apiKey: customApiKey }) : this.openai;
        const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

        const prompt = this.buildExtractionPrompt(text);

        const response = await client.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: `You are an expert at extracting structured timetable data from various formats. 
                    Your task is to identify timeblocks with their days, times, and event names from unstructured text.
                    Always return valid JSON.`
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        return JSON.parse(response.choices[0].message.content);
    }

    /**
     * Extract using Google Gemini (Text)
     */
    async extractWithGemini(text, customApiKey = null) {
        const apiKey = customApiKey || process.env.GEMINI_API_KEY;
        const geminiClient = new GoogleGenerativeAI(apiKey);
        const model = geminiClient.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const prompt = `${this.getSystemPrompt()}\n\n${this.buildExtractionPrompt(text)}\n\nIMPORTANT: Return ONLY valid JSON, no markdown formatting or additional text. Root object MUST have "timeblocks".`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text();

        // Clean up Gemini's response (sometimes includes markdown)
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        return JSON.parse(responseText);
    }

    /**
     * Extract using Anthropic Claude (Text)
     */
    async extractWithAnthropic(text, customApiKey = null) {
        const Anthropic = require('@anthropic-ai/sdk');
        const apiKey = customApiKey || process.env.ANTHROPIC_API_KEY;
        const client = new Anthropic({ apiKey });

        const prompt = this.buildExtractionPrompt(text);

        const response = await client.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            temperature: 0.1,
            system: this.getSystemPrompt(),
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        return JSON.parse(response.content[0].text);
    }

    getSystemPrompt() {
        return `You are an expert at extracting structured timetable data from various formats. 
Your task is to identify timeblocks with their days, times, and event names from unstructured text.
Always return valid JSON with no additional formatting or explanation.`;
    }

    buildExtractionPrompt(text) {
        return `
Extract all timetable events. 

### CRITICAL INSTRUCTION: MATRIX & LOCKED BLOCKS
1. **Matrix Layout**: Treat the document as a grid. Time slots often appear as column headers on top. These times apply to ALL days (rows) below them unless a specific cell says otherwise.
2. **Locked Blocks (Recurring Events)**: Look for "Gray Blocks" or vertical text that spans across all days (or appears to be a divider). 
   - Examples: "Registration and Early Morning Work", "Break", "Lunch".
   - **ACTION**: If you see such a block (e.g., "Break" at 10:20-10:35), you MUST generate a separate timeblock for **EVERY** day (Monday-Friday) for that event at that time. Do not just list it once.
   
### Extraction Rules:
- **Day of the week**: Identify the row for each day (Monday-Sunday).
- **Time**: Start/End time from column headers or specific cell text. Use 24-hour format (HH:MM).
- **Event Name**: "Maths", "English", "Science", "Break", "Lunch", "Registration", etc. Keep exact wording.
- **Notes**: Any extra info in the cell (e.g., "Room 3", "Mrs Smith").

### Context/Text:
${text}

### Return JSON Structure:
{
    "timeblocks": [
        {
            "day": "Monday",
            "event_name": "Registration",
            "start_time": "08:35",
            "end_time": "08:50",
            "notes": "Early Morning Work",
            "confidence": 0.95
        },
        ...
    ],
    "metadata": {
        "total_events": 25,
        "days_covered": ["Monday", "Tuesday", ...],
        "extraction_notes": "Detected locked blocks for Break and Lunch."
    }
}

### Final Checklist:
- Did you expand "Locked Blocks" (Break/Lunch/Reg) for ALL days?
- Did you use the column header times for the cells below them?
- Return ONLY valid JSON.
`;
    }

    validateAndNormalize(data) {
        if (!data.timeblocks || !Array.isArray(data.timeblocks)) {
            throw new Error('Invalid LLM response: missing timeblocks array');
        }

        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        const normalized = data.timeblocks.map(rawBlock => {
            // Normalize keys to lowercase
            const block = {};
            for (const key in rawBlock) {
                block[key.toLowerCase()] = rawBlock[key];
            }

            // Map common variances
            if (block.eventname) block.event_name = block.eventname;
            if (block.event) block.event_name = block.event;
            if (block.starttime) block.start_time = block.starttime;
            if (block.endtime) block.end_time = block.end_time;
            if (block.time_start) block.start_time = block.time_start;
            if (block.time_end) block.end_time = block.time_end;

            // Normalize Day
            if (block.day) block.day = block.day.trim();

            // Handle case where day might be "Wed" or "Wednesday."
            // Simplified check: if string contains the day name
            const dayMatch = validDays.find(d => block.day && block.day.includes(d));
            if (dayMatch) block.day = dayMatch;

            // Validate day
            if (!validDays.includes(block.day)) {
                console.warn(`Invalid day: "${block.day}" (Keys: ${Object.keys(rawBlock).join(',')})`);
                return null;
            }

            // Validate times
            if (!this.isValidTime(block.start_time) || !this.isValidTime(block.end_time)) {
                console.warn(`Invalid time for ${block.event_name} (${block.start_time}-${block.end_time}). Keys: ${Object.keys(rawBlock).join(',')}`);
                return null;
            }

            return {
                day: block.day,
                event_name: block.event_name ? block.event_name.trim() : 'Unknown Event',
                start_time: block.start_time,
                end_time: block.end_time,
                notes: block.notes || null,
                confidence: block.confidence || 0.8
            };
        }).filter(block => block !== null);

        return {
            timeblocks: normalized,
            metadata: data.metadata || {}
        };
    }

    isValidTime(time) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    }

    /**
     * Get list of available providers
     */
    getAvailableProviders() {
        const providers = [];

        if (process.env.OPENAI_API_KEY) {
            providers.push({
                name: 'openai',
                displayName: 'OpenAI GPT-4',
                model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
                available: true
            });
        }

        if (process.env.GEMINI_API_KEY) {
            providers.push({
                name: 'gemini',
                displayName: 'Google Gemini',
                model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
                available: true
            });
        }

        if (process.env.ANTHROPIC_API_KEY) {
            providers.push({
                name: 'anthropic',
                displayName: 'Anthropic Claude',
                model: 'claude-3-5-sonnet-20241022',
                available: true
            });
        }

        return providers;
    }
}

module.exports = new LLMService();