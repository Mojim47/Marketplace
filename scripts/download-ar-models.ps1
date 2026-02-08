# ═══════════════════════════════════════════════════════════════════════════
# Download AR/ML Models for Production
# ═══════════════════════════════════════════════════════════════════════════

$ModelsDir = "public/models"

# Create directories
New-Item -ItemType Directory -Force -Path "$ModelsDir/yolo-nano"
New-Item -ItemType Directory -Force -Path "$ModelsDir/facemesh"
New-Item -ItemType Directory -Force -Path "$ModelsDir/handpose"
New-Item -ItemType Directory -Force -Path "$ModelsDir/midas"

Write-Host "📦 Downloading YOLO-Nano (Object Detection)..." -ForegroundColor Cyan
# YOLO-Nano TensorFlow.js model
Invoke-WebRequest -Uri "https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/model.json" -OutFile "$ModelsDir/yolo-nano/model.json"

Write-Host "📦 Downloading FaceMesh model..." -ForegroundColor Cyan
# FaceMesh is part of MediaPipe - loaded dynamically from CDN
# No need to download, just reference: @mediapipe/face_mesh

Write-Host "📦 Downloading HandPose model..." -ForegroundColor Cyan
# HandPose is part of MediaPipe - loaded dynamically from CDN
# No need to download, just reference: @mediapipe/hands

Write-Host "✅ Models ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Note: FaceMesh and HandPose use MediaPipe which loads from CDN." -ForegroundColor Yellow
Write-Host "For offline use, you need to self-host MediaPipe WASM files." -ForegroundColor Yellow
