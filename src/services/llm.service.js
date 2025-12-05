const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class LLMService {
    constructor() {
        // Initialize OpenAI
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Initialize Gemini
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        this.defaultProvider = process.env.DEFAULT_LLM_PROVIDER || 'openai';
    }

    /**
     * Extract timetable data using specified LLM provider
     * @param {string} extractedText - Raw text from document
     * @param {string} provider - 'openai', 'gemini', or 'anthropic'
     * @param {string} apiKey - Optional custom API key
     */
    async extractTimetableData(extractedText, provider = null, apiKey = null) {
        const selectedProvider = provider || this.defaultProvider;

        console.log(`🤖 Using LLM Provider: ${selectedProvider.toUpperCase()}`);

        try {
            let result;

            switch (selectedProvider.toLowerCase()) {
                case 'openai':
                    result = await this.extractWithOpenAI(extractedText, apiKey);
                    break;
                case 'gemini':
                    result = await this.extractWithGemini(extractedText, apiKey);
                    break;
                case 'anthropic':
                    result = await this.extractWithAnthropic(extractedText, apiKey);
                    break;
                default:
                    throw new Error(`Unsupported LLM provider: ${selectedProvider}`);
            }

            return this.validateAndNormalize(result);

        } catch (error) {
            console.error(`LLM extraction error (${selectedProvider}):`, error);
            throw new Error(`Failed to extract timetable data using ${selectedProvider}: ${error.message}`);
        }
    }

    /**
     * Extract using OpenAI GPT-4
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
     * Extract using Google Gemini
     */
    async extractWithGemini(text, customApiKey = null) {
        const apiKey = customApiKey || process.env.GEMINI_API_KEY;
        const geminiClient = new GoogleGenerativeAI(apiKey);
        const model = geminiClient.getGenerativeModel({
            model: process.env.GEMINI_MODEL || 'gemini-1.5-pro'
        });

        const prompt = `${this.getSystemPrompt()}\n\n${this.buildExtractionPrompt(text)}\n\nIMPORTANT: Return ONLY valid JSON, no markdown formatting or additional text.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text();

        // Clean up Gemini's response (sometimes includes markdown)
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        return JSON.parse(responseText);
    }

    /**
     * Extract using Anthropic Claude
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
Extract all timetable events from the following text. Look for:
- Day of the week (Monday-Sunday)
- Time information (start time, end time, or duration)
- Event/Activity names (e.g., "Maths", "Registration", "Play", "Snack Time")
- Any additional notes or details

Text to analyze:
${text}

Return a JSON object with this exact structure:
{
    "timeblocks": [
        {
            "day": "Monday",
            "event_name": "Registration",
            "start_time": "09:00",
            "end_time": "09:15",
            "notes": "Optional notes",
            "confidence": 0.95
        }
    ],
    "metadata": {
        "total_events": 10,
        "days_covered": ["Monday", "Tuesday"],
        "extraction_notes": "Any issues or ambiguities"
    }
}

Rules:
- Use 24-hour time format (HH:MM)
- If duration is given instead of end time, calculate end time
- If time is ambiguous, use your best judgment and set confidence lower
- Preserve original event names exactly as written
- Valid days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- If no specific day is mentioned but times are clear, try to infer from context
- Return ONLY the JSON object, no additional text or markdown formatting
`;
    }

    validateAndNormalize(data) {
        if (!data.timeblocks || !Array.isArray(data.timeblocks)) {
            throw new Error('Invalid LLM response: missing timeblocks array');
        }

        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        const normalized = data.timeblocks.map(block => {
            // Validate day
            if (!validDays.includes(block.day)) {
                console.warn(`Invalid day: ${block.day}`);
                return null;
            }

            // Validate times
            if (!this.isValidTime(block.start_time) || !this.isValidTime(block.end_time)) {
                console.warn(`Invalid time for ${block.event_name}`);
                return null;
            }

            return {
                day: block.day,
                event_name: block.event_name.trim(),
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
                model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
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