$baseDir = "data\부산상가"
$files = Get-ChildItem "$baseDir\*.csv"

$stores = [System.Collections.Generic.List[PSObject]]::new()
$skipped = 0

foreach ($f in $files) {
    Write-Host "Reading $($f.Name)..."
    $cat = "cvs"
    $catLabel = "편의점"
    $brandCol = ""
    
    if ($f.Name -like "*대형마트*") {
        $cat = "mart"
        $catLabel = "대형마트 입점점포"
        $brandCol = "마트브랜드"
    } elseif ($f.Name -like "*백화점*") {
        $cat = "department"
        $catLabel = "백화점 입점점포"
        $brandCol = "백화점브랜드"
    } elseif ($f.Name -like "*헬스장*") {
        $cat = "gym"
        $catLabel = "헬스장"
    }

    $rows = Import-Csv -Path $f.FullName -Encoding Default
    foreach ($row in $rows) {
        $lat = 0.0
        $lng = 0.0
        $validLat = [double]::TryParse($row.위도, [ref]$lat)
        $validLng = [double]::TryParse($row.경도, [ref]$lng)

        if (-not ($validLat -and $validLng -and $lat -ge 34.5 -and $lat -le 35.8 -and $lng -ge 128.5 -and $lng -le 129.6)) {
            $skipped++
            continue
        }

        $brand = ""
        if ($brandCol -and $row.PSObject.Properties[$brandCol]) {
            $brand = $row.$brandCol
        }

        if ($cat -eq "cvs" -and -not $brand) {
            $nm = $row.상호명
            if ($nm -match "CU|씨유") { $brand = "CU" }
            elseif ($nm -match "GS25|지에스") { $brand = "GS25" }
            elseif ($nm -match "세븐일레븐|7-ELEVEN") { $brand = "세븐일레븐" }
            elseif ($nm -match "이마트24|emart24") { $brand = "이마트24" }
            elseif ($nm -match "미니스톱|ministop") { $brand = "미니스톱" }
        }

        $dong = $row.행정동명
        if (-not $dong) { $dong = $row.법정동명 }

        $storeObj = [PSCustomObject]@{
            id               = $row.상가업소번호
            name             = $row.상호명
            branch           = $row.지점명
            category         = $cat
            categoryLabel    = $catLabel
            categoryName     = $row.상권업종대분류명
            subCategoryName  = $row.상권업종소분류명
            gu               = $row.시군구명
            dong             = $dong
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

$json = $stores | ConvertTo-Json -Depth 3 -Compress
[System.IO.File]::WriteAllText("$PWD\data\stores.json", $json, [System.Text.Encoding]::UTF8)
Write-Host "Generated data\stores.json"

$js = "window.STORES_DATA = " + $json + ";"
[System.IO.File]::WriteAllText("$PWD\data\stores_data.js", $js, [System.Text.Encoding]::UTF8)
Write-Host "Generated data\stores_data.js"