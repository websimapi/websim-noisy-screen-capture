let canvas = document.getElementById('noiseCanvas');
let ctx = canvas.getContext('2d');
let startButton = document.getElementById('startCapture');
let selectRegionButton = document.getElementById('selectRegion');
let clearRegionButton = document.getElementById('clearRegion');
let mediaStream = null;
let previousImageData = null;

// Cropping variables
let isSelectingRegion = false;
let startX = 0;
let startY = 0;
let cropRegion = null;
let isDragging = false;

// Set canvas size to window size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (!mediaStream) {
    generateNoise();
  }
}

// Initialize canvas size
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Generate random noise for a pixel
function getRandomPixel() {
  const value = Math.random() > 0.5 ? 255 : 0;
  return [value, value, value, 255]; // RGBA
}

// Fill canvas with random noise
function generateNoise(region = null) {
  const imageData = ctx.getImageData(
    region ? region.x : 0,
    region ? region.y : 0,
    region ? region.width : canvas.width,
    region ? region.height : canvas.height
  );
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const pixel = getRandomPixel();
    data[i] = pixel[0];     // R
    data[i + 1] = pixel[1]; // G
    data[i + 2] = pixel[2]; // B
    data[i + 3] = pixel[3]; // A
  }
  
  ctx.putImageData(imageData, region ? region.x : 0, region ? region.y : 0);
}

// Initial noise generation
generateNoise();

// Compare pixels and update only changed ones
function updateChangedPixels(newImageData) {
  if (!previousImageData) {
    previousImageData = newImageData;
    return;
  }

  const region = cropRegion || { x: 0, y: 0, width: canvas.width, height: canvas.height };
  const currentImageData = ctx.getImageData(region.x, region.y, region.width, region.height);
  const current = currentImageData.data;
  const prev = previousImageData.data;
  const next = newImageData.data;

  for (let y = 0; y < region.height; y++) {
    for (let x = 0; x < region.width; x++) {
      const i = (y * region.width + x) * 4;
      
      // Check if pixel has changed
      if (next[i] !== prev[i] || 
          next[i + 1] !== prev[i + 1] || 
          next[i + 2] !== prev[i + 2]) {
        // Generate new random noise for changed pixel
        const pixel = getRandomPixel();
        current[i] = pixel[0];
        current[i + 1] = pixel[1];
        current[i + 2] = pixel[2];
        current[i + 3] = pixel[3];
      }
    }
  }

  ctx.putImageData(currentImageData, region.x, region.y);
  previousImageData = newImageData;
}

// Handle screen capture
async function startCapture() {
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: { 
        cursor: "never"
      },
      audio: false
    });

    const videoTrack = mediaStream.getVideoTracks()[0];
    const videoStream = new MediaStream([videoTrack]);
    const video = document.createElement('video');
    video.srcObject = videoStream;
    video.play();

    // Process video frames
    const processFrame = () => {
      if (!mediaStream) return;

      const region = cropRegion || { x: 0, y: 0, width: canvas.width, height: canvas.height };
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = region.width;
      tempCanvas.height = region.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      tempCtx.drawImage(video, 
        region.x, region.y, region.width, region.height,
        0, 0, region.width, region.height
      );
      const newImageData = tempCtx.getImageData(0, 0, region.width, region.height);
      
      updateChangedPixels(newImageData);
      requestAnimationFrame(processFrame);
    };

    video.onplaying = () => {
      processFrame();
    };

  } catch (err) {
    console.error("Error capturing screen:", err);
  }
}

// Stop screen capture
function stopCapture() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
    previousImageData = null;
    generateNoise(cropRegion); // Reset to full noise within region
  }
}

// Region selection handlers
function startRegionSelection() {
  isSelectingRegion = true;
  document.body.classList.add('cropping');
}

function handleMouseDown(e) {
  if (!isSelectingRegion) return;
  
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
}

function handleMouseMove(e) {
  if (!isDragging) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  // Clear the previous frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  generateNoise();

  // Draw selection rectangle
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(
    startX,
    startY,
    currentX - startX,
    currentY - startY
  );
}

function handleMouseUp(e) {
  if (!isDragging) return;

  isDragging = false;
  isSelectingRegion = false;
  document.body.classList.remove('cropping');

  const endX = e.clientX;
  const endY = e.clientY;

  // Calculate the crop region
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  if (width > 10 && height > 10) { // Minimum size check
    cropRegion = { x, y, width, height };
    clearRegionButton.style.display = 'block';
    selectRegionButton.textContent = 'Change Region';
    
    // Reset the noise in the selected region
    generateNoise(cropRegion);
  }
}

function clearCropRegion() {
  cropRegion = null;
  clearRegionButton.style.display = 'none';
  selectRegionButton.textContent = 'Select Region';
  generateNoise();
}

// Event listeners
startButton.addEventListener('click', () => {
  if (!mediaStream) {
    startCapture();
    startButton.textContent = 'Stop Capture';
  } else {
    stopCapture();
    startButton.textContent = 'Start Screen Capture';
  }
});

selectRegionButton.addEventListener('click', startRegionSelection);
clearRegionButton.addEventListener('click', clearCropRegion);

canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mediaStream) {
    stopCapture();
    startButton.textContent = 'Start Screen Capture';
  }
});