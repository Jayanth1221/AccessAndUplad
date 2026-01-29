// controller/uploadFolderController.js
const { uploadFolderToAzure, testConnection } = require('../utils/uploadFolderService.js');
const path = require('path');

/**
 * Upload folder via API
 */
const uploadFolder = async (req, res) => {
    try {
        // Get parameters from query or body
        const localPath = req.query.localPath || req.body.localPath;
        const remotePath = req.query.remotePath || req.body.remotePath || '';
        
        if (!localPath) {
            return res.status(400).json({
                success: false,
                message: 'Local folder path is required',
                example: '/apiFiles/uploadFolder?localPath=/Users/name/Desktop/myfolder&remotePath=uploads/project1',
                note: 'Use forward slashes in remotePath'
            });
        }
        
        console.log(`📤 Upload request:`);
        console.log(`   Local: ${localPath}`);
        console.log(`   Remote: ${remotePath || '(root)'}`);
        
        // Test connection first
        const connected = await testConnection();
        if (!connected) {
            return res.status(500).json({
                success: false,
                message: 'Cannot connect to Azure File Share'
            });
        }
        
        // Upload folder
        const result = await uploadFolderToAzure(localPath, remotePath);
        
        res.json({
            success: true,
            message: 'Folder upload completed',
            summary: {
                total: result.total,
                successful: result.successful,
                failed: result.failed
            },
            details: result.details.slice(0, 10), // Show first 10 files
            api: {
                method: 'POST',
                endpoint: '/apiFiles/uploadFolder',
                body: { localPath: '/path/to/local', remotePath: 'optional/remote/path' }
            }
        });
        
    } catch (error) {
        console.error('❌ Upload controller error:', error.message);
        
        if (error.message.includes('not found') || error.message.includes('ENOENT')) {
            return res.status(404).json({
                success: false,
                message: 'Local folder not found',
                path: req.query.localPath || req.body.localPath,
                tip: 'Use absolute path like C:/Users/name/Desktop/folder'
            });
        }
        
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Test upload with a sample folder
 */
const testUpload = async (req, res) => {
    try {
        // Create a test folder on desktop
        const testFolderPath = path.join(require('os').homedir(), 'Desktop', 'azure-upload-test');
        
        console.log(`🧪 Creating test folder: ${testFolderPath}`);
        
        // Check if test folder exists, create if not
        const fs = require('fs').promises;
        try {
            await fs.access(testFolderPath);
            console.log('Test folder already exists');
        } catch {
            await fs.mkdir(testFolderPath, { recursive: true });
            
            // Create test files
            await fs.writeFile(path.join(testFolderPath, 'test1.txt'), 'Hello Azure!');
            await fs.writeFile(path.join(testFolderPath, 'test2.txt'), 'Upload test file');
            
            // Create a subfolder
            const subFolder = path.join(testFolderPath, 'documents');
            await fs.mkdir(subFolder, { recursive: true });
            await fs.writeFile(path.join(subFolder, 'document.pdf'), 'PDF content placeholder');
            
            console.log('Created 3 test files');
        }
        
        // Upload test folder
        const result = await uploadFolderToAzure(testFolderPath, 'test-uploads');
        
        res.json({
            success: true,
            message: 'Test upload completed',
            testFolder: testFolderPath,
            result: result
        });
        
    } catch (error) {
        console.error('Test upload error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};




module.exports = {
    uploadFolder,
    testUpload,
    
};