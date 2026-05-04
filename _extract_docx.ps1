# Extract docx 1
Add-Type -AssemblyName System.IO.Compression.FileSystem
$outDir1 = 'C:\Users\maher\Desktop\retail-engine\_docx_extract1'
$outDir2 = 'C:\Users\maher\Desktop\retail-engine\_docx_extract2'
if(Test-Path $outDir1){Remove-Item -Recurse -Force $outDir1}
if(Test-Path $outDir2){Remove-Item -Recurse -Force $outDir2}
[System.IO.Compression.ZipFile]::ExtractToDirectory('C:\Users\maher\Downloads\Construction AI Architecture.docx', $outDir1)
[System.IO.Compression.ZipFile]::ExtractToDirectory('C:\Users\maher\Downloads\Construction AI Architecture (1).docx', $outDir2)

# Parse docx 1
$xml1 = [xml](Get-Content "$outDir1\word\document.xml")
$ns1 = New-Object Xml.XmlNamespaceManager($xml1.NameTable)
$ns1.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$nodes1 = $xml1.SelectNodes('//w:p', $ns1)
$lines1 = @()
foreach($p in $nodes1) {
    $texts = $p.SelectNodes('.//w:t', $ns1)
    $line = ($texts | ForEach-Object { $_.InnerText }) -join ''
    if($line.Trim()) { $lines1 += $line }
}
$lines1 -join "`n" | Out-File 'C:\Users\maher\Desktop\retail-engine\_docx1_text.txt' -Encoding utf8

# Parse docx 2
$xml2 = [xml](Get-Content "$outDir2\word\document.xml")
$ns2 = New-Object Xml.XmlNamespaceManager($xml2.NameTable)
$ns2.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$nodes2 = $xml2.SelectNodes('//w:p', $ns2)
$lines2 = @()
foreach($p in $nodes2) {
    $texts = $p.SelectNodes('.//w:t', $ns2)
    $line = ($texts | ForEach-Object { $_.InnerText }) -join ''
    if($line.Trim()) { $lines2 += $line }
}
$lines2 -join "`n" | Out-File 'C:\Users\maher\Desktop\retail-engine\_docx2_text.txt' -Encoding utf8

Write-Host "DONE"
