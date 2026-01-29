// controller/lastTwoMinutesController.js
const { getLastTwoMinutesFiles, testConnection } = require('../utils/lastTwoMinutesService.js');

/**
 * Get files from last 2 minutes ONLY - NO OPTIONS
 */
const getLastTwoMinutesFilesAPI = async (req, res) => {
    try {
        console.log(`🕒 API Called: Fetching last 2 minutes files`);
        console.log(`Time: ${new Date().toLocaleTimeString()}`);
        
        // Fixed: No query parameters accepted
        if (Object.keys(req.query).length > 0) {
            console.log('⚠️ Extra parameters ignored - this API only returns last 2 minutes files');
        }
        
        // Test connection
        const connected = await testConnection();
        if (!connected) {
            return res.status(500).json({
                success: false,
                message: 'Cannot connect to Azure File Share'
            });
        }
        
        // Get files from last 2 minutes
        const files = await getLastTwoMinutesFiles();
        
        // Calculate summary
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - (2 * 60 * 1000));
        
        const response = {
            success: true,
            count: files.length,
            timeRange: {
                from: twoMinutesAgo.toISOString(),
                to: now.toISOString(),
                description: 'Last 2 minutes'
            },
            summary: {
                totalFiles: files.length,
                totalSize: totalSize,
                sizeReadable: formatBytes(totalSize),
                newestFile: files[0]?.minutesAgo || 'none',
                oldestFile: files[files.length - 1]?.minutesAgo || 'none'
            },
            files: files.map(file => ({
                name: file.name,
                path: file.path,
                size: file.size,
                sizeReadable: formatBytes(file.size),
                lastModified: file.lastModified,
                minutesAgo: file.minutesAgo,
                contentType: file.contentType,
                downloadUrl: `/apiFiles/download?filePath=${encodeURIComponent(file.path)}`
            })),
            note: 'This API always returns files from last 2 minutes only. No parameters needed.'
        };
        
        console.log(`✅ Returning ${files.length} files from last 2 minutes`);
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ API error:', error.message);
        
        res.status(500).json({
            success: false,
            message: error.message,
            apiInfo: 'GET /apiFiles/lastTwoMinutes - returns files modified in last 2 minutes'
        });
    }
};

/**
 * Format bytes to human readable
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = {
    getLastTwoMinutesFilesAPI
};