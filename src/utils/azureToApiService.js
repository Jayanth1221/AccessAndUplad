// utils/azureToApiService.js
const { ShareServiceClient, AnonymousCredential } = require("@azure/storage-file-share");
const axios = require('axios');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
  override: true
});

const COMPANY_API_ENDPOINT=process.env.COMPANY_API_ENDPOINT || 'http://localhost:6001/s11e/v1/tenant/files/publish-flipout-data-call-analytics';
const API_ENDPOINT = COMPANY_API_ENDPOINT


/**
 * Get files from last 2 minutes and send to API
 */
async function processRecentFilesAndUpload() {
    try {
        const sasUrl = process.env.SAS_URL;
        
        if (!sasUrl) {
            throw new Error("SAS_URL not found in .env");
        }

        console.log(`🚀 Starting Azure Files to API Job`);
        console.log(`Time: ${new Date().toLocaleTimeString()}`);
        
        // Parse Azure URL
        const url = new URL(sasUrl);
        const shareName = url.pathname.split('/')[1];
        
        console.log(`Azure Share: ${shareName}`);
        
        // Create service client
        const accountSasUrl = `https://${url.hostname}/?${url.searchParams.toString()}`;
        const serviceClient = new ShareServiceClient(accountSasUrl, new AnonymousCredential());
        const shareClient = serviceClient.getShareClient(shareName);
        
        // Get files from last 2 minutes
        const twoMinutesAgo = new Date(Date.now() - (2 * 60 * 1000));
        console.log(`⏰ Searching files since: ${twoMinutesAgo.toLocaleTimeString()}`);
        
        const recentFiles = await getRecentFilesWithMetadata(shareClient, '', twoMinutesAgo);
        
        console.log(`📊 Found ${recentFiles.length} recent files`);
        
        // Process each file and upload to API
        const processedFiles = [];
        const failedFiles = [];
        
        for (const file of recentFiles) {
            try {
                const result = await processAndUploadFile(shareClient, file);
                processedFiles.push(result);
            } catch (error) {
                console.error(`❌ Failed to process ${file.name}:`, error.message);
                failedFiles.push({ file: file.name, error: error.message });
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🎯 JOB COMPLETE');
        console.log(`✅ Successfully processed: ${processedFiles.length} files`);
        console.log(`❌ Failed: ${failedFiles.length} files`);
        
        if (failedFiles.length > 0) {
            console.log('\nFailed files:');
            failedFiles.forEach(f => console.log(`  - ${f.file}: ${f.error}`));
        }
        
        return {
            success: true,
            totalFound: recentFiles.length,
            processed: processedFiles.length,
            failed: failedFiles.length,
            processedFiles: processedFiles,
            failedFiles: failedFiles
        };
        
    } catch (error) {
        console.error('❌ Job error:', error.message);
        throw error;
    }
}

/**
 * Get recent files with metadata
 */
async function getRecentFilesWithMetadata(shareClient, currentPath, timeThreshold, results = []) {
    try {
        let directoryClient;
        if (currentPath) {
            directoryClient = shareClient.getDirectoryClient(currentPath);
        } else {
            directoryClient = shareClient.rootDirectoryClient;
        }
        
        const iterator = directoryClient.listFilesAndDirectories();
        
        for await (const item of iterator) {
            if (item.kind === 'directory') {
                const subDirPath = currentPath ? 
                    `${currentPath}/${item.name}` : item.name;
                
                await getRecentFilesWithMetadata(shareClient, subDirPath, timeThreshold, results);
                
            } else if (item.kind === 'file') {
                const fileClient = directoryClient.getFileClient(item.name);
                
                try {
                    const properties = await fileClient.getProperties();
                    const lastModified = new Date(properties.lastModified);
                    const filePath = currentPath ? 
                        `${currentPath}/${item.name}` : item.name;
                    
                    // Check if within last 2 minutes
                    if (lastModified >= timeThreshold) {
                        const minutesAgo = Math.round((Date.now() - lastModified.getTime()) / (1000 * 60));
                        
                        results.push({
                            name: item.name,
                            path: filePath,
                            size: properties.contentLength,
                            lastModified: lastModified,
                            minutesAgo: minutesAgo,
                            contentType: properties.contentType || 'unknown',
                            fileClient: fileClient,
                            directoryClient: directoryClient
                        });
                    }
                    
                } catch (error) {
                    // Skip if can't get properties
                }
            }
        }
        
        return results;
        
    } catch (error) {
        console.log(`⚠️ Error searching ${currentPath}:`, error.message);
        return results;
    }
}

/**
 * Process and upload single file to API
 */
async function processAndUploadFile(shareClient, fileInfo) {
    console.log(`\n📁 Processing: ${fileInfo.name}`);
    
    // Get audio file download URL
    const audioDownloadUrl = await createDownloadUrl(fileInfo);
    console.log(`   Audio URL: ${audioDownloadUrl.substring(0, 80)}...`);
    
    // Look for corresponding JSON metadata file
    let jsonDownloadUrl = '';
    try {
        const jsonFileInfo = await findMetadataFile(shareClient, fileInfo);
        if (jsonFileInfo) {
            jsonDownloadUrl = await createDownloadUrl(jsonFileInfo);
            console.log(`   JSON URL: ${jsonDownloadUrl.substring(0, 80)}...`);
        }
    } catch (error) {
        console.log(`   ⚠️ No metadata file found for ${fileInfo.name}`);
    }
    
    // Prepare payload matching company's format
    const payload = {
        file_name: fileInfo.name,
        date: formatDate(fileInfo.lastModified),
        audio_download_link: audioDownloadUrl,
        metadata_download_link: jsonDownloadUrl || '',
        source: 'azure-file-share',
        size_bytes: fileInfo.size,
        file_path: fileInfo.path
    };
    
    console.log(`   📤 Uploading to API...`);
    console.log("payload",payload)
    // Send to company API
    const response = await axios.post(API_ENDPOINT, payload);
    
    console.log(`   ✅ API Response: ${response.status} ${response.statusText}`);
    
    return {
        file: fileInfo.name,
        status: 'success',
        apiStatus: response.status,
        payload: payload
    };
}

/**
 * Create SAS download URL for file
 */
async function createDownloadUrl(fileInfo) {
    // Your download endpoint format
    const baseUrl = `http://localhost:${process.env.PORT || 7000}`;
    return `${baseUrl}/apiFiles/download?filePath=${encodeURIComponent(fileInfo.path)}`;
}

/**
 * Find corresponding JSON metadata file
 */
async function findMetadataFile(shareClient, audioFileInfo) {
    const jsonFileName = audioFileInfo.name.replace(/\.(mp3|wav)$/i, '') + '.json';
    const jsonPath = audioFileInfo.path.replace(/\.(mp3|wav)$/i, '.json');
    
    try {
        // Extract directory path from full path
        const pathParts = jsonPath.split('/');
        const fileName = pathParts.pop();
        const directoryPath = pathParts.join('/');
        
        let directoryClient;
        if (directoryPath) {
            directoryClient = shareClient.getDirectoryClient(directoryPath);
        } else {
            directoryClient = shareClient.rootDirectoryClient;
        }
        
        const fileClient = directoryClient.getFileClient(fileName);
        await fileClient.getProperties();
        
        return {
            name: fileName,
            path: jsonPath,
            fileClient: fileClient,
            directoryClient: directoryClient
        };
        
    } catch (error) {
        return null;
    }
}

/**
 * Format date like company expects
 */
function formatDate(date) {
    const d = new Date(date);
    return d.toISOString().replace('T', ' ').substring(0, 19);
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
        console.log('✅ Azure connection successful');
        return true;
    } catch (error) {
        console.log('❌ Azure connection failed:', error.message);
        return false;
    }
}

module.exports = {
    processRecentFilesAndUpload,
    testConnection
};