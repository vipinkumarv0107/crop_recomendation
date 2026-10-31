/* =========================================================
   CropAI - script.js
   Connects the frontend to the backend deployed on Render
========================================================= */

// ---------- CONFIG ----------
const API_BASE_URL = "https://crop-recomendation-4.onrender.com";
const PREDICT_ENDPOINT = "/predict"; // change if your backend route is different
const REQUEST_TIMEOUT_MS = 60000;    // Render free tier can take ~50s to wake up

// ---------- DOM ELEMENTS ----------
const form = document.getElementById("predictionForm");
const predictButton = document.getElementById("predictButton");
const buttonText = document.getElementById("buttonText");
const errorMessage = document.getElementById("errorMessage");

const resultEl = document.getElementById("result");
const resultDescription = document.getElementById("resultDescription");
const confidenceBox = document.getElementById("confidenceBox");
const confidenceEl = document.getElementById("confidence");
const probabilitySection = document.getElementById("cropProbabilitySection");
const cropList = document.getElementById("cropList");

// ---------- HELPERS ----------
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
}

function hideError() {
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
}

function setLoading(isLoading, text) {
    predictButton.disabled = isLoading;
    buttonText.textContent = isLoading
        ? (text || "⏳ Analyzing...")
        : "🤖 Predict Best Crop";
}

function capitalize(str) {
    str = String(str);
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Convert 0-1 or 0-100 values to a 0-100 number
function toPercent(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return 0;
    return num <= 1 ? num * 100 : num;
}

// Turn many possible backend shapes into [{name, percent}, ...]
function normalizeProbabilities(data) {
    const raw =
        data.probabilities ||
        data.all_probabilities ||
        data.crop_probabilities ||
        data.top_predictions ||
        data.top_crops ||
        null;

    if (!raw) return [];

    let list = [];

    if (Array.isArray(raw)) {
        list = raw.map((item) => {
            if (Array.isArray(item)) {
                return { name: item[0], percent: toPercent(item[1]) };
            }
            return {
                name: item.crop || item.name || item.label,
                percent: toPercent(
                    item.probability ?? item.confidence ?? item.score ?? 0
                ),
            };
        });
    } else if (typeof raw === "object") {
        list = Object.entries(raw).map(([name, value]) => ({
            name,
            percent: toPercent(value),
        }));
    }

    return list
        .filter((c) => c.name)
        .sort((a, b) => b.percent - a.percent);
}

function renderProbabilities(list) {
    cropList.innerHTML = "";

    if (!list.length) {
        probabilitySection.style.display = "none";
        return;
    }

    list.slice(0, 5).forEach((crop) => {
        const item = document.createElement("div");
        item.className = "crop-item";

        item.innerHTML = `
            <div class="crop-info">
                <span class="crop-name">${capitalize(crop.name)}</span>
                <span class="crop-percent">${crop.percent.toFixed(1)}%</span>
            </div>
            <div class="progress-container">
                <div class="progress-bar"></div>
            </div>
        `;

        cropList.appendChild(item);

        // animate bar after it is in the DOM
        const bar = item.querySelector(".progress-bar");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                bar.style.width = `${Math.min(crop.percent, 100)}%`;
            });
        });
    });

    probabilitySection.style.display = "block";
}

// ---------- FORM SUBMIT ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError();

    const N = parseFloat(document.getElementById("nitrogen").value);
    const P = parseFloat(document.getElementById("phosphorus").value);
    const K = parseFloat(document.getElementById("potassium").value);
    const temperature = parseFloat(document.getElementById("temperature").value);
    const humidity = parseFloat(document.getElementById("humidity").value);
    const ph = parseFloat(document.getElementById("ph_value").value);
    const rainfall = parseFloat(document.getElementById("rainfall").value);

    if ([N, P, K, temperature, humidity, ph, rainfall].some(Number.isNaN)) {
        showError("Please fill in all fields with valid numbers.");
        return;
    }

    // Both naming styles are sent so it works with common backend schemas
    const payload = {
        N, P, K,
        nitrogen: N,
        phosphorus: P,
        potassium: K,
        temperature,
        humidity,
        ph,
        ph_value: ph,
        rainfall,
    };

    setLoading(true);
    resultEl.textContent = "Analyzing...";
    resultDescription.textContent =
        "Our AI model is analyzing your soil and weather data. " +
        "The first request may take up to a minute while the server wakes up.";
    confidenceBox.style.display = "none";
    probabilitySection.style.display = "none";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE_URL}${PREDICT_ENDPOINT}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            let detail = `Server error (${response.status})`;
            try {
                const err = await response.json();
                if (typeof err.detail === "string") {
                    detail = err.detail;
                } else if (Array.isArray(err.detail)) {
                    // FastAPI validation errors
                    detail = err.detail
                        .map((d) => `${(d.loc || []).slice(-1)[0]}: ${d.msg}`)
                        .join(", ");
                } else if (err.error || err.message) {
                    detail = err.error || err.message;
                }
            } catch (_) { /* ignore JSON parse errors */ }
            throw new Error(detail);
        }

        const data = await response.json();

        const crop =
            data.recommended_crop ||
            data.predicted_crop ||
            data.prediction ||
            data.crop ||
            data.result;

        if (!crop) {
            throw new Error("Unexpected response from server.");
        }

        resultEl.textContent = capitalize(crop);
        resultDescription.textContent =
            `Based on your soil nutrients and weather conditions, ` +
            `${capitalize(crop)} is the most suitable crop to grow.`;

        const probs = normalizeProbabilities(data);

        let confidence = data.confidence ?? data.probability ?? data.score;
        if (confidence === undefined && probs.length) {
            confidence = probs[0].percent;
        }

        if (confidence !== undefined) {
            confidenceEl.textContent = `${toPercent(confidence).toFixed(1)}%`;
            confidenceBox.style.display = "inline-block";
        }

        renderProbabilities(probs);
    } catch (error) {
        console.error("Prediction error:", error);

        resultEl.textContent = "Waiting for prediction...";
        resultDescription.textContent =
            "Enter your soil and weather details to discover the most suitable crop.";

        if (error.name === "AbortError") {
            showError("The server took too long to respond. Please try again.");
        } else if (error instanceof TypeError) {
            showError(
                "Could not reach the server. Check your internet connection " +
                "or try again in a moment."
            );
        } else {
            showError(error.message || "Something went wrong. Please try again.");
        }
    } finally {
        clearTimeout(timeoutId);
        setLoading(false);
    }
});

// ---------- WAKE UP RENDER SERVER ON PAGE LOAD ----------
// Render's free tier sleeps when idle; this pings it early.
fetch(`${API_BASE_URL}/`, { method: "GET" }).catch(() => {});
