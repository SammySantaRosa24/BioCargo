$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$mysqlBase = Join-Path $env:ProgramFiles 'MySQL\MySQL Server 8.0'
$mysqld = Join-Path $mysqlBase 'bin\mysqld.exe'
$mysqladmin = Join-Path $mysqlBase 'bin\mysqladmin.exe'
$dataDir = Join-Path $projectRoot '.local\mysql-data'
$port = 3307

if (-not (Test-Path -LiteralPath $mysqld) -or -not (Test-Path -LiteralPath $mysqladmin)) {
  throw 'MySQL 8 não foi encontrado em Program Files. Instale o MySQL Server 8 antes de iniciar o banco local.'
}
if (-not (Test-Path -LiteralPath $dataDir)) {
  throw "Diretório de dados local não existe: $dataDir. A inicialização do banco ainda não foi feita."
}

& $mysqladmin --host=127.0.0.1 "--port=$port" --user=root ping *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output "MySQL local já está respondendo em 127.0.0.1:$port."
  exit 0
}

$argumentLine = "--basedir=`"$mysqlBase`" --datadir=`"$dataDir`" --port=$port --bind-address=127.0.0.1 --mysqlx=0"
Start-Process -FilePath $mysqld -ArgumentList $argumentLine -WindowStyle Hidden | Out-Null

for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
  Start-Sleep -Seconds 1
  & $mysqladmin --host=127.0.0.1 "--port=$port" --user=root ping *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Output "MySQL local iniciado em 127.0.0.1:$port usando .local/mysql-data."
    exit 0
  }
}

throw 'O MySQL local não respondeu. Confira os logs em .local/mysql-data.'
