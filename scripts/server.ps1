$port = 8085
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server running on http://localhost:$port/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    
    $path = $req.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($path)) { $path = "index.html" }
    $localFile = Join-Path $PWD $path
    
    if (Test-Path $localFile -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($localFile)
        $ext = [System.IO.Path]::GetExtension($localFile).ToLower()
        
        switch ($ext) {
            ".html" { $res.ContentType = "text/html; charset=utf-8" }
            ".js"   { $res.ContentType = "application/javascript; charset=utf-8" }
            ".css"  { $res.ContentType = "text/css; charset=utf-8" }
            ".json" { $res.ContentType = "application/json; charset=utf-8" }
            default { $res.ContentType = "application/octet-stream" }
        }
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found: $path")
        $res.OutputStream.Write($msg, 0, $msg.Length)
    }
    $res.OutputStream.Close()
}