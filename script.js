

const API_URL = "http://127.0.0.1:8000";



const form = document.getElementById("predictionForm");



if (form) {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Get button
        const button = form.querySelector("button[type='submit']");

        // Save original button text
        const originalButtonText = button
            ? button.innerHTML
            : "Predict Crop";

        try {
                
            // Get Input Values
                

            const data = {
                nitrogen: parseFloat(
                    document.getElementById("nitrogen").value
                ),

                phosphorus: parseFloat(
                    document.getElementById("phosphorus").value
                ),

                potassium: parseFloat(
                    document.getElementById("potassium").value
                ),

                temperature: parseFloat(
                    document.getElementById("temperature").value
                ),

                humidity: parseFloat(
                    document.getElementById("humidity").value
                ),

                ph_value: parseFloat(
                    document.getElementById("ph_value").value
                ),

                rainfall: parseFloat(
                    document.getElementById("rainfall").value
                )
            };

                
            // Validate Inputs
                

            for (const key in data) {
                if (isNaN(data[key])) {
                    showError("Please enter valid values in all fields.");
                    return;
                }
            }

                
            // Loading State
                

            if (button) {
                button.disabled = true;
                button.innerHTML = "🌱 Predicting...";
            }

            showStatus("Analyzing soil and weather conditions...", "loading");

                
            // Send Request to FastAPI
                

            const response = await fetch(`${API_URL}/predict`, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(data)
            });

                
            // Get Response
                

            const result = await response.json();

                
            // Handle FastAPI Error
                

            if (!response.ok) {

                let errorMessage = "Prediction failed.";

                if (result.detail) {

                    if (Array.isArray(result.detail)) {
                        errorMessage = result.detail
                            .map(error => error.msg)
                            .join(", ");
                    } else {
                        errorMessage = result.detail;
                    }
                }

                throw new Error(errorMessage);
            }

                
            // Display Prediction
                

            displayPrediction(result);

            showStatus(
                "Prediction completed successfully.",
                "success"
            );

        } catch (error) {

            console.error("FastAPI Error:", error);

            showError(
                "Unable to connect to FastAPI.\n\n" +
                error.message +
                "\n\nMake sure FastAPI is running at:\n" +
                API_URL
            );

        } finally {

                
            // Reset Button
                

            if (button) {
                button.disabled = false;
                button.innerHTML = originalButtonText;
            }
        }
    });
}

       
// Display Prediction       

function displayPrediction(result) {

    // Recommended crop
    const resultElement = document.getElementById("result");

    if (resultElement) {
        resultElement.textContent =
            result.recommended_crop || "Unknown";
    }


        
    // Description
        

    const descriptionElement =
        document.getElementById("resultDescription");

    if (descriptionElement) {

        const crop = result.recommended_crop || "crop";

        descriptionElement.textContent =
            `${crop} is recommended based on the provided soil and environmental conditions.`;
    }


        
    // Confidence Percentage
        

    const confidenceBox =
        document.getElementById("confidenceBox");

    const confidenceElement =
        document.getElementById("confidence");

    if (
        confidenceElement &&
        result.confidence !== undefined &&
        result.confidence !== null
    ) {

        const confidence = Number(result.confidence);

        confidenceElement.textContent =
            `${confidence.toFixed(2)}%`;

        if (confidenceBox) {
            confidenceBox.style.display = "block";
        }
    }


        
    // Crop Probability List
        

    const probabilitySection =
        document.getElementById("cropProbabilitySection");

    const cropList =
        document.getElementById("cropList");

    if (
        probabilitySection &&
        cropList &&
        Array.isArray(result.crop_probabilities)
    ) {

        // Clear previous results
        cropList.innerHTML = "";

        // Sort highest probability first
        const probabilities =
            [...result.crop_probabilities].sort(
                (a, b) =>
                    Number(b.percentage) -
                    Number(a.percentage)
            );


            
        // Create Crop Probability Cards
            

        probabilities.forEach((item, index) => {

            const crop =
                item.crop || "Unknown";

            const percentage =
                Number(item.percentage) || 0;

            // Container
            const cropItem =
                document.createElement("div");

            cropItem.className = "crop-probability-item";


            // Header
            const header =
                document.createElement("div");

            header.className =
                "crop-probability-header";


            // Crop name
            const cropName =
                document.createElement("span");

            cropName.className =
                "crop-name";

            cropName.textContent =
                `${index + 1}. ${crop}`;


            // Percentage
            const percentageText =
                document.createElement("span");

            percentageText.className =
                "crop-percentage";

            percentageText.textContent =
                `${percentage.toFixed(2)}%`;


            header.appendChild(cropName);
            header.appendChild(percentageText);


            // Progress background
            const progress =
                document.createElement("div");

            progress.className =
                "progress";


            // Progress bar
            const progressBar =
                document.createElement("div");

            progressBar.className =
                "progress-bar";

            progressBar.style.width = "0%";


            progress.appendChild(progressBar);

            cropItem.appendChild(header);
            cropItem.appendChild(progress);

            cropList.appendChild(cropItem);


            // Animate progress bar
            setTimeout(() => {

                progressBar.style.width =
                    `${Math.min(percentage, 100)}%`;

            }, 100);
        });


        probabilitySection.style.display =
            "block";
    }


        
    // Show Result Section
        

    const resultContainer =
        document.getElementById("resultContainer");

    if (resultContainer) {
        resultContainer.style.display = "block";

        resultContainer.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}

       
// Show Error       

function showError(message) {

    console.error(message);

    const status =
        document.getElementById("status");

    if (status) {

        status.textContent =
            message;

        status.className =
            "status error";

        status.style.display =
            "block";
    } else {

        alert(message);
    }
}

       
// Show Status       

function showStatus(message, type) {

    const status =
        document.getElementById("status");

    if (!status) {
        return;
    }

    status.textContent =
        message;

    status.className =
        `status ${type}`;

    status.style.display =
        "block";
}

       
// Reset Form       

function resetPrediction() {

    if (form) {
        form.reset();
    }

    // Hide result
    const resultContainer =
        document.getElementById("resultContainer");

    if (resultContainer) {
        resultContainer.style.display =
            "none";
    }

    // Clear crop list
    const cropList =
        document.getElementById("cropList");

    if (cropList) {
        cropList.innerHTML = "";
    }

    // Hide confidence
    const confidenceBox =
        document.getElementById("confidenceBox");

    if (confidenceBox) {
        confidenceBox.style.display =
            "none";
    }

    // Hide probability section
    const probabilitySection =
        document.getElementById("cropProbabilitySection");

    if (probabilitySection) {
        probabilitySection.style.display =
            "none";
    }

    // Clear status
    const status =
        document.getElementById("status");

    if (status) {
        status.textContent = "";
        status.style.display = "none";
    }
}

       
// Check API Connection       

async function checkAPIConnection() {

    try {

        const response =
            await fetch(`${API_URL}/docs`);

        if (response.ok) {

            console.log(
                "✅ FastAPI connected:",
                API_URL
            );

        } else {

            console.warn(
                "⚠️ FastAPI responded with:",
                response.status
            );
        }

    } catch (error) {

        console.warn(
            "❌ FastAPI is not running:",
            API_URL
        );
    }
}

       
// Run API Check on Page Load       

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "🌱 CropAI frontend loaded"
        );

        console.log(
            "🔗 FastAPI:",
            API_URL
        );

        checkAPIConnection();
    }
);