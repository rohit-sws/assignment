const OpenAI = require('openai');

class LLMService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async extractTimetableData(extractedText) {
        const prompt = this.buildExtractionPrompt(extractedText);

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
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
                temperature: 0.1 // Low temperature for consistency
            });

            const result = JSON.parse(response.choices[0].message.content);
            return this.validateAndNormalize(result);

        } catch (error) {
            console.error('LLM extraction error:', error);
            throw new Error('Failed to extract timetable data from document');
        }
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
}

module.exports = new LLMService();