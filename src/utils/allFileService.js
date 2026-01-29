const { ShareServiceClient } = require('@azure/storage-file-share');
const path = require('path');
require('dotenv').config({ 
    path: path.resolve(__dirname, '../../.env'), 
    override: true 
});

const getAllAzureFileService = () => {
    const sasUrl = process.env.SAS_URL;
    if (!sasUrl) throw new Error('SAS_URL not found in .env');

    const serviceClient = new ShareServiceClient(sasUrl);
    const shareClient = serviceClient.getShareClient('');

    
    const scanDirectory = async (dirClient, currentPath = '') => {
        const files = [];
        
        for await (const item of dirClient.listFilesAndDirectories()) {
            console.log(`${'  '.repeat(currentPath.split('/').length)}📁 ${item.name} (${item.kind})`);
            
            if (item.kind === 'file') {
                files.push({
                    fullPath: `${currentPath}/${item.name}`.replace(/^\//, ''),
                    folder: currentPath || 'root',
                    name: item.name,
                    size: item.properties.contentLength || 0,
                    lastModified: item.properties.lastModified
                });
                console.log('item details:',item);
                
            } else if (item.kind === 'directory') {
                // RECURSE into subfolder
                const subDirClient = dirClient.getDirectoryClient(item.name);
                const subFiles = await scanDirectory(subDirClient, `${currentPath}/${item.name}`);
                files.push(...subFiles);
            }
        }
        return files;
    };

    return {
        async getAllFiles() {
            console.log('🔍 Scanning ALL folders recursively...');
            return await scanDirectory(shareClient.rootDirectoryClient);
        }
    };
};

module.exports = { getAllAzureFileService };
