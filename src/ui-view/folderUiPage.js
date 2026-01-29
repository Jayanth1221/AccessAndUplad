const folderUiPage=(req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Upload Folder to Azure</title>
</head>
<body>
  <h2>Upload Folder to Azure File Share</h2>

  <form id="uploadForm">
    <label>Server Folder Path:</label><br>
    <input type="text" name="localPath" placeholder="/home/app/data" required><br><br>

    <label>Remote Path (optional):</label><br>
    <input type="text" name="remotePath" placeholder="uploads/project1"><br><br>

    <button type="submit">Upload</button>
  </form>

  <pre id="result"></pre>

  <script>
    document.getElementById('uploadForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      console.log(data)

      const res = await fetch('/apiFiles/uploadFolder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      document.getElementById('result').textContent =
        JSON.stringify(await res.json(), null, 2);
    };
  </script>
</body>
</html>
`);
}

module.exports={folderUiPage}