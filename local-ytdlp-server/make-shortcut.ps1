$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Aura YT Server.lnk")
$s.TargetPath = "$env:USERPROFILE\Desktop\retail-engine\local-ytdlp-server\start.bat"
$s.WorkingDirectory = "$env:USERPROFILE\Desktop\retail-engine\local-ytdlp-server"
$s.IconLocation = "C:\Windows\System32\shell32.dll,175"
$s.Description = "Start Aura YouTube background playback server"
$s.Save()
Write-Host "Shortcut created on Desktop!"
