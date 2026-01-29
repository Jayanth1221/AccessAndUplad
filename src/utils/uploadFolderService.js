// utils/uploadFolderService.js
const { ShareServiceClient, AnonymousCredential } = require("@azure/storage-file-share");
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

/**
 * Upload entire folder to Azure File Share
 * @param {string} localFolderPath - Local folder path (e.g., "/Users/name/Desktop/myfolder")
 * @param {string} remoteBasePath - Remote base path in Azure (e.g., "uploads/projects")
 * @returns {Promise<Object>} - Upload results summary
 */
async function uploadFolderToAzure(localFolderPath, remoteBasePath = '') {
    try {
        const sasUrl = process.env.SAS_URL;
        
        if (!sasUrl) {
            throw new Error("SAS_URL not found in .env");
        }

        console.log(`📂 Starting folder upload...`);
        console.log(`Local: ${localFolderPath}`);
        console.log(`Remote: ${remoteBasePath || '(root)'}`);

        // Validate local folder
        try {
            const stats = await fs.stat(localFolderPath);
            if (!stats.isDirectory()) {
                throw new Error(`Path is not a directory: ${localFolderPath}`);
            }
        } catch (error) {
            throw new Error(`Local folder not found: ${localFolderPath}`);
        }

        // Parse Azure URL
        const url = new URL(sasUrl);
        const shareName = url.pathname.split('/')[1];
        
        console.log(`Azure Share: ${shareName}`);
        console.log(`Permissions: ${url.searchParams.get('sp')}`);

        // Create service client (using Method 2 that works)
        const accountSasUrl = `https://${url.hostname}/?${url.searchParams.toString()}`;
        const serviceClient = new ShareServiceClient(accountSasUrl, new AnonymousCredential());
        const shareClient = serviceClient.getShareClient(shareName);

        // Test connection
        try {
            await shareClient.getProperties();
            console.log(`✅ Connected to Azure File Share`);
        } catch (error) {
            throw new Error(`Connection failed: ${error.message}`);
        }

        // Read all files from local folder
        const allFiles = await getAllFiles(localFolderPath);
        console.log(`📊 Found ${allFiles.length} files to upload`);

        // Upload all files
        const results = {
            total: allFiles.length,
            successful: 0,
            failed: 0,
            details: []
        };

        for (const localFile of allFiles) {
            try {
                await uploadSingleFile(
                    shareClient, 
                    localFile, 
                    localFolderPath, 
                    remoteBasePath
                );
                
                results.successful++;
                results.details.push({
                    file: localFile.relativePath,
                    status: '✅ Success',
                    size: localFile.size
                });
                
            } catch (fileError) {
                results.failed++;
                results.details.push({
                    file: localFile.relativePath,
                    status: '❌ Failed',
                    error: fileError.message
                });
                
                console.error(`Failed: ${localFile.relativePath} - ${fileError.message}`);
            }
        }

        console.log(`\n🎯 Upload Complete:`);
        console.log(`✅ Successful: ${results.successful}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log(`📁 Destination: ${remoteBasePath || 'root'}`);

        return results;

    } catch (error) {
        console.error('❌ Folder upload error:', error.message);
        throw error;
    }
}

/**
 * Get all files from folder recursively
 */
async function getAllFiles(dir, baseDir = dir) {
    const items = await fs.readdir(dir);
    const files = [];

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
            // Recursively get files from subdirectory
            const subFiles = await getAllFiles(fullPath, baseDir);
            files.push(...subFiles);
        } else {
            // It's a file
            const relativePath = path.relative(baseDir, fullPath);
            
            // Convert Windows backslashes to forward slashes for Azure
            const azurePath = relativePath.split(path.sep).join('/');
            
            files.push({
                fullPath: fullPath,
                relativePath: azurePath,
                size: stat.size,
                name: item
            });
        }
    }

    return files;
}

/**
 * Upload single file to Azure
 */
async function uploadSingleFile(shareClient, fileInfo, localBasePath, remoteBasePath) {
    console.log(`⬆️  Uploading: ${fileInfo.relativePath} (${formatBytes(fileInfo.size)})`);
    
    // Create remote path (combine base path with file's relative path)
    let remoteFilePath = fileInfo.relativePath;
    if (remoteBasePath) {
        remoteFilePath = `${remoteBasePath}/${fileInfo.relativePath}`;
    }
    
    // Ensure directory exists in Azure
    await ensureDirectoryExists(shareClient, remoteFilePath);
    
    // Read file content
    const fileBuffer = await fs.readFile(fileInfo.fullPath);
    
    // Get directory and filename from remote path
    const pathParts = remoteFilePath.split('/');
    const fileName = pathParts.pop();
    const directoryPath = pathParts.join('/');
    
    // Get directory client
    let directoryClient;
    if (directoryPath) {
        directoryClient = shareClient.getDirectoryClient(directoryPath);
    } else {
        directoryClient = shareClient.rootDirectoryClient;
    }
    
    // Get file client and upload
    const fileClient = directoryClient.getFileClient(fileName);
    await fileClient.create(fileBuffer.length);
    await fileClient.uploadRange(fileBuffer, 0, fileBuffer.length);
    
    console.log(`   ✅ Uploaded: ${remoteFilePath}`);
}

/**
 * Ensure directory exists in Azure (create if needed)
 */
async function ensureDirectoryExists(shareClient, filePath) {
    const pathParts = filePath.split('/');
    pathParts.pop(); // Remove filename
    
    let currentPath = '';
    
    for (const part of pathParts) {
        if (!part) continue; // Skip empty parts
        
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        try {
            const dirClient = shareClient.getDirectoryClient(currentPath);
            await dirClient.getProperties();
            // Directory exists
        } catch (error) {
            if (error.statusCode === 404) {
                // Directory doesn't exist, create it
                const createDirClient = shareClient.getDirectoryClient(currentPath);
                await createDirClient.create();
                console.log(`   📁 Created directory: ${currentPath}`);
            } else {
                throw error;
            }
        }
    }
}

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

/**
 * Test connection
 */
async function testConnection() {
    try {
        const sasUrl = process.env.SAS_URL;
        const url = new URL(sasUrl);
        const shareName = url.pathname.split('/')[1];
        
        const accountSasUrl = `https://${url.hostname}/?${url.searchParams.toString()}`;
        const serviceClient = new ShareServiceClient(accountSasUrl, new AnonymousCredential());
        const shareClient = serviceClient.getShareClient(shareName);
        
        await shareClient.getProperties();
        console.log('✅ Connection successful');
        return true;
    } catch (error) {
        console.log('❌ Connection failed:', error.message);
        return false;
    }
}

module.exports = {
    uploadFolderToAzure,
    testConnection,
    getAllFiles
};