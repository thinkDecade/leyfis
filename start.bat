@echo off
echo Starting Leyfis development container...
docker start leyfis-dev 2>nul || docker run -d ^
  --name leyfis-dev ^
  -v %USERPROFILE%\leyfis-protocol:/workspace ^
  -v leyfis-build-cache:/build-cache ^
  -p 8899:8899 ^
  -p 8900:8900 ^
  -p 3000:3000 ^
  -p 3001:3001 ^
  leyfis-dev ^
  tail -f /dev/null
echo Container running.
