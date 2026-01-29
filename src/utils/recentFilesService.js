// utils/recentFilesService.js
const { ShareServiceClient, AnonymousCredential } = require("@azure/storage-file-share");
require('dotenv').config();

/**
 * Get files modified in the last 24 hours
 * @param {string} directoryPath - Optional directory to search in
 * @returns {Promise<Array>} - List of recent files
 */
async function getRecentFilesFromAzure(directoryPath = '', hoursBack = 24) {
    try {
        const sasUrl = process.env.SAS_URL;
        
        if (!sasUrl) {
            throw new Error("SAS_URL not found in .env");
        }

        console.log(`🔍 Fetching files from last ${hoursBack} hours...`);
        
        // Parse Azure URL
        const url = new URL(sasUrl);
        const shareName = url.pathname.split('/')[1];
        
        console.log(`Share: ${shareName}`);
        console.log(`Directory: ${directoryPath || '(root)'}`);
        
        // Create service client (using Method 2 that works)
        const accountSasUrl = `https://${url.hostname}/?${url.searchParams.toString()}`;
        const serviceClient = new ShareServiceClient(accountSasUrl, new AnonymousCredential());
        const shareClient = serviceClient.getShareClient(shareName);
        
        // Calculate time threshold
        const now = new Date();
        const hoursAgo = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000));
        
        console.log(`⏰ Time threshold: ${hoursAgo.toISOString()}`);
        console.log(`Current time: ${now.toISOString()}`);
        
        // Get all files recursively
        const recentFiles = await searchRecentFilesRecursive(
            shareClient, 
            directoryPath, 
            hoursAgo
        );
        
        console.log(`✅ Found ${recentFiles.length} recent files`);
        
        // Sort by modification date (newest first)
        recentFiles.sort((a, b) => 
            new Date(b.lastModified) - new Date(a.lastModified)
        );
        
        return recentFiles;
        
    } catch (error) {
        console.error('❌ Error fetching recent files:', error.message);
        throw error;
    }
}

/**
 * Recursively search for recent files
 */
async function searchRecentFilesRecursive(shareClient, currentPath, timeThreshold, results = []) {
    try {
        // Get directory client
        let directoryClient;
        if (currentPath) {
            directoryClient = shareClient.getDirectoryClient(currentPath);
        } else {
            directoryClient = shareClient.rootDirectoryClient;
        }
        
        // List files and subdirectories
        const iterator = directoryClient.listFilesAndDirectories();
        
        for await (const item of iterator) {
            if (item.kind === 'directory') {
                // Recursively search subdirectories
                const subDirPath = currentPath ? 
                    `${currentPath}/${item.name}` : item.name;
                
                console.log(`📁 Searching subdirectory: ${subDirPath}`);
                
                await searchRecentFilesRecursive(
                    shareClient, 
                    subDirPath, 
                    timeThreshold, 
                    results
                );
                
            } else if (item.kind === 'file') {
                // Check if file was modified recently
                try {
                    // Get file client to get properties
                    const fileClient = directoryClient.getFileClient(item.name);
                    const properties = await fileClient.getProperties();
                    
                    const lastModified = new Date(properties.lastModified);
                    const filePath = currentPath ? 
                        `${currentPath}/${item.name}` : item.name;
                    
                    // Check if modified within time threshold
                    if (lastModified >= timeThreshold) {
                        console.log(`✅ Recent file found: ${filePath} (${lastModified.toISOString()})`);
                        
                        results.push({
                            name: item.name,
                            path: filePath,
                            size: properties.contentLength,
                            lastModified: lastModified.toISOString(),
                            contentType: properties.contentType || 'unknown',
                            etag: properties.etag,
                            isFile: true,
                            ageInHours: Math.round((Date.now() - lastModified.getTime()) / (1000 * 60 * 60))
                        });
                    }
                    
                } catch (fileError) {
                    console.log(`⚠️ Could not get properties for: ${item.name}`, fileError.message);
                }
            }
        }
        
        return results;
        
    } catch (error) {
        console.log(`❌ Error searching directory ${currentPath}:`, error.message);
        return results;
    }
}

/**
 * Get files modified in specific date range
 */
async function getFilesByDateRange(directoryPath = '', startDate, endDate = new Date()) {
    try {
        const sasUrl = process.env.SAS_URL;
        const url = new URL(sasUrl);
        const shareName = url.pathname.split('/')[1];
        
        const accountSasUrl = `https://${url.hostname}/?${url.searchParams.toString()}`;
        const serviceClient = new ShareServiceClient(accountSasUrl, new AnonymousCredential());
        const shareClient = serviceClient.getShareClient(shareName);
        
        const results = [];
        await searchFilesByDateRecursive(shareClient, directoryPath, startDate, endDate, results);
        
        return results;
        
    } catch (error) {
        console.error('Date range search error:', error.message);
        throw error;
    }
}

/**
 * Alternative: Get files using batch method (faster for large directories)
 */
async function getRecentFilesFast(directoryPath = '', hoursBack = 24) {
    try {
        const sasUrl = process.env.SAS_URL;
        const url = new URL(sasUrl);
        const shareName = url.pathname.split('/')[1];
        
        const accountSasUrl = `https://${url.hostname}/?${url.searchParams.toString()}`;
        const serviceClient = new ShareServiceClient(accountSasUrl, new AnonymousCredential());
        const shareClient = serviceClient.getShareClient(shareName);
        
        const timeThreshold = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
        const allFiles = await getAllFilesFlat(shareClient, directoryPath);
        
        // Filter recent files
        const recentFiles = allFiles.filter(file => 
            new Date(file.lastModified) >= timeThreshold
        );
        
        return recentFiles;
        
    } catch (error) {
        console.error('Fast search error:', error.message);
        throw error;
    }
}

/**
 * Get all files as flat list (without checking each file's properties)
 */
async function getAllFilesFlat(shareClient, directoryPath = '') {
    const files = [];
    
    try {
        const directoryClient = directoryPath ? 
            shareClient.getDirectoryClient(directoryPath) : 
            shareClient.rootDirectoryClient;
        
        const iterator = directoryClient.listFilesAndDirectories();
        
        for await (const item of iterator) {
            if (item.kind === 'file') {
                // Note: This only gives basic info, not lastModified
                // We need to get properties for each file
                const filePath = directoryPath ? 
                    `${directoryPath}/${item.name}` : item.name;
                
                // Get properties to check lastModified
                const fileClient = directoryClient.getFileClient(item.name);
                try {
                    const properties = await fileClient.getProperties();
                    
                    files.push({
                        name: item.name,
                        path: filePath,
                        size: properties.contentLength,
                        lastModified: properties.lastModified,
                        contentType: properties.contentType
                    });
                } catch {
                    // Skip if can't get properties
                }
            } else if (item.kind === 'directory') {
                const subDirPath = directoryPath ? 
                    `${directoryPath}/${item.name}` : item.name;
                
                const subFiles = await getAllFilesFlat(shareClient, subDirPath);
                files.push(...subFiles);
            }
        }
        
    } catch (error) {
        console.log(`Error listing ${directoryPath}:`, error.message);
    }
    
    return files;
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
    getRecentFilesFromAzure,
    getFilesByDateRange,
    getRecentFilesFast,
    testConnection
};