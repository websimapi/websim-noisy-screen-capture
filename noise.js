let canvas = document.getElementById('noiseCanvas');
let ctx = canvas.getContext('2d');
let startButton = document.getElementById('startCapture');
let selectRegionButton = document.getElementById('selectRegion');
let clearRegionButton = document.getElementById('clearRegion');
let toggleFilterButton = document.getElementById('toggleFilter');
let toggleRegionModeButton = document.getElementById('toggleRegionMode');
let sensitivitySlider = document.getElementById('sensitivity');
let sensitivityValue = document.getElementById('sensitivityValue');
let toggleMenuButton = document.getElementById('toggleMenu');
let controlsPanel = document.querySelector('.controls');
let filterTypeSelect = document.getElementById('filterType');
let asciiOutput = document.getElementById('asciiOutput');
let mediaStream = null;
let previousImageData = null;

// Cropping variables
let isSelectingRegion = false;
let startX = 0;
let startY = 0;
let cropRegion = null;
let isDragging = false;

// Filter state
let isFilterEnabled = true;
let filterInsideRegion = true;
let sensitivity = 10;
let currentFilterType = 'noise';

// ASCII characters from darkest to lightest
const asciiChars = '@%#*+=-:. ';

// Convert RGB to brightness value (0-255)
function getBrightness(r, g, b) {
  return Math.floor((r + g + b) / 3);
}

// Convert brightness to ASCII character
function getAsciiChar(brightness) {
  const charIndex = Math.floor(brightness / 256 * asciiChars.length);
  return asciiChars[charIndex];
}

// Create ASCII art from image data
function createAsciiArt(imageData, x, y, width, height) {
  const charWidth = 6;
  const charHeight = 8;
  const cols = Math.floor(width / charWidth);
  const rows = Math.floor(height / charHeight);
  let asciiArt = '';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pixelX = x + (col * charWidth);
      const pixelY = y + (row * charHeight);
      const i = (pixelY * canvas.width + pixelX) * 4;
      
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      
      const brightness = getBrightness(r, g, b);
      asciiArt += getAsciiChar(brightness);
    }
    asciiArt += '\n';
  }

  return asciiArt;
}

// Update ASCII display
function updateAsciiDisplay(imageData, region) {
  if (currentFilterType !== 'ascii') {
    asciiOutput.style.display = 'none';
    return;
  }

  asciiOutput.style.display = 'block';
  const x = region ? region.x : 0;
  const y = region ? region.y : 0;
  const width = region ? region.width : canvas.width;
  const height = region ? region.height : canvas.height;
  
  const ascii = createAsciiArt(imageData, x, y, width, height);
  asciiOutput.style.left = `${x}px`;
  asciiOutput.style.top = `${y}px`;
  asciiOutput.textContent = ascii;
}

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

  const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const current = currentImageData.data;
  const prev = previousImageData.data;
  const next = newImageData.data;

  const threshold = (sensitivity / 100) * 255;

  // Clear ASCII output if not using ASCII filter
  if (currentFilterType !== 'ascii') {
    asciiOutput.style.display = 'none';
  }

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      
      const isInsideRegion = cropRegion && 
        x >= cropRegion.x && 
        x < cropRegion.x + cropRegion.width && 
        y >= cropRegion.y && 
        y < cropRegion.y + cropRegion.height;

      const shouldApplyFilter = filterInsideRegion ? isInsideRegion : !isInsideRegion;

      // Always update the non-filtered region with video data
      if (!shouldApplyFilter) {
        current[i] = next[i];
        current[i + 1] = next[i + 1];
        current[i + 2] = next[i + 2];
        current[i + 3] = next[i + 3];
        continue;
      }
      
      const diffR = Math.abs(next[i] - prev[i]);
      const diffG = Math.abs(next[i + 1] - prev[i + 1]);
      const diffB = Math.abs(next[i + 2] - prev[i + 2]);
      
      if (diffR > threshold || diffG > threshold || diffB > threshold) {
        if (isFilterEnabled) {
          if (currentFilterType === 'noise') {
            const pixel = getRandomPixel();
            current[i] = pixel[0];
            current[i + 1] = pixel[1];
            current[i + 2] = pixel[2];
            current[i + 3] = pixel[3];
          } else {
            // For ASCII, we'll just copy the video data and handle ASCII rendering separately
            current[i] = next[i];
            current[i + 1] = next[i + 1];
            current[i + 2] = next[i + 2];
            current[i + 3] = next[i + 3];
          }
        } else {
          current[i] = next[i];
          current[i + 1] = next[i + 1];
          current[i + 2] = next[i + 2];
          current[i + 3] = next[i + 3];
        }
      }
    }
  }

  ctx.putImageData(currentImageData, 0, 0);
  
  // Update ASCII display if needed
  if (currentFilterType === 'ascii' && isFilterEnabled) {
    const region = filterInsideRegion ? cropRegion : {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height
    };
    updateAsciiDisplay(currentImageData, region);
  }

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

      // Create temporary canvas at full size
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      // Draw the full video frame
      tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const newImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
      
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

// Add toggle filter handler
toggleFilterButton.addEventListener('click', () => {
  isFilterEnabled = !isFilterEnabled;
  toggleFilterButton.textContent = isFilterEnabled ? 'Disable Filter' : 'Enable Filter';
  
  // Regenerate noise if no capture is active
  if (!mediaStream) {
    generateNoise(cropRegion);
  }
});

// Add toggle region mode handler
toggleRegionModeButton.addEventListener('click', () => {
  filterInsideRegion = !filterInsideRegion;
  toggleRegionModeButton.textContent = filterInsideRegion ? 'Filter Inside Region' : 'Filter Outside Region';
  
  // Regenerate noise if no capture is active
  if (!mediaStream) {
    generateNoise();
  }
});

// Add toggle menu handler
toggleMenuButton.addEventListener('click', () => {
  controlsPanel.classList.toggle('hidden');
});

// Add filter type change handler
filterTypeSelect.addEventListener('change', (e) => {
  currentFilterType = e.target.value;
  if (!mediaStream) {
    generateNoise(cropRegion);
  }
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mediaStream) {
    stopCapture();
    startButton.textContent = 'Start Screen Capture';
  }
});

// Update sensitivity display
sensitivitySlider.addEventListener('input', (e) => {
  sensitivity = parseInt(e.target.value);
  sensitivityValue.textContent = `${sensitivity}%`;
});