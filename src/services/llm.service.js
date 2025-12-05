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
   - Examples: "Registration and Early Morning Work", "Break", "Lunch", "Reading books and register", "Daily routine".
   - **ACTION**: If you see such a block (e.g., "Break" at 10:20-10:35), you MUST generate a separate timeblock for **EVERY** day (Monday-Friday) for that event at that time. Do not just list it once.

3. **HEADER-BASED TIMING (CRITICAL)**:
   - If the TOP ROW contains time ranges (e.g., "8:40", "9:00", "9:15-10:45", "11:00-11:30"), these define the TIME SLOTS for the COLUMNS below.
   - When you see an event in a cell (e.g., "Maths" in the Monday row under the "9:15-10:45" column), that event happens at that time.
   - **RULE**: Use the column header time for the event, NOT text inside the cell (unless the cell explicitly overrides it).
   - **INFERRING END TIMES**: If a column header only shows a START time (e.g., "8:40", "9:00"), the END time is the START time of the NEXT column. For example:
     * Column 1: "8:40" → Column 2: "9:00" means events in Column 1 run from 08:40 to 09:00
     * Column 2: "9:00" → Column 3: "9:15" means events in Column 2 run from 09:00 to 09:15
   - If a column header already shows a range (e.g., "9:15-10:45"), use that directly.
   
   - **MULTIPLE SUBJECTS IN ONE CELL (TIME SPLITTING)**:
     * If a cell contains MULTIPLE subjects/activities (e.g., "RWI" and "Play (Observation)" both in the 9:00-10:15 slot), you MUST split the time equally.
     * Example: 9:00-10:15 is 75 minutes. If there are 2 subjects, each gets 37-38 minutes:
       - Subject 1: 09:00 - 09:37 (or 09:38)
       - Subject 2: 09:38 (or 09:37) - 10:15
     * Round to nearest minute. The last subject should end at the column's end time.
     * Create SEPARATE timeblock entries for each subject.
   
   - If a cell is EMPTY but the column has a header time, skip it (no event for that day/time).

4. **Sparse Timetables**:
   - Some timetables have many empty cells. Only extract events where there is actual text content.
   - If a row (day) has no events in certain time slots, that's normal - just skip those.
   
### Extraction Rules:
- **Day of the week**: Identify the row for each day (Monday-Sunday). May be abbreviated (M, Tu, W, Th, F).
- **Time**: Start/End time from column headers or specific cell text. Use 24-hour format (HH:MM).
- **Event Name**: "Maths", "English", "Science", "Break", "Lunch", "Registration", "Readers", "Yoga", etc. Keep exact wording.
- **Notes**: Any extra info in the cell (e.g., "Room 3", "Mrs Smith", "Intervention folders").

### Context/Text:
${text}

### Return JSON Structure:
{
    "timeblocks": [
        {
            "day": "Monday",
            "event_name": "Reading books and register",
            "start_time": "08:40",
            "end_time": "09:00",
            "notes": "Daily routine",
            "confidence": 0.95
        },
        {
            "day": "Tuesday",
            "event_name": "RWI",
            "start_time": "09:00",
            "end_time": "09:37",
            "notes": "Split from 9:00-10:15 slot (2 subjects)",
            "confidence": 0.90
        },
        {
            "day": "Tuesday",
            "event_name": "Play (Observation)",
            "start_time": "09:38",
            "end_time": "10:15",
            "notes": "Split from 9:00-10:15 slot (2 subjects)",
            "confidence": 0.90
        },
        ...
    ],
    "metadata": {
        "total_events": 25,
        "days_covered": ["Monday", "Tuesday", ...],
        "extraction_notes": "Detected locked blocks for Break and Lunch. Used header-based timing. Split multi-subject cells."
    }
}

### Final Checklist:
- Did you expand "Locked Blocks" (Break/Lunch/Reg/Daily routine) for ALL days where they appear?
- Did you use the COLUMN HEADER times for events, not just cell text?
- Did you handle abbreviated day names (M=Monday, Tu=Tuesday, W=Wednesday, Th=Thursday, F=Friday)?
- Did you SPLIT time slots when multiple subjects appear in one cell (e.g., 2 subjects in 75 mins = ~37 mins each)?
- Did you skip empty cells rather than inventing events?
- Return ONLY valid JSON.
`;
    }

    validateAndNormalize(data) {
        if (!data.timeblocks || !Array.isArray(data.timeblocks)) {
            console.error('LLM Response structure:', JSON.stringify(data, null, 2));
            throw new Error('Invalid LLM response: missing timeblocks array');
        }

        if (data.timeblocks.length === 0) {
            console.warn('LLM returned empty timeblocks array');
            throw new Error('LLM returned no timeblocks - the document may be too complex or unreadable');
        }

        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        const normalized = data.timeblocks.map(rawBlock => {
            // Normalize keys to lowercase
            const block = {};
            for (const key in rawBlock) {
                block[key.toLowerCase()] = rawBlock[key];
            }

            // Map common variances - handle both camelCase and snake_case
            // LLM might return: eventName, event_name, eventname, event, etc.
            if (block.eventname && !block.event_name) block.event_name = block.eventname;
            if (block.event && !block.event_name) block.event_name = block.event;

            // Time fields: startTime, start_time, starttime, time_start
            if (block.starttime && !block.start_time) block.start_time = block.starttime;
            if (block.time_start && !block.start_time) block.start_time = block.time_start;

            // End time: endTime, end_time, endtime, time_end  
            if (block.endtime && !block.end_time) block.end_time = block.endtime;
            if (block.time_end && !block.end_time) block.end_time = block.time_end;

            // Normalize Day
            if (block.day) block.day = block.day.trim();

            // Handle abbreviated day names (M, Tu, W, Th, F, Sa, Su)
            const dayAbbreviations = {
                'M': 'Monday',
                'Tu': 'Tuesday',
                'W': 'Wednesday',
                'Th': 'Thursday',
                'F': 'Friday',
                'Sa': 'Saturday',
                'Su': 'Sunday',
                'Mon': 'Monday',
                'Tue': 'Tuesday',
                'Wed': 'Wednesday',
                'Thu': 'Thursday',
                'Fri': 'Friday',
                'Sat': 'Saturday',
                'Sun': 'Sunday'
            };

            if (dayAbbreviations[block.day]) {
                block.day = dayAbbreviations[block.day];
            }

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
            if (!block.start_time || !block.end_time) {
                console.warn(`Missing time data for ${block.event_name} (start: ${block.start_time}, end: ${block.end_time}). Keys: ${Object.keys(rawBlock).join(',')}`);
                return null;
            }

            if (!this.isValidTime(block.start_time) || !this.isValidTime(block.end_time)) {
                console.warn(`Invalid time format for ${block.event_name} (${block.start_time}-${block.end_time}). Keys: ${Object.keys(rawBlock).join(',')}`);
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

        if (normalized.length === 0 && data.timeblocks.length > 0) {
            console.error(`All ${data.timeblocks.length} timeblocks were filtered out as invalid`);
            console.error('Sample raw block:', JSON.stringify(data.timeblocks[0], null, 2));
        }

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