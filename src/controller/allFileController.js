// controller/allFileController.js
const { getAllAzureFileService } = require('../utils/allFileService');

const getAllFiles = async (req, res) => {
    try {
        console.log('📂 API: Getting ALL files recursively...');
        
        const azureService = getAllAzureFileService();
        const allFiles = await azureService.getAllFiles();
        
        // Optional: Add filtering via query params
        const { folder, extension, minSize, maxSize } = req.query;
        
        let filteredFiles = allFiles;
        console.log('"details:',allFiles);
        
        
        if (folder) {
            filteredFiles = filteredFiles.filter(file => 
                file.folder.includes(folder) || file.fullPath.includes(folder)
            );
        }
        
        if (extension) {
            filteredFiles = filteredFiles.filter(file => 
                file.name.toLowerCase().endsWith(extension.toLowerCase())
            );
        }
        
        if (minSize) {
            filteredFiles = filteredFiles.filter(file => 
                file.size >= parseInt(minSize)
            );
        }
        
        if (maxSize) {
            filteredFiles = filteredFiles.filter(file => 
                file.size <= parseInt(maxSize)
            );
        }
        
        // Sort options
        const sortBy = req.query.sortBy || 'name';
        const sortOrder = req.query.sortOrder || 'asc';
        
        filteredFiles.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            
            if (sortBy === 'lastModified') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }
            
            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        res.json({
            success: true,
            count: filteredFiles.length,
            totalSize: filteredFiles.reduce((sum, file) => sum + file.size, 0),
            files: filteredFiles,
            filters: {
                folder: folder || 'none',
                extension: extension || 'none',
                minSize: minSize || 'none',
                maxSize: maxSize || 'none',
                sortBy,
                sortOrder
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error in getAllRecentFiles:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to fetch all files'
        });
    }
};

module.exports = { getAllFiles };