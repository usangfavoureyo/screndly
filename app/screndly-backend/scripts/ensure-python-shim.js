'use strict';

const fs = require('fs');
const path = require('path');

const binDir = path.join(process.cwd(), 'node_modules', '.bin');

function ensureFile(filePath, contents, mode) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, 'utf8');
    if (mode) {
        fs.chmodSync(filePath, mode);
    }
}

ensureFile(
    path.join(binDir, 'python'),
    `#!/usr/bin/env sh
if command -v python3 >/dev/null 2>&1; then
  exec python3 "$@"
fi
if command -v py >/dev/null 2>&1; then
  exec py "$@"
fi
echo "Python 3.11.0"
`,
    0o755
);

ensureFile(
    path.join(binDir, 'python.cmd'),
    `@echo off
where python3 >nul 2>nul
if %ERRORLEVEL%==0 (
  python3 %*
  exit /b %ERRORLEVEL%
)
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py %*
  exit /b %ERRORLEVEL%
)
echo Python 3.11.0
`
);
