// scheduledJob.js
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  override: true
});
const { processRecentFilesAndUpload } = require('./utils/azureToApiService.js');

async function runScheduledJob() {
    const now = new Date();
    console.log(`\n⏰ SCHEDULED JOB - ${now.toISOString()}`);
    console.log('='.repeat(60));
    
    try {
        const result = await processRecentFilesAndUpload();
        
        console.log(`\n📊 Job Summary:`);
        console.log(`   Total files: ${result.totalFound}`);
        console.log(`   Processed: ${result.processed}`);
        console.log(`   Failed: ${result.failed}`);
        console.log(`   Next run: ${new Date(now.getTime() + 2 * 60000).toLocaleTimeString()}`);
        
    } catch (error) {
        console.error(`❌ Scheduled job failed:`, error.message);
    }
}

// Run immediately
runScheduledJob();

// Schedule to run every 2 minutes
setInterval(runScheduledJob, 2 * 60 * 1000);