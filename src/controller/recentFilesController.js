// controller/recentFilesController.js
const { 
    getRecentFilesFromAzure, 
    getFilesByDateRange,
    getRecentFilesFast,
    testConnection 
} = require('../utils/recentFilesService.js');

/**
 * Get recent files (last 24 hours by default)
 */
const getRecentFiles = async (req, res) => {
    try {
        const { 
            hours = 24, 
            directory = '', 
            limit,
            fast = 'false',
            startDate,
            endDate 
        } = req.query;
        
        console.log(`📅 Recent files request:`, {
            hours,
            directory,
            limit,
            fast,
            startDate,
            endDate
        });
        
        // Validate hours parameter
        const hoursBack = parseInt(hours);
        if (isNaN(hoursBack) || hoursBack < 1 || hoursBack > 720) { // Max 30 days
            return res.status(400).json({
                success: false,
                message: 'Hours parameter must be between 1 and 720 (30 days)',
                received: hours
            });
        }
        
        // Test connection first
        const connected = await testConnection();
        if (!connected) {
            return res.status(500).json({
                success: false,
                message: 'Cannot connect to Azure File Share'
            });
        }
        
        let recentFiles;
        
        // Choose method based on parameters
        if (startDate) {
            // Date range search
            const start = new Date(startDate);
            const end = endDate ? new Date(endDate) : new Date();
            
            if (isNaN(start.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid startDate format',
                    example: '2024-01-20T10:30:00.000Z'
                });
            }
            
            console.log(`📊 Date range search: ${start.toISOString()} to ${end.toISOString()}`);
            recentFiles = await getFilesByDateRange(directory, start, end);
            
        } else if (fast === 'true') {
            // Fast method (may miss some properties)
            console.log('🚀 Using fast search method');
            recentFiles = await getRecentFilesFast(directory, hoursBack);
        } else {
            // Standard recursive method
            console.log(`🔍 Searching last ${hoursBack} hours recursively`);
            recentFiles = await getRecentFilesFromAzure(directory, hoursBack);
        }
        
        // Apply limit if specified
        if (limit && !isNaN(parseInt(limit))) {
            const limitNum = parseInt(limit);
            recentFiles = recentFiles.slice(0, limitNum);
        }
        
        // Calculate summary
        const totalSize = recentFiles.reduce((sum, file) => sum + (file.size || 0), 0);
        const filesByType = recentFiles.reduce((acc, file) => {
            const ext = file.name.split('.').pop().toLowerCase();
            acc[ext] = (acc[ext] || 0) + 1;
            return acc;
        }, {});
        
        const response = {
            success: true,
            count: recentFiles.length,
            timeRange: {
                hours: hoursBack,
                from: new Date(Date.now() - (hoursBack * 60 * 60 * 1000)).toISOString(),
                to: new Date().toISOString(),
                requestedAt: new Date().toISOString()
            },
            summary: {
                totalFiles: recentFiles.length,
                totalSize: totalSize,
                sizeReadable: formatBytes(totalSize),
                fileTypes: filesByType
            },
            files: recentFiles.map(file => ({
                name: file.name,
                path: file.path,
                size: file.size,
                sizeReadable: formatBytes(file.size),
                lastModified: file.lastModified,
                contentType: file.contentType,
                ageInHours: file.ageInHours || Math.round(
                    (Date.now() - new Date(file.lastModified).getTime()) / (1000 * 60 * 60)
                ),
                downloadUrl: `/apiFiles/download?filePath=${encodeURIComponent(file.path)}`
            })),
            api: {
                endpoint: '/apiFiles/recentFiles',
                parameters: {
                    hours: 'Last N hours (default: 24)',
                    directory: 'Directory to search in (optional)',
                    limit: 'Max number of files to return',
                    fast: 'Use faster search method (true/false)',
                    startDate: 'Start date (ISO format)',
                    endDate: 'End date (ISO format, defaults to now)'
                },
                examples: [
                    '/apiFiles/recentFiles?hours=24',
                    '/apiFiles/recentFiles?hours=48&directory=uploads',
                    '/apiFiles/recentFiles?hours=24&limit=10',
                    '/apiFiles/recentFiles?startDate=2024-01-20T00:00:00Z&endDate=2024-01-21T00:00:00Z'
                ]
            }
        };
        
        console.log(`✅ Returning ${recentFiles.length} recent files`);
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ Recent files controller error:', error.message);
        
        res.status(500).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
    getRecentFiles
};