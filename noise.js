let canvas = document.getElementById('noiseCanvas');
let ctx = canvas.getContext('2d');
let startButton = document.getElementById('startCapture');
let mediaStream = null;
let previousImageData = null;

// Set canvas size to window size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
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
function generateNoise() {
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const pixel = getRandomPixel();
    data[i] = pixel[0];     // R
    data[i + 1] = pixel[1]; // G
    data[i + 2] = pixel[2]; // B
    data[i + 3] = pixel[3]; // A
  }
  
  ctx.putImageData(imageData, 0, 0);
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

  for (let i = 0; i < current.length; i += 4) {
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

  ctx.putImageData(currentImageData, 0, 0);
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

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
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
    generateNoise(); // Reset to full noise
  }
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

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mediaStream) {
    stopCapture();
    startButton.textContent = 'Start Screen Capture';
  }
});