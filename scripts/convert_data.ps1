# Data Conversion Script (CSV -> JSON & JS)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$baseDir = "data\부산상가"
$files = @(
    @{ Path = "$baseDir\부산_대형마트_입점점포_202603.csv"; Category = "mart"; Label = "대형마트 입점점포"; BrandCol = "마트브랜드" },
    @{ Path = "$baseDir\부산_백화점_입점점포_202603.csv"; Category = "department"; Label = "백화점 입점점포"; BrandCol = "백화점브랜드" },
    @{ Path = "$baseDir\부산_헬스장_202603.csv"; Category = "gym"; Label = "헬스장"; BrandCol = $null },
    @{ Path = "$baseDir\부산상가_편의점.csv"; Category = "cvs"; Label = "편의점"; BrandCol = $null }
)

$stores = [System.Collections.Generic.List[PSObject]]::new()
$skipped = 0

foreach ($item in $files) {
    Write-Host "Processing $($item.Path)..."
    $rows = Import-Csv -Path $item.Path -Encoding Default
    foreach ($row in $rows) {
        $lat = 0.0
        $lng = 0.0
        $validLat = [double]::TryParse($row.위도, [ref]$lat)
        $validLng = [double]::TryParse($row.경도, [ref]$lng)

        # Validate coordinates (around Busan: lat 34.8~35.5, lng 128.5~129.5)
        if (-not ($validLat -and $validLng -and $lat -ge 34.5 -and $lat -le 35.8 -and $lng -ge 128.5 -and $lng -le 129.6)) {
            $skipped++
            continue
        }

        $brand = ""
        if ($item.BrandCol -and $row.PSObject.Properties[$item.BrandCol]) {
            $brand = $row.($item.BrandCol)
        }

        # Convenience store brand deduction if not explicit
        if ($item.Category -eq "cvs" -and -not $brand) {
            if ($row.상호명 -match "CU|씨유") { $brand = "CU" }
            elseif ($row.상호명 -match "GS25|지에스") { $brand = "GS25" }
            elseif ($row.상호명 -match "세븐일레븐|7-ELEVEN") { $brand = "세븐일레븐" }
            elseif ($row.상호명 -match "이마트24|emart24") { $brand = "이마트24" }
            elseif ($row.상호명 -match "미니스톱|ministop") { $brand = "미니스톱" }
        }

        $storeObj = [PSCustomObject]@{
            id               = $row.상가업소번호
            name             = $row.상호명
            branch           = $row.지점명
            category         = $item.Category
            categoryLabel    = $item.Label
            categoryName     = $row.상권업종대분류명
            subCategoryName  = $row.상권업종소분류명
            gu               = $row.시군구명
            dong             = if ($row.행정동명) { $row.행정동명 } else { $row.법정동명 }
            roadAddress      = $row.도로명주소
            buildingName     = $row.건물명
            floor            = $row.층정보
            lat              = [math]::Round($lat, 6)
            lng              = [math]::Round($lng, 6)
            brand            = $brand
        }
        $stores.Add($storeObj)
    }
}

Write-Host "Total Valid Stores: $($stores.Count) (Skipped: $skipped)"

# 1. Output JSON file
$json = $stores | ConvertTo-Json -Depth 3 -Compress
[System.IO.File]::WriteAllText("data\stores.json", $json, [System.Text.Encoding]::UTF8)
Write-Host "Saved data\stores.json (Size: $((Get-Item 'data\stores.json').Length) bytes)"

# 2. Output JS file (for zero-CORS local file open support)
$jsContent = "window.STORES_DATA = " + $json + ";"
[System.IO.File]::WriteAllText("data\stores_data.js", $jsContent, [System.Text.Encoding]::UTF8)
Write-Host "Saved data\stores_data.js (Size: $((Get-Item 'data\stores_data.js').Length) bytes)"
