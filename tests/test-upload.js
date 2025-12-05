const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:3000/api';

async function testProviders() {
    try {
        console.log('🔍 Fetching available LLM providers...\n');
        const response = await axios.get(`${API_BASE_URL}/timetables/providers`);
        console.log('Available Providers:');
        console.log(JSON.stringify(response.data, null, 2));
        return response.data.providers;
    } catch (error) {
        console.error('❌ Failed to fetch providers:', error.message);
        return [];
    }
}

async function testUpload(provider = 'openai', apiKey = null) {
    try {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🧪 Testing timetable upload with ${provider.toUpperCase()}...`);
        console.log('='.repeat(50));

        // Create form data
        const form = new FormData();
        const filePath = path.join(__dirname, 'sample-timetables', 'sample-timetable.txt');

        form.append('timetable', fs.createReadStream(filePath));
        form.append('llm_provider', provider);

        if (apiKey) {
            form.append('api_key', apiKey);
        }

        // Upload
        console.log('📤 Uploading timetable...');
        const response = await axios.post(`${API_BASE_URL}/timetables/upload`, form, {
            headers: form.getHeaders()
        });

        console.log('✅ Upload successful!');
        console.log(`\n📊 Provider Used: ${response.data.llm_provider_used}`);
        console.log('\n📋 Extracted Timeblocks:');

        if (response.data.data.timeblocks) {
            response.data.data.timeblocks.forEach(block => {
                console.log(`  ${block.day}: ${block.event_name} (${block.start_time} - ${block.end_time})`);
            });
        }

        console.log('\n📄 Full Response:');
        console.log(JSON.stringify(response.data, null, 2));

        return response.data.data.id;

    } catch (error) {
        console.error(`❌ Test failed for ${provider}:`, error.response?.data || error.message);
        return null;
    }
}

async function runTests() {
    console.log('🚀 Starting LLM Provider Tests\n');

    // Test 1: Get available providers
    const providers = await testProviders();

    if (providers.length === 0) {
        console.log('\n⚠️  No providers configured. Please set API keys in .env file.');
        return;
    }

    // Test 2: Upload with each available provider
    for (const provider of providers) {
        if (provider.available) {
            await testUpload(provider.name);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between tests
        }
    }

    console.log('\n✅ All tests completed!');
}

// Run tests
runTests();