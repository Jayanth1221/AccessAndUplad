const { ShareServiceClient } = require('@azure/storage-file-share');
const path = require('path');
require('dotenv').config({ 
    path: path.resolve(__dirname, '../../.env'), 
    override: true 
});

const getAzureFileService = () => {
    const sasUrl = process.env.SAS_URL;
    
    if (!sasUrl) {
        console.error('SAS_URL is not set in .env file');
        throw new Error('SAS_URL not found in .env. Check your .env file.');
    }
    
    console.log('✅ SAS_URL loaded successfully');
    
    const serviceClient = new ShareServiceClient(sasUrl);
    const shareClient = serviceClient.getShareClient('');

    return {
        async downloadFile(filePath) {
            try {
                // Remove leading slash if present
                const normalizedPath = filePath.replace(/^\//, '');
                
                console.log(`🔍 Looking for file: "${normalizedPath}"`);
                
                // Split path into directory and filename
                const pathParts = normalizedPath.split('/');
                const fileName = pathParts.pop();
                const directoryPath = pathParts.join('/');
                console.log(`📁 Directory path: ${directoryPath || '(root)'}`);
                console.log(`📄 File name: ${fileName}`);
                
                // Get directory client
                let dirClient;
                if (directoryPath && directoryPath.trim() !== '') {
                    dirClient = shareClient.getDirectoryClient(directoryPath);
                } else {
                    dirClient = shareClient.rootDirectoryClient;
                }
                
                // Get file client
                const fileClient = dirClient.getFileClient(fileName);
                
                console.log('🔍 Checking if file exists...');
                
                // Get file properties first
                const properties = await fileClient.getProperties();
                console.log(`✅ File found! Size: ${properties.contentLength} bytes`);
                
                // Download the file
                const downloadResponse = await fileClient.download();
                console.log("last modified: ",properties.lastModified);
                
                
                if (!downloadResponse.readableStreamBody) {
                    throw new Error('File stream is empty or not available');
                }
                
                return {
                    stream: downloadResponse.readableStreamBody,
                    properties: properties,
                    fileName: fileName
                };
                
            } catch (error) {
                console.error('❌ Azure download error:', error.message);
                
                // Handle specific Azure errors
                if (error.statusCode === 404) {
                    throw new Error(`File not found: "${filePath}"`);
                } else if (error.code === 'ResourceNotFound') {
                    throw new Error(`File or directory not found: "${filePath}"`);
                } else if (error.message.includes('authorization')) {
                    throw new Error(`Authorization failed. Check your SAS URL: ${error.message}`);
                }
                
                throw error;
            }
        }
    };
};

module.exports = { getAzureFileService };