const { ShareServiceClient } = require('@azure/storage-file-share');
//.env files
const path = require('path');
require('dotenv').config({ 
    path: path.resolve(__dirname, '../../.env'),  // Force ROOT .env
    override: true 
});

const getAzureFileService = () => {
    const sasUrl = process.env.SAS_URL;
    if (!sasUrl) throw new Error('SAS_URL not found in .env');
    
    const serviceClient = new ShareServiceClient(sasUrl);
    const shareClient = serviceClient.getShareClient('');
    
    return {
        async getRecentFiles() {
            const recentFiles = [];
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            const directoryClient = shareClient.rootDirectoryClient;

            for await (const item of directoryClient.listFilesAndDirectories()) {
                if (item.kind === 'file' && item.properties.lastModified > twoMinutesAgo) {
                    recentFiles.push({
                        name: item.name,
                        lastModified: item.properties.lastModified,
                        size: item.properties.contentLength || 0
                    });
                }
            }
            return recentFiles;
        }
    };
};

module.exports = { getAzureFileService };
