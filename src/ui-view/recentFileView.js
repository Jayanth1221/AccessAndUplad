const recentFileView=(req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Recent Files</title>
            <style>
                body { font-family: Arial; margin: 40px; }
                .card { border: 1px solid #ddd; padding: 20px; margin: 10px; border-radius: 5px; }
                .file-item { padding: 8px; border-bottom: 1px solid #eee; }
                .file-size { color: #666; font-size: 0.9em; }
                .file-time { color: #888; font-size: 0.8em; }
            </style>
        </head>
        <body>
            <h1>📅 Recent Files Explorer</h1>
            
            <div class="card">
                <h3>Search Options:</h3>
                <div>
                    <label>Hours back: </label>
                    <input type="number" id="hours" value="24" min="1" max="720">
                </div>
                <div style="margin-top: 10px;">
                    <label>Directory: </label>
                    <input type="text" id="directory" placeholder="uploads/images (optional)">
                </div>
                <div style="margin-top: 10px;">
                    <label>Limit: </label>
                    <input type="number" id="limit" placeholder="50 (optional)">
                </div>
                <button onclick="fetchRecentFiles()" style="margin-top: 15px; padding: 10px 20px;">
                    Search Recent Files
                </button>
            </div>
            
            <div id="results" style="margin-top: 30px;"></div>
            
            <script>
                async function fetchRecentFiles() {
                    const hours = document.getElementById('hours').value;
                    const directory = document.getElementById('directory').value;
                    const limit = document.getElementById('limit').value;
                    
                    let url = \`/apiFiles/recentFiles?hours=\${hours}\`;
                    if (directory) url += \`&directory=\${encodeURIComponent(directory)}\`;
                    if (limit) url += \`&limit=\${limit}\`;
                    
                    const resultsDiv = document.getElementById('results');
                    resultsDiv.innerHTML = '<p>Loading... ⏳</p>';
                    
                    try {
                        const response = await fetch(url);
                        const data = await response.json();
                        
                        if (data.success) {
                            let html = \`
                                <div class="card">
                                    <h3>📊 Results: \${data.count} files found</h3>
                                    <p>Time range: Last \${data.timeRange.hours} hours</p>
                                    <p>Total size: \${data.summary.sizeReadable}</p>
                                    
                                    <h4>📁 Recent Files:</h4>
                            \`;
                            
                            data.files.forEach(file => {
                                const date = new Date(file.lastModified).toLocaleString();
                                html += \`
                                    <div class="file-item">
                                        <div>
                                            <strong>\${file.name}</strong>
                                            <span class="file-size">(\${file.sizeReadable})</span>
                                        </div>
                                        <div class="file-time">
                                            Modified: \${date} (about \${file.ageInHours} hours ago)
                                        </div>
                                        <div>
                                            <a href="\${file.downloadUrl}" target="_blank">Download</a>
                                            • Path: \${file.path}
                                        </div>
                                    </div>
                                \`;
                            });
                            
                            html += \`</div>\`;
                            resultsDiv.innerHTML = html;
                        } else {
                            resultsDiv.innerHTML = \`<p style="color: red;">Error: \${data.message}</p>\`;
                        }
                    } catch (error) {
                        resultsDiv.innerHTML = \`<p style="color: red;">Error: \${error.message}</p>\`;
                    }
                }
                
                // Load initial data
                fetchRecentFiles();
            </script>
        </body>
        </html>
    `);
}

module.exports={recentFileView}