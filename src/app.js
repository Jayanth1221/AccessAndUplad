const express = require('express');
const app = express();

const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  override: true
});


const PORT = process.env.PORT || 7000;


// Controllers (IMPORT ONCE)
const { getAllFiles } = require('./controller/allFileController');
const { downloadFile } = require('./controller/downloadFileController');
const { uploadFolder, testUpload } = require('./controller/uploadFolderController');
const { getRecentFiles } = require('./controller/recentFilesController.js');



const cors = require('cors');
app.use(express.json());
app.use(cors());


app.get('/', (req, res) => {
  res.send('View File API');
});

app.get('/apiFiles', (req, res) => {
  res.send('API is running successfully');
});


app.get('/apiFiles/allFile',getAllFiles)

app.get('/apiFiles/download', downloadFile);


// Upload APIs
app.post('/apiFiles/uploadFolder', uploadFolder);
app.get('/apiFiles/test-upload', testUpload);


// Add this route (replace existing if you have one)
app.get('/apiFiles/recentFiles', getRecentFiles);



// web interface
const {recentFileView}=require('./ui-view/recentFileView.js')
const {folderUiPage}=require('./ui-view/folderUiPage.js')
const {lastTwoMinView}=require('./ui-view/lastTwoMinView.js')

app.get('/apiFiles/recentFiles/view', recentFileView);
app.get('/apiFiles/uploadFolder',folderUiPage );
app.get('/apiFiles/lastTwoMinutes/view',lastTwoMinView );


// Chekking 
const { getLastTwoMinutesFilesAPI } = require('./controller/lastTwoMinutesController.js');
app.get('/apiFiles/lastTwoMinutes', getLastTwoMinutesFilesAPI);





// In app.js - add these imports
const { runAzureToApiJob, scheduledJob, testApiConnection } = require('./controller/azureApiController.js');
const axios = require('axios'); // Add at top with other imports

// Add these routes
app.post('/apiFiles/process-and-upload', runAzureToApiJob);
app.get('/apiFiles/scheduled-job', scheduledJob);
app.get('/apiFiles/test-api-connection', testApiConnection);

// Web interface for the job
app.get('/apiFiles/process-job/view', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Azure Files to API Processor</title>
            <style>
                body { font-family: Arial; margin: 40px; }
                .card { border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 5px; }
                .btn { background: #4CAF50; color: white; padding: 10px 20px; border: none; cursor: pointer; border-radius: 4px; }
                .btn:hover { background: #45a049; }
                .btn:disabled { background: #cccccc; }
                .status-box { margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>📤 Azure Files to API Processor</h1>
            
            <div class="card">
                <h3>Process Last 2 Minutes Files</h3>
                <p>Fetches files from Azure File Share (last 2 minutes) and uploads to company API</p>
                
                <button class="btn" onclick="runJob()" id="runBtn">
                    🚀 Run Processing Job
                </button>
                
                <div id="status" class="status-box">
                    <p>Click the button above to start processing</p>
                </div>
            </div>
            
            <div class="card">
                <h3>📋 Job Information</h3>
                <p><strong>Time Window:</strong> Last 2 minutes</p>
                <p><strong>File Types:</strong> .mp3, .wav files with .json metadata</p>
                <p><strong>Process:</strong> 
                  1. Fetch files from Azure (last 2 min)<br>
                  2. Generate download URLs<br>
                  3. Send to company API<br>
                  4. Report results
                </p>
            </div>
            
            <div class="card">
                <h3>🔗 Other Endpoints</h3>
                <ul>
                    <li><a href="/apiFiles">API Home</a></li>
                    <li><a href="/apiFiles/allFilles">List all files</a></li>
                    <li><a href="/apiFiles/lastTwoMinutes">Last 2 minutes API</a></li>
                    <li><a href="/apiFiles/test-api-connection">Test API Connection</a></li>
                </ul>
            </div>
            
            <script>
                async function runJob() {
                    const btn = document.getElementById('runBtn');
                    const statusDiv = document.getElementById('status');
                    
                    // Disable button and show loading
                    btn.disabled = true;
                    btn.innerHTML = '⏳ Processing...';
                    statusDiv.innerHTML = '<p><strong>Starting job...</strong></p><p>Fetching files from last 2 minutes...</p>';
                    
                    try {
                        const response = await fetch('/apiFiles/process-and-upload', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            }
                        });
                        
                        const result = await response.json();
                        
                        let html = '';
                        
                        if (result.success) {
                            html += \`
                                <h4 style="color: #4CAF50;">✅ Job Completed Successfully</h4>
                                <p><strong>Duration:</strong> \${result.duration}</p>
                                <p><strong>Files found:</strong> \${result.result?.totalFound || 0}</p>
                                <p><strong>Processed:</strong> \${result.result?.processed || 0}</p>
                                <p><strong>Failed:</strong> \${result.result?.failed || 0}</p>
                            \`;
                            
                            if (result.result?.processedFiles && result.result.processedFiles.length > 0) {
                                html += \`<h5>📁 Processed Files:</h5><ul>\`;
                                result.result.processedFiles.forEach(file => {
                                    html += \`<li><strong>\${file.file}</strong> - API Status: \${file.apiStatus}</li>\`;
                                });
                                html += \`</ul>\`;
                            }
                            
                            if (result.result?.failedFiles && result.result.failedFiles.length > 0) {
                                html += \`<h5 style="color: #f44336;">❌ Failed Files:</h5><ul>\`;
                                result.result.failedFiles.forEach(file => {
                                    html += \`<li>\${file.file}: \${file.error}</li>\`;
                                });
                                html += \`</ul>\`;
                            }
                            
                        } else {
                            html += \`<h4 style="color: #f44336;">❌ Job Failed</h4>\`;
                            html += \`<p>\${result.message}</p>\`;
                        }
                        
                        html += \`<p><small>Completed at: \${new Date().toLocaleTimeString()}</small></p>\`;
                        statusDiv.innerHTML = html;
                        
                    } catch (error) {
                        statusDiv.innerHTML = \`
                            <h4 style="color: #f44336;">❌ Error</h4>
                            <p>\${error.message}</p>
                            <p>Check if the server is running and try again.</p>
                        \`;
                    } finally {
                        // Re-enable button
                        btn.disabled = false;
                        btn.innerHTML = '🚀 Run Processing Job';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
