const fs = require('fs');
const path = require('path');
require('dotenv').config();
const llmService = require('../src/services/llm.service');

const ARTIFACTS_DIR = '/Users/rohit/.gemini/antigravity/brain/27f49bd7-ff9c-4285-bbf6-f3ff63a0a0aa';

async function test() {
    // Testing with the provided image (likely Image 3 or the new one uploaded)
    // The user mentioned "Registration and Early Morning Work" which is in the complex timetable.
    // I'll test with the new image if available or one of the samples.
    // The user uploaded: uploaded_image_1764962749974.png

    // Check if new image exists in artifacts dir or use absolute path provided by user metadata?
    // User metadata says: /Users/rohit/.gemini/antigravity/brain/27f49bd7-ff9c-4285-bbf6-f3ff63a0a0aa/uploaded_image_1764962749974.png
    const file = path.join(ARTIFACTS_DIR, 'uploaded_image_1764962749974.png');

    if (!fs.existsSync(file)) {
        console.log('File not found:', file);
        return;
    }

    console.log('Testing extraction on:', file);
    try {
        const result = await llmService.extractTimetableData(file, 'gemini', 'image');

        console.log('--- Verification Results ---');
        console.log('Total Timeblocks:', result.timeblocks.length);

        // check for recurring blocks
        const breaks = result.timeblocks.filter(b => b.event_name.toLowerCase().includes('break'));
        console.log('Break blocks found:', breaks.length);
        breaks.forEach(b => console.log(`  - ${b.day}: ${b.start_time}-${b.end_time}`));

        const lunches = result.timeblocks.filter(b => b.event_name.toLowerCase().includes('lunch'));
        console.log('Lunch blocks found:', lunches.length);

        const registrations = result.timeblocks.filter(b => b.event_name.toLowerCase().includes('registration'));
        console.log('Registration blocks found:', registrations.length);

    } catch (e) {
        console.error('FAILED:', e.message);
        if (e.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
    }
}

test();
