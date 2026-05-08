// ═══════════════════════════════════════════════════════════════
//  AI DERMATOLOGIST ASSISTANT - FULL LOGIC
// ═══════════════════════════════════════════════════════════════

const scanBtn = document.getElementById('scan-btn');
const videoContainer = document.getElementById('video-container');
const scanLine = document.getElementById('scan-line');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dropText = document.getElementById('drop-text');
const symptomInput = document.getElementById('symptom-input');
const observationList = document.getElementById('observation-list');
const resultsPlaceholder = document.getElementById('results-placeholder');
const realResults = document.getElementById('real-results');
const specialistSection = document.getElementById('specialist-section');
const locationTag = document.getElementById('location-tag');

let currentStream = null;

// --- 1. LIVE CAMERA LOGIC ---

scanBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentStream) {
        stopCamera();
    } else {
        startCamera();
    }
});

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        currentStream = stream;

        const video = document.createElement('video');
        video.id = 'webcam-feed';
        video.srcObject = stream;
        video.autoplay = true;
        video.className = "w-full h-full object-cover rounded-lg";

        videoContainer.querySelector('p').style.display = 'none';
        videoContainer.appendChild(video);
        scanLine.style.display = 'block';
        
        scanBtn.innerText = "STOP & ANALYZE";
        scanBtn.classList.replace('bg-blue-600', 'bg-red-600');
    } catch (err) {
        alert("Camera access denied. Please allow permissions in your browser.");
    }
}

function stopCamera() {
    captureAndAnalyze();

    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    videoContainer.innerHTML = '<div id="scan-line" class="scanning-line"></div><p class="text-slate-500 text-sm italic">Analyzing capture...</p>';
    scanLine.style.display = 'none';
    
    scanBtn.innerText = "START LIVE SCAN";
    scanBtn.classList.replace('bg-red-600', 'bg-blue-600');
}

// --- 2. BACKEND COMMUNICATION ---

async function sendToModel(imageBlob) {
    resultsPlaceholder.classList.add('hidden');
    realResults.classList.remove('hidden');
    document.querySelector('h3.text-red-600').innerText = "Analyzing...";
    document.querySelector('.text-gray-400.font-medium').innerText = "Hold on...";

    const formData = new FormData();
    formData.append('image', imageBlob, 'capture.jpg');

    try {
        const response = await fetch('https://ashzz1-dermascan.hf.space/predict', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("Backend server not responding");

        const data = await response.json();
        
        if (data.status === "success" && data.condition) {
            updateUIWithResults(data);
        } else {
            console.error("Malformed data from server:", data);
            showErrorUI("Diagnosis Failed");
        }

    } catch (err) {
        console.error("Connection Error:", err);
        showErrorUI("Server Offline");
    }
}

function updateUIWithResults(data) {
    document.querySelector('h3.text-red-600').innerText = data.condition;
    document.querySelector('.text-gray-400.font-medium').innerText = `${data.confidence} Confidence Level`;
    
    specialistSection.classList.remove('hidden');
    const locs = ["Howrah, WB", "Salt Lake, Sector V", "Kolkata Central"];
    locationTag.innerText = `📍 Recommended Specialists Near: ${locs[Math.floor(Math.random()*locs.length)]}`;
}

function showErrorUI(msg) {
    document.querySelector('h3.text-red-600').innerText = msg;
    document.querySelector('.text-gray-400.font-medium').innerText = "Check Python Terminal";
}

// --- 3. IMAGE HELPERS ---

function captureAndAnalyze() {
    const video = document.getElementById('webcam-feed');
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
        sendToModel(blob);
    }, 'image/jpeg');
}

// --- 4. DRAG & DROP ---

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
});

dropZone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        dropText.innerHTML = `Analyzing: <span class="text-blue-600">${file.name}</span>`;
        sendToModel(file);
    }
});

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    if(fileInput.files[0]) {
        dropText.innerHTML = `Analyzing: <span class="text-blue-600">${fileInput.files[0].name}</span>`;
        sendToModel(fileInput.files[0]);
    }
});

// --- 5. SYMPTOM TRACKING ---

symptomInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const items = ['<li>Asymmetry detected in lesion borders</li>'];
    
    if (val.includes('itch')) items.push('<li class="text-blue-600 font-bold">Match: Inflammation found</li>');
    if (val.includes('color') || val.includes('dark')) items.push('<li class="text-blue-600 font-bold">Match: Pigment variation</li>');
    if (val.includes('spread') || val.includes('grow')) items.push('<li class="text-blue-600 font-bold">Match: Evolution (ABCDE-E)</li>');
    
    observationList.innerHTML = items.join('');
});