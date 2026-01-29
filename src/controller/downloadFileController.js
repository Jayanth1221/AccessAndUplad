// controller/downloadFileController.js - IMPROVED VERSION
const { getAzureFileService } = require('../utils/downloadFileService.js');

const downloadFile = async (req, res) => {
    try {
        // Support both filepath and filePath
        const filepath = req.query.filepath || req.query.filePath;
        
        // Log for debugging
        console.log(`📥 Download request received`);
        console.log(`   Path parameter: ${filepath || '(empty)'}`);
        console.log(`   Query params:`, Object.keys(req.query).length > 0 ? req.query : 'none');
        console.log(`   Referrer: ${req.headers.referer || 'direct access'}`);
        
        // ⭐⭐⭐ NEW: Check if it's a direct browser visit (no referrer, no params)
        const isDirectBrowserVisit = !filepath && 
                                   !req.headers.referer && 
                                   req.headers['user-agent']?.includes('Mozilla');
        
        if (isDirectBrowserVisit) {
            console.log('🌐 Direct browser visit detected - showing help page');
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>File Download API</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; }
                        .box { border: 1px solid #ccc; padding: 20px; border-radius: 5px; }
                        code { background: #f5f5f5; padding: 2px 5px; }
                        a { color: #0066cc; }
                    </style>
                </head>
                <body>
                    <h1>📁 File Download API</h1>
                    <div class="box">
                        <p>This endpoint is for downloading files from Azure File Share.</p>
                        
                        <h3>Usage:</h3>
                        <p>Add <code>?filePath=</code> parameter with the file path:</p>
                        <code>GET /apiFiles/download?filePath=Call%20Recordings/Existing%20Booking/Add%20Kid/filename.wav</code>
                        
                        <h3>Examples:</h3>
                        <ul>
                            <li><a href="/apiFiles/download?filePath=Call%20Recordings/Existing%20Booking/Add%20Kid/54bd75b6-8fe6-4de7-ba5a-f16ae7edca40.wav" target="_blank">Test Download</a></li>
                            <li><a href="/apiFiles/allFilles" target="_blank">View Available Files</a></li>
                        </ul>
                        
                        <h3>Available Endpoints:</h3>
                        <ul>
                            <li><a href="/apiFiles/allFilles">List all files</a></li>
                            <li><a href="/apiFiles">API Home</a></li>
                            <li><a href="/">Main Page</a></li>
                        </ul>
                    </div>
                </body>
                </html>
            `);
        }
        
        // Validate input
        if (!filepath) {
            console.warn('⚠️ Missing file path parameter');
            
            // If it's an API request (not browser), return JSON
            const isApiRequest = req.headers.accept?.includes('application/json') || 
                               req.headers['content-type']?.includes('application/json');
            
            if (isApiRequest) {
                return res.status(400).json({
                    success: false,
                    message: 'File path is required',
                    example: '/apiFiles/download?filePath=folder/file.pdf',
                    availableEndpoints: {
                        listFiles: '/apiFiles/allFilles',
                        apiHome: '/apiFiles'
                    }
                });
            } else {
                // For browser, redirect to help
                return res.redirect('/apiFiles/download#help');
            }
        }
        
        // Decode URL-encoded path
        const decodedPath = decodeURIComponent(filepath);
        console.log(`🔍 Downloading: "${decodedPath}"`);
        
        // Get Azure service
        const azureService = getAzureFileService();
        
        // Download file
        const { stream, properties, fileName } = await azureService.downloadFile(decodedPath);
        
        console.log(`✅ File ready: ${fileName} (${properties.contentLength} bytes)`);
        
        // Set download headers
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', properties.contentType || 'application/octet-stream');
        res.setHeader('Content-Length', properties.contentLength);
        
        if (properties.lastModified) {
            res.setHeader('Last-Modified', new Date(properties.lastModified).toUTCString());
        }
        
        console.log(`🚀 Streaming file: ${fileName}`);
        
        // Pipe the stream directly
        stream.pipe(res);
        
        stream.on('end', () => {
            console.log(`✅ Download completed: ${fileName}`);
        });
        
        stream.on('error', (streamError) => {
            console.error('❌ Stream error:', streamError.message);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Download failed',
                    error: streamError.message
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Download error:', error.message);
        
        // Check if headers already sent
        if (res.headersSent) {
            console.log('⚠️ Headers already sent, cannot send error response');
            return;
        }
        
        // User-friendly error responses
        const errorResponse = {
            success: false,
            message: error.message
        };
        
        if (error.message.includes('not found')) {
            errorResponse.suggestion = 'Check the file path exists in Azure File Share';
            errorResponse.example = 'Call Recordings/Existing Booking/Add Kid/file.wav';
            res.status(404).json(errorResponse);
        } else if (error.message.includes('authorization')) {
            errorResponse.solution = 'Check SAS token permissions in .env file';
            res.status(403).json(errorResponse);
        } else {
            res.status(500).json(errorResponse);
        }
    }
};

module.exports = { downloadFile };