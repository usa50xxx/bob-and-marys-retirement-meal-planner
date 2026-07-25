$ErrorActionPreference = "Stop"

$env:NODE_PATH = "C:\Users\usa50\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules;C:\Users\usa50\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules"
$node = "C:\Users\usa50\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$test = "C:\Users\usa50\Documents\Codex\2026-07-23\i-want-to-create-a-new\work\e-drive-click-test.js"

& $node $test
exit $LASTEXITCODE
