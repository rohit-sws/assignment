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

            // DEBUG: Log raw LLM response
            console.log('=== RAW LLM RESPONSE ===');
            console.log(JSON.stringify(result, null, 2));
            console.log('=== END RAW RESPONSE ===');

            const validatedData = this.validateAndNormalize(result);

            return validatedData;

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
1. **MATRIX LAYOUT (CRITICAL)**:
   - Many timetables use a GRID/TABLE structure where:
     * ROWS = Days of the week (Monday, Tuesday, etc.) OR Row numbers (1, 2, 3, etc.) with times
     * COLUMNS = Time slots (defined by headers at the top)
   - The COLUMN HEADERS define the TIME for ALL events in that column.
   - Example: If column 3 header says "9:15-10:45", then ANY event in column 3 happens at 9:15-10:45.

2. **EVENT NAME EXTRACTION (CRITICAL)**:
   - **NEVER use generic names like "Unknown Event", "Event", or "Activity"**
   - **ALWAYS extract the ACTUAL text from the cell**
   - Examples of CORRECT event names:
     * "Students are allowed inside"
     * "Late Bell Rings"
     * "Morning Work"
     * "Daily 5: Station 1"
     * "Word Work (Phonics)"
     * "Writer's Workshop"
     * "Math"
     * "Lunch"
     * "Science/Health/Social Studies"
     * "Jobs & Read Aloud"
   - If a cell contains a time AND an event name (e.g., "8:35 Students are allowed inside"), extract ONLY the event name part ("Students are allowed inside")
   - If a cell is truly empty or unreadable, skip it entirely - don't create a timeblock

3. **LOCKED BLOCKS (Recurring Events)**:
   - Look for "Gray Blocks" or vertical text that spans across all days (or appears to be a divider). 
   - Examples: "Registration and Early Morning Work", "Break", "Lunch", "Reading books and register", "Daily routine".
   - **ACTION**: If you see such a block (e.g., "Break" at 10:20-10:35), you MUST generate a separate timeblock for **EVERY** day (Monday-Friday) for that event at that time. Do not just list it once.

4. **HEADER-BASED TIMING (CRITICAL)**:
   - If the TOP ROW contains time ranges (e.g., "8:40", "9:00", "9:15-10:45", "11:00-11:30"), these define the TIME SLOTS for the COLUMNS below.
   - When you see an event in a cell (e.g., "Maths" in the Monday row under the "9:15-10:45" column), that event happens at that time.
   
   - **CELL-SPECIFIC TIMES OVERRIDE HEADERS (HIGHEST PRIORITY)**:
     * If a cell contains its OWN time (e.g., "10:50-12:00 English" or "9:30 - 10:20 Maths"), USE THAT TIME, NOT the column header.
     * Example: Column header says "11:00-11:55" but cell says "10:50-12:00 English" → Use 10:50-12:00
     * Look for patterns like "HH:MM - HH:MM Activity" or "HH:MM-HH:MM Activity" inside cells.
     * These cell-specific times are ABSOLUTE and take precedence over everything else.
   
   - **RULE**: Use the column header time for the event ONLY if the cell doesn't specify its own time.
   - **INFERRING END TIMES**: If a column header only shows a START time (e.g., "8:40", "9:00"), the END time is the START time of the NEXT column. For example:
     * Column 1: "8:40" → Column 2: "9:00" means events in Column 1 run from 08:40 to 09:00
     * Column 2: "9:00" → Column 3: "9:15" means events in Column 2 run from 09:00 to 09:15
   
   - **⚠️ CRITICAL: LAST COLUMN END TIME (MUST NOT BE UNDEFINED)**:
     * If it's the LAST time slot of the day (e.g., "2:30", "3:00", "14:30", "15:00" with no column after it), you MUST infer a reasonable end time.
     * **NEVER return undefined or null for end_time - this is INVALID and will cause the timeblock to be rejected.**
     * **Default assumption**: Add 30-45 minutes for most activities, 15 minutes for short activities like "Pack Up" or "Dismissal"
     * Examples:
       - "3:00 Jobs & Read Aloud" → ends at 15:30 (3:30pm) - 30 minute activity
       - "3:10 Pack Up" → ends at 15:15 (3:15pm) - 5 minute activity  
       - "3:15 School Dismissed" → ends at 15:20 (3:20pm) - 5 minute activity
       - "2:30 Adventure to Fitness" → ends at 15:00 (3:00pm) - 30 minute activity
     * Look for context clues:
       - "Dismissal" or "Pack Up" = short (5-15 mins)
       - "Jobs", "Read Aloud", "Fitness" = medium (30 mins)
       - If the next row says "School Dismissed" at a specific time, use that as the end time
   
   - If a column header already shows a range (e.g., "9:15-10:45"), use that directly.
   
   - **MULTIPLE SUBJECTS IN ONE CELL (TIME SPLITTING)**:
     * If a cell contains MULTIPLE subjects/activities (e.g., "RWI" and "Play (Observation)" both in the 9:00-10:15 slot), you MUST split the time equally.
     * Example: 9:00-10:15 is 75 minutes. If there are 2 subjects, each gets 37-38 minutes:
       - Subject 1: 09:00 - 09:37 (or 09:38)
       - Subject 2: 09:38 (or 09:37) - 10:15
     * Round to nearest minute. The last subject should end at the column's end time.
     * Create SEPARATE timeblock entries for each subject.
   
   - If a cell is EMPTY but the column has a header time, skip it (no event for that day/time).

4. **Multi-Column Daily Schedules**:
   - Some timetables show SEPARATE COLUMNS for different days (e.g., "Daily Schedule—Monday, Tuesday, Thursday" | "Daily Schedule—Wednesday" | "Daily Schedule—Friday")
   - **CRITICAL**: Each column is a SEPARATE daily schedule with its own time slots
   - If a column header says "Monday, Tuesday, Thursday", create the SAME events for ALL THREE days
   - Example:
     * Column 1 header: "Daily Schedule—Monday, Tuesday, Thursday"
     * Row 1: "8:35 Students are allowed inside"
     * Result: Create 3 timeblocks (one for Monday, one for Tuesday, one for Thursday) with the same event
   - Each column has its own row numbers (1, 2, 3, etc.) - these are NOT shared across columns
   - Process each column independently and duplicate events for all days listed in that column's header

5. **Sparse Timetables**:
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
        {
            "day": "Monday",
            "event_name": "English",
            "start_time": "10:50",
            "end_time": "12:00",
            "notes": "Experience Day - cell-specific time overrides column header",
            "confidence": 0.95
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
- Did you prioritize CELL-SPECIFIC times (e.g., "10:50-12:00 English") over column header times?
- Did you expand "Locked Blocks" (Break/Lunch/Reg/Daily routine) for ALL days where they appear?
- Did you use the COLUMN HEADER times for events when cells don't have their own times?
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

        // First, expand any blocks with days arrays into individual blocks
        const expandedBlocks = data.timeblocks.map(rawBlock => {
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

            // Handle days array (multi-column schedules return days: ["Monday", "Tuesday", "Thursday"])
            // Expand into multiple blocks, one per day
            if (block.days && Array.isArray(block.days)) {
                // Return array of blocks, one for each day
                return block.days.map(day => ({
                    ...block,
                    day: day,
                    days: undefined // Remove the days array
                }));
            }

            // Single day - return as array for consistent handling
            return [block];
        }).flat(); // Flatten the array of arrays

        // Now normalize and validate each expanded block
        const normalized = expandedBlocks.map(block => {

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

            // Validate day exists
            if (!block.day) {
                console.warn(`Missing day field. Keys: ${Object.keys(block).join(',')}`);
                return null;
            }

            // Validate day
            if (!validDays.includes(block.day)) {
                console.warn(`Invalid day: "${block.day}" (Keys: ${Object.keys(block).join(',')})`);
                return null;
            }

            // Check for missing time data BEFORE validation
            if (!block.start_time || !block.end_time) {
                // If end_time is missing but start_time exists, try to infer it
                if (block.start_time && !block.end_time) {
                    const eventName = (block.event_name || '').toLowerCase();
                    const startTime = block.start_time;

                    // Infer end time based on event type
                    let durationMinutes = 30; // default

                    if (eventName.includes('dismiss') || eventName.includes('pack up')) {
                        durationMinutes = 5;
                    } else if (eventName.includes('read') || eventName.includes('job') || eventName.includes('fitness')) {
                        durationMinutes = 30;
                    } else if (eventName.includes('lunch') || eventName.includes('recess')) {
                        durationMinutes = 30;
                    } else {
                        durationMinutes = 30; // default for unknown activities
                    }

                    // Calculate end time
                    const [hours, minutes] = startTime.split(':').map(Number);
                    const startDate = new Date(2000, 0, 1, hours, minutes || 0);
                    startDate.setMinutes(startDate.getMinutes() + durationMinutes);

                    block.end_time = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;

                    console.log(`Auto-inferred end_time for "${block.event_name}": ${block.start_time} → ${block.end_time} (${durationMinutes} mins)`);
                } else {
                    console.warn(`Missing time data for ${block.event_name} (start: ${block.start_time}, end: ${block.end_time}). Keys: ${Object.keys(block).join(',')}`);
                    return null;
                }
            }

            // Validate times
            if (!this.isValidTime(block.start_time) || !this.isValidTime(block.end_time)) {
                console.warn(`Invalid time format for ${block.event_name}. Start: ${block.start_time}, End: ${block.end_time}. Raw keys: ${Object.keys(block).join(',')}`);
                return null;
            }
            return {
                day: block.day ? String(block.day).trim() : null,
                event_name: block.event_name ? block.event_name.trim() : 'Unknown Event',
                start_time: block.start_time,
                end_time: block.end_time,
                notes: block.notes || null,
                confidence: block.confidence || 0.8
            };
        }).filter(block => {
            if (!block || !block.day) {
                console.warn('Filtered out block with missing day');
                return false;
            }

            // Normalize day name
            let dayStr = String(block.day).trim();

            // Handle abbreviated day names (M, Tu, W, Th, F, Sa, Su)
            const dayAbbreviations = {
                'M': 'Monday', 'Mon': 'Monday',
                'Tu': 'Tuesday', 'Tue': 'Tuesday',
                'W': 'Wednesday', 'Wed': 'Wednesday',
                'Th': 'Thursday', 'Thu': 'Thursday',
                'F': 'Friday', 'Fri': 'Friday',
                'Sa': 'Saturday', 'Sat': 'Saturday',
                'Su': 'Sunday', 'Sun': 'Sunday'
            };

            if (dayAbbreviations[dayStr]) {
                dayStr = dayAbbreviations[dayStr];
            }

            // Handle case where day might be "Wed" or "Wednesday."
            // Simplified check: if string contains the day name
            const dayMatch = validDays.find(d => dayStr.includes(d));
            if (dayMatch) {
                dayStr = dayMatch;
            }

            // Validate day
            if (!validDays.includes(dayStr)) {
                console.warn(`Invalid day: "${block.day}" (Normalized: "${dayStr}"). Filtering out block.`);
                return false;
            }

            block.day = dayStr; // Update the block with the normalized day
            return true;
        });

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