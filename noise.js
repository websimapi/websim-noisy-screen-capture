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
let useAsciiFilter = false;
const asciiChars = ['@', '#', '8', '&', 'o', ':', '*', '.', ' '];

// ASCII settings
let asciiDetail = 8;
let useCustomAsciiColor = true;
let asciiColor = '#ffffff';
let asciiDetailSlider = document.getElementById('asciiDetail');
let asciiDetailValue = document.getElementById('asciiDetailValue');
let asciiColorPicker = document.getElementById('asciiColor');
let asciiSettings = document.querySelectorAll('.ascii-settings');
let asciiColorToggle = document.getElementById('asciiColorToggle');

// Rainbow effect settings
let useNoiseRainbow = false;
let useAsciiRainbow = false;
let rainbowHue = 0;
const RAINBOW_SPEED = 2; // Hue change per frame

// Generate random noise for a pixel with optional rainbow effect
function getRandomPixel() {
  const value = Math.random() > 0.5 ? 255 : 0;
  
  if (useNoiseRainbow) {
    if (value === 255) {
      // Convert HSL to RGB for white pixels
      const hue = (rainbowHue + Math.random() * 30) % 360;
      const [r, g, b] = hslToRgb(hue / 360, 1, 0.5);
      return [r, g, b, 255];
    } else {
      // Dark complementary color for black pixels
      const hue = ((rainbowHue + 180) + Math.random() * 30) % 360;
      const [r, g, b] = hslToRgb(hue / 360, 1, 0.2);
      return [r, g, b, 255];
    }
  }
  
  return [value, value, value, 255];
}

// HSL to RGB conversion function
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Update sensitivity display
sensitivitySlider.addEventListener('input', (e) => {
  sensitivity = parseInt(e.target.value);
  sensitivityValue.textContent = `${sensitivity}%`;
});

// Update ASCII detail display
asciiDetailSlider.addEventListener('input', (e) => {
  asciiDetail = parseInt(e.target.value);
  asciiDetailValue.textContent = `${asciiDetail}px`;
});

// Update ASCII color
asciiColorPicker.addEventListener('input', (e) => {
  asciiColor = e.target.value;
});

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

function getAsciiChar(brightness) {
  const index = Math.floor(brightness / 255 * (asciiChars.length - 1));
  return asciiChars[index];
}

// Update ASCII drawing to support rainbow effect
function drawAsciiPixel(ctx, x, y, char, originalColor) {
  if (useAsciiRainbow) {
    const hue = (rainbowHue + Math.random() * 30) % 360;
    const [r, g, b] = hslToRgb(hue / 360, 1, 0.5);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  } else if (useCustomAsciiColor) {
    ctx.fillStyle = asciiColor;
  } else {
    ctx.fillStyle = `rgb(${originalColor[0]}, ${originalColor[1]}, ${originalColor[2]})`;
  }
  ctx.font = `${asciiDetail}px monospace`;
  ctx.fillText(char, x, y);
}

// Compare pixels and update only changed pixels
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
  
  if (useAsciiFilter) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // First pass: Process noise filter region based on original video data
  for (let y = 0; y < canvas.height; y += asciiDetail) {
    for (let x = 0; x < canvas.width; x += asciiDetail) {
      const i = (y * canvas.width + x) * 4;
      
      const isInsideRegion = cropRegion && 
        x >= cropRegion.x && 
        x < cropRegion.x + cropRegion.width && 
        y >= cropRegion.y && 
        y < cropRegion.y + cropRegion.height;

      const shouldApplyFilter = filterInsideRegion ? isInsideRegion : !isInsideRegion;

      if (shouldApplyFilter) {
        const diffR = Math.abs(next[i] - prev[i]);
        const diffG = Math.abs(next[i + 1] - prev[i + 1]);
        const diffB = Math.abs(next[i + 2] - prev[i + 2]);
        
        if (diffR > threshold || diffG > threshold || diffB > threshold) {
          for (let by = 0; by < asciiDetail; by++) {
            for (let bx = 0; bx < asciiDetail; bx++) {
              const bi = ((y + by) * canvas.width + (x + bx)) * 4;
              if (bi < current.length) {
                const pixel = getRandomPixel();
                current[bi] = pixel[0];
                current[bi + 1] = pixel[1];
                current[bi + 2] = pixel[2];
                current[bi + 3] = pixel[3];
              }
            }
          }
        }
      }
    }
  }

  // Second pass: Process non-filtered regions
  for (let y = 0; y < canvas.height; y += asciiDetail) {
    for (let x = 0; x < canvas.width; x += asciiDetail) {
      const i = (y * canvas.width + x) * 4;
      
      const isInsideRegion = cropRegion && 
        x >= cropRegion.x && 
        x < cropRegion.x + cropRegion.width && 
        y >= cropRegion.y && 
        y < cropRegion.y + cropRegion.height;

      const shouldApplyFilter = filterInsideRegion ? isInsideRegion : !isInsideRegion;
      
      if (!shouldApplyFilter) {
        if (useAsciiFilter) {
          const brightness = (next[i] + next[i + 1] + next[i + 2]) / 3;
          const asciiChar = getAsciiChar(brightness);
          const originalColor = [next[i], next[i + 1], next[i + 2]];
          drawAsciiPixel(ctx, x, y, asciiChar, originalColor);
        } else {
          for (let by = 0; by < asciiDetail; by++) {
            for (let bx = 0; bx < asciiDetail; bx++) {
              const bi = ((y + by) * canvas.width + (x + bx)) * 4;
              if (bi < current.length) {
                current[bi] = next[bi];
                current[bi + 1] = next[bi + 1];
                current[bi + 2] = next[bi + 2];
                current[bi + 3] = next[bi + 3];
              }
            }
          }
        }
      }
    }
  }

  // Update the canvas with the final result
  if (!useAsciiFilter) {
    ctx.putImageData(currentImageData, 0, 0);
  } else {
    // For ASCII mode, update only the noise filter region with image data
    if (cropRegion) {
      const filterRegion = filterInsideRegion ? cropRegion : {
        x: 0,
        y: 0,
        width: canvas.width,
        height: canvas.height
      };
      
      const regionData = ctx.getImageData(
        filterRegion.x,
        filterRegion.y,
        filterRegion.width,
        filterRegion.height
      );
      
      for (let y = 0; y < filterRegion.height; y++) {
        for (let x = 0; x < filterRegion.width; x++) {
          const sourceIndex = ((filterRegion.y + y) * canvas.width + (filterRegion.x + x)) * 4;
          const targetIndex = (y * filterRegion.width + x) * 4;
          regionData.data[targetIndex] = current[sourceIndex];
          regionData.data[targetIndex + 1] = current[sourceIndex + 1];
          regionData.data[targetIndex + 2] = current[sourceIndex + 2];
          regionData.data[targetIndex + 3] = current[sourceIndex + 3];
        }
      }
      
      ctx.putImageData(regionData, filterRegion.x, filterRegion.y);
    }
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

      if (useNoiseRainbow || useAsciiRainbow) {
        rainbowHue = (rainbowHue + RAINBOW_SPEED) % 360;
      }

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

const toggleAsciiButton = document.getElementById('toggleAscii');
toggleAsciiButton.addEventListener('click', () => {
  useAsciiFilter = !useAsciiFilter;
  toggleAsciiButton.textContent = useAsciiFilter ? 'Disable ASCII' : 'Enable ASCII';
  
  // Toggle ASCII settings visibility
  asciiSettings.forEach(setting => {
    setting.classList.toggle('show', useAsciiFilter);
  });
  
  // Regenerate display if no capture is active
  if (!mediaStream) {
    generateNoise();
  }
});

// Add ASCII color toggle handler
asciiColorToggle.addEventListener('click', () => {
  useCustomAsciiColor = !useCustomAsciiColor;
  asciiColorToggle.textContent = useCustomAsciiColor ? 'Use Original Colors' : 'Use Custom Color';
  asciiColorPicker.style.display = useCustomAsciiColor ? 'block' : 'none';
  
  // Regenerate display if no capture is active
  if (!mediaStream) {
    generateNoise();
  }
});

// Add rainbow effect toggle buttons handlers
const toggleNoiseRainbowButton = document.getElementById('toggleNoiseRainbow');
const toggleAsciiRainbowButton = document.getElementById('toggleAsciiRainbow');

toggleNoiseRainbowButton.addEventListener('click', () => {
  useNoiseRainbow = !useNoiseRainbow;
  toggleNoiseRainbowButton.textContent = useNoiseRainbow ? 'Disable Noise Rainbow' : 'Enable Noise Rainbow';
  
  if (!mediaStream) {
    generateNoise();
  }
});

toggleAsciiRainbowButton.addEventListener('click', () => {
  useAsciiRainbow = !useAsciiRainbow;
  toggleAsciiRainbowButton.textContent = useAsciiRainbow ? 'Disable ASCII Rainbow' : 'Enable ASCII Rainbow';
  
  if (!mediaStream) {
    generateNoise();
  }
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mediaStream) {
    stopCapture();
    startButton.textContent = 'Start Screen Capture';
  }
});

// Initial noise generation
generateNoise();