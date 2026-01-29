// controller/azureApiController.js - UPDATED
const { processRecentFilesAndUpload, testConnection } = require('../utils/azureToApiService.js');
const axios = require('axios'); // Add this line

const path = require('path');
require('dotenv').config({ 
    path: path.resolve(__dirname, '../../.env'), 
    override: true 
});


// Add this constant at the top
const COMPANY_API_ENDPOINT = process.env.COMPANY_API_ENDPOINT || 'http://localhost:6001/s11e/v1/tenant/files/publish-flipout-data-call-analytics';

/**
 * Manual trigger for Azure to API job
 */
const runAzureToApiJob = async (req, res) => {
    try {
        console.log(`🔧 Manual job trigger received`);
        
        // Test connection first
        const connected = await testConnection();
        if (!connected) {
            return res.status(500).json({
                success: false,
                message: 'Cannot connect to Azure File Share'
            });
        }
        
        console.log(`🚀 Starting Azure Files to API processing...`);
        const startTime = Date.now();
        
        // Run the job
        const result = await processRecentFilesAndUpload();
        const duration = Date.now() - startTime;
        
        console.log(`✅ Job completed in ${duration}ms`);
        
        res.json({
            success: true,
            message: 'Azure files processed and sent to API',
            duration: `${duration}ms`,
            result: result,
            api: {
                endpoint: COMPANY_API_ENDPOINT, // Use the constant here
                note: 'Files from last 2 minutes are processed'
            }
        });
        
    } catch (error) {
        console.error('❌ Job controller error:', error.message);
        
        res.status(500).json({
            success: false,
            message: error.message,
            job: 'Azure Files to API Processing'
        });
    }
};

/**
 * Scheduled job endpoint (for cron jobs)
 */
const scheduledJob = async (req, res) => {
    try {
        console.log(`⏰ Scheduled job running at ${new Date().toISOString()}`);
        
        // Run in background, don't wait for response
        processRecentFilesAndUpload().catch(console.error);
        
        // Send immediate response
        res.json({
            success: true,
            message: 'Scheduled job started',
            time: new Date().toISOString(),
            note: 'Processing files from last 2 minutes',
            apiEndpoint: COMPANY_API_ENDPOINT // Add this
        });
        
    } catch (error) {
        console.error('Scheduled job error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Test API connection
 */
const testApiConnection = async (req, res) => {
    try {
        console.log('Testing API connection...');
        
        // Test Azure connection
        const azureConnected = await testConnection();
        
        // Test company API connection
        let apiConnected = false;
        try {
            // Try to reach the API base URL
            const apiBaseUrl = COMPANY_API_ENDPOINT.replace('/publish-flipout-data-call-analytics', '');
            const response = await axios.get(apiBaseUrl);
            apiConnected = response.status >= 200 && response.status < 300;
        } catch (error) {
            apiConnected = false;
        }
        
        res.json({
            success: true,
            connections: {
                azure: azureConnected ? '✅ Connected' : '❌ Failed',
                companyApi: apiConnected ? '✅ Connected' : '❌ Failed',
                apiEndpoint: COMPANY_API_ENDPOINT
            },
            ready: azureConnected && apiConnected,
            testUrl: COMPANY_API_ENDPOINT
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
};

module.exports = {
    runAzureToApiJob,
    scheduledJob,
    testApiConnection
};