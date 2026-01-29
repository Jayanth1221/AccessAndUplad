const lastTwoMinView=(req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Last 2 Minutes Files</title>
            <meta http-equiv="refresh" content="30">
            <style>
                body { font-family: Arial; margin: 40px; }
                .header { background: #4CAF50; color: white; padding: 20px; border-radius: 5px; }
                .file-item { padding: 10px; border-bottom: 1px solid #ddd; }
                .time-badge { background: #2196F3; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🕒 Last 2 Minutes Files</h1>
                <p>Auto-refreshes every 30 seconds • ${new Date().toLocaleTimeString()}</p>
            </div>
            
            <div id="results" style="margin-top: 20px;">
                <p>Loading files from last 2 minutes...</p>
            </div>
            
            <script>
                async function loadLastTwoMinutesFiles() {
                    try {
                        const response = await fetch('/apiFiles/lastTwoMinutes');
                        const data = await response.json();
                        
                        const resultsDiv = document.getElementById('results');
                        
                        if (data.success) {
                            let html = \`
                                <h3>📊 Found \${data.count} files in last 2 minutes</h3>
                                <p>Total size: \${data.summary.sizeReadable}</p>
                                <p>Time range: \${new Date(data.timeRange.from).toLocaleTimeString()} to \${new Date(data.timeRange.to).toLocaleTimeString()}</p>
                                <hr>
                            \`;
                            
                            if (data.files.length > 0) {
                                data.files.forEach(file => {
                                    const time = new Date(file.lastModified).toLocaleTimeString();
                                    html += \`
                                        <div class="file-item">
                                            <div>
                                                <strong>\${file.name}</strong>
                                                <span class="time-badge">\${file.minutesAgo} min ago</span>
                                            </div>
                                            <div>\${file.sizeReadable} • \${time}</div>
                                            <div>Path: \${file.path}</div>
                                            <div>
                                                <a href="\${file.downloadUrl}" target="_blank">⬇️ Download</a>
                                            </div>
                                        </div>
                                    \`;
                                });
                            } else {
                                html += '<p>No files modified in last 2 minutes</p>';
                            }
                            
                            html += \`
                                <hr>
                                <p><small>Last updated: \${new Date().toLocaleTimeString()}</small></p>
                            \`;
                            
                            resultsDiv.innerHTML = html;
                        } else {
                            resultsDiv.innerHTML = \`<p style="color: red;">Error: \${data.message}</p>\`;
                        }
                    } catch (error) {
                        document.getElementById('results').innerHTML = 
                            \`<p style="color: red;">Error: \${error.message}</p>\`;
                    }
                }
                
                // Load immediately and every 30 seconds
                loadLastTwoMinutesFiles();
                setInterval(loadLastTwoMinutesFiles, 30000);
            </script>
        </body>
        </html>
    `);
}

module.exports={lastTwoMinView}