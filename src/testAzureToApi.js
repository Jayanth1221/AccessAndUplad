// testAzureToApi.js
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  override: true
});

console.log('=== TEST AZURE FILES TO API INTEGRATION ===\n');

const { processRecentFilesAndUpload, testConnection } = require('./utils/azureToApiService.js');

async function testIntegration() {
    console.log('1. Testing Azure connection...');
    const azureConnected = await testConnection();
    
    if (!azureConnected) {
        console.log('❌ Cannot proceed - Azure connection failed');
        return;
    }
   
    console.log('✅ Azure connection OK\n');
    
    console.log('2. Testing company API...');
    try {
        // Simple test to see if API endpoint is reachable
        const axios = require('axios');
        const response = await axios.get('http://localhost:6001/s11e/v1/tenant/files/');
        console.log(`✅ Company API reachable: ${response.status}`);
    } catch (error) {
        console.log(`⚠️ Company API may not be available: ${error.message}`);
        console.log('Will still test file processing...\n');
    }
    
    console.log('3. Processing recent files...\n');
    
    try {
        const startTime = Date.now();
        const result = await processRecentFilesAndUpload();
        const duration = Date.now() - startTime;
        
        console.log(`\n🎯 PROCESSING COMPLETE (${duration}ms)`);
        console.log('='.repeat(60));
        
        console.log(`📊 Results:`);
        console.log(`   Files found: ${result.totalFound}`);
        console.log(`   Successfully processed: ${result.processed}`);
        console.log(`   Failed: ${result.failed}`);
        
        if (result.processedFiles && result.processedFiles.length > 0) {
            console.log(`\n📁 Processed files:`);
            result.processedFiles.forEach((file, i) => {
                console.log(`   ${i + 1}. ${file.file}`);
                console.log(`      Status: ${file.apiStatus}`);
                console.log(`      Audio: ${file.payload.audio_download_link.substring(0, 60)}...`);
                if (file.payload.metadata_download_link) {
                    console.log(`      JSON: ${file.payload.metadata_download_link.substring(0, 60)}...`);
                }
                console.log('');
            });
        }
        
        console.log('\n📋 API Endpoints to use:');
        console.log('1. POST /apiFiles/process-and-upload (Manual trigger)');
        console.log('2. GET /apiFiles/scheduled-job (For cron jobs)');
        console.log('3. GET /apiFiles/process-job/view (Web interface)');
        
    } catch (error) {
        console.log(`❌ Processing failed: ${error.message}`);
    }
}

testIntegration();