const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:3000/api';

async function testUpload() {
    try {
        console.log('🧪 Testing timetable upload...\n');

        // Create form data
        const form = new FormData();
        const filePath = path.join(__dirname, 'sample-timetables', 'sample-timetable.txt');

        // For testing, we'll send as text file
        form.append('timetable', fs.createReadStream(filePath));
        form.append('teacher_id', '1');

        // Upload
        console.log('📤 Uploading timetable...');
        const response = await axios.post(`${API_BASE_URL}/timetables/upload`, form, {
            headers: form.getHeaders()
        });

        console.log('✅ Upload successful!');
        console.log('\n📊 Response:');
        console.log(JSON.stringify(response.data, null, 2));

        // Get the timetable
        const timetableId = response.data.data.id;
        console.log(`\n📖 Fetching timetable ${timetableId}...`);

        const getResponse = await axios.get(`${API_BASE_URL}/timetables/${timetableId}`);
        console.log('\n📋 Timetable details:');
        console.log(JSON.stringify(getResponse.data, null, 2));

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

testUpload();