@echo off
echo Starting Leyfis development container...
docker start leyfis-dev 2>nul || docker run -d ^
  --name leyfis-dev ^
  -v %USERPROFILE%\leyfis-protocol:/workspace ^
  -v leyfis-build-cache:/build-cache ^
  -p 8899:8899 ^
  -p 8900:8900 ^
  leyfis-dev ^
  tail -f /dev/null
echo.
echo Container running.
echo Run commands with: docker exec -it leyfis-dev bash -c "COMMAND"
echo Open a shell with: shell.bat
