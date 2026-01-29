// utils/lastTwoMinutesService.js
const { ShareServiceClient, AnonymousCredential } = require("@azure/storage-file-share");
require('dotenv').config();

/**
 * Get files modified in the last 2 minutes ONLY
 */
async function getLastTwoMinutesFiles() {
    try {
        const sasUrl = process.env.SAS_URL;
        
        if (!sasUrl) {
            throw new Error("SAS_URL not found in .env");
        }

        console.log(`🕒 Fetching files from last 2 minutes...`);
        
        // Parse Azure URL
        const url = new URL(sasUrl);
        const shareName = url.pathname.split('/')[1];
        
        console.log(`Share: ${shareName}`);
        
        // Create service client
        const accountSasUrl = `https://${url.hostname}/?${url.searchParams.toString()}`;
        const serviceClient = new ShareServiceClient(accountSasUrl, new AnonymousCredential());
        const shareClient = serviceClient.getShareClient(shareName);
        
        // Fixed: Last 2 minutes (120 seconds)
        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - (2 * 60 * 1000));
        
        console.log(`⏰ Time threshold: ${twoMinutesAgo.toLocaleTimeString()}`);
        console.log(`Current time: ${now.toLocaleTimeString()}`);
        
        // Get recent files
        const recentFiles = await searchRecentFiles(shareClient, '', twoMinutesAgo);
        
        console.log(`✅ Found ${recentFiles.length} files from last 2 minutes`);
        
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
 * Search for recent files recursively
 */
async function searchRecentFiles(shareClient, currentPath, timeThreshold, results = []) {
    try {
        // Get directory client
        let directoryClient;
        if (currentPath) {
            directoryClient = shareClient.getDirectoryClient(currentPath);
        } else {
            directoryClient = shareClient.rootDirectoryClient;
        }
        
        // List files and directories
        const iterator = directoryClient.listFilesAndDirectories();
        
        for await (const item of iterator) {
            if (item.kind === 'directory') {
                // Search subdirectories
                const subDirPath = currentPath ? 
                    `${currentPath}/${item.name}` : item.name;
                
                await searchRecentFiles(shareClient, subDirPath, timeThreshold, results);
                
            } else if (item.kind === 'file') {
                // Check file modification time
                const fileClient = directoryClient.getFileClient(item.name);
                
                try {
                    const properties = await fileClient.getProperties();
                    const lastModified = new Date(properties.lastModified);
                    const filePath = currentPath ? 
                        `${currentPath}/${item.name}` : item.name;
                    
                    // Fixed: Check if modified within last 2 minutes
                    if (lastModified >= timeThreshold) {
                        const minutesAgo = Math.round((Date.now() - lastModified.getTime()) / (1000 * 60));
                        
                        results.push({
                            name: item.name,
                            path: filePath,
                            size: properties.contentLength,
                            lastModified: lastModified.toISOString(),
                            minutesAgo: minutesAgo,
                            contentType: properties.contentType || 'unknown'
                        });
                    }
                    
                } catch (fileError) {
                    // Skip if can't get properties
                }
            }
        }
        
        return results;
        
    } catch (error) {
        console.log(`⚠️ Error searching directory ${currentPath}:`, error.message);
        return results;
    }
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
    getLastTwoMinutesFiles,
    testConnection
};