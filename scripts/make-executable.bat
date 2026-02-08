@echo off
REM Make scripts executable on Windows
echo Making emergency scripts executable...
attrib +x emergency-rollback.sh
attrib +x git-emergency-restore.sh
echo Scripts are now executable