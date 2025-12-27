

$FunctionAppName = "func-yzzx-iot"
$ResourceGroup = "rg-yzzx-iot"
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Join-Path $repoRoot "..\functions\adt-ingestor-dotnet"
Set-Location $projectPath

Write-Host "Building and publishing .NET isolated function..."
dotnet publish -c Release -o ./publish

# Zip the contents of the publish directory (not the folder itself)
$zipPath = Join-Path $projectPath "publish.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Set-Location ./publish
Compress-Archive -Path * -DestinationPath ../publish.zip -Force
Set-Location ..

# Deploy using az CLI (host.json must be at root of zip)
Write-Host "Deploying publish.zip to Azure Function App using config-zip..."
az functionapp deployment source config-zip --name $FunctionAppName --resource-group $ResourceGroup --src publish.zip

Write-Host "Deployment complete."
