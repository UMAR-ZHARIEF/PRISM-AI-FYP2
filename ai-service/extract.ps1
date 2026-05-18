$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open('d:\PRISM-AI\SRS Template.doc', $false, $true)
    $text = $doc.Content.Text
    [IO.File]::WriteAllText('d:\PRISM-AI\srs_text.txt', $text)
} finally {
    if ($doc) { $doc.Close() }
    $word.Quit()
}
