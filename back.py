from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
import pandas as pd
import joblib
from pathlib import Path


# ============================================================
# BASE DIRECTORY
# ============================================================

BASE_DIR = Path(__file__).resolve().parent


# ============================================================
# MODEL PATH
# ============================================================

MODEL_PATH = BASE_DIR / "crop_recommendation_model.pkl"


# ============================================================
# LOAD TRAINED MODEL
# ============================================================

try:
    model = joblib.load(MODEL_PATH)
    print("✅ Crop Recommendation Model Loaded Successfully")

except Exception as e:
    raise RuntimeError(
        f"❌ Error loading crop recommendation model: {str(e)}"
    )


# ============================================================
# CREATE FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AgriAI - Crop Recommendation API",
    description="AI-powered Crop Recommendation System",
    version="1.0.0"
)


# ============================================================
# STATIC FILES & TEMPLATES
# ============================================================

# If index.html is in the same folder as this Python file
app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR)),
    name="static"
)

templates = Jinja2Templates(
    directory=str(BASE_DIR)
)


# ============================================================
# CORS CONFIGURATION
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# INPUT DATA MODEL
# ============================================================

class CropInput(BaseModel):

    nitrogen: float = Field(
        ...,
        ge=0,
        description="Nitrogen value in soil"
    )

    phosphorus: float = Field(
        ...,
        ge=0,
        description="Phosphorus value in soil"
    )

    potassium: float = Field(
        ...,
        ge=0,
        description="Potassium value in soil"
    )

    temperature: float = Field(
        ...,
        ge=-10,
        le=60,
        description="Temperature in Celsius"
    )

    humidity: float = Field(
        ...,
        ge=0,
        le=100,
        description="Humidity percentage"
    )

    ph_value: float = Field(
        ...,
        ge=0,
        le=14,
        description="Soil pH value"
    )

    rainfall: float = Field(
        ...,
        ge=0,
        description="Rainfall in mm"
    )


# ============================================================
# CROP PROBABILITY RESPONSE MODEL
# ============================================================

class CropProbability(BaseModel):

    crop: str
    percentage: float


# ============================================================
# PREDICTION RESPONSE MODEL
# ============================================================

class PredictionResponse(BaseModel):

    recommended_crop: str

    confidence: float

    crop_probabilities: list[CropProbability]


# ============================================================
# HOME PAGE
# ============================================================

@app.get(
    "/",
    response_class=HTMLResponse
)
def home(request: Request):

    try:

        return templates.TemplateResponse(
            "index.html",
            {
                "request": request
            }
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Unable to load homepage: {str(e)}"
        )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "model": "Crop Recommendation Model",
        "model_loaded": model is not None
    }


# ============================================================
# MODEL INFORMATION
# ============================================================

@app.get("/model-info")
def model_info():

    try:

        model_type = type(model).__name__

        # Check whether probability prediction is available
        probability_supported = hasattr(
            model,
            "predict_proba"
        )

        # Get crop classes if available
        if hasattr(model, "classes_"):

            crops = [
                str(crop).title()
                for crop in model.classes_
            ]

        else:

            crops = []

        return {
            "model_type": model_type,
            "probability_supported": probability_supported,
            "number_of_crops": len(crops),
            "crops": crops
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Model information error: {str(e)}"
        )


# ============================================================
# CROP PREDICTION API
# ============================================================

@app.post(
    "/predict",
    response_model=PredictionResponse
)
def predict(data: CropInput):

    try:

        # ----------------------------------------------------
        # CREATE INPUT DATAFRAME
        # ----------------------------------------------------

        input_data = pd.DataFrame([
            {
                "Nitrogen": data.nitrogen,
                "Phosphorus": data.phosphorus,
                "Potassium": data.potassium,
                "Temperature": data.temperature,
                "Humidity": data.humidity,
                "pH_Value": data.ph_value,
                "Rainfall": data.rainfall
            }
        ])


        # ----------------------------------------------------
        # PREDICT CROP
        # ----------------------------------------------------

        prediction = model.predict(input_data)

        recommended_crop = str(
            prediction[0]
        ).title()


        # ----------------------------------------------------
        # CHECK PROBABILITY SUPPORT
        # ----------------------------------------------------

        if not hasattr(model, "predict_proba"):

            raise HTTPException(
                status_code=500,
                detail=(
                    "The trained model does not support "
                    "probability prediction. "
                    "Use a classifier with predict_proba() "
                    "or retrain the model."
                )
            )


        # ----------------------------------------------------
        # GET PROBABILITIES
        # ----------------------------------------------------

        probabilities = model.predict_proba(
            input_data
        )[0]


        # ----------------------------------------------------
        # GET CROP CLASS NAMES
        # ----------------------------------------------------

        if not hasattr(model, "classes_"):

            raise HTTPException(
                status_code=500,
                detail=(
                    "Model does not contain classes_. "
                    "Cannot map probabilities to crop names."
                )
            )


        classes = model.classes_


        # ----------------------------------------------------
        # CREATE CROP + PERCENTAGE LIST
        # ----------------------------------------------------

        crop_probabilities = []

        for crop, probability in zip(
            classes,
            probabilities
        ):

            percentage = float(
                probability * 100
            )

            crop_probabilities.append(
                {
                    "crop": str(crop).title(),
                    "percentage": round(
                        percentage,
                        2
                    )
                }
            )


        # ----------------------------------------------------
        # SORT CROPS BY PERCENTAGE
        # HIGHEST → LOWEST
        # ----------------------------------------------------

        crop_probabilities.sort(
            key=lambda x: x["percentage"],
            reverse=True
        )


        # ----------------------------------------------------
        # GET HIGHEST CONFIDENCE
        # ----------------------------------------------------

        confidence = crop_probabilities[0]["percentage"]


        # ----------------------------------------------------
        # RETURN RESPONSE
        # ----------------------------------------------------

        return PredictionResponse(

            recommended_crop=recommended_crop,

            confidence=confidence,

            crop_probabilities=crop_probabilities

        )


    except HTTPException:

        raise


    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction error: {str(e)}"
        )


# ============================================================
# TOP 5 CROPS ONLY
# ============================================================

@app.post("/predict/top")
def predict_top_crops(data: CropInput):

    try:

        # ----------------------------------------------------
        # INPUT DATA
        # ----------------------------------------------------

        input_data = pd.DataFrame([
            {
                "Nitrogen": data.nitrogen,
                "Phosphorus": data.phosphorus,
                "Potassium": data.potassium,
                "Temperature": data.temperature,
                "Humidity": data.humidity,
                "pH_Value": data.ph_value,
                "Rainfall": data.rainfall
            }
        ])


        # ----------------------------------------------------
        # CHECK MODEL
        # ----------------------------------------------------

        if not hasattr(model, "predict_proba"):

            raise HTTPException(
                status_code=500,
                detail="Model does not support predict_proba()."
            )


        if not hasattr(model, "classes_"):

            raise HTTPException(
                status_code=500,
                detail="Model does not contain classes_."
            )


        # ----------------------------------------------------
        # PROBABILITIES
        # ----------------------------------------------------

        probabilities = model.predict_proba(
            input_data
        )[0]


        classes = model.classes_


        # ----------------------------------------------------
        # CREATE LIST
        # ----------------------------------------------------

        crops = []

        for crop, probability in zip(
            classes,
            probabilities
        ):

            crops.append(
                {
                    "crop": str(crop).title(),
                    "percentage": round(
                        float(probability * 100),
                        2
                    )
                }
            )


        # ----------------------------------------------------
        # SORT
        # ----------------------------------------------------

        crops.sort(
            key=lambda x: x["percentage"],
            reverse=True
        )


        # ----------------------------------------------------
        # TOP 5
        # ----------------------------------------------------

        top_crops = crops[:5]


        return {
            "top_crops": top_crops
        }


    except HTTPException:

        raise


    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Top crop prediction error: {str(e)}"
        )


# ============================================================
# RUN INFORMATION
# ============================================================

@app.get("/api-info")
def api_info():

    return {

        "application": "AgriAI",

        "description": (
            "AI-powered crop recommendation "
            "based on soil and environmental data."
        ),

        "version": "1.0.0",

        "endpoints": {

            "home": "/",

            "health": "/health",

            "model_info": "/model-info",

            "prediction": "/predict",

            "top_crops": "/predict/top"

        },

        "input_features": [

            "Nitrogen",

            "Phosphorus",

            "Potassium",

            "Temperature",

            "Humidity",

            "pH_Value",

            "Rainfall"

        ]

    }